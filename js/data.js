window.STATUS_CONFIG = {
  ok:    { label:'Бензин есть', color:'#1a9e5c', bg:'#e6f7ef', text:'#0d5c34', hex:'#1a9e5c' },
  queue: { label:'Очередь',     color:'#d97706', bg:'#fef3cd', text:'#7c4a00', hex:'#d97706' },
  limit: { label:'Лимит',       color:'#9333ea', bg:'#f3e8ff', text:'#5b21b6', hex:'#9333ea' },
  empty: { label:'Нет бензина', color:'#dc2626', bg:'#fee2e2', text:'#7f1d1d', hex:'#dc2626' },
};

// Заправки загружаются из OpenStreetMap через Overpass API
// Этот массив пуст — данные приходят динамически
window.STATIONS_SEED = [];

window.SEED_REPORTS = [];

// Загрузка всех АЗС Москвы из OpenStreetMap
window.loadOSMStations = function(onLoaded) {
  // Запрос Overpass: все точки и полигоны с тегом amenity=fuel в границах Москвы
  const query = `
    [out:json][timeout:30];
    (
      node["amenity"="fuel"](55.49,37.27,55.92,37.97);
      way["amenity"="fuel"](55.49,37.27,55.92,37.97);
    );
    out center;
  `;

  const url = 'https://overpass-api.de/api/interpreter';

  fetch(url, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  .then(r => r.json())
  .then(data => {
    const stations = [];
    data.elements.forEach(el => {
      const lat = el.lat || (el.center && el.center.lat);
      const lng = el.lon || (el.center && el.center.lon);
      if (!lat || !lng) return;

      const tags = el.tags || {};
      const brand = detectBrandOSM(tags);
      const addr = buildAddr(tags);
      const fuels = detectFuels(tags);

      stations.push({
        id: 'osm_' + el.id,
        brand,
        addr,
        lat,
        lng,
        fuels,
        status: 'ok',
        source: 'osm',
      });
    });
    window.STATIONS_SEED = stations;
    if (onLoaded) onLoaded(stations);
  })
  .catch(err => {
    console.warn('Overpass недоступен, пробуем зеркало...', err);
    // Резервное зеркало
    fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    .then(r => r.json())
    .then(data => {
      const stations = [];
      data.elements.forEach(el => {
        const lat = el.lat || (el.center && el.center.lat);
        const lng = el.lon || (el.center && el.center.lon);
        if (!lat || !lng) return;
        const tags = el.tags || {};
        stations.push({
          id: 'osm_' + el.id,
          brand: detectBrandOSM(tags),
          addr: buildAddr(tags),
          lat, lng,
          fuels: detectFuels(tags),
          status: 'ok',
          source: 'osm',
        });
      });
      window.STATIONS_SEED = stations;
      if (onLoaded) onLoaded(stations);
    })
    .catch(() => {
      if (onLoaded) onLoaded([]);
    });
  });
};

function detectBrandOSM(tags) {
  const name = (tags.brand || tags.name || tags.operator || '').trim();
  const n = name.toLowerCase();
  if (n.includes('лукойл') || n.includes('lukoil'))       return 'Лукойл';
  if (n.includes('газпром') || n.includes('gazprom'))     return 'Газпромнефть';
  if (n.includes('роснефть') || n.includes('rosneft'))    return 'Роснефть';
  if (n.includes('татнефть') || n.includes('tatneft'))    return 'Татнефть';
  if (n.includes('ортк'))                                  return 'ОРТК';
  if (n.includes('shell') || n.includes('шелл'))          return 'Shell';
  if (n.includes('bp') || n.includes('бп'))               return 'BP';
  if (n.includes('neste') || n.includes('несте'))         return 'Neste';
  if (n.includes('трасса'))                                return 'Трасса';
  if (n.includes('башнефть'))                              return 'Башнефть';
  if (n.includes('сургут'))                                return 'Сургутнефтегаз';
  if (n.includes('евро'))                                  return 'ЕвроАЗС';
  if (n.includes('tnk') || n.includes('тнк'))             return 'ТНК';
  if (name) return name;
  return 'АЗС';
}

function buildAddr(tags) {
  const parts = [];
  if (tags['addr:street'])      parts.push(tags['addr:street']);
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (parts.length) return parts.join(', ');
  if (tags.name && tags.name.length < 60) return tags.name;
  return 'Москва';
}

function detectFuels(tags) {
  const fuels = [];
  if (tags['fuel:octane_92'] === 'yes' || tags['fuel:92'])  fuels.push('АИ-92');
  if (tags['fuel:octane_95'] === 'yes' || tags['fuel:95'])  fuels.push('АИ-95');
  if (tags['fuel:octane_98'] === 'yes' || tags['fuel:98'])  fuels.push('АИ-98');
  if (tags['fuel:diesel'] === 'yes')                         fuels.push('ДТ');
  if (tags['fuel:lpg'] === 'yes' || tags['fuel:gas'])        fuels.push('ГАЗ');
  return fuels.length ? fuels : ['АИ-92', 'АИ-95', 'ДТ'];
}
