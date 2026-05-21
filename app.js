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

// ── TYT TH-9800 ve CHIRP rehber verileri ─────────────────────────────────────

var TYT_GUIDE = {
  target_relay: 'Gaziantep UHF – 439.400 MHz / –7.600 / 88.5 Hz',
  steps: [
    { step: 1, title: 'VFO Modunu Aç',
      description: 'Ana bant kadranını VFO konumuna getirin. Ekranda frekans rakamlarının değiştirmeye hazır olduğunu görün.' },
    { step: 2, title: 'Frekansı Gir',
      description: 'Dinleme frekansını tuşlayın. Gaziantep UHF için 439.400 değerini girin.' },
    { step: 3, title: 'Menü 31 – Ton Modu',
      description: 'Menü 31 (TONE M) adımından tonlama şeklini "CTCSS" olarak seçin. Squelch\'i açık tutacak alt sesi aktive eder.' },
    { step: 4, title: 'Menü 30 – CTCSS Frekansı',
      description: 'Menü 30 (TONE F) adımından 88.5 Hz değerini seçin. PTT\'ye basıldığında bu ton otomatik iletilir.' },
    { step: 5, title: 'Çapraz Bant Tekrarlayıcı',
      description: 'V+U modunu etkinleştirin. Cihaz, el telsizinden gelen UHF sinyali alıp 50 Watt ile VHF üzerinden röleye aktarır.' },
  ]
};

var CHIRP_GUIDE = {
  target_relay: 'Tüm Röle Hafıza Kanalları',
  steps: [
    { step: 1, title: 'Kabloyu Bağla',
      description: 'K-Type USB programlama kablosunu telsizin mikrofon jakına ve bilgisayara takın. Windows sürücüyü otomatik yükler.' },
    { step: 2, title: 'Radyodan İndir',
      description: 'CHIRP\'te Radio → Download from Radio. Cihaz modelini seçin. Mevcut hafıza kanalları tablo halinde gösterilir.' },
    { step: 3, title: 'Kanalları Düzenle',
      description: 'Her satır bir kanal. Name (GZT-VHF), Frequency (145.675), Offset (–0.600), CTCSS Tone (88.5) alanlarını doldurun.' },
    { step: 4, title: 'Radyoya Yükle',
      description: 'Radio → Upload to Radio. Tüm kanallar saniyeler içinde EPROM\'a kalıcı yazılır. Artık hafıza modunda gezebilirsiniz.' },
  ]
};

// ── Q Kodları verileri ────────────────────────────────────────────────────────

var Q_KODLARI = [
  { code: 'QRZ',  meaning: 'Kim çağırıyor?',       usage: '"QRZ?" → bu frekansı kim çağırıyor?' },
  { code: 'QTH',  meaning: 'Bulunduğun yer',        usage: '"QTH İstanbul" → bulunduğum yer' },
  { code: 'QSL',  meaning: 'Anlaşıldı / Alındı',    usage: '"QSL" → mesajı aldım, onaylıyorum' },
  { code: 'QRM',  meaning: 'Yapay parazit',          usage: '"QRM var" → başka istasyon karışıyor' },
  { code: 'QRN',  meaning: 'Atmosferik gürültü',     usage: '"QRN çok" → statik gürültü yüksek' },
  { code: 'QSY',  meaning: 'Frekans değiştir',       usage: '"QSY 145.500" → şu frekansa geçelim' },
  { code: 'QRB',  meaning: 'Aramızdaki mesafe',      usage: '"QRB?" → aremizdeki uzaklık kaç km?' },
  { code: 'QSP',  meaning: 'İleteceğim (köprü)',     usage: '"QSP edeceğim" → mesajı aktaracağım' },
  { code: 'QRT',  meaning: 'Yayını kesiyorum',       usage: '"QRT" → kapanıyorum, yayın bitiyor' },
  { code: 'QRX',  meaning: 'Bekleyin',               usage: '"QRX 5 dk" → 5 dakika sonra döneceğim' },
  { code: 'QRV',  meaning: 'Hazırım',                usage: '"QRV" → dinliyorum, iletişime hazırım' },
  { code: 'QSO',  meaning: 'İletişim / Görüşme',     usage: '"QSO kuruyorum" → seninle iletişimdeyim' },
  { code: 'QTR',  meaning: 'Saat kaç?',              usage: '"QTR?" → şu an yerel saat nedir?' },
  { code: 'QRP',  meaning: 'Gücü azalt',             usage: '"QRP yapıyorum" → düşük güce geçiyorum' },
  { code: 'QRO',  meaning: 'Gücü artır',             usage: '"QRO yap" → çıkış gücünü artır' },
  { code: 'QAP',  meaning: 'Dinlemeye devam et',     usage: '"QAP" → frekansı dinlemeye devam edin' },
  { code: '73',   meaning: 'İyi dilekler',            usage: '"73" → görüşmek üzere, esenlikler' },
  { code: '88',   meaning: 'Sevgi ve öpücük',         usage: '"88" → aile ve yakın dostlara selamlama' },
];

// ── Mesh & Dijital teknoloji verileri ─────────────────────────────────────────

var MESH_TEKNOLOJILER = [
  {
    name: 'Meshtastic', icon: '📡', color: '#2ecc71', band: 'LoRa 433 / 868 MHz',
    desc: 'ESP32 tabanlı açık kaynak mesh ağı. GPS konum paylaşımı ve mesajlaşma. 10–40 km kapsama, internet gerektirmez.',
    key: 'Python API: pip install meshtastic. ESP32 deep sleep ile pil ömrü optimize edilir.'
  },
  {
    name: 'APRS', icon: '📦', color: '#f39c12', band: '144.800 MHz (TR/EU)',
    desc: 'Otomatik Paket Raporlama. 1200 baud AFSK, AX.25 protokolü. GPS konum, hava ve telemetri verisi iletir.',
    key: 'Direwolf ile ses kartından TNC olmadan çalıştırılabilir. aprs.fi üzerinden izlenir.'
  },
  {
    name: 'Reticulum', icon: '🔐', color: '#3498db', band: 'LoRa / Wi-Fi / Seri',
    desc: 'Kriptografik, sunucusuz ağ yığını. Kimlikler şifreleme anahtarıdır. DNS / DHCP gerektirmez.',
    key: 'pip install rns. LoRa, Wi-Fi veya ses modem üzerinde; Sideband ile şifreli mesaj.'
  },
  {
    name: 'JS8Call', icon: '📶', color: '#9b59b6', band: 'HF 7 – 14 MHz',
    desc: 'Zayıf sinyal mesajlaşma modu. –24 dB SNR\'de veri aktarımı. İyonosfer yansımasıyla kıtalararası.',
    key: 'pyjs8call API ile headless sunucu olarak çalıştırılabilir; Reticulum köprüsü kurulur.'
  },
  {
    name: 'Briar', icon: '🛡️', color: '#e74c3c', band: 'Bluetooth / Wi-Fi / Tor',
    desc: 'Afet ve otoriter rejim senaryoları için mesajlaşma. Tor, BT ve Wi-Fi üzerinden çalışır. Merkezi sunucu yok.',
    key: 'QR kod ile anahtar değişimi (MITM imkansız). İnternet olmadan BT mesh üzerinden iletir.'
  },
  {
    name: 'Yggdrasil', icon: '🌿', color: '#27ae60', band: 'IP ağ katmanı',
    desc: 'Kendi kendini yapılandıran IPv6 mesh ağı. Kriptografik kimlikler. LAN ve Wi-Fi üzerinde çalışır.',
    key: 'yggdrasil -autoconf ile başlar; multicast ile yerel cihazları otomatik keşfeder.'
  },
];

// ── Eğitim müfredatı verileri ─────────────────────────────────────────────────

var EGITIM_MODULLER = [
  {
    num: 1, color: '#2ecc71', icon: '⚖️', title: 'Radyo Hukuku & Teori',
    topics: [
      { title: 'KEGM Lisans Sınavı',
        desc: 'Yılda 2 kez; 50 soru × 2 puan. A/B sınıfı için %75 (38+ doğru), C sınıfı için %60 (30+ doğru) geçme notu.' },
      { title: 'Yetkinlik Sınıfları',
        desc: 'A/B: tüm bantlar ve yüksek çıkış gücü. C: sınırlı bant ve çıkış gücü yetkisi.' },
      { title: 'Frekans Bantları',
        desc: 'HF: iyonosfer (skywave) ile 1000+ km. VHF: line-of-sight + troposfer. UHF: bina içi penetrasyon.' },
      { title: 'Fonetik Alfabe & Q Kodları',
        desc: 'Alpha-Bravo-Charlie… standardı. Q kodları kısa ve net bilgi aktarımı için uluslararası kısaltmalar.' },
    ]
  },
  {
    num: 2, color: '#f39c12', icon: '📡', title: 'Anten Teorisi & Saha Kurulumu',
    topics: [
      { title: 'Anten Boy Hesabı',
        desc: 'λ/4 (çeyrek dalga) = 75 / f(MHz) metre. 145 MHz VHF için ≈ 0.52 m, 433 MHz UHF için ≈ 0.17 m.' },
      { title: 'SWR & Empedans Eşleşmesi',
        desc: 'SWR < 1.5 ideal. NanoVNA ile ölçüm. Uyumsuz anten güç kaybına ve PA hasarına yol açar.' },
      { title: 'Anten Tipleri',
        desc: 'Dipol: her yön. Yagi: yönlü yüksek kazanç. Ground plane: taşınabilir omni. Manyetik taban: araç.' },
      { title: 'Programlama & CHIRP',
        desc: 'USB kablo → Radio > Download → tabloyu doldur → Upload. Tüm şehir röleleri dakikada hafızaya alınır.' },
    ]
  },
  {
    num: 3, color: '#3498db', icon: '📦', title: 'Paket Radyo & AX.25',
    topics: [
      { title: 'AFSK Modülasyon',
        desc: '1200 baud. "1" biti = 1200 Hz (Mark), "0" biti = 2200 Hz (Space) ses frekansı olarak iletilir.' },
      { title: 'AX.25 Protokolü',
        desc: 'OSI Katman 2. Çağrı işareti adresleme, NRZI kodlama, CRC hata denetimi, bit stuffing içerir.' },
      { title: 'Direwolf TNC',
        desc: 'Ses kartı tabanlı yazılım TNC. sudo apt install direwolf ile kurulur, donanım gerektirmez.' },
      { title: 'Python ile AX.25',
        desc: 'aprs3, aioax25, pyham_ax25 kütüphaneleri. APRS paketi ayrıştırma, gönderme ve IGate işlemleri.' },
    ]
  },
  {
    num: 4, color: '#9b59b6', icon: '📻', title: 'Yazılım Tanımlı Radyo (SDR)',
    topics: [
      { title: 'SDR Donanımları',
        desc: 'RTL-SDR (~$20): geniş bant izleme. HackRF (~$300): TX+RX. ADALM PlutoSDR: I/Q yüksek hız.' },
      { title: 'GNU Radio Akış Tasarımı',
        desc: 'Görsel blok diyagramı ile filtre, demodülatör ve kod çözücü zincirleri oluşturulur.' },
      { title: 'ADS-B & Havacılık Telemetri',
        desc: 'Uçakların 1090 MHz transponder sinyali alınır; konum haritada gerçek zamanlı izlenir.' },
      { title: 'Kurulum',
        desc: 'libiio + SoapySDR → GNU Radio veya Gqrx. RTL-SDR için rtl-sdr paketi yeterli.' },
    ]
  },
  {
    num: 5, color: '#e74c3c', icon: '🌐', title: 'Mesh & Kriptografik Ağlar',
    topics: [
      { title: 'Meshtastic Kurulumu',
        desc: 'ESP32 + LoRa SX1276. Python API: SerialInterface().sendText("test"). Deep sleep duty cycling.' },
      { title: 'Reticulum (RNS)',
        desc: 'pip install rns. rns.Interface ile LoRa/Wi-Fi köprüsü. Sideband ile şifreli mobil mesaj.' },
      { title: 'Briar & Bramble',
        desc: 'GPL-3.0 Android uygulaması. BT + Wi-Fi + Tor katmanları. QR kod ile güvenli el sıkışma.' },
      { title: 'Yggdrasil Mesh',
        desc: 'yggdrasil -autoconf ile otomatik IPv6 mesh. HJSON konfigürasyonu ile güvenilir arayüzler tanımlanır.' },
    ]
  },
];

// ── NATO Fonetik Alfabe ───────────────────────────────────────────────────────

var NATO_ALFABE = [
  {l:'A',w:'Alpha'},   {l:'B',w:'Bravo'},    {l:'C',w:'Charlie'}, {l:'D',w:'Delta'},
  {l:'E',w:'Echo'},    {l:'F',w:'Foxtrot'},  {l:'G',w:'Golf'},    {l:'H',w:'Hotel'},
  {l:'I',w:'India'},   {l:'J',w:'Juliet'},   {l:'K',w:'Kilo'},    {l:'L',w:'Lima'},
  {l:'M',w:'Mike'},    {l:'N',w:'November'}, {l:'O',w:'Oscar'},   {l:'P',w:'Papa'},
  {l:'Q',w:'Quebec'},  {l:'R',w:'Romeo'},    {l:'S',w:'Sierra'},  {l:'T',w:'Tango'},
  {l:'U',w:'Uniform'}, {l:'V',w:'Victor'},   {l:'W',w:'Whiskey'}, {l:'X',w:'X-ray'},
  {l:'Y',w:'Yankee'},  {l:'Z',w:'Zulu'},
];

// ── DMR Codeplug rehberi ──────────────────────────────────────────────────────

var DMR_GUIDE = {
  target_relay: 'Mersin İnsu DMR – 439.238 MHz / TS-2',
  steps: [
    { step: 1, title: 'Kanal Tipini Seç',
      description: 'Cihazı DMR moduna alın. Yeni kanal oluştururken Channel Type: Digital seçin.' },
    { step: 2, title: 'Color Code (CC)',
      description: 'Rölenin Color Code değerini girin — Türkiye\'de genellikle CC1. CTCSS yerine DMR\'de renk kodu kullanılır.' },
    { step: 3, title: 'Time Slot (TS)',
      description: 'Zaman dilimini seçin: TS-1 yerel trafik, TS-2 geniş ağ bağlantısı. Türkiye röleleri çoğunlukla TS-2 kullanır.' },
    { step: 4, title: 'Talk Group (TG)',
      description: 'TG 286 Türkiye ulusal, TG 2860 bölgesel. Acil haberleşme için TG 9112 (uluslararası TAC acil).' },
    { step: 5, title: 'CPS Yazılımı',
      description: 'CHIRP DMR desteklemez. Cihaza özgü CPS (Customer Programming Software) kullanın; üreticinin sitesinden ücretsiz indirilir.' },
  ]
};

// ── Afet senaryoları ──────────────────────────────────────────────────────────

var AFET_SENARYOLAR = [
  {
    title: 'Deprem', icon: '🏚️', color: '#e74c3c',
    steps: [
      'Sarsıntı bitince güvenli alana çık, telsizi hemen aç',
      'UHF 433.500 MHz dene — beton/enkaz içinde VHF\'den iyi nüfuz eder',
      'CTCSS tonsuz çağır; röle hasarlı olabilir, simplex da dene',
      '145.500 MHz simplex: röle yoksa simplex hayat kurtarır',
      'APRS 144.800 MHz: GPS konumunu otomatik yayınla',
    ]
  },
  {
    title: 'Sel / Taşkın', icon: '🌊', color: '#3498db',
    steps: [
      'Yüksek zemine çık; telsizi su geçirmez korumaya al',
      'VHF tercih et — açık su yüzeyi VHF için idealdir',
      'Kıyıda: 156.800 MHz (Deniz Ch16) uluslararası acil kanalı',
      'Yerel röle ile tahliye güzergahlarını koordine et',
      'PTT\'ye kısa bas (3–5 sn); uzun iletim pili tüketir',
    ]
  },
  {
    title: 'Kentsel', icon: '🏙️', color: '#9b59b6',
    steps: [
      'Bina yoğunluğunda UHF (433 MHz) ön planda tut',
      'Röleyi bu haritadan bul; CTCSS tonunu girmeden PTT\'ye basma',
      'DMR/C4FM röle varsa kullan — kanal kalabalığı yaratmaz',
      'Kanal doluysa "BREAK BREAK" de ve 5 sn bekle',
      'Sinyal zayıfsa yüksek kata ya da bina dışına çık',
    ]
  },
  {
    title: 'Kırsal / Dağlık', icon: '⛰️', color: '#2ecc71',
    steps: [
      'Line-of-sight baskın: VHF (145 MHz) ilk tercih',
      'Her 10 m rakım ≈ 4 km ekstra menzil; en yüksek noktaya çık',
      'Röleye ulaşamazsan simplex: dağlarda 20–50 km mümkün',
      'HF düşün: 7.110 MHz bölgesel, 14.300 MHz uluslararası',
      'Anteni dik tut; yatay polarizasyon kaybına yol açar',
    ]
  },
];

// ── Simplex & APRS harita noktaları ──────────────────────────────────────────

var SIMPLEX_APRS = [
  {id:'sx-ist', type:'simplex', name:'İstanbul – Simplex',  lat:41.015, lon:28.980, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-ank', type:'simplex', name:'Ankara – Simplex',    lat:39.925, lon:32.865, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-izm', type:'simplex', name:'İzmir – Simplex',     lat:38.420, lon:27.130, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-brs', type:'simplex', name:'Bursa – Simplex',     lat:40.200, lon:29.060, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-ada', type:'simplex', name:'Adana – Simplex',     lat:37.010, lon:35.330, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-gaz', type:'simplex', name:'Gaziantep – Simplex', lat:37.065, lon:37.380, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-ant', type:'simplex', name:'Antalya – Simplex',   lat:36.897, lon:30.713, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'sx-tra', type:'simplex', name:'Trabzon – Simplex',   lat:41.005, lon:39.725, freq:'145.500 / 433.500', note:'VHF+UHF ulusal çağrı kanalları'},
  {id:'aprs-ist', type:'aprs', name:'İstanbul – APRS',  lat:41.060, lon:29.020, freq:'144.800', note:'APRS ağ bölgesi · aprs.fi üzerinden izle'},
  {id:'aprs-ank', type:'aprs', name:'Ankara – APRS',    lat:39.950, lon:32.840, freq:'144.800', note:'APRS ağ bölgesi · aprs.fi üzerinden izle'},
  {id:'aprs-izm', type:'aprs', name:'İzmir – APRS',     lat:38.450, lon:27.160, freq:'144.800', note:'APRS ağ bölgesi · aprs.fi üzerinden izle'},
  {id:'aprs-ada', type:'aprs', name:'Adana – APRS',     lat:37.025, lon:35.310, freq:'144.800', note:'APRS ağ bölgesi · aprs.fi üzerinden izle'},
  {id:'aprs-gaz', type:'aprs', name:'Gaziantep – APRS', lat:37.080, lon:37.400, freq:'144.800', note:'APRS ağ bölgesi · aprs.fi üzerinden izle'},
];

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

  html += '<p class="protocol-section-title" style="margin-top:18px">Senaryo Bazlı Protokoller</p>'
        + '<div class="scenario-grid">';
  for (var s = 0; s < AFET_SENARYOLAR.length; s++) {
    var sc = AFET_SENARYOLAR[s];
    html += '<div class="scenario-card" style="border-left-color:' + sc.color + '">'
      + '<div class="scenario-header">'
      + '<span style="font-size:18px">' + sc.icon + '</span>'
      + '<span class="scenario-title">' + sc.title + '</span>'
      + '</div>';
    for (var t = 0; t < sc.steps.length; t++) {
      html += '<div class="scenario-step">' + sc.steps[t] + '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ── Eğitim rehberi ────────────────────────────────────────────────────────────

function buildStepCards(steps, transformDesc) {
  var html = '';
  for (var i = 0; i < steps.length; i++) {
    var s    = steps[i];
    var desc = transformDesc ? transformDesc(s.description) : s.description;
    html += '<div class="step-card">'
      + '<div class="step-num">' + s.step + '</div>'
      + '<div class="step-content"><h3>' + s.title + '</h3><p>' + desc + '</p></div>'
      + '</div>';
  }
  return html;
}

function renderTraining(data) {
  var el = document.getElementById('tab-guide');
  if (!el) return;
  var html = '';

  if (data) {
    html += '<p class="protocol-section-title">📻 Baofeng UV-5R – Manuel Programlama</p>'
          + '<p class="training-subtitle">Hedef Röle: <strong>' + data.target_relay + '</strong></p>';
    html += buildStepCards(data.steps, function(d) {
      return d
        .replace(/(\d{3}\.\d{3,4})\s*MHz/g, '<code>$1 MHz</code>')
        .replace(/(\d{2,3}(?:\.\d+)?)\s*Hz/g, '<code>$1 Hz</code>')
        .replace(/(00\.600)/g, '<code>$1</code>')
        .replace(/Menü\s+(\d+)/g, 'Menü <strong>$1</strong>');
    });
  }

  html += '<p class="protocol-section-title" style="margin-top:18px">📡 TYT TH-9800 – Mobil İstasyon</p>'
        + '<p class="training-subtitle">Hedef Röle: <strong>' + TYT_GUIDE.target_relay + '</strong></p>';
  html += buildStepCards(TYT_GUIDE.steps, function(d) {
    return d.replace(/Menü\s+(\d+)/g, 'Menü <strong>$1</strong>');
  });

  html += '<p class="protocol-section-title" style="margin-top:18px">💻 CHIRP – Toplu Programlama</p>'
        + '<p class="training-subtitle">Hedef: <strong>' + CHIRP_GUIDE.target_relay + '</strong></p>';
  html += buildStepCards(CHIRP_GUIDE.steps, null);

  html += '<p class="protocol-section-title" style="margin-top:18px">📶 DMR Codeplug Programlama</p>'
        + '<p class="training-subtitle">Hedef Röle: <strong>' + DMR_GUIDE.target_relay + '</strong></p>';
  html += buildStepCards(DMR_GUIDE.steps, null);

  el.innerHTML = html;
}

// ── Q Kodları paneli ─────────────────────────────────────────────────────────

function renderQCodes() {
  var el = document.getElementById('tab-qcodes');
  if (!el) return;
  var html = '<p class="freq-copy-hint">Koda tıklayarak panoya kopyalayın</p><div class="qcode-grid">';
  for (var i = 0; i < Q_KODLARI.length; i++) {
    var q = Q_KODLARI[i];
    html += '<div class="qcode-card" data-copy="' + q.code + '" title="Kopyala: ' + q.code + '">'
      + '<span class="qcode-code">' + q.code + '</span>'
      + '<span class="qcode-meaning">' + q.meaning + '</span>'
      + '<span class="freq-desc">' + q.usage + '</span>'
      + '</div>';
  }
  html += '</div>';

  html += '<p class="protocol-section-title" style="margin-top:18px">NATO Fonetik Alfabe</p>'
        + '<p class="freq-copy-hint">Harfe tıklayarak fonetik adı kopyalayın</p>'
        + '<div class="nato-grid">';
  for (var j = 0; j < NATO_ALFABE.length; j++) {
    var n = NATO_ALFABE[j];
    html += '<div class="nato-card" data-copy="' + n.w + '" title="Kopyala: ' + n.w + '">'
      + '<span class="nato-letter">' + n.l + '</span>'
      + '<span class="nato-word">' + n.w + '</span>'
      + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
  el.querySelectorAll('.qcode-card, .nato-card').forEach(function(card) {
    card.addEventListener('click', function() { copyText(this.dataset.copy); });
  });
}

// ── Mesh & Dijital paneli ────────────────────────────────────────────────────

function renderMesh() {
  var el = document.getElementById('tab-mesh');
  if (!el) return;
  var html = '<div class="mesh-grid">';
  for (var i = 0; i < MESH_TEKNOLOJILER.length; i++) {
    var t = MESH_TEKNOLOJILER[i];
    html += '<div class="mesh-card">'
      + '<div class="mesh-card-header" style="border-left-color:' + t.color + '">'
      + '<span class="mesh-icon">' + t.icon + '</span>'
      + '<div><span class="mesh-name">' + t.name + '</span>'
      + '<span class="mesh-band">' + t.band + '</span></div>'
      + '</div>'
      + '<p class="mesh-desc">' + t.desc + '</p>'
      + '<p class="mesh-key">' + t.key + '</p>'
      + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ── Eğitim müfredatı paneli ──────────────────────────────────────────────────

function renderEgitim() {
  var el = document.getElementById('tab-egitim');
  if (!el) return;
  var html = '';
  for (var i = 0; i < EGITIM_MODULLER.length; i++) {
    var m = EGITIM_MODULLER[i];
    html += '<details class="edu-module"' + (i === 0 ? ' open' : '') + '>'
      + '<summary class="edu-module-header">'
      + '<div class="phase-num" style="background:' + m.color + '">' + m.num + '</div>'
      + '<span class="edu-module-title">' + m.icon + ' ' + m.title + '</span>'
      + '</summary><div class="edu-topics">';
    for (var j = 0; j < m.topics.length; j++) {
      var topic = m.topics[j];
      html += '<div class="edu-topic">'
        + '<span class="edu-topic-title">' + topic.title + '</span>'
        + '<span class="edu-topic-desc">' + topic.desc + '</span>'
        + '</div>';
    }
    html += '</div></details>';
  }
  el.innerHTML = html;
}


// ── Simplex & APRS harita katmanı ────────────────────────────────────────────

var specialLayer       = null;
var specialLayerActive = false;

function makeSpecialIcon(color) {
  var d = '<div style="width:11px;height:11px;background:' + color
    + ';border:2px solid rgba(255,255,255,.9);border-radius:2px;'
    + 'box-shadow:0 0 7px ' + color + ';transform:rotate(45deg)"></div>';
  return L.divIcon({ className:'', html:d, iconSize:[11,11], iconAnchor:[5,5], popupAnchor:[0,-10] });
}

function initSpecialLayers() {
  specialLayer = L.layerGroup();
  for (var i = 0; i < SIMPLEX_APRS.length; i++) {
    var pt    = SIMPLEX_APRS[i];
    var color = pt.type === 'aprs' ? '#c39bd3' : '#5dade2';
    var typeLabel = pt.type === 'aprs' ? 'APRS Dijipeater Bölgesi' : 'VHF / UHF Simplex';
    var popup = '<div class="popup-title">' + pt.name + '</div>'
      + '<div class="popup-row"><span class="popup-label">Tip</span>'
      + '<span class="popup-value">' + typeLabel + '</span></div>'
      + '<div class="popup-row"><span class="popup-label">Frekans</span>'
      + '<span class="popup-value popup-copy" data-copy="' + pt.freq + ' MHz">' + pt.freq + ' MHz</span></div>'
      + '<div class="popup-notes">' + pt.note + '</div>';
    (function(p) {
      var m = L.marker([p.lat, p.lon], { icon: makeSpecialIcon(color), title: p.name });
      m.bindPopup(popup, { maxWidth: 260 });
      m.on('popupopen', function(e) {
        e.popup.getElement().querySelectorAll('.popup-copy').forEach(function(span) {
          span.onclick = function() { copyText(this.dataset.copy); };
        });
      });
      specialLayer.addLayer(m);
    })(pt);
  }
}

function toggleSpecialLayer() {
  var btn = document.getElementById('btn-layer-special');
  if (specialLayerActive) {
    map.removeLayer(specialLayer);
    specialLayerActive = false;
    if (btn) btn.classList.remove('active');
  } else {
    specialLayer.addTo(map);
    specialLayerActive = true;
    if (btn) btn.classList.add('active');
  }
}

// ── Frekans / Offset Hesaplayıcı ─────────────────────────────────────────────

var CTCSS_TONES = [67.0,71.9,74.4,77.0,79.7,82.5,85.4,88.5,91.5,94.8,97.4,100.0,
  103.5,107.2,110.9,114.8,118.8,123.0,127.3,131.8,136.5,141.3,146.2,151.4,
  156.7,162.2,167.9,173.8,179.9,186.2,192.8,203.5,210.7,218.1,225.7,233.6,241.8,250.3];

function renderHesap() {
  var el = document.getElementById('tab-hesap');
  if (!el) return;
  var opts = CTCSS_TONES.map(function(t) {
    return '<option value="' + t + '"' + (t === 88.5 ? ' selected' : '') + '>' + t + ' Hz</option>';
  }).join('');

  el.innerHTML =
    '<div class="calc-section">'
    + '<label class="calc-label">Dinleme Frekansı (Röle TX / RX)</label>'
    + '<div class="calc-input-row">'
    + '<input type="number" id="calc-freq" class="calc-input" placeholder="ör. 145.675" step="0.025" min="130" max="450">'
    + '<span class="calc-unit">MHz</span></div>'
    + '<label class="calc-label">CTCSS Tonu</label>'
    + '<select id="calc-ctcss" class="calc-input"><option value="">— Ton yok —</option>' + opts + '</select>'
    + '<button id="calc-btn" class="btn btn-primary" style="width:100%;margin-top:14px">Hesapla</button>'
    + '</div>'
    + '<div class="calc-result" id="calc-result" style="display:none">'
    + '<div class="calc-res-band" id="calc-res-band"></div>'
    + '<div class="calc-res-row"><span class="calc-res-label">Dinleme (RX)</span>'
    + '<span class="calc-res-val popup-copy" id="calc-rx" title="Kopyala"></span></div>'
    + '<div class="calc-res-row"><span class="calc-res-label">Gönderme (TX)</span>'
    + '<span class="calc-res-val popup-copy" id="calc-tx" title="Kopyala"></span></div>'
    + '<div class="calc-res-row"><span class="calc-res-label">Offset</span>'
    + '<span class="calc-res-val" id="calc-offset"></span></div>'
    + '<div class="calc-res-row" id="calc-tone-row"><span class="calc-res-label">CTCSS</span>'
    + '<span class="calc-res-val popup-copy" id="calc-tone" title="Kopyala"></span></div>'
    + '<div class="calc-copy-all">'
    + '<button class="btn btn-secondary calc-copy-btn" id="calc-copy-chirp">💾 CHIRP formatında kopyala</button>'
    + '</div></div>';

  document.getElementById('calc-btn').addEventListener('click', function() {
    var freq = parseFloat(document.getElementById('calc-freq').value);
    if (isNaN(freq) || freq < 130 || freq > 450) {
      showToast('Geçerli frekans girin (130–450 MHz)');
      return;
    }
    var offset, bandLabel;
    if (freq >= 144 && freq < 148)      { offset = -0.600; bandLabel = 'VHF · 144–148 MHz · Offset –0.600'; }
    else if (freq >= 430 && freq < 440) { offset = -7.600; bandLabel = 'UHF · 430–440 MHz · Offset –7.600'; }
    else { showToast('Standart VHF (144–148) veya UHF (430–440) aralığı dışında'); return; }

    var tx    = Math.round((freq + offset) * 10000) / 10000;
    var ctcss = document.getElementById('calc-ctcss').value;

    document.getElementById('calc-res-band').textContent = bandLabel;
    var rxEl = document.getElementById('calc-rx');
    rxEl.textContent = freq.toFixed(4) + ' MHz';
    rxEl.dataset.copy = freq.toFixed(4) + ' MHz';
    var txEl = document.getElementById('calc-tx');
    txEl.textContent = tx.toFixed(4) + ' MHz';
    txEl.dataset.copy = tx.toFixed(4) + ' MHz';
    document.getElementById('calc-offset').textContent = offset + ' MHz';

    var toneRow = document.getElementById('calc-tone-row');
    if (ctcss) {
      var toneEl = document.getElementById('calc-tone');
      toneEl.textContent = ctcss + ' Hz';
      toneEl.dataset.copy = ctcss + ' Hz';
      toneRow.style.display = '';
    } else { toneRow.style.display = 'none'; }

    var offDir  = offset < 0 ? '-' : '+';
    var offAbs  = Math.abs(offset).toFixed(3);
    var chirp   = 'Röle,' + freq.toFixed(4) + ',' + offDir + ',' + offAbs + ','
                + (ctcss ? 'Tone' : '') + ',' + (ctcss || '88.5') + ','
                + (ctcss || '88.5') + ',023,NN,FM,5.00,,,,,,';
    document.getElementById('calc-copy-chirp').onclick = function() { copyText(chirp); };

    var res = document.getElementById('calc-result');
    res.style.display = '';
    res.querySelectorAll('.popup-copy').forEach(function(sp) {
      sp.onclick = function() { copyText(this.dataset.copy); };
    });
  });
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

  // Referans paneli
  var refPanel  = document.getElementById('ref-panel');
  var btnRef    = document.getElementById('btn-training');
  function openRefPanel()  { refPanel.classList.add('open');    btnRef.textContent = '🗺️ Harita'; }
  function closeRefPanel() { refPanel.classList.remove('open'); btnRef.textContent = '📻 Rehber'; }

  btnRef.addEventListener('click', function() {
    refPanel.classList.contains('open') ? closeRefPanel() : openRefPanel();
  });
  document.getElementById('ref-panel-close').addEventListener('click', closeRefPanel);

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
  renderQCodes();
  renderMesh();
  renderEgitim();
  renderHesap();

  // Simplex / APRS katmanı
  initSpecialLayers();
  document.getElementById('btn-layer-special').addEventListener('click', toggleSpecialLayer);

  // Offline
  document.getElementById('btn-offline').addEventListener('click', showOfflineInfo);

  // Mobil drawer
  document.getElementById('btn-mobile-list').addEventListener('click', function() {
    document.querySelector('.sidebar').classList.toggle('drawer-open');
  });
  // Haritaya tıklayınca sidebar drawer'ı kapat (referans panel kapatılmaz — map altında zaten)
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
