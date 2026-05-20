'use strict';

var TILE_URL  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

var TYPE_CFG = {
  VHF:  { color: '#2ecc71', badge: 'badge-vhf'  },
  UHF:  { color: '#f39c12', badge: 'badge-uhf'  },
  DMR:  { color: '#3498db', badge: 'badge-dmr'  },
  C4FM: { color: '#9b59b6', badge: 'badge-c4fm' },
  NXDN: { color: '#e74c3c', badge: 'badge-nxdn' },
};

var map;
var allRelays  = [];
var markers    = {};
var userMarker = null;
var userCircle = null;

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function getConfig(relay) {
  if (relay.type === 'digital') return TYPE_CFG[relay.protocol] || TYPE_CFG.DMR;
  return TYPE_CFG[relay.band] || TYPE_CFG.VHF;
}

function typeCssClass(relay) {
  if (relay.type === 'digital') return (relay.protocol || 'DMR').toLowerCase();
  return relay.band.toLowerCase();
}

function typeLabel(relay) {
  if (relay.type === 'digital') return relay.protocol || 'DMR';
  return relay.band;
}

function fmtFreq(n) {
  return n.toFixed(4);
}

// ── Harita işaretçi ikonu ────────────────────────────────────────────────────

function makeIcon(color) {
  var dot = '<div style="'
    + 'width:14px;height:14px;'
    + 'background:' + color + ';'
    + 'border:3px solid rgba(255,255,255,0.85);'
    + 'border-radius:50%;'
    + 'box-shadow:0 0 10px ' + color + '99;'
    + '"></div>';
  return L.divIcon({
    className: '',
    html: dot,
    iconSize:    [14, 14],
    iconAnchor:  [7, 7],
    popupAnchor: [0, -13],
  });
}

// ── Popup içeriği ────────────────────────────────────────────────────────────

function buildPopup(relay) {
  var c = getConfig(relay);

  function row(label, val) {
    return '<div class="popup-row">'
      + '<span class="popup-label">' + label + '</span>'
      + '<span class="popup-value">' + val + '</span>'
      + '</div>';
  }

  var html = '<div class="popup-title">' + relay.name + '</div>';
  html += row('Dinleme (RX)',  fmtFreq(relay.listen_freq) + ' MHz');
  html += row('Gönderme (TX)', fmtFreq(relay.send_freq)   + ' MHz');
  html += row('Offset',        (relay.offset > 0 ? '+' : '') + relay.offset + ' MHz');
  if (relay.ctcss)       html += row('CTCSS Tonu',   relay.ctcss    + ' Hz');
  if (relay.protocol)    html += row('Protokol',     relay.protocol);
  if (relay.timeslot)    html += row('Zaman Dilimi', relay.timeslot);
  if (relay.channel)     html += row('Kanal',        relay.channel);
  if (relay.elevation_m) html += row('Rakım',        relay.elevation_m + ' m');
  if (relay.operator)    html += row('Operatör',     relay.operator);

  html += '<div class="popup-tags">'
    + '<span class="popup-badge" style="background:' + c.color + '22;color:' + c.color + '">' + relay.region + '</span>'
    + '<span class="popup-badge" style="background:' + c.color + '22;color:' + c.color + '">' + typeLabel(relay) + '</span>'
    + '</div>';

  if (relay.notes) {
    html += '<div class="popup-notes">' + relay.notes + '</div>';
  }

  return html;
}

// ── Sidebar öğesi ────────────────────────────────────────────────────────────

function buildSidebarItem(relay) {
  var c       = getConfig(relay);
  var cssKey  = typeCssClass(relay);
  var tlabel  = typeLabel(relay);

  var el         = document.createElement('div');
  el.className   = 'relay-item ' + cssKey;
  el.dataset.id  = relay.id;
  el.dataset.type = relay.type;

  el.innerHTML = ''
    + '<div class="relay-item-header">'
    +   '<span class="relay-item-name">' + relay.name + '</span>'
    +   '<span class="relay-badge ' + c.badge + '">' + tlabel + '</span>'
    + '</div>'
    + '<div class="relay-item-sub">' + fmtFreq(relay.listen_freq) + ' MHz &middot; ' + relay.region + '</div>';

  el.addEventListener('click', function() {
    var m = markers[relay.id];
    if (!m) return;
    map.flyTo([relay.lat, relay.lon], 13, { duration: 1.2 });
    setTimeout(function() { m.openPopup(); }, 1350);
  });

  return el;
}

// ── Eğitim paneli ────────────────────────────────────────────────────────────

function renderTraining(data) {
  if (!data) return;

  document.getElementById('training-title').textContent = data.title;

  var html = '<p class="training-subtitle">Hedef Röle: <strong>' + data.target_relay + '</strong></p>';

  for (var i = 0; i < data.steps.length; i++) {
    var s = data.steps[i];
    var desc = s.description
      .replace(/(\d{3}\.\d{3,4})\s*MHz/g, '<code>$1 MHz</code>')
      .replace(/(\d{2,3}(?:\.\d+)?)\s*Hz/g,  '<code>$1 Hz</code>')
      .replace(/(00\.600)/g,                  '<code>$1</code>')
      .replace(/Menü\s+(\d+)/g,               'Menü <strong>$1</strong>');

    html += '<div class="step-card">'
      + '<div class="step-num">' + s.step + '</div>'
      + '<div class="step-content">'
      +   '<h3>' + s.title + '</h3>'
      +   '<p>' + desc + '</p>'
      + '</div>'
      + '</div>';
  }

  document.getElementById('training-body').innerHTML = html;
}

// ── Filtre ───────────────────────────────────────────────────────────────────

function applyFilter(filter) {
  var items = document.querySelectorAll('.relay-item');
  for (var i = 0; i < items.length; i++) {
    var show = filter === 'all' || items[i].dataset.type === filter;
    items[i].style.display = show ? '' : 'none';
  }

  for (var id in markers) {
    if (!Object.prototype.hasOwnProperty.call(markers, id)) continue;
    var relay = null;
    for (var j = 0; j < allRelays.length; j++) {
      if (allRelays[j].id === id) { relay = allRelays[j]; break; }
    }
    if (!relay) continue;
    var show2 = filter === 'all' || relay.type === filter;
    var m = markers[id];
    if (show2) {
      if (!map.hasLayer(m)) m.addTo(map);
    } else {
      map.removeLayer(m);
    }
  }
}

// ── Kullanıcı konumu ─────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  var R    = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
           + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
           * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showNearby(lat, lon, accuracy) {
  // Kullanıcı konumu işaretçisi
  if (userMarker) { map.removeLayer(userMarker); map.removeLayer(userCircle); }

  var userIcon = L.divIcon({
    className: '',
    html: '<div class="user-dot"></div>',
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
  });
  userMarker = L.marker([lat, lon], { icon: userIcon, zIndexOffset: 1000 })
    .bindPopup('<strong>Konumunuz</strong>')
    .addTo(map);
  userCircle = L.circle([lat, lon], {
    radius:      Math.min(accuracy || 500, 5000),
    color:       '#4a90d9',
    fillColor:   '#4a90d9',
    fillOpacity: 0.08,
    weight:      1,
  }).addTo(map);

  // Her rölenin mesafesini hesapla ve sidebar öğesine yaz
  var withDist = allRelays.map(function(r) {
    return { relay: r, dist: haversine(lat, lon, r.lat, r.lon) };
  });
  withDist.sort(function(a, b) { return a.dist - b.dist; });

  var listEl  = document.getElementById('relay-list');
  var itemMap = {};
  listEl.querySelectorAll('.relay-item').forEach(function(el) {
    itemMap[el.dataset.id] = el;
  });

  withDist.forEach(function(wd) {
    var el = itemMap[wd.relay.id];
    if (!el) return;

    var distText = wd.dist < 10
      ? wd.dist.toFixed(1) + ' km'
      : Math.round(wd.dist) + ' km';

    var badge = el.querySelector('.dist-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'dist-badge';
      el.querySelector('.relay-item-sub').appendChild(badge);
    }
    badge.textContent = distText;
    el.classList.toggle('nearby', wd.dist <= 50);

    listEl.appendChild(el); // mesafeye göre yeniden sırala
  });

  // Haritayı kullanıcı + en yakın 5 röleye sığdır
  var bounds = [[lat, lon]];
  for (var i = 0; i < Math.min(5, withDist.length); i++) {
    bounds.push([withDist[i].relay.lat, withDist[i].relay.lon]);
  }
  map.flyToBounds(L.latLngBounds(bounds).pad(0.3), { duration: 1.5 });

  // En yakın rölenin popup'ını aç
  var nearest = withDist[0];
  if (nearest) {
    setTimeout(function() {
      markers[nearest.relay.id] && markers[nearest.relay.id].openPopup();
    }, 1800);
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    alert('Tarayıcınız konum servisini desteklemiyor.');
    return;
  }
  var btn = document.getElementById('btn-locate');
  btn.disabled    = true;
  btn.textContent = '📍 Alınıyor…';

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      btn.disabled    = false;
      btn.textContent = '📍 Konumum';
      showNearby(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    },
    function(err) {
      btn.disabled    = false;
      btn.textContent = '📍 Konumum';
      var msgs = { 1: 'Konum izni reddedildi.', 2: 'Konum alınamadı.', 3: 'Konum isteği zaman aşımına uğradı.' };
      alert(msgs[err.code] || 'Konum hatası.');
    },
    { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false }
  );
}

// ── Çevrimdışı tile önbellekleme (SW tabanlı) ────────────────────────────────
// OpenStreetMap toplu (bulk) tile indirmeyi engellemektedir.
// Tile'lar, Service Worker aracılığıyla siz haritayı gezinirken
// otomatik olarak önbelleğe alınır — ayrıca bir indirme gerekmez.

function showOfflineInfo() {
  var msg = 'Harita parçaları, haritayı gezinirken otomatik olarak cihazınıza kaydedilir.\n\n'
    + 'Çevrimdışı erişmek istediğiniz bölgeyi şimdi haritada kaydırın ve yakınlaştırın — '
    + 'bu adım tamamlandığında o bölge internet olmadan da görüntülenebilir.';
  alert(msg);
}

// ── Bağlantı durumu ──────────────────────────────────────────────────────────

function updateStatus() {
  var dot  = document.getElementById('status-dot');
  var text = document.getElementById('status-text');
  if (!dot || !text) return;
  if (navigator.onLine) {
    dot.className    = 'status-dot online';
    text.textContent = 'Çevrimiçi';
  } else {
    dot.className    = 'status-dot offline';
    text.textContent = 'Çevrimdışı';
  }
}

// ── Ana başlatma ─────────────────────────────────────────────────────────────

function init() {
  // Haritayı başlat
  map = L.map('map', { zoomControl: true });
  map.setView([37.0, 36.2], 8);

  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTR,
    maxZoom: 19,
  }).addTo(map);

  // Veri yükle
  fetch('./data.json')
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      allRelays = data.relays;

      // İşaretçiler
      for (var i = 0; i < allRelays.length; i++) {
        var relay = allRelays[i];
        var c     = getConfig(relay);
        var m     = L.marker([relay.lat, relay.lon], {
          icon: makeIcon(c.color),
          title: relay.name,
          riseOnHover: true,
        });
        m.bindPopup(buildPopup(relay), { maxWidth: 300 });
        m.addTo(map);
        markers[relay.id] = m;
      }

      // Tüm işaretçilere sığdır
      var group = L.featureGroup(Object.values(markers));
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.15));
      }

      // Sidebar
      var listEl = document.getElementById('relay-list');
      for (var j = 0; j < allRelays.length; j++) {
        listEl.appendChild(buildSidebarItem(allRelays[j]));
      }

      // Eğitim paneli
      renderTraining(data.baofeng_programming);
    })
    .catch(function(err) {
      console.error('data.json yüklenemedi:', err);
      document.getElementById('relay-list').innerHTML =
        '<p class="error-msg">Röle verileri yüklenemedi.<br>'
        + 'Sayfayı yenileyin veya internet bağlantınızı kontrol edin.</p>';
    });

  // Filtre butonları
  var filterBtns = document.querySelectorAll('.filter-btn');
  for (var k = 0; k < filterBtns.length; k++) {
    filterBtns[k].addEventListener('click', function() {
      for (var n = 0; n < filterBtns.length; n++) filterBtns[n].classList.remove('active');
      this.classList.add('active');
      applyFilter(this.dataset.filter);
    });
  }

  // Eğitim modalı
  var modal = document.getElementById('training-modal');
  document.getElementById('btn-training').addEventListener('click', function() {
    modal.classList.add('active');
  });
  document.getElementById('modal-close').addEventListener('click', function() {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Konum butonu
  document.getElementById('btn-locate').addEventListener('click', locateUser);

  // Offline kaydet butonu
  document.getElementById('btn-offline').addEventListener('click', showOfflineInfo);

  // Bağlantı durumu
  updateStatus();
  window.addEventListener('online',  updateStatus);
  window.addEventListener('offline', updateStatus);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(function(e) { console.warn('SW:', e.message); });
  }
}

// DOMContentLoaded garantisi
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
