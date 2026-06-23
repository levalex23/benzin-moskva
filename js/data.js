// Начальный набор АЗС Москвы (резервные данные, если Firebase недоступен)
// При наличии Firebase — данные загружаются оттуда
window.STATIONS_SEED = [
  // Центр
  { id: 's001', brand: 'Газпромнефть', addr: 'Тверская ул., 5', lat: 55.7621, lng: 37.6097, fuels: ['АИ-92','АИ-95','ДТ'], status: 'ok' },
  { id: 's002', brand: 'Лукойл',       addr: 'Садовая-Самотёчная, 24', lat: 55.7700, lng: 37.6147, fuels: ['АИ-92','АИ-95','АИ-98','ДТ'], status: 'queue' },
  { id: 's003', brand: 'Роснефть',     addr: 'Новый Арбат, 31', lat: 55.7527, lng: 37.5813, fuels: ['АИ-92','АИ-95','ДТ'], status: 'ok' },
  // Север
  { id: 's004', brand: 'Лукойл',       addr: 'Ленинградское ш., 13', lat: 55.8017, lng: 37.5215, fuels: ['АИ-92','АИ-95','АИ-98','ДТ','ГАЗ'], status: 'ok' },
  { id: 's005', brand: 'Татнефть',     addr: 'Дмитровское ш., 40', lat: 55.8482, lng: 37.5614, fuels: ['АИ-92','АИ-95'], status: 'empty' },
  { id: 's006', brand: 'Газпромнефть', addr: 'Ярославское ш., 9', lat: 55.8253, lng: 37.6528, fuels: ['АИ-92','АИ-95','ДТ'], status: 'queue' },
  // Восток
  { id: 's007', brand: 'ОРТК',         addr: 'Шоссе Энтузиастов, 78', lat: 55.7571, lng: 37.7928, fuels: ['АИ-92','АИ-95','ДТ'], status: 'limit' },
  { id: 's008', brand: 'Роснефть',     addr: 'Рязанский пр., 62', lat: 55.7228, lng: 37.7849, fuels: ['АИ-92','АИ-95','АИ-98','ДТ'], status: 'empty' },
  { id: 's009', brand: 'Лукойл',       addr: 'Щёлковское ш., 4', lat: 55.7898, lng: 37.7531, fuels: ['АИ-92','АИ-95','ДТ'], status: 'ok' },
  // Юг
  { id: 's010', brand: 'Газпромнефть', addr: 'Варшавское ш., 87', lat: 55.6603, lng: 37.6194, fuels: ['АИ-92','АИ-95','ДТ','ГАЗ'], status: 'ok' },
  { id: 's011', brand: 'Лукойл',       addr: 'Каширское ш., 52', lat: 55.6481, lng: 37.6873, fuels: ['АИ-92','АИ-95','АИ-98','ДТ'], status: 'queue' },
  { id: 's012', brand: 'Роснефть',     addr: 'Проектируемый пр., 4062', lat: 55.6213, lng: 37.5922, fuels: ['АИ-92','АИ-95','ДТ'], status: 'ok' },
  // Запад
  { id: 's013', brand: 'Shell',        addr: 'Кутузовский пр., 40', lat: 55.7342, lng: 37.3881, fuels: ['АИ-95','АИ-98','ДТ'], status: 'ok' },
  { id: 's014', brand: 'BP',           addr: 'Новорижское ш., 3 км', lat: 55.7749, lng: 37.3224, fuels: ['АИ-92','АИ-95','АИ-98','ДТ'], status: 'ok' },
  { id: 's015', brand: 'Татнефть',     addr: 'Можайское ш., 11', lat: 55.7298, lng: 37.3428, fuels: ['АИ-92','АИ-95'], status: 'empty' },
  // МКАД
  { id: 's016', brand: 'ОРТК',         addr: 'МКАД 45 км (север)', lat: 55.8721, lng: 37.4217, fuels: ['АИ-92','АИ-95','ДТ'], status: 'limit' },
  { id: 's017', brand: 'Лукойл',       addr: 'МКАД 84 км (юго-запад)', lat: 55.6314, lng: 37.3571, fuels: ['АИ-92','АИ-95','АИ-98','ДТ'], status: 'ok' },
  { id: 's018', brand: 'Газпромнефть', addr: 'МКАД 105 км (юг)', lat: 55.5889, lng: 37.6021, fuels: ['АИ-92','АИ-95','ДТ'], status: 'queue' },
  { id: 's019', brand: 'Роснефть',     addr: 'МКАД 13 км (восток)', lat: 55.7831, lng: 37.8612, fuels: ['АИ-92','АИ-95','ДТ'], status: 'ok' },
  { id: 's020', brand: 'Татнефть',     addr: 'МКАД 61 км (северо-восток)', lat: 55.8902, lng: 37.7348, fuels: ['АИ-92','АИ-95'], status: 'empty' },
];

// Цвета и метки статусов
window.STATUS_CONFIG = {
  ok:    { label: 'Бензин есть', color: '#1a9e5c', bg: '#e6f7ef', text: '#0d5c34', hex: '#1a9e5c' },
  queue: { label: 'Очередь',     color: '#d97706', bg: '#fef3cd', text: '#7c4a00', hex: '#d97706' },
  limit: { label: 'Лимит',       color: '#9333ea', bg: '#f3e8ff', text: '#5b21b6', hex: '#9333ea' },
  empty: { label: 'Нет бензина', color: '#dc2626', bg: '#fee2e2', text: '#7f1d1d', hex: '#dc2626' },
};

// Примеры отчётов для начального состояния
window.SEED_REPORTS = [
  { stationId:'s005', type:'empty', note:'АИ-95 закончился, говорят завоз завтра', ts: Date.now() - 25*60000 },
  { stationId:'s006', type:'queue', note:'Очередь ~25 мин, лимит 40л', ts: Date.now() - 18*60000 },
  { stationId:'s007', type:'limit', note:'Не больше 30л на машину', ts: Date.now() - 10*60000 },
  { stationId:'s008', type:'empty', note:'Закрыто, вывеска «нет топлива»', ts: Date.now() - 40*60000 },
  { stationId:'s015', type:'empty', note:'АИ-92 и АИ-95 нет', ts: Date.now() - 55*60000 },
  { stationId:'s016', type:'limit', note:'Лимит 60л, касса принимает только карты', ts: Date.now() - 8*60000 },
  { stationId:'s018', type:'queue', note:'Выстроилась очередь из 15 машин', ts: Date.now() - 30*60000 },
  { stationId:'s020', type:'empty', note:'Бензина нет, дизель есть', ts: Date.now() - 20*60000 },
  { stationId:'s002', type:'queue', note:'Медленно, примерно 20 мин', ts: Date.now() - 12*60000 },
  { stationId:'s011', type:'queue', note:'Очередь но движется, ~10 мин', ts: Date.now() - 5*60000 },
];
