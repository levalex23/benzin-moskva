// ═══════════════════════════════════════════════════
//  БензинМосква
// ═══════════════════════════════════════════════════

const State = {
  map: null,
  placemarks: {},
  stations: {},
  reports: {},
  selectedId: null,
  addingMode: false,
  newStationCoords: null,
  newStationStatus: 'ok',
  searchBounds: null,
};

// ── ЯНДЕКС КАРТЫ ──────────────────────────────────
window.initYandexMap = function() {
  State.map = new ymaps.Map('map', {
    center: [55.751244, 37.618423],
    zoom: 12,
    controls: ['zoomControl', 'geolocationControl'],
  }, {
    suppressMapOpenBlock: true,
    yandexMapDisablePoiInteractivity: true,
  });

  State.map.events.add('click', onMapClick);
  State.map.events.add('boundschange', onBoundsChange);

  loadReports();
  initFeed();
  setupAddButton();

  // Загружаем seed-заправки сразу
  loadSeedStations();

  // Потом ищем реальные
  searchAllStations();
};

// ── SEED ДАННЫЕ ───────────────────────────────────
function loadSeedStations() {
  STATIONS_SEED.forEach(s => {
    if (!State.stations[s.id]) {
      State.stations[s.id] = { ...s };
      renderStation(s);
    }
  });
  updateHeaderStats();
}

// ── ПОИСК ВСЕХ АЗС ───────────────────────────────
function searchAllStations() {
  showLoader(true);

  // Границы Москвы (в пределах МКАД + немного)
  const moscowBounds = [[55.49, 37.27], [55.92, 37.97]];

  // Список запросов — по каждой сети отдельно для максимального покрытия
  const queries = [
    'Лукойл АЗС Москва',
    'Газпромнефть АЗС Москва',
    'Роснефть АЗС Москва',
    'Татнефть АЗС Москва',
    'ОРТК АЗС Москва',
    'Shell АЗС Москва',
    'BP АЗС Москва',
    'АЗС заправка Москва',
    'автозаправочная станция Москва',
  ];

  let completed = 0;
  const total = queries.length;

  queries.forEach(query => {
    ymaps.search(query, {
      boundedBy: moscowBounds,
      strictBounds: true,
      results: 50,
      searchControlProvider: 'yandex#search',
    }).then(res => {
      processSearchResults(res);
    }).catch(() => {}).finally(() => {
      completed++;
      if (completed >= total) {
        showLoader(false);
        updateHeaderStats();
      }
    });
  });

  // Дополнительно — поиск через Places API по сетке
  searchByGrid();
}

// Поиск по сетке районов Москвы
function searchByGrid() {
  const areas = [
    // Центр
    [55.751, 37.618],
    // Север
    [55.820, 37.560], [55.820, 37.650], [55.820, 37.740],
    // Юг
    [55.680, 37.560], [55.680, 37.650], [55.680, 37.740],
    // Запад
    [55.751, 37.420], [55.780, 37.420], [55.720, 37.420],
    // Восток
    [55.751, 37.820], [55.780, 37.820], [55.720, 37.820],
    // Северо-запад / северо-восток
    [55.820, 37.450], [55.820, 37.780],
    // Юго-запад / юго-восток
    [55.670, 37.450], [55.670, 37.780],
  ];

  areas.forEach((center, i) => {
    setTimeout(() => {
      const delta = 0.07;
      const bounds = [
        [center[0] - delta, center[1] - delta],
        [center[0] + delta, center[1] + delta],
      ];
      ymaps.search('АЗС', {
        boundedBy: bounds,
        strictBounds: true,
        results: 50,
      }).then(res => {
        processSearchResults(res);
        updateHeaderStats();
      }).catch(() => {});
    }, i * 300); // небольшая задержка между запросами
  });
}

function processSearchResults(res) {
  res.geoObjects.each(obj => {
    try {
      const coords = obj.geometry.getCoordinates();
      const props = obj.properties.getAll();

      // Получаем название и адрес
      const name = props.name ||
        (props.CompanyMetaData && props.CompanyMetaData.name) ||
        props.text || 'АЗС';
      const addr = props.description ||
        (props.CompanyMetaData && props.CompanyMetaData.address) ||
        props.address || '';

      // Фильтр — только АЗС
      const nameL = name.toLowerCase();
      const addrL = addr.toLowerCase();
      const isGas = nameL.includes('азс') || nameL.includes('заправ') ||
        nameL.includes('лукойл') || nameL.includes('газпром') ||
        nameL.includes('роснефть') || nameL.includes('татнефть') ||
        nameL.includes('shell') || nameL.includes('шелл') ||
        nameL.includes('ортк') || nameL.includes('нефть') ||
        nameL.includes('топлив') || nameL.includes('бензин') ||
        nameL.includes('автозаправ') || nameL.includes('bp') ||
        nameL.includes('neste') || nameL.includes('трасса');
      if (!isGas) return;

      // Уникальный ID по координатам с округлением 3 знака (~100м)
      const id = 'g_' + coords[0].toFixed(3) + '_' + coords[1].toFixed(3);
      if (State.stations[id]) return;

      const brand = detectBrand(name);
      const station = {
        id,
        brand: brand !== 'АЗС' ? brand : (name.length < 40 ? name : 'АЗС'),
        addr: addr || 'Москва',
        lat: coords[0],
        lng: coords[1],
        fuels: getFuels(brand),
        status: 'ok',
        source: 'yandex',
      };

      State.stations[id] = station;
      renderStation(station);
    } catch(e) {}
  });
}

// При перемещении по карте догружаем
let boundsTimer = null;
function onBoundsChange(e) {
  // Только если сильно изменились границы
  if (e.get('newZoom') !== e.get('oldZoom')) return;
  clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    const bounds = State.map.getBounds();
    ymaps.search('АЗС', {
      boundedBy: bounds,
      strictBounds: true,
      results: 50,
    }).then(res => {
      processSearchResults(res);
      updateHeaderStats();
    }).catch(() => {});
  }, 1000);
}

function detectBrand(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('лукойл'))            return 'Лукойл';
  if (t.includes('газпром'))           return 'Газпромнефть';
  if (t.includes('роснефть'))          return 'Роснефть';
  if (t.includes('татнефть'))          return 'Татнефть';
  if (t.includes('ортк'))              return 'ОРТК';
  if (t.includes('shell') || t.includes('шелл')) return 'Shell';
  if (t.includes(' bp') || t.startsWith('bp')) return 'BP';
  if (t.includes('neste'))             return 'Neste';
  if (t.includes('трасса'))            return 'Трасса';
  if (t.includes('сургут'))            return 'Сургутнефтегаз';
  if (t.includes('башнефть'))          return 'Башнефть';
  if (t.includes('евро'))              return 'ЕвроАЗС';
  return 'АЗС';
}

function getFuels(brand) {
  const premium = ['Shell', 'BP', 'Neste', 'Лукойл', 'Газпромнефть'];
  if (premium.includes(brand)) return ['АИ-92', 'АИ-95', 'АИ-98', 'ДТ'];
  return ['АИ-92', 'АИ-95', 'ДТ'];
}

function showLoader(on) {
  let el = document.getElementById('mapLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mapLoader';
    el.style.cssText = [
      'position:fixed', 'top:62px', 'left:50%', 'transform:translateX(-50%)',
      'background:#1a1917', 'color:#fff', 'padding:8px 18px',
      'border-radius:20px', 'font-size:13px', 'font-weight:500',
      'z-index:200', 'display:flex', 'align-items:center', 'gap:8px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)', 'white-space:nowrap',
    ].join(';');
    el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#E8341C;animation:pulse 1s infinite;display:inline-block"></span> Ищем заправки Москвы...';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

// ── МАРКЕРЫ ───────────────────────────────────────
function makeIcon(status) {
  const colors = { ok:'#1a9e5c', queue:'#d97706', limit:'#9333ea', empty:'#dc2626' };
  const c = colors[status] || colors.ok;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <path d="M15 2C8.9 2 4 6.9 4 13c0 8 11 23 11 23S26 21 26 13C26 6.9 21.1 2 15 2z"
      fill="${c}" stroke="white" stroke-width="1.5"/>
    <circle cx="15" cy="13" r="5.5" fill="white" opacity="0.92"/>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function renderStation(station) {
  if (!State.map || State.placemarks[station.id]) return;
  const status = getEffectiveStatus(station.id);
  const pm = new ymaps.Placemark(
    [station.lat, station.lng],
    { hintContent: station.brand + (station.addr ? '<br>' + station.addr : '') },
    {
      iconLayout: 'default#image',
      iconImageHref: makeIcon(status),
      iconImageSize: [30, 38],
      iconImageOffset: [-15, -38],
    }
  );
  pm.events.add('click', () => openPanel(station.id));
  State.map.geoObjects.add(pm);
  State.placemarks[station.id] = pm;
}

function updatePlacemark(id, status) {
  const pm = State.placemarks[id];
  if (pm) pm.options.set('iconImageHref', makeIcon(status));
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
  const last = reps.length ? reps.reduce((a,b) => a.ts>b.ts?a:b) : null;
  document.getElementById('panelUpdated').textContent = last ? 'обновлено ' + timeAgo(last.ts) : 'нет данных';

  document.getElementById('panelFuelTypes').innerHTML =
    (s.fuels || ['АИ-92','АИ-95','ДТ']).map(f => `<span class="fuel-tag">${f}</span>`).join('');

  renderReports(id);
}

function renderReports(id) {
  const el = document.getElementById('reportsList');
  const reps = (State.reports[id] || []).slice().sort((a,b) => b.ts-a.ts).slice(0,8);
  if (!reps.length) {
    el.innerHTML = '<div class="no-reports">Нет отчётов — будь первым!</div>';
    return;
  }
  el.innerHTML = reps.map(r => {
    const cfg = STATUS_CONFIG[r.type] || STATUS_CONFIG.ok;
    return `<div class="report-item">
      <span class="ri-dot ${r.type}"></span>
      <div class="ri-body">
        <div class="ri-type">${cfg.label}${r.note ? ' — '+r.note : ''}</div>
        <div class="ri-time">${timeAgo(r.ts)}</div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('panelClose').addEventListener('click', () => {
  document.getElementById('sidePanel').classList.remove('open');
  document.getElementById('sidePanel').setAttribute('aria-hidden','true');
  State.selectedId = null;
});

// ── ОТЧЁТ ────────────────────────────────────────
window.submitReport = function(type) {
  if (!State.selectedId) return;
  const r = { stationId: State.selectedId, type, note:'', ts: Date.now() };
  if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
  State.reports[r.stationId].push(r);
  updatePlacemark(r.stationId, type);
  refreshPanel(r.stationId);
  updateHeaderStats();
  pushFeedEvent(r);
  if (window._firebaseReady) {
    window._dbPush(window._dbRef(window._db,'reports'), { ...r, ts: window._dbTimestamp() });
  }
  showToast({ok:'✓ Бензин есть — спасибо!', queue:'⏱ Очередь отмечена', limit:'⚠ Лимит отмечен', empty:'✕ Нет бензина — отмечено'}[type]);
  document.querySelectorAll('.report-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.report-btn[data-type="${type}"]`);
  if (btn) { btn.classList.add('active'); setTimeout(() => btn.classList.remove('active'), 1500); }
};

// ── FIREBASE: ОТЧЁТЫ ─────────────────────────────
function loadReports() {
  SEED_REPORTS.forEach(r => {
    if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
    State.reports[r.stationId].push(r);
  });
  if (window._firebaseReady) {
    window._dbOnValue(window._dbRef(window._db,'reports'), snap => {
      const data = snap.val();
      if (!data) return;
      // Сбрасываем и перезагружаем
      Object.keys(State.reports).forEach(k => State.reports[k] = []);
      SEED_REPORTS.forEach(r => {
        if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
        State.reports[r.stationId].push(r);
      });
      Object.values(data).forEach(r => {
        if (!State.reports[r.stationId]) State.reports[r.stationId] = [];
        State.reports[r.stationId].push(r);
        pushFeedEvent(r);
      });
      Object.keys(State.stations).forEach(id => updatePlacemark(id, getEffectiveStatus(id)));
      if (State.selectedId) refreshPanel(State.selectedId);
      updateHeaderStats();
    });
  }
}

// ── ДОБАВИТЬ АЗС ─────────────────────────────────
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
  const brand = document.getElementById('addBrand').value;
  const addr  = document.getElementById('addAddr').value.trim() || 'Адрес не указан';
  const id = 'u' + Date.now();
  const station = { id, brand, addr, lat: State.newStationCoords[0], lng: State.newStationCoords[1], fuels: getFuels(brand), status: State.newStationStatus, addedBy:'user', ts: Date.now() };
  State.stations[id] = station;
  renderStation(station);
  if (window._firebaseReady) window._dbSet(window._dbRef(window._db,`stations/${id}`), station);
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
window.closeModal = function() { document.getElementById('modalAdd').classList.remove('open'); State.addingMode = false; };

// ── ЛЕНТА ────────────────────────────────────────
const feedEvents = [];
function initFeed() { SEED_REPORTS.slice().reverse().forEach(r => pushFeedEvent(r)); }
function pushFeedEvent(r) {
  const s = State.stations[r.stationId];
  if (!s) return;
  const cfg = STATUS_CONFIG[r.type] || STATUS_CONFIG.ok;
  feedEvents.unshift({ text: s.brand + ', ' + (s.addr||''), status: cfg.label, color: cfg.hex, time: timeAgo(r.ts) });
  if (feedEvents.length > 40) feedEvents.pop();
  renderFeed();
}
function renderFeed() {
  const items = feedEvents.slice(0,20);
  document.getElementById('feedInner').innerHTML =
    [...items,...items].map(ev =>
      `<div class="feed-event"><span class="fe-dot" style="background:${ev.color}"></span><span class="fe-name">${ev.text}</span><span>— ${ev.status}</span><span class="fe-time">${ev.time}</span></div>`
    ).join('');
}

// ── STATS ─────────────────────────────────────────
function updateHeaderStats() {
  const c = {ok:0,queue:0,limit:0,empty:0};
  Object.keys(State.stations).forEach(id => { const st=getEffectiveStatus(id); if(c[st]!==undefined) c[st]++; });
  document.getElementById('countOk').textContent    = c.ok;
  document.getElementById('countQueue').textContent = c.queue + c.limit;
  document.getElementById('countEmpty').textContent = c.empty;
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── UTILS ─────────────────────────────────────────
function timeAgo(ts) {
  const d = Math.floor((Date.now()-ts)/60000);
  if (d<1) return 'только что';
  if (d<60) return d+' мин назад';
  return Math.floor(d/60)+' ч назад';
}

window.addEventListener('firebase-ready', () => { State.firebaseReady = true; });

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!State.map) {
      document.getElementById('map').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#f0ede6;color:#6b6960;font-family:Inter,sans-serif;gap:12px;"><div style="font-size:40px">🗺️</div><div style="font-size:16px;font-weight:600;color:#1a1917">Карта не загрузилась</div><div style="font-size:13px;text-align:center;max-width:300px;line-height:1.6">Вставь ключ Яндекс.Карт в <code>index.html</code> вместо <code>ВСТАВЬ_СВОЙ_КЛЮЧ_ЗДЕСЬ</code></div></div>`;
      loadReports(); initFeed(); updateHeaderStats(); setupAddButton();
    }
  }, 4000);
});
