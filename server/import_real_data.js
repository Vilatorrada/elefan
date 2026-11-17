import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, saveDb, closeDb, isAptSupport, applyPhysicalPoleDeduplication } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geojsonPath = path.join(__dirname, '../punts_de_llum.geojson');

console.log('Llegint punts_de_llum.geojson...');
const geojsonRaw = fs.readFileSync(geojsonPath, 'utf8');
const geojson = JSON.parse(geojsonRaw);

const features = geojson.features || [];
console.log(`Carregades ${features.length} entitats del GeoJSON.`);

// Extreure faroles geolocalitzades amb 3 estats:
// - Columna i Bàcul -> APTA (seleccionable per l'Ajuntament; inicialment no seleccionada)
// - Resta de suports (façana, paret, pal de fusta...) -> NO_APTA (bloquejada i no seleccionable)
const validLamps = [];
const seenCodes = new Set();

features.forEach(f => {
  const props = f.properties || {};
  const lat = props.latitud;
  const lng = props.longitud;
  const street = props.carrer;

  if (lat && lng && street) {
    const codi = props.codi || `F-${props.id}`;
    if (seenCodes.has(codi)) return;
    seenCodes.add(codi);

    const suport = props.suport || 'Columna';
    const isApt = isAptSupport(suport);

    validLamps.push({
      id: props.id,
      codi,
      carrer: street.trim(),
      num: props.num || 's/n',
      suport,
      lampada: props.lampada || 'LED',
      potencia: props.potencia || '30',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      status: isApt ? 'APTA' : 'NO_APTA',
      suitable: isApt,
      selected: false,
      lockedUnsuitable: !isApt,
      unsuitableReason: isApt ? '' : `Suport no apte (${suport}) — només s'admeten Columna i Bàcul`,
      lotId: null
    });
  }
});

// Ordenar per carrer i posició espacial
validLamps.sort((a, b) => {
  const cmpStreet = a.carrer.localeCompare(b.carrer, 'ca');
  if (cmpStreet !== 0) return cmpStreet;
  return (a.lat - b.lat) || (a.lng - b.lng);
});

const aptCount = validLamps.filter(l => l.status === 'APTA').length;
const nonAptCount = validLamps.filter(l => l.status === 'NO_APTA').length;
console.log(`Inventari importat: ${validLamps.length} faroles (${aptCount} Aptes [Columna + Bàcul], ${nonAptCount} No Aptes bloquejades, 0 Seleccionades).`);

const db = getDb();

db.electionInfo.status = 'OPEN';
db.lamps = validLamps;
db.lots = [];
delete db.zones;

const seatDistribution = [
  { id: 'ERC', ratio: 0.26 },
  { id: 'JUNTS', ratio: 0.22 },
  { id: 'PSC', ratio: 0.17 },
  { id: 'AXSJ', ratio: 0.12 },
  { id: 'CXSJ', ratio: 0.11 },
  { id: 'CUP', ratio: 0.08 },
  { id: 'PP', ratio: 0.04 }
];

db.parties.forEach(p => {
  const dist = seatDistribution.find(d => d.id === p.id);
  if (dist) {
    p.quotaRatio = dist.ratio;
  }
});

db.lotPreferences = {};
db.lotOrderPreferences = {};
delete db.lotCategoryModes;
db.locationPreferences = {};
db.allocationResults = null;

applyPhysicalPoleDeduplication(db);
const finalApt = db.lamps.filter(l => l.status === 'APTA').length;
const finalNoApt = db.lamps.filter(l => l.status === 'NO_APTA').length;

saveDb(db);
closeDb();
console.log(
  `Base de dades SQLite (eleccions.sqlite) reinicialitzada! (${db.lamps.length} totals | ${finalApt} suports físics Aptes | ${finalNoApt} No Aptes | ${db.lots.length} lots inicials)`
);
