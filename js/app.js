// ═══════════════════════════════════════════════════
//  БензинМосква — главный модуль приложения
// ═══════════════════════════════════════════════════

// Глобальное состояние
const State = {
  map: null,
  placemarks: {},       // stationId → placemark
  stations: {},         // stationId → station object
  reports: {},          // stationId → [ ...reports ]
  selectedId: null,
  addingMode: false,
  newStationCoords: null,
  newStationStatus: 'ok',
  firebaseReady: false,
};

// ── ИНИЦИАЛИЗАЦИЯ ──────────────────────────────────
function initApp() {
  loadStations();
  loadReports();
  initFeed();
  updateHeaderStats();
  setupAddButton();
}

// ── ЯНДЕКС КАРТЫ ──────────────────────────────────
window.initYandexMap = function() {
  State.map = new ymaps.Map('map', {
    center: [55.751244, 37.618423],
    zoom: 11,
    controls: ['zoomControl', 'geolocationControl'],
  }, {
    suppressMapOpenBlock: true,
    yandexMapDisablePoiInteractivity: true,
  });

  State.map.events.add('click', onMapClick);

  // Загружаем заправки
  Object.values(State.stations).forEach(renderStation);
  initApp();
};

// ── ДАННЫЕ: ЗАПРАВКИ ──────────────────────────────
function loadStations() {
  STATIONS_SEED.forEach(s => {
    State.stations[s.id] = { ...s, reports: [] };
  });

  // Если Firebase доступен — слушаем узел stations
  if (window._firebaseReady) {
    const stRef = window._dbRef(window._db, 'stations');
    window._dbOnValue(stRef, snap => {
      const data = snap.val();
      if (!data) return;
      Object.entries(data).forEach(([id, val]) => {
        if (!State.stations[id]) {
          State.stations[id] = val;
          if (State.map) renderStation(val);
        }
      });
    });
  }
}

// ── ДАННЫЕ: ОТЧЁТЫ ─────────────────────────────────
function loadReports() {
  // Начальные seed-отчёты
  SEED_REPORTS.forEach(r => {
    if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
    State.reports[r.stationId].push(r);
  });

  // Firebase live
  if (window._firebaseReady) {
    const rpRef = window._dbRef(window._db, 'reports');
    window._dbOnValue(rpRef, snap => {
      const data = snap.val();
      if (!data) return;
      // Сброс и перезагрузка
      Object.keys(State.stations).forEach(id => State.reports[id] = []);
      SEED_REPORTS.forEach(r => {
        if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
        State.reports[r.stationId].push(r);
      });
      Object.values(data).forEach(r => {
        if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
        State.reports[r.stationId].push(r);
        pushFeedEvent(r);
      });
      // Обновляем маркеры
      Object.keys(State.stations).forEach(id => {
        const st = getEffectiveStatus(id);
        updatePlacemark(id, st);
      });
      if (State.selectedId) refreshPanel(State.selectedId);
      updateHeaderStats();
    });
  }
}

// ── ЭФФЕКТИВНЫЙ СТАТУС ─────────────────────────────
function getEffectiveStatus(stationId) {
  const reps = State.reports[stationId] || [];
  if (reps.length === 0) return State.stations[stationId]?.status || 'ok';
  // Берём последний отчёт (максимальный timestamp)
  const last = reps.reduce((a, b) => (a.ts > b.ts ? a : b));
  return last.type;
}

// ── МАРКЕРЫ НА КАРТЕ ──────────────────────────────
function makeIcon(status) {
  const cfg = STATUS_CONFIG[status];
  const color = cfg.hex;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <filter id="sh" x="-30%" y="-10%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#00000033"/>
      </filter>
      <ellipse cx="18" cy="41" rx="7" ry="3" fill="rgba(0,0,0,0.15)"/>
      <path d="M18 2C10.3 2 4 8.3 4 16c0 9 14 26 14 26S32 25 32 16C32 8.3 25.7 2 18 2z"
            fill="${color}" filter="url(#sh)"/>
      <circle cx="18" cy="16" r="7" fill="white" opacity="0.9"/>
    </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function renderStation(station) {
  if (!State.map) return;
  const status = getEffectiveStatus(station.id);
  const pm = new ymaps.Placemark(
    [station.lat, station.lng],
    {},
    {
      iconLayout: 'default#image',
      iconImageHref: makeIcon(status),
      iconImageSize: [36, 44],
      iconImageOffset: [-18, -44],
    }
  );
  pm.events.add('click', () => openPanel(station.id));
  State.map.geoObjects.add(pm);
  State.placemarks[station.id] = pm;
}

function updatePlacemark(stationId, status) {
  const pm = State.placemarks[stationId];
  if (!pm) return;
  pm.options.set('iconImageHref', makeIcon(status));
}

// ── ПАНЕЛЬ ────────────────────────────────────────
function openPanel(stationId) {
  State.selectedId = stationId;
  refreshPanel(stationId);
  document.getElementById('sidePanel').classList.add('open');
  document.getElementById('sidePanel').setAttribute('aria-hidden', 'false');
}

function refreshPanel(stationId) {
  const station = State.stations[stationId];
  if (!station) return;
  const status = getEffectiveStatus(stationId);
  const cfg = STATUS_CONFIG[status];

  document.getElementById('panelBrand').textContent = station.brand;
  document.getElementById('panelName').textContent = station.brand;
  document.getElementById('panelAddr').textContent = station.addr;

  const badge = document.getElementById('panelStatusBadge');
  badge.textContent = cfg.label;
  badge.className = 'status-badge ' + status;

  const reps = (State.reports[stationId] || []);
  if (reps.length > 0) {
    const last = reps.reduce((a, b) => a.ts > b.ts ? a : b);
    document.getElementById('panelUpdated').textContent = 'обновлено ' + timeAgo(last.ts);
  } else {
    document.getElementById('panelUpdated').textContent = '';
  }

  // Топливо
  const fuelsEl = document.getElementById('panelFuelTypes');
  fuelsEl.innerHTML = (station.fuels || []).map(f =>
    `<span class="fuel-tag">${f}</span>`
  ).join('');

  // Отчёты
  renderReports(stationId);
}

function renderReports(stationId) {
  const el = document.getElementById('reportsList');
  const reps = (State.reports[stationId] || [])
    .slice().sort((a, b) => b.ts - a.ts).slice(0, 8);

  if (reps.length === 0) {
    el.innerHTML = '<div class="no-reports">Нет отчётов — будь первым!</div>';
    return;
  }

  el.innerHTML = reps.map(r => {
    const cfg = STATUS_CONFIG[r.type] || STATUS_CONFIG.ok;
    return `<div class="report-item">
      <span class="ri-dot ${r.type}"></span>
      <div class="ri-body">
        <div class="ri-type">${cfg.label}${r.note ? ` — ${r.note}` : ''}</div>
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

// ── ОТПРАВКА ОТЧЁТА ───────────────────────────────
window.submitReport = function(type) {
  if (!State.selectedId) return;

  const report = {
    stationId: State.selectedId,
    type,
    note: '',
    ts: Date.now(),
    anon: true,
  };

  // Локально
  if (!State.reports[State.selectedId]) State.reports[State.selectedId] = [];
  State.reports[State.selectedId].push(report);
  updatePlacemark(State.selectedId, type);
  refreshPanel(State.selectedId);
  updateHeaderStats();
  pushFeedEvent(report);

  // Firebase
  if (window._firebaseReady) {
    const rpRef = window._dbRef(window._db, 'reports');
    window._dbPush(rpRef, { ...report, ts: window._dbTimestamp() });
  }

  showToast(getToastMsg(type));
  highlightReportBtn(type);
};

function getToastMsg(type) {
  return {
    ok:    '✓ Спасибо! Отмечено: бензин есть',
    queue: '⏱ Спасибо! Отмечено: очередь',
    limit: '⚠ Спасибо! Отмечено: лимит',
    empty: '✕ Спасибо! Отмечено: нет бензина',
  }[type];
}

function highlightReportBtn(type) {
  document.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.report-btn[data-type="${type}"]`);
  if (btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 1500);
  }
}

// ── ДОБАВИТЬ ЗАПРАВКУ ─────────────────────────────
function setupAddButton() {
  document.getElementById('btnAddStation').addEventListener('click', () => {
    State.addingMode = true;
    State.newStationCoords = null;
    openModal();
    showToast('Нажми на карту, чтобы выбрать место');
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
  if (!State.newStationCoords) {
    showToast('Сначала нажми на карту!');
    return;
  }
  const brand = document.getElementById('addBrand').value;
  const addr  = document.getElementById('addAddr').value.trim() || 'Адрес не указан';
  const id    = 'u' + Date.now();
  const station = {
    id, brand, addr,
    lat: State.newStationCoords[0],
    lng: State.newStationCoords[1],
    fuels: ['АИ-92', 'АИ-95', 'ДТ'],
    status: State.newStationStatus,
    addedBy: 'user',
    ts: Date.now(),
  };

  State.stations[id] = station;
  renderStation(station);

  // Firebase
  if (window._firebaseReady) {
    const stRef = window._dbRef(window._db, `stations/${id}`);
    window._dbSet(stRef, station);
  }

  // Начальный отчёт
  window.submitReport && (() => {
    State.selectedId = id;
    submitReport(State.newStationStatus);
    State.selectedId = null;
  })();

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

function openModal() {
  document.getElementById('modalAdd').classList.add('open');
  document.getElementById('modalCoords').textContent = 'Координаты: не выбраны — нажми на карту';
}
window.closeModal = function() {
  document.getElementById('modalAdd').classList.remove('open');
  State.addingMode = false;
};

// ── ЛЕНТА СОБЫТИЙ ────────────────────────────────
const feedEvents = [];

function initFeed() {
  // Заполняем лентой из seed-отчётов
  SEED_REPORTS.slice().reverse().forEach(r => pushFeedEvent(r));
}

function pushFeedEvent(report) {
  const station = State.stations[report.stationId];
  if (!station) return;
  const cfg = STATUS_CONFIG[report.type] || STATUS_CONFIG.ok;
  const ev = {
    text: `${station.brand}, ${station.addr}`,
    status: cfg.label,
    color: cfg.hex,
    time: timeAgo(report.ts),
  };
  feedEvents.unshift(ev);
  if (feedEvents.length > 30) feedEvents.pop();
  renderFeed();
}

function renderFeed() {
  const inner = document.getElementById('feedInner');
  const items = feedEvents.slice(0, 15);
  const html = [...items, ...items].map(ev =>
    `<div class="feed-event">
      <span class="fe-dot" style="background:${ev.color}"></span>
      <span class="fe-name">${ev.text}</span>
      <span>— ${ev.status}</span>
      <span class="fe-time">${ev.time}</span>
    </div>`
  ).join('');
  inner.innerHTML = html;
}

// ── HEADER STATS ─────────────────────────────────
function updateHeaderStats() {
  const counts = { ok: 0, queue: 0, limit: 0, empty: 0 };
  Object.keys(State.stations).forEach(id => {
    const st = getEffectiveStatus(id);
    if (counts[st] !== undefined) counts[st]++;
  });
  document.getElementById('countOk').textContent = counts.ok;
  document.getElementById('countQueue').textContent = counts.queue + counts.limit;
  document.getElementById('countEmpty').textContent = counts.empty;
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── УТИЛИТЫ ──────────────────────────────────────
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1)  return 'только что';
  if (diff < 60) return diff + ' мин назад';
  const h = Math.floor(diff / 60);
  return h + ' ч назад';
}

// ── FIREBASE READY HOOK ───────────────────────────
if (window._firebaseReady) {
  window.dispatchEvent(new Event('firebase-ready'));
}
window.addEventListener('firebase-ready', () => {
  State.firebaseReady = true;
});

// ── ЗАПУСК КАРТЫ ─────────────────────────────────
// Яндекс.Карты вызывают window.initYandexMap когда готовы
// Если скрипт Яндекса не подключён — показываем заглушку
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!State.map) {
      document.getElementById('map').innerHTML = `
        <div style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          height:100%;background:#f0ede6;color:#6b6960;font-family:Inter,sans-serif;gap:10px;
        ">
          <div style="font-size:32px">🗺️</div>
          <div style="font-size:15px;font-weight:500;color:#1a1917">Карта не загрузилась</div>
          <div style="font-size:13px;max-width:320px;text-align:center;line-height:1.6">
            Подключи API Яндекс.Карт:<br>
            вставь свой ключ в тег <code style="background:#fff;padding:2px 6px;border-radius:4px">&lt;script&gt;</code>
            в файле <strong>index.html</strong>
          </div>
        </div>`;
      // Всё равно инициализируем данные
      initApp();
    }
  }, 3000);
});
