// ═══════════════════════════════════════════════════
//  БензинМосква — реальные АЗС из OpenStreetMap
// ═══════════════════════════════════════════════════

const State = {
  map: null,
  clusterer: null,
  placemarks: {},
  stations: {},
  reports: {},
  selectedId: null,
  addingMode: false,
  newStationCoords: null,
  newStationStatus: 'ok',
};

window.initYandexMap = function() {
  State.map = new ymaps.Map('map', {
    center: [55.751244, 37.618423],
    zoom: 11,
    controls: ['zoomControl', 'geolocationControl'],
  }, {
    suppressMapOpenBlock: true,
    yandexMapDisablePoiInteractivity: true,
  });

  // Кластеризатор — при отдалении группирует маркеры
  State.clusterer = new ymaps.Clusterer({
    groupByCoordinates: false,
    clusterIconLayout: ymaps.templateLayoutFactory.createClass(
      '<div style="background:#E8341C;color:#fff;border-radius:50%;width:38px;height:38px;' +
      'display:flex;align-items:center;justify-content:center;' +
      'font-family:Inter,sans-serif;font-weight:700;font-size:14px;' +
      'border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);cursor:pointer;">' +
      '{{ properties.geoObjects.length }}</div>'
    ),
    clusterIconShape: { type:'Circle', coordinates:[19,19], radius:19 },
  });
  State.map.geoObjects.add(State.clusterer);
  State.map.events.add('click', onMapClick);

  loadReports();
  initFeed();
  setupAddButton();
  loadOSMData();
};

// ── ЗАГРУЗКА ИЗ OSM ───────────────────────────────
function loadOSMData() {
  showLoader(true, 'Загружаем реальные АЗС из OpenStreetMap...');

  window.loadOSMStations(stations => {
    if (!stations || stations.length === 0) {
      showLoader(false);
      showToast('Не удалось загрузить данные. Проверь интернет.');
      return;
    }

    const pms = [];
    stations.forEach(s => {
      if (State.stations[s.id]) return;
      State.stations[s.id] = s;
      const pm = makePlacemark(s);
      State.placemarks[s.id] = pm;
      pms.push(pm);
    });
    State.clusterer.add(pms);

    updateHeaderStats();
    showLoader(false);
    showToast(`✓ Загружено ${stations.length} заправок Москвы`);

    // Применяем отчёты из Firebase к загруженным маркерам
    Object.keys(State.reports).forEach(id => {
      if (State.placemarks[id]) updatePlacemark(id, getEffectiveStatus(id));
    });
  });
}

// ── МАРКЕРЫ ───────────────────────────────────────
function makeIcon(status) {
  const c = { ok:'#1a9e5c', queue:'#d97706', limit:'#9333ea', empty:'#dc2626' }[status] || '#1a9e5c';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 2C8.5 2 4 6.5 4 12c0 7.5 10 22 10 22S24 19.5 24 12C24 6.5 19.5 2 14 2z"
      fill="${c}" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="12" r="5" fill="white" opacity="0.92"/>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function makePlacemark(station) {
  const status = getEffectiveStatus(station.id);
  const pm = new ymaps.Placemark(
    [station.lat, station.lng],
    { hintContent: `<b>${station.brand}</b><br>${station.addr}` },
    {
      iconLayout: 'default#image',
      iconImageHref: makeIcon(status),
      iconImageSize: [28, 36],
      iconImageOffset: [-14, -36],
    }
  );
  pm.events.add('click', () => openPanel(station.id));
  return pm;
}

function updatePlacemark(id, status) {
  const pm = State.placemarks[id];
  if (pm) pm.options.set('iconImageHref', makeIcon(status));
}

function showLoader(on, msg) {
  let el = document.getElementById('mapLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mapLoader';
    el.style.cssText = [
      'position:fixed', 'top:62px', 'left:50%', 'transform:translateX(-50%)',
      'background:#1a1917', 'color:#fff', 'padding:10px 20px',
      'border-radius:20px', 'font-size:13px', 'font-weight:500',
      'z-index:200', 'display:flex', 'align-items:center', 'gap:10px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)', 'white-space:nowrap',
    ].join(';');
    document.body.appendChild(el);
  }
  if (on) {
    el.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#E8341C;animation:pulse 1s infinite;display:inline-block;flex-shrink:0"></span> ${msg||'Загрузка...'}`;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

// ── СТАТУС ────────────────────────────────────────
function getEffectiveStatus(id) {
  const reps = State.reports[id] || [];
  if (!reps.length) return State.stations[id]?.status || 'ok';
  return reps.reduce((a, b) => a.ts > b.ts ? a : b).type;
}

// ── ПАНЕЛЬ ────────────────────────────────────────
function openPanel(id) {
  State.selectedId = id;
  refreshPanel(id);
  document.getElementById('sidePanel').classList.add('open');
  document.getElementById('sidePanel').setAttribute('aria-hidden', 'false');
}

function refreshPanel(id) {
  const s = State.stations[id];
  if (!s) return;
  const status = getEffectiveStatus(id);
  const cfg = STATUS_CONFIG[status];

  document.getElementById('panelBrand').textContent = s.brand;
  document.getElementById('panelName').textContent = s.brand;
  document.getElementById('panelAddr').textContent = s.addr || 'Адрес уточняется';

  const badge = document.getElementById('panelStatusBadge');
  badge.textContent = cfg.label;
  badge.className = 'status-badge ' + status;

  const reps = State.reports[id] || [];
  const last = reps.length ? reps.reduce((a, b) => a.ts > b.ts ? a : b) : null;
  document.getElementById('panelUpdated').textContent = last
    ? 'обновлено ' + timeAgo(last.ts) : 'нет данных — сообщи первым!';

  document.getElementById('panelFuelTypes').innerHTML =
    (s.fuels || ['АИ-92','АИ-95','ДТ']).map(f => `<span class="fuel-tag">${f}</span>`).join('');

  renderReports(id);
}

function renderReports(id) {
  const el = document.getElementById('reportsList');
  const reps = (State.reports[id] || []).slice().sort((a, b) => b.ts - a.ts).slice(0, 8);
  if (!reps.length) {
    el.innerHTML = '<div class="no-reports">Нет отчётов — будь первым!</div>';
    return;
  }
  el.innerHTML = reps.map(r => {
    const cfg = STATUS_CONFIG[r.type] || STATUS_CONFIG.ok;
    return `<div class="report-item">
      <span class="ri-dot ${r.type}"></span>
      <div class="ri-body">
        <div class="ri-type">${cfg.label}${r.note ? ' — ' + r.note : ''}</div>
        <div class="ri-time">${timeAgo(r.ts)}</div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('panelClose').addEventListener('click', () => {
  document.getElementById('sidePanel').classList.remove('open');
  document.getElementById('sidePanel').setAttribute('aria-hidden', 'true');
  State.selectedId = null;
});

// ── ОТЧЁТ ─────────────────────────────────────────
window.submitReport = function(type) {
  if (!State.selectedId) return;
  const r = { stationId: State.selectedId, type, note: '', ts: Date.now() };
  if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
  State.reports[r.stationId].push(r);
  updatePlacemark(r.stationId, type);
  refreshPanel(r.stationId);
  updateHeaderStats();
  pushFeedEvent(r);

  if (window._firebaseReady) {
    window._dbPush(window._dbRef(window._db, 'reports'), { ...r, ts: window._dbTimestamp() });
  }

  const msgs = { ok:'✓ Бензин есть — спасибо!', queue:'⏱ Очередь отмечена', limit:'⚠ Лимит отмечен', empty:'✕ Нет бензина — отмечено' };
  showToast(msgs[type]);

  document.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.report-btn[data-type="${type}"]`);
  if (btn) { btn.classList.add('active'); setTimeout(() => btn.classList.remove('active'), 1500); }
};

// ── FIREBASE ──────────────────────────────────────
function loadReports() {
  if (!window._firebaseReady) return;
  window._dbOnValue(window._dbRef(window._db, 'reports'), snap => {
    const data = snap.val();
    State.reports = {};
    if (data) {
      Object.values(data).forEach(r => {
        if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
        State.reports[r.stationId].push(r);
        pushFeedEvent(r);
      });
    }
    Object.keys(State.stations).forEach(id => updatePlacemark(id, getEffectiveStatus(id)));
    if (State.selectedId) refreshPanel(State.selectedId);
    updateHeaderStats();
  });
}

// ── ДОБАВИТЬ АЗС ──────────────────────────────────
function setupAddButton() {
  document.getElementById('btnAddStation').addEventListener('click', () => {
    State.addingMode = true;
    openModal();
    showToast('Нажми на карту чтобы выбрать место');
  });
}

function onMapClick(e) {
  if (!State.addingMode) return;
  const coords = e.get('coords');
  State.newStationCoords = coords;
  document.getElementById('modalCoords').textContent =
    `Координаты: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
}

window.submitStation = function() {
  if (!State.newStationCoords) { showToast('Сначала нажми на карту!'); return; }
  const id = 'u' + Date.now();
  const station = {
    id,
    brand: document.getElementById('addBrand').value,
    addr: document.getElementById('addAddr').value.trim() || 'Адрес не указан',
    lat: State.newStationCoords[0],
    lng: State.newStationCoords[1],
    fuels: ['АИ-92','АИ-95','ДТ'],
    status: State.newStationStatus,
    addedBy: 'user',
  };
  State.stations[id] = station;
  const pm = makePlacemark(station);
  State.placemarks[id] = pm;
  State.clusterer.add(pm);
  if (window._firebaseReady) {
    window._dbSet(window._dbRef(window._db, `stations/${id}`), station);
  }
  updateHeaderStats();
  closeModal();
  State.addingMode = false;
  showToast('Заправка добавлена! Спасибо 🙏');
};

window.selectStatus = function(btn, type) {
  document.querySelectorAll('.ms-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  State.newStationStatus = type;
};

function openModal()  { document.getElementById('modalAdd').classList.add('open'); }
window.closeModal = function() {
  document.getElementById('modalAdd').classList.remove('open');
  State.addingMode = false;
};

// ── ЛЕНТА ─────────────────────────────────────────
const feedEvents = [];
function initFeed() {}

function pushFeedEvent(r) {
  const s = State.stations[r.stationId];
  if (!s) return;
  const cfg = STATUS_CONFIG[r.type] || STATUS_CONFIG.ok;
  feedEvents.unshift({ text: s.brand + ', ' + (s.addr||''), status: cfg.label, color: cfg.hex, time: timeAgo(r.ts) });
  if (feedEvents.length > 40) feedEvents.pop();
  renderFeed();
}

function renderFeed() {
  const items = feedEvents.slice(0, 20);
  if (!items.length) return;
  document.getElementById('feedInner').innerHTML =
    [...items, ...items].map(ev =>
      `<div class="feed-event">
        <span class="fe-dot" style="background:${ev.color}"></span>
        <span class="fe-name">${ev.text}</span>
        <span>— ${ev.status}</span>
        <span class="fe-time">${ev.time}</span>
      </div>`
    ).join('');
}

// ── STATS ─────────────────────────────────────────
function updateHeaderStats() {
  const c = { ok:0, queue:0, limit:0, empty:0 };
  Object.keys(State.stations).forEach(id => {
    const st = getEffectiveStatus(id);
    if (c[st] !== undefined) c[st]++;
  });
  document.getElementById('countOk').textContent    = c.ok;
  document.getElementById('countQueue').textContent = c.queue + c.limit;
  document.getElementById('countEmpty').textContent = c.empty;
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 60000);
  if (d < 1) return 'только что';
  if (d < 60) return d + ' мин назад';
  return Math.floor(d / 60) + ' ч назад';
}

window.addEventListener('firebase-ready', () => {
  State.firebaseReady = true;
  loadReports();
});

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!State.map) {
      document.getElementById('map').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
          height:100%;background:#f0ede6;font-family:Inter,sans-serif;gap:12px;">
          <div style="font-size:40px">🗺️</div>
          <div style="font-size:16px;font-weight:600;color:#1a1917">Вставь ключ Яндекс.Карт в index.html</div>
        </div>`;
      initFeed(); setupAddButton();
    }
  }, 4000);
});
