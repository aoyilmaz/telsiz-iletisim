'use strict';

var TILE_URL  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

var TYPE_CFG = {
  VHF:    { color: '#2ecc71', badge: 'badge-vhf'    },
  UHF:    { color: '#f39c12', badge: 'badge-uhf'    },
  DMR:    { color: '#3498db', badge: 'badge-dmr'    },
  C4FM:   { color: '#9b59b6', badge: 'badge-c4fm'   },
  NXDN:   { color: '#e74c3c', badge: 'badge-nxdn'   },
  'D-STAR': { color: '#e67e22', badge: 'badge-dstar' },
};

var map, markerCluster;
var allRelays    = [];
var markers      = {};
var userMarker   = null;
var userCircle   = null;
var nearestLines = [];
var urlParsed    = false;

var activeFilters = { type: 'all', search: '', radius: 0, country: '' };
var distanceMap   = {};

// ── Yardımcı ────────────────────────────────────────────────────────────────

function getConfig(relay) {
  if (relay.type === 'digital') return TYPE_CFG[relay.protocol] || TYPE_CFG.DMR;
  return TYPE_CFG[relay.band] || TYPE_CFG.VHF;
}

function typeCssClass(relay) {
  if (relay.type === 'digital') return (relay.protocol || 'DMR').toLowerCase().replace(/[^a-z]/g, '');
  return relay.band.toLowerCase();
}

function typeLabel(relay) {
  if (relay.type === 'digital') return relay.protocol || 'DMR';
  return relay.band;
}

function fmtFreq(n) { return n.toFixed(4); }

function haversine(lat1, lon1, lat2, lon2) {
  var R    = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
           + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
           * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km) {
  return km < 10 ? km.toFixed(1) + ' km' : Math.round(km) + ' km';
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { showToast('Kopyalandı: ' + text); });
  } else {
    var el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Kopyalandı: ' + text);
  }
}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._tmr);
  t._tmr = setTimeout(function() { t.classList.remove('visible'); }, 2600);
}

// ── İkon ────────────────────────────────────────────────────────────────────

function makeIcon(color) {
  var dot = '<div style="width:14px;height:14px;background:' + color
    + ';border:3px solid rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 0 10px '
    + color + '99;"></div>';
  return L.divIcon({ className: '', html: dot, iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -13] });
}

// ── Popup ────────────────────────────────────────────────────────────────────

function buildPopup(relay) {
  var c = getConfig(relay);

  function row(label, val, copyVal) {
    var v = copyVal
      ? '<span class="popup-value popup-copy" data-copy="' + copyVal + '" title="Kopyala">' + val + '</span>'
      : '<span class="popup-value">' + val + '</span>';
    return '<div class="popup-row"><span class="popup-label">' + label + '</span>' + v + '</div>';
  }

  var html = '<div class="popup-title">' + relay.name + '</div>';
  html += row('Dinleme (RX)',  fmtFreq(relay.listen_freq) + ' MHz', fmtFreq(relay.listen_freq) + ' MHz');
  html += row('Gönderme (TX)', fmtFreq(relay.send_freq)   + ' MHz', fmtFreq(relay.send_freq)   + ' MHz');
  html += row('Offset',        (relay.offset > 0 ? '+' : '') + relay.offset + ' MHz', null);
  if (relay.ctcss)       html += row('CTCSS', relay.ctcss + ' Hz', relay.ctcss + ' Hz');
  if (relay.protocol)    html += row('Protokol', relay.protocol, null);
  if (relay.timeslot)    html += row('Zaman Dilimi', relay.timeslot, null);
  if (relay.elevation_m) html += row('Rakım', relay.elevation_m + ' m', null);
  if (relay.operator)    html += row('Operatör', relay.operator, null);

  html += '<div class="popup-tags">'
    + '<span class="popup-badge" style="background:' + c.color + '22;color:' + c.color + '">' + relay.region + '</span>'
    + '<span class="popup-badge" style="background:' + c.color + '22;color:' + c.color + '">' + typeLabel(relay) + '</span>'
    + '</div>';

  if (relay.notes) html += '<div class="popup-notes">' + relay.notes + '</div>';

  html += '<div class="popup-actions">'
    + '<button class="popup-btn popup-share" data-id="' + relay.id + '">🔗 Paylaş</button>'
    + '</div>';

  return html;
}

// ── Sidebar öğesi ────────────────────────────────────────────────────────────

function buildSidebarItem(relay) {
  var c      = getConfig(relay);
  var cssKey = typeCssClass(relay);
  var tlabel = typeLabel(relay);

  var dist = distanceMap[relay.id];

  var el = document.createElement('div');
  el.className       = 'relay-item ' + cssKey + (dist !== undefined && dist <= 50 ? ' nearby' : '');
  el.dataset.id      = relay.id;
  el.dataset.type    = relay.type;
  el.dataset.search  = (relay.name + ' ' + relay.region).toLowerCase();

  el.innerHTML = ''
    + '<div class="relay-item-header">'
    +   '<span class="relay-item-name">' + relay.name + '</span>'
    +   '<span class="relay-badge ' + c.badge + '">' + tlabel + '</span>'
    + '</div>'
    + '<div class="relay-item-sub">'
    +   fmtFreq(relay.listen_freq) + ' MHz &middot; ' + relay.region
    +   (dist !== undefined ? ' &middot; <span class="dist-badge">' + fmtDist(dist) + '</span>' : '')
    + '</div>';

  el.addEventListener('click', function() {
    var m = markers[relay.id];
    if (!m) return;
    map.flyTo([relay.lat, relay.lon], 13, { duration: 1.2 });
    setTimeout(function() { m.openPopup(); }, 1350);
    document.querySelector('.sidebar').classList.remove('drawer-open');
  });

  return el;
}

// ── Filtre (birleşik) ────────────────────────────────────────────────────────

function applyFilters() {
  var userPos = userMarker ? userMarker.getLatLng() : null;
  var q       = activeFilters.search;
  var toAdd   = [];
  var visible = [];

  for (var i = 0; i < allRelays.length; i++) {
    var relay = allRelays[i];

    var passCountry = !activeFilters.country || relay.countryCode === activeFilters.country;
    var passType    = activeFilters.type === 'all' || relay.type === activeFilters.type;
    var passSearch  = !q || (relay.name + ' ' + relay.region).toLowerCase().indexOf(q) !== -1;
    var passDist    = !activeFilters.radius || !userPos
                    || haversine(userPos.lat, userPos.lng, relay.lat, relay.lon) <= activeFilters.radius;

    if (passCountry && passType && passSearch && passDist) {
      if (markers[relay.id]) toAdd.push(markers[relay.id]);
      visible.push(relay);
    }
  }

  markerCluster.clearLayers();
  markerCluster.addLayers(toAdd);
  renderSidebar(visible);
}

// ── Sidebar içerik oluştur ───────────────────────────────────────────────────

var MAX_SIDEBAR = 400;

function renderSidebar(relays) {
  var listEl = document.getElementById('relay-list');

  // Filtre yoksa sadece mesaj göster (5000+ DOM öğesi oluşturma)
  var noFilter = !activeFilters.country && !activeFilters.search
              && !activeFilters.radius && activeFilters.type === 'all';
  if (noFilter) {
    listEl.innerHTML = '<p class="info-msg">Haritada kümeye tıklayın veya listeden ülke seçin.</p>';
    buildCityDropdown([]);
    return;
  }

  // Mesafeye göre sırala (konum alındıysa)
  if (Object.keys(distanceMap).length > 0) {
    relays = relays.slice().sort(function(a, b) {
      var da = distanceMap[a.id] !== undefined ? distanceMap[a.id] : Infinity;
      var db = distanceMap[b.id] !== undefined ? distanceMap[b.id] : Infinity;
      return da - db;
    });
  }

  listEl.innerHTML = '';
  var shown = relays.slice(0, MAX_SIDEBAR);
  for (var i = 0; i < shown.length; i++) {
    listEl.appendChild(buildSidebarItem(shown[i]));
  }
  if (relays.length > MAX_SIDEBAR) {
    var p = document.createElement('p');
    p.className = 'info-msg';
    p.textContent = '+ ' + (relays.length - MAX_SIDEBAR) + ' daha var. Filtre ile daraltın.';
    listEl.appendChild(p);
  }
  buildCityDropdown(relays);
}

// ── Tüm röleler: haritaya yükle (sidebar yok) ───────────────────────────────

function initAllRelays(relays) {
  markerCluster.clearLayers();
  Object.keys(markers).forEach(function(id) { delete markers[id]; });
  allRelays = relays;

  var toAdd = [];
  for (var i = 0; i < allRelays.length; i++) {
    var relay = allRelays[i];
    var c     = getConfig(relay);
    var m     = L.marker([relay.lat, relay.lon], {
      icon:        makeIcon(c.color),
      title:       relay.name,
      riseOnHover: true,
    });
    m.bindPopup(buildPopup(relay), { maxWidth: 300 });

    m.on('popupopen', function(e) {
      var pEl = e.popup.getElement();
      if (!pEl) return;
      pEl.querySelectorAll('.popup-copy').forEach(function(span) {
        span.onclick = function() { copyText(this.dataset.copy); };
      });
      var shareBtn = pEl.querySelector('.popup-share');
      if (shareBtn) {
        shareBtn.onclick = function() { copyText(buildShareUrl(this.dataset.id)); };
      }
    });

    markers[relay.id] = m;
    toAdd.push(m);
  }
  markerCluster.addLayers(toAdd);
  applyFilters(); // initial render

  if (!urlParsed) { urlParsed = true; parseShareUrl(); }
}

// ── Ülke filtresi uygula + haritada uç ──────────────────────────────────────

function setCountryFilter(code) {
  activeFilters.country = code;
  activeFilters.type    = 'all';
  activeFilters.search  = '';
  distanceMap = {};

  var searchEl = document.getElementById('search-input');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  var allBtn = document.querySelector('.filter-btn[data-filter="all"]');
  if (allBtn) allBtn.classList.add('active');
  document.getElementById('select-city').innerHTML = '<option value="">Tüm Şehirler</option>';
  document.getElementById('radius-filter').style.display = 'none';
  activeFilters.radius = 0;

  applyFilters();

  if (code) {
    var cb = allRelays.filter(function(r) { return r.countryCode === code; });
    if (cb.length > 0) {
      var bounds = L.latLngBounds(cb.map(function(r) { return [r.lat, r.lon]; }));
      map.flyToBounds(bounds.pad(0.15), { duration: 1.2, maxZoom: 9 });
    }
  } else {
    map.flyTo([20, 0], 2, { duration: 1.5 });
  }
}

// ── Şehir dropdown ───────────────────────────────────────────────────────────

function buildCityDropdown(relays) {
  var citySet = {};
  relays.forEach(function(r) {
    var parts = r.region.split('-');
    var city  = (parts[parts.length - 1] || r.region).trim();
    if (city) citySet[city] = true;
  });
  var cities = Object.keys(citySet).sort();
  var sel = document.getElementById('select-city');
  if (!sel) return;
  sel.innerHTML = '<option value="">Tüm Şehirler</option>';
  cities.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

function showListError(html) {
  document.getElementById('relay-list').innerHTML = '<p class="error-msg">' + html + '</p>';
}

// ── URL paylaşımı ────────────────────────────────────────────────────────────

function buildShareUrl(relayId) {
  return window.location.origin + window.location.pathname + '?relay=' + encodeURIComponent(relayId);
}

function parseShareUrl() {
  try {
    var relayId = new URLSearchParams(window.location.search).get('relay');
    if (!relayId) return;
    var relay = null;
    for (var i = 0; i < allRelays.length; i++) {
      if (allRelays[i].id === relayId) { relay = allRelays[i]; break; }
    }
    if (!relay) return;
    setTimeout(function() {
      map.flyTo([relay.lat, relay.lon], 14, { duration: 1.5 });
      setTimeout(function() { markers[relay.id] && markers[relay.id].openPopup(); }, 1700);
    }, 400);
  } catch(e) {}
}

// ── Kullanıcı konumu ─────────────────────────────────────────────────────────

function showNearby(lat, lon, accuracy) {
  nearestLines.forEach(function(l) { map.removeLayer(l); });
  nearestLines = [];

  if (userMarker) { map.removeLayer(userMarker); map.removeLayer(userCircle); }

  userMarker = L.marker([lat, lon], {
    icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
    zIndexOffset: 1000,
  }).bindPopup('<strong>Konumunuz</strong>').addTo(map);

  userCircle = L.circle([lat, lon], {
    radius:      Math.min(accuracy || 500, 5000),
    color:       '#4a90d9', fillColor: '#4a90d9', fillOpacity: 0.08, weight: 1,
  }).addTo(map);

  var withDist = allRelays.map(function(r) {
    return { relay: r, dist: haversine(lat, lon, r.lat, r.lon) };
  }).sort(function(a, b) { return a.dist - b.dist; });

  // distanceMap güncelle → renderSidebar bu sıralamayı kullanacak
  distanceMap = {};
  withDist.forEach(function(wd) { distanceMap[wd.relay.id] = wd.dist; });

  // En yakın 3 röleye kesik çizgi
  for (var i = 0; i < Math.min(3, withDist.length); i++) {
    var r    = withDist[i].relay;
    var line = L.polyline([[lat, lon], [r.lat, r.lon]], {
      color: '#4a90d9', weight: 1.5, opacity: 0.55, dashArray: '5, 7',
    }).addTo(map);
    line.bindTooltip(fmtDist(withDist[i].dist), {
      permanent: true, direction: 'center', className: 'dist-tooltip',
    });
    nearestLines.push(line);
  }

  // Yarıçap filtresi: slider değerini uygula
  activeFilters.radius = parseInt(document.getElementById('radius-slider').value, 10);
  document.getElementById('radius-filter').style.display = '';
  applyFilters();

  // Harita: kullanıcı + en yakın 5
  var bounds = [[lat, lon]];
  for (var k = 0; k < Math.min(5, withDist.length); k++) {
    bounds.push([withDist[k].relay.lat, withDist[k].relay.lon]);
  }
  map.flyToBounds(L.latLngBounds(bounds).pad(0.3), { duration: 1.5 });

  if (withDist[0]) {
    setTimeout(function() { markers[withDist[0].relay.id] && markers[withDist[0].relay.id].openPopup(); }, 1800);
  }
}

function locateUser() {
  if (!navigator.geolocation) { alert('Tarayıcınız konum servisini desteklemiyor.'); return; }
  var btn = document.getElementById('btn-locate');
  btn.disabled = true;
  btn.textContent = '📍 Alınıyor…';

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      btn.disabled = false;
      btn.textContent = '📍 Konumum';
      showNearby(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    },
    function(err) {
      btn.disabled = false;
      btn.textContent = '📍 Konumum';
      var msgs = { 1: 'Konum izni reddedildi.', 2: 'Konum alınamadı.', 3: 'Zaman aşımı.' };
      alert(msgs[err.code] || 'Konum hatası.');
    },
    { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false }
  );
}

// ── Offline bilgi ────────────────────────────────────────────────────────────

function showOfflineInfo() {
  alert('Harita parçaları, haritayı gezinirken otomatik olarak cihazınıza kaydedilir.\n\n'
    + 'Çevrimdışı erişmek istediğiniz bölgeyi şimdi haritada kaydırın ve yakınlaştırın.');
}

// ── Bağlantı durumu ──────────────────────────────────────────────────────────

function updateStatus() {
  var dot  = document.getElementById('status-dot');
  var text = document.getElementById('status-text');
  if (!dot || !text) return;
  dot.className    = navigator.onLine ? 'status-dot online'  : 'status-dot offline';
  text.textContent = navigator.onLine ? 'Çevrimiçi' : 'Çevrimdışı';
}

// ── Acil frekans verileri ────────────────────────────────────────────────────

var ACIL_FREQS = [
  {
    name: 'Türkiye Simplex',
    freqs: [
      { freq: '145.500', label: 'VHF Çağrı',    desc: 'Ulusal VHF acil çağrı kanalı' },
      { freq: '433.500', label: 'UHF Çağrı',    desc: 'Ulusal UHF acil çağrı kanalı' },
      { freq: '145.300', label: 'VHF Kanal 2',  desc: 'Alternatif VHF simplex' },
      { freq: '433.450', label: 'UHF Kanal 2',  desc: 'Alternatif UHF simplex' },
    ]
  },
  {
    name: 'APRS & Uydu',
    freqs: [
      { freq: '144.800', label: 'APRS Avrupa',    desc: 'Otomatik paket raporlama' },
      { freq: '144.390', label: 'APRS K.Amerika', desc: 'Kuzey Amerika APRS' },
      { freq: '145.800', label: 'ISS Downlink',   desc: 'Uzay İstasyonu – VHF' },
      { freq: '437.800', label: 'ISS Uplink',     desc: 'Uzay İstasyonu – UHF' },
    ]
  },
  {
    name: 'Havacılık & Denizcilik',
    freqs: [
      { freq: '121.500', label: 'Hava Acil',  desc: 'Uluslararası havacılık acil (AM)' },
      { freq: '156.800', label: 'Deniz Ch16', desc: 'Uluslararası deniz acil çağrı' },
      { freq: '156.300', label: 'Deniz Ch6',  desc: 'Gemi–gemi güvenlik kanalı' },
    ]
  },
  {
    name: 'HF Kısa Dalga',
    freqs: [
      { freq: '14.300', label: 'IARU Uluslararası', desc: 'Küresel amatör HF acil kanalı' },
      { freq: '7.110',  label: 'HF Bölgesel',       desc: 'Bölgesel afet koordinasyonu' },
      { freq: '3.760',  label: 'Avrupa 80m',         desc: 'Avrupa bölgesel acil kanal' },
      { freq: '7.060',  label: 'Dijital Acil',       desc: 'JS8Call / Winlink HF acil' },
    ]
  }
];

var AFET_PROTOKOLU = {
  signals: [
    { word: 'MAYDAY',      desc: 'Hayati tehlike — 3 kez tekrar edilir' },
    { word: 'PAN PAN',     desc: 'Acil durum — hayat tehlikesi yok' },
    { word: 'SECURITE',    desc: 'Güvenlik uyarısı — seyrüsefer tehlikesi' },
    { word: 'BREAK BREAK', desc: 'Acil iletişim için kanalı boşaltın' },
  ],
  phases: [
    {
      num: 1, color: '#2ecc71', icon: '📋', title: 'Hazırlık',
      steps: [
        'Telsizi tam şarjlı tutun, yedek batarya bulundurun',
        'Yerel röle frekanslarını hafızaya kaydedin (CHIRP)',
        'CTCSS tonlarını ve offsetleri önceden programlayın',
        'Düzenli olarak acil kanalları dinleyin (145.500 MHz)',
      ]
    },
    {
      num: 2, color: '#f39c12', icon: '📡', title: 'İlk Temas: Simplex',
      steps: [
        '145.500 MHz (VHF) veya 433.500 MHz (UHF) açın',
        'Squelch\'i en düşük seviyeye indirin',
        '"[Çağrı işareti], acil, konum [yer], alıyor musunuz?" deyin',
        '5–10 sn dinleyin; yanıt yoksa 3 kez tekrarlayın',
      ]
    },
    {
      num: 3, color: '#3498db', icon: '🔄', title: 'Röle Kullan',
      steps: [
        'Bu haritadan en yakın röleyi bulun',
        'CTCSS tonunu ve offseti doğru girin',
        'PTT\'ye basınca rölenin "açılma" sesini bekleyin',
        'Mesajı kısa tutun: konum, durum, ihtiyaç',
      ]
    },
    {
      num: 4, color: '#9b59b6', icon: '📦', title: 'APRS / Veri',
      steps: [
        '144.800 MHz üzerinden konum raporunu yayınlayın',
        'APRS paketi: çağrı işareti / GPS koordinatı / durum',
        'İnternet olmadan yerel APRS ağı üzerinden iletilir',
        'aprs.fi veya YAAC ile konumunuzu izleyin',
      ]
    },
    {
      num: 5, color: '#e74c3c', icon: '🌐', title: 'Dijital & HF',
      steps: [
        'DMR / C4FM rölelerine geçin; kapsama alanı daha geniş',
        'HF 14.300 MHz: iyonosfer yansımasıyla kıtalararası iletişim',
        'JS8Call: –24 dB SNR\'de bile veri aktarımı yapılır',
        'Meshtastic / LoRa: internet yokken yerel mesh ağı kurun',
      ]
    },
  ]
};

// ── Frekans paneli ────────────────────────────────────────────────────────────

function renderFreqs() {
  var el = document.getElementById('tab-freqs');
  if (!el) return;
  var html = '<p class="freq-copy-hint">Frekansa tıklayarak panoya kopyalayın</p>';
  for (var i = 0; i < ACIL_FREQS.length; i++) {
    var cat = ACIL_FREQS[i];
    html += '<div class="freq-category">'
      + '<div class="freq-category-title">' + cat.name + '</div>'
      + '<div class="freq-grid">';
    for (var j = 0; j < cat.freqs.length; j++) {
      var f = cat.freqs[j];
      html += '<div class="freq-card" data-copy="' + f.freq + ' MHz" title="Kopyala: ' + f.freq + ' MHz">'
        + '<span class="freq-value">' + f.freq + ' MHz</span>'
        + '<span class="freq-label">' + f.label + '</span>'
        + '<span class="freq-desc">' + f.desc + '</span>'
        + '</div>';
    }
    html += '</div></div>';
  }
  el.innerHTML = html;
  el.querySelectorAll('.freq-card').forEach(function(card) {
    card.addEventListener('click', function() { copyText(this.dataset.copy); });
  });
}

// ── Protokol paneli ───────────────────────────────────────────────────────────

function renderProtocol() {
  var el = document.getElementById('tab-protocol');
  if (!el) return;
  var html = '<p class="protocol-section-title">Acil Çağrı Sinyalleri</p>'
           + '<div class="protocol-signals">';
  for (var i = 0; i < AFET_PROTOKOLU.signals.length; i++) {
    var s = AFET_PROTOKOLU.signals[i];
    html += '<div class="signal-card">'
      + '<span class="signal-word">' + s.word + '</span>'
      + '<span class="signal-desc">' + s.desc + '</span>'
      + '</div>';
  }
  html += '</div><p class="protocol-section-title">İletişim Aşamaları</p>';
  for (var j = 0; j < AFET_PROTOKOLU.phases.length; j++) {
    var p = AFET_PROTOKOLU.phases[j];
    html += '<div class="protocol-phase">'
      + '<div class="phase-header">'
      + '<div class="phase-num" style="background:' + p.color + '">' + p.num + '</div>'
      + '<span class="phase-title">' + p.icon + ' ' + p.title + '</span>'
      + '</div><div class="phase-steps">';
    for (var k = 0; k < p.steps.length; k++) {
      html += '<div class="phase-step">' + p.steps[k] + '</div>';
    }
    html += '</div></div>';
  }
  el.innerHTML = html;
}

// ── Eğitim rehberi ────────────────────────────────────────────────────────────

function renderTraining(data) {
  if (!data) return;
  var el = document.getElementById('tab-guide');
  if (!el) return;
  var html = '<p class="training-subtitle">Hedef Röle: <strong>' + data.target_relay + '</strong></p>';
  for (var i = 0; i < data.steps.length; i++) {
    var s    = data.steps[i];
    var desc = s.description
      .replace(/(\d{3}\.\d{3,4})\s*MHz/g, '<code>$1 MHz</code>')
      .replace(/(\d{2,3}(?:\.\d+)?)\s*Hz/g,  '<code>$1 Hz</code>')
      .replace(/(00\.600)/g,                  '<code>$1</code>')
      .replace(/Menü\s+(\d+)/g,               'Menü <strong>$1</strong>');
    html += '<div class="step-card">'
      + '<div class="step-num">' + s.step + '</div>'
      + '<div class="step-content"><h3>' + s.title + '</h3><p>' + desc + '</p></div>'
      + '</div>';
  }
  el.innerHTML = html;
}


// ── Ana başlatma ─────────────────────────────────────────────────────────────

function init() {
  map = L.map('map', { zoomControl: true });
  map.setView([39.0, 35.0], 6);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

  // Marker clustering
  markerCluster = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 60, spiderfyOnMaxZoom: true })
    : L.layerGroup();
  markerCluster.addTo(map);

  // Dünya verisi yükle (world.json); hata durumunda yalnızca TR
  var listEl = document.getElementById('relay-list');
  listEl.innerHTML = '<p class="info-msg">Veriler yükleniyor…</p>';
  map.setView([20, 0], 2);

  fetch('./data/world.json')
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(d) {
      initAllRelays(d.relays);
    })
    .catch(function() {
      // Fallback: yalnızca Türkiye
      fetch('./data/TR.json')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          d.relays.forEach(function(r) { r.countryCode = 'TR'; });
          initAllRelays(d.relays);
          setCountryFilter('TR');
        })
        .catch(function(e) {
          listEl.innerHTML = '<p class="error-msg">Veri yüklenemedi: ' + e.message + '</p>';
        });
    });

  // Eğitim rehberi (TR.json'dan)
  fetch('./data/TR.json')
    .then(function(r) { return r.json(); })
    .then(function(d) { renderTraining(d.baofeng_programming); })
    .catch(function() {});

  // Ülke seçici
  document.getElementById('select-country').addEventListener('change', function() {
    urlParsed = true;
    setCountryFilter(this.value);
  });

  // Filtre butonları
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      activeFilters.type = this.dataset.filter;
      applyFilters();
    });
  });

  // Arama
  document.getElementById('search-input').addEventListener('input', function() {
    activeFilters.search = this.value.toLowerCase();
    document.getElementById('select-city').value = '';
    applyFilters();
  });

  // Şehir seçici
  document.getElementById('select-city').addEventListener('change', function() {
    var city = this.value;
    activeFilters.search = city.toLowerCase();
    document.getElementById('search-input').value = city;
    applyFilters();
    if (city) {
      var filtered = allRelays.filter(function(r) {
        return r.region.toLowerCase().indexOf(city.toLowerCase()) !== -1;
      });
      if (filtered.length > 0) {
        map.flyToBounds(L.latLngBounds(filtered.map(function(r) { return [r.lat, r.lon]; })).pad(0.3), { duration: 1.2 });
      }
    }
  });

  // Yarıçap slider
  document.getElementById('radius-slider').addEventListener('input', function() {
    var val = parseInt(this.value, 10);
    document.getElementById('radius-label').textContent = val + ' km';
    activeFilters.radius = val;
    applyFilters();
  });
  document.getElementById('btn-radius-reset').addEventListener('click', function() {
    activeFilters.radius = 0;
    document.getElementById('radius-filter').style.display = 'none';
    applyFilters();
  });

  // Konum
  document.getElementById('btn-locate').addEventListener('click', locateUser);

  // Referans modalı
  var modal = document.getElementById('training-modal');
  document.getElementById('btn-training').addEventListener('click', function() { modal.classList.add('active'); });
  document.getElementById('modal-close').addEventListener('click', function() { modal.classList.remove('active'); });
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.remove('active'); });

  // Tab geçişi
  document.querySelectorAll('.modal-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var target = this.dataset.tab;
      document.querySelectorAll('.modal-body').forEach(function(body) {
        body.style.display = body.id === target ? '' : 'none';
      });
    });
  });

  // Panelleri önceden doldur
  renderFreqs();
  renderProtocol();

  // Offline
  document.getElementById('btn-offline').addEventListener('click', showOfflineInfo);

  // Mobil drawer
  document.getElementById('btn-mobile-list').addEventListener('click', function() {
    document.querySelector('.sidebar').classList.toggle('drawer-open');
  });
  // Haritaya tıklayınca drawer'ı kapat
  map.on('click', function() {
    document.querySelector('.sidebar').classList.remove('drawer-open');
  });

  // Bağlantı
  updateStatus();
  window.addEventListener('online',  updateStatus);
  window.addEventListener('offline', updateStatus);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(function(e) { console.warn('SW:', e.message); });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
