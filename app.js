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

var activeFilters = { type: 'all', search: '', radius: 0 };

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

  var el = document.createElement('div');
  el.className       = 'relay-item ' + cssKey;
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
  markerCluster.clearLayers();
  var userPos = userMarker ? userMarker.getLatLng() : null;
  var toAdd   = [];
  var items   = document.querySelectorAll('.relay-item');

  for (var i = 0; i < items.length; i++) {
    var el    = items[i];
    var relay = null;
    for (var j = 0; j < allRelays.length; j++) {
      if (allRelays[j].id === el.dataset.id) { relay = allRelays[j]; break; }
    }
    if (!relay) continue;

    var passType   = activeFilters.type === 'all' || relay.type === activeFilters.type;
    var passSearch = !activeFilters.search
                  || (el.dataset.search || '').indexOf(activeFilters.search) !== -1;
    var passDist   = !activeFilters.radius || !userPos
                  || haversine(userPos.lat, userPos.lng, relay.lat, relay.lon) <= activeFilters.radius;

    var show = passType && passSearch && passDist;
    el.style.display = show ? '' : 'none';
    if (show && markers[relay.id]) toAdd.push(markers[relay.id]);
  }

  markerCluster.addLayers(toAdd);
}

// ── Röleleri harita + listeye yükle ─────────────────────────────────────────

function loadRelays(relays) {
  markerCluster.clearLayers();
  Object.keys(markers).forEach(function(id) { delete markers[id]; });
  allRelays = relays;

  var listEl = document.getElementById('relay-list');
  listEl.innerHTML = '';

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

    // Popup event delegation: kopyala + paylaş
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

  if (toAdd.length > 0) {
    map.fitBounds(markerCluster.getBounds().pad(0.1));
  }

  for (var j = 0; j < allRelays.length; j++) {
    listEl.appendChild(buildSidebarItem(allRelays[j]));
  }

  buildCityDropdown(allRelays);

  // Filtreleri sıfırla
  activeFilters.type   = 'all';
  activeFilters.search = '';
  activeFilters.radius = 0;
  var searchEl = document.getElementById('search-input');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  var allBtn = document.querySelector('.filter-btn[data-filter="all"]');
  if (allBtn) allBtn.classList.add('active');

  if (!urlParsed) { urlParsed = true; parseShareUrl(); }
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

// ── RepeaterBook dönüştürücü ─────────────────────────────────────────────────

function convertRB(entry, countryLabel) {
  var txFreq = parseFloat(entry.Frequency);
  var rxFreq = parseFloat(entry.Input_Freq);
  var lat    = parseFloat(entry.Latitude);
  var lon    = parseFloat(entry.Longitude);
  if (isNaN(txFreq) || isNaN(rxFreq) || isNaN(lat) || isNaN(lon)) return null;
  if (lat === 0 && lon === 0) return null;

  var band   = (txFreq >= 430 && txFreq < 450) ? 'UHF' : 'VHF';
  var type   = 'analog';
  var proto  = null;
  if (entry.DMR === 'Yes' || entry.DMR === '1')          { type = 'digital'; proto = 'DMR';    }
  else if (entry.dstar === 'Yes' || entry.dstar === '1') { type = 'digital'; proto = 'D-STAR'; }
  else if (entry.Fusion === 'Yes' || entry.YSF === 'Yes'){ type = 'digital'; proto = 'C4FM';   }
  else if (entry.NXDN === 'Yes' || entry.NXDN === '1')   { type = 'digital'; proto = 'NXDN';   }

  var name = '';
  if (entry.Callsign) name += entry.Callsign;
  if (entry.City)     name += (name ? ' ' : '') + entry.City;
  if (!name)          name = txFreq.toFixed(4) + ' MHz';

  return {
    id:          'rb-' + (entry.Callsign || '').replace(/[^a-z0-9]/gi, '') + '-' + Math.round(lat * 1000),
    name:        name,
    region:      countryLabel + (entry.City ? ' - ' + entry.City : ''),
    type:        type,
    band:        band,
    protocol:    proto,
    listen_freq: txFreq,
    send_freq:   rxFreq,
    offset:      parseFloat((rxFreq - txFreq).toFixed(3)),
    ctcss:       entry.PL ? parseFloat(entry.PL) : null,
    lat:         lat,
    lon:         lon,
    operator:    entry.Callsign || null,
    notes:       entry.Notes || null,
  };
}

// ── Ülke verisi yükle ────────────────────────────────────────────────────────

var CACHE_PFX = 'rb_';
var CACHE_TTL = 3600 * 1000;

function getCached(key) {
  try {
    var s = localStorage.getItem(CACHE_PFX + key);
    if (!s) return null;
    var o = JSON.parse(s);
    if (Date.now() - o.ts > CACHE_TTL) { localStorage.removeItem(CACHE_PFX + key); return null; }
    return o.data;
  } catch(e) { return null; }
}

function setCached(key, data) {
  try { localStorage.setItem(CACHE_PFX + key, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
}

function loadCountryData(code, label, rbName) {
  if (code === 'TR') {
    setLoading(true);
    fetch('./data.json')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        loadRelays(d.relays);
        renderTraining(d.baofeng_programming);
        setLoading(false);
      })
      .catch(function(err) {
        setLoading(false);
        showListError('data.json yüklenemedi: ' + err.message);
      });
    return;
  }

  var cached = getCached(code);
  if (cached) { loadRelays(cached); return; }

  setLoading(true);
  var url = 'https://www.repeaterbook.com/row_repeaters/export.php?country='
          + encodeURIComponent(rbName) + '&band=&status_id=1&format=json';

  fetch(url)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      if (!data.results || !data.results.length) throw new Error('Sonuç bulunamadı');
      var relays = data.results.map(function(e) { return convertRB(e, label); }).filter(Boolean);
      setCached(code, relays);
      loadRelays(relays);
      setLoading(false);
    })
    .catch(function(err) {
      setLoading(false);
      showListError('Veri yüklenemedi: ' + err.message
        + '<br><small>RepeaterBook CORS kısıtlaması olabilir.</small>');
    });
}

function setLoading(yes) {
  if (yes) document.getElementById('relay-list').innerHTML = '<p class="info-msg">Yükleniyor…</p>';
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

  // Sidebar: mesafeye göre sırala
  var listEl  = document.getElementById('relay-list');
  var itemMap = {};
  listEl.querySelectorAll('.relay-item').forEach(function(el) { itemMap[el.dataset.id] = el; });

  withDist.forEach(function(wd) {
    var el = itemMap[wd.relay.id];
    if (!el) return;
    var badge = el.querySelector('.dist-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'dist-badge';
      el.querySelector('.relay-item-sub').appendChild(badge);
    }
    badge.textContent = fmtDist(wd.dist);
    el.classList.toggle('nearby', wd.dist <= 50);
    listEl.appendChild(el);
  });

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

// ── Eğitim paneli ────────────────────────────────────────────────────────────

function renderTraining(data) {
  if (!data) return;
  document.getElementById('training-title').textContent = data.title;
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
  document.getElementById('training-body').innerHTML = html;
}

// ── Ülke seçici ──────────────────────────────────────────────────────────────

function buildCountrySelector(countriesData) {
  var sel = document.getElementById('select-country');
  countriesData.regions.forEach(function(region) {
    var grp = document.createElement('optgroup');
    grp.label = region.name;
    region.countries.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value         = c.code;
      opt.dataset.label = c.label;
      opt.dataset.rb    = c.rb;
      opt.textContent   = c.label;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });

  sel.addEventListener('change', function() {
    var opt = this.options[this.selectedIndex];
    urlParsed = true; // URL paylaşımını yeni ülke yüklemesinde atla
    loadCountryData(opt.value, opt.dataset.label || opt.textContent, opt.dataset.rb);
    document.getElementById('select-city').innerHTML = '<option value="">Tüm Şehirler</option>';
  });
}

// ── Ana başlatma ─────────────────────────────────────────────────────────────

function init() {
  map = L.map('map', { zoomControl: true });
  map.setView([39.0, 35.0], 6);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

  // Marker clustering (fallback: basit layer group)
  markerCluster = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true })
    : L.layerGroup();
  markerCluster.addTo(map);

  // Türkiye verisi
  loadCountryData('TR', 'Türkiye', null);

  // Ülke listesi
  fetch('./countries.json')
    .then(function(r) { return r.json(); })
    .then(buildCountrySelector)
    .catch(function() {});

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

  // Eğitim modalı
  var modal = document.getElementById('training-modal');
  document.getElementById('btn-training').addEventListener('click', function() { modal.classList.add('active'); });
  document.getElementById('modal-close').addEventListener('click', function() { modal.classList.remove('active'); });
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.remove('active'); });

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
