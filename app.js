'use strict';

const TILE_URL  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar';

const TYPE_CFG = {
  VHF:  { color: '#2ecc71', cls: 'vhf',  badge: 'badge-vhf'  },
  UHF:  { color: '#f39c12', cls: 'uhf',  badge: 'badge-uhf'  },
  DMR:  { color: '#3498db', cls: 'dmr',  badge: 'badge-dmr'  },
  C4FM: { color: '#9b59b6', cls: 'c4fm', badge: 'badge-c4fm' },
  NXDN: { color: '#e74c3c', cls: 'nxdn', badge: 'badge-nxdn' },
};

let map, baseTileLayer, saveTilesControl;
let allRelays = [];
const markers = {};

// ── Helpers ────────────────────────────────────────────────────────────────

function cfg(relay) {
  return relay.type === 'digital'
    ? (TYPE_CFG[relay.protocol] || TYPE_CFG.DMR)
    : (TYPE_CFG[relay.band]     || TYPE_CFG.VHF);
}

function markerIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:3px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 10px ${color}99;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -13],
  });
}

function fmt(n, decimals = 4) {
  return n.toFixed(decimals);
}

// ── Popup ───────────────────────────────────────────────────────────────────

function buildPopup(relay) {
  const c = cfg(relay);

  const rows = [
    ['Dinleme (RX)',  `${fmt(relay.listen_freq)} MHz`],
    ['Gönderme (TX)', `${fmt(relay.send_freq)} MHz`],
    ['Offset',        `${relay.offset > 0 ? '+' : ''}${relay.offset} MHz`],
    relay.ctcss       ? ['CTCSS Tonu',   `${relay.ctcss} Hz`]      : null,
    relay.protocol    ? ['Protokol',     relay.protocol]            : null,
    relay.timeslot    ? ['Zaman Dilimi', relay.timeslot]            : null,
    relay.channel     ? ['Kanal',        relay.channel]             : null,
    relay.elevation_m ? ['Rakım',        `${relay.elevation_m} m`]  : null,
    relay.operator    ? ['Operatör',     relay.operator]            : null,
  ].filter(Boolean);

  const rowsHTML = rows.map(([label, val]) =>
    `<div class="popup-row"><span class="popup-label">${label}</span><span class="popup-value">${val}</span></div>`
  ).join('');

  const typeLabel = relay.type === 'digital' ? (relay.protocol || 'Dijital') : relay.band;

  return `
    <div class="popup-title">${relay.name}</div>
    ${rowsHTML}
    <div class="popup-tags">
      <span class="popup-badge" style="background:${c.color}22;color:${c.color}">${relay.region}</span>
      <span class="popup-badge" style="background:${c.color}22;color:${c.color}">${typeLabel}</span>
    </div>
    ${relay.notes ? `<div class="popup-notes">${relay.notes}</div>` : ''}
  `;
}

// ── Sidebar item ─────────────────────────────────────────────────────────────

function buildSidebarItem(relay) {
  const c = cfg(relay);
  const typeKey  = relay.type === 'digital' ? (relay.protocol || 'DMR').toLowerCase() : relay.band.toLowerCase();
  const typeLabel = relay.type === 'digital' ? (relay.protocol || 'DMR') : relay.band;

  const el = document.createElement('div');
  el.className = `relay-item ${typeKey}`;
  el.dataset.id   = relay.id;
  el.dataset.type = relay.type;

  el.innerHTML = `
    <div class="relay-item-header">
      <span class="relay-item-name">${relay.name}</span>
      <span class="relay-badge ${c.badge}">${typeLabel}</span>
    </div>
    <div class="relay-item-sub">${fmt(relay.listen_freq)} MHz &middot; ${relay.region}</div>
  `;

  el.addEventListener('click', () => {
    const m = markers[relay.id];
    if (!m) return;
    map.flyTo([relay.lat, relay.lon], 13, { duration: 1.2 });
    setTimeout(() => m.openPopup(), 1350);
  });

  return el;
}

// ── Training panel ───────────────────────────────────────────────────────────

function renderTraining(data) {
  if (!data) return;
  document.getElementById('training-title').textContent = data.title;

  const highlight = str => str
    .replace(/(\d{3}\.\d{3,4})\s*MHz/g, '<code>$1 MHz</code>')
    .replace(/(\d{2,3}(?:\.\d+)?)\s*Hz/g,  '<code>$1 Hz</code>')
    .replace(/(00\.600)/g,                  '<code>$1</code>')
    .replace(/Menü\s+(\d+)/g,              'Menü <strong>$1</strong>');

  document.getElementById('training-body').innerHTML = `
    <p class="training-subtitle">Hedef Röle: <strong>${data.target_relay}</strong></p>
    ${data.steps.map(s => `
      <div class="step-card">
        <div class="step-num">${s.step}</div>
        <div class="step-content">
          <h3>${s.title}</h3>
          <p>${highlight(s.description)}</p>
        </div>
      </div>`).join('')}
  `;
}

// ── Filter ───────────────────────────────────────────────────────────────────

function applyFilter(filter) {
  document.querySelectorAll('.relay-item').forEach(item => {
    const show = filter === 'all' || item.dataset.type === filter;
    item.style.display = show ? '' : 'none';
  });

  allRelays.forEach(relay => {
    const m    = markers[relay.id];
    const show = filter === 'all' || relay.type === filter;
    if (!m) return;
    if (show) { if (!map.hasLayer(m)) m.addTo(map); }
    else      { map.removeLayer(m); }
  });
}

// ── Progress toast ───────────────────────────────────────────────────────────

function showProgress(text, pct) {
  const el = document.getElementById('download-progress');
  el.style.display = 'block';
  document.getElementById('progress-text').textContent = text;
  if (pct !== undefined) {
    document.getElementById('progress-fill').style.width = `${pct}%`;
  }
}
function hideProgress() {
  document.getElementById('download-progress').style.display = 'none';
  document.getElementById('progress-fill').style.width = '0';
}

// ── Online / offline status ──────────────────────────────────────────────────

function updateStatus() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (navigator.onLine) {
    dot.className = 'status-dot online';
    text.textContent = 'Çevrimiçi';
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Çevrimdışı';
  }
}

// ── Offline tile support (leaflet.offline) ───────────────────────────────────

function initOfflineSupport() {
  const lo = window.leafletOffline;
  if (!lo || typeof lo.createTileLayerOffline !== 'function') {
    console.info('leaflet.offline bulunamadı, standart tile katmanı kullanılıyor.');
    document.getElementById('btn-offline').disabled = true;
    document.getElementById('btn-offline').title = 'Çevrimdışı kayıt bu tarayıcıda desteklenmiyor';
    return;
  }

  // Swap out base tile layer for the offline-capable version
  map.removeLayer(baseTileLayer);
  baseTileLayer = lo.createTileLayerOffline(TILE_URL, {
    attribution: TILE_ATTR,
    maxZoom: 18,
    crossOrigin: true,
  });
  baseTileLayer.addTo(map);

  saveTilesControl = new lo.ControlSaveTiles(baseTileLayer, {
    zoomlevels: [8, 9, 10, 11, 12, 13],
    alwaysDownload: false,
    confirm(layer, successCb) {
      const count = layer._tilesforSave ? layer._tilesforSave.length : '?';
      if (window.confirm(`${count} harita parçası indirilip yerel depoya kaydedilecek. Devam edilsin mi?`)) {
        successCb();
      }
    },
    confirmRemoval(_layer, successCb) {
      if (window.confirm('Kaydedilen tüm harita parçaları silinecek. Onaylıyor musunuz?')) {
        successCb();
      }
    },
  });
  saveTilesControl.addTo(map);

  baseTileLayer.on('savestart',     ()  => showProgress('İndirme başlıyor…'));
  baseTileLayer.on('savetilecount', e   => {
    const pct = Math.round(((e.saved || 0) / (e.total || 1)) * 100);
    showProgress(`${e.saved || 0} / ${e.total || 0} parça — %${pct}`, pct);
  });
  baseTileLayer.on('saveend',       ()  => {
    showProgress('Harita çevrimdışı kullanıma hazır!', 100);
    setTimeout(hideProgress, 2800);
  });
  baseTileLayer.on('saveerror',     ()  => {
    hideProgress();
    alert('Harita parçaları indirilemedi. İnternet bağlantınızı kontrol edin.');
  });

  document.getElementById('btn-offline').disabled = false;
  document.getElementById('btn-offline').title = 'Mevcut harita görünümünü çevrimdışı kaydet';
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // Map
  map = L.map('map', { zoomControl: true }).setView([37.0, 36.2], 8);

  baseTileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 });
  baseTileLayer.addTo(map);

  // Load data
  try {
    const res  = await fetch('./data.json');
    const data = await res.json();
    allRelays  = data.relays;

    allRelays.forEach(relay => {
      const c = cfg(relay);
      const m = L.marker([relay.lat, relay.lon], {
        icon: markerIcon(c.color),
        title: relay.name,
        riseOnHover: true,
      }).bindPopup(buildPopup(relay), { maxWidth: 300 });
      m.addTo(map);
      markers[relay.id] = m;
    });

    // Fit all markers into view
    const group = L.featureGroup(Object.values(markers));
    map.fitBounds(group.getBounds().pad(0.12));

    // Sidebar
    const listEl = document.getElementById('relay-list');
    allRelays.forEach(relay => listEl.appendChild(buildSidebarItem(relay)));

    // Training panel
    renderTraining(data.baofeng_programming);

  } catch (err) {
    console.error('Veri yüklenemedi:', err);
    document.getElementById('relay-list').innerHTML =
      '<p class="error-msg">Veri yüklenemedi. Uygulama çevrimdışı modda olabilir; harita önbellekten yükleniyor.</p>';
  }

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  // Training modal
  const modal = document.getElementById('training-modal');
  document.getElementById('btn-training').addEventListener('click',  () => modal.classList.add('active'));
  document.getElementById('modal-close').addEventListener('click',   () => modal.classList.remove('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

  // Offline button (wired after initOfflineSupport)
  document.getElementById('btn-offline').addEventListener('click', () => {
    if (saveTilesControl) saveTilesControl._saveTiles();
  });

  // Cancel download
  document.getElementById('btn-cancel-download').addEventListener('click', hideProgress);

  // Status
  updateStatus();
  window.addEventListener('online',  updateStatus);
  window.addEventListener('offline', updateStatus);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch(e => console.warn('SW kaydı başarısız:', e.message));
  }

  // Init offline tile support after CDN scripts have had time to load
  setTimeout(initOfflineSupport, 800);
}

document.addEventListener('DOMContentLoaded', init);
