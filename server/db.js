import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_FILE = path.join(__dirname, 'seed.json');

function resolveDataDir() {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, 'data');
}

function resolveSqlitePath() {
  if (process.env.SQLITE_FILE) {
    return path.resolve(process.env.SQLITE_FILE);
  }
  return path.join(resolveDataDir(), 'eleccions.sqlite');
}

// Initial Data Seed for Ajuntament de Sant Joan de Vilatorrada
const initialData = {
  electionInfo: {
    id: "MUN_2027",
    title: "Eleccions Municipals 2027 - Sant Joan de Vilatorrada",
    date: "24 de Maig de 2027",
    deadline: "2027-05-01T23:59:59Z",
    status: "OPEN", // "OPEN", "CLOSED", "ALLOCATED"
    totalStreetlampsAvailable: 0,
    totalLocationsAvailable: 16
  },
  parties: [
    {
      id: "ERC",
      name: "Esquerra Republicana de Catalunya - Acord Municipal",
      acronym: "ERC-AM",
      color: "#FFB200",
      seats: 5,
      votes: 1420,
      orderRank: 1, // 1st choice in round robin
      allocatedStreetlampsQuota: 95,
      allocatedLocationsQuota: 4,
      username: "ERC",
      password: "erc"
    },
    {
      id: "JUNTS",
      name: "Junts per Sant Joan de Vilatorrada i Sant Martí - CM",
      acronym: "JUNTS",
      color: "#00C4B3",
      seats: 4,
      votes: 1180,
      orderRank: 2,
      allocatedStreetlampsQuota: 80,
      allocatedLocationsQuota: 3,
      username: "JUNTS",
      password: "junts"
    },
    {
      id: "PSC",
      name: "Partit dels Socialistes de Catalunya - CP",
      acronym: "PSC-CP",
      color: "#E52320",
      seats: 3,
      votes: 950,
      orderRank: 3,
      allocatedStreetlampsQuota: 65,
      allocatedLocationsQuota: 3,
      username: "PSC",
      password: "psc"
    },
    {
      id: "AXSJ",
      name: "Alternativa per Sant Joan",
      acronym: "AxSJ",
      color: "#8B5CF6",
      seats: 2,
      votes: 680,
      orderRank: 4,
      allocatedStreetlampsQuota: 45,
      allocatedLocationsQuota: 2,
      username: "AXSJ",
      password: "axsj"
    },
    {
      id: "CXSJ",
      name: "Compromís amb Sant Joan - Confluència",
      acronym: "CxSJ",
      color: "#10B981",
      seats: 2,
      votes: 590,
      orderRank: 5,
      allocatedStreetlampsQuota: 40,
      allocatedLocationsQuota: 2,
      username: "CXSJ",
      password: "cxsj"
    },
    {
      id: "CUP",
      name: "Candidatura d'Unitat Popular - AMunt",
      acronym: "CUP-AMunt",
      color: "#FACC15",
      seats: 1,
      votes: 380,
      orderRank: 6,
      allocatedStreetlampsQuota: 25,
      allocatedLocationsQuota: 1,
      username: "CUP",
      password: "cup"
    },
    {
      id: "PP",
      name: "Partit Popular de Catalunya",
      acronym: "PP",
      color: "#1D4ED8",
      seats: 0,
      votes: 210,
      orderRank: 7,
      allocatedStreetlampsQuota: 15,
      allocatedLocationsQuota: 1,
      username: "PP",
      password: "pp"
    }
  ],
  admin: {
    username: "admin",
    password: "admin",
    name: "Oficina d'Estadística i Eleccions - Sant Joan de Vilatorrada"
  },

  // Geolocated municipal streetlamps inventory (all unsuitable by default until validated)
  lamps: [],

  // Streetlamp Lots created manually by municipal staff (empty by default)
  lots: [],

  // Billboard locations (Emplaçaments per pancartes / panells)
  locations: [
    {
      id: "EMP-01",
      name: "Plaça Major - Façana Cal Gallifa",
      address: "Plaça Major, s/n",
      description: "Panell electoral central de gran format a la zona de vianants.",
      capacity: 3,
      lat: 41.7472,
      lng: 1.8071,
      imageUrl: "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-02",
      name: "Passeig del Riu - Accés Complex Esportiu",
      address: "Passeig del Riu, 12",
      description: "Lloc d'alta visibilitat per a conductors i vianants.",
      capacity: 2,
      lat: 41.7450,
      lng: 1.8100,
      imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623266010b?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-03",
      name: "Carrer Major - Entrada Sud (Rotonda Manresa)",
      address: "Carrer Major, 1",
      description: "Panell a la rotonda d'entrada principal al municipi des de Manresa.",
      capacity: 3,
      lat: 41.7435,
      lng: 1.8048,
      imageUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-04",
      name: "Avinguda de Montserrat - Cruïlla Carrer Girona",
      address: "Av. Montserrat, 45",
      description: "Zona comercial i de pas de línia d'autobús interurbà.",
      capacity: 2,
      lat: 41.7438,
      lng: 1.8080,
      imageUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-05",
      name: "Cal Gallifa - Espai Cultural",
      address: "Carrer de les Escoles, 2",
      description: "Panell davant de la Biblioteca i Centre Cultural Cal Gallifa.",
      capacity: 2,
      lat: 41.7490,
      lng: 1.8085,
      imageUrl: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-06",
      name: "Plaça de la Pau",
      address: "Plaça de la Pau",
      description: "Panell fix municipal en zona residencial central.",
      capacity: 2,
      lat: 41.7455,
      lng: 1.8072,
      imageUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-07",
      name: "Zona Escolar - Institut i Escola Bressol",
      address: "Av. de les Escoles, 15",
      description: "Panell proper als centres educatius de la vila.",
      capacity: 2,
      lat: 41.7510,
      lng: 1.8090,
      imageUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "EMP-08",
      name: "Sant Martí de Torroella - Plaça de l'EMD",
      address: "Plaça de l'Església, Sant Martí",
      description: "Panell situat al nucli de Sant Martí de Torroella.",
      capacity: 1,
      lat: 41.7525,
      lng: 1.8060,
      imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&auto=format&fit=crop&q=60"
    }
  ],

  // Store party streetlamp priority per lot: { [partyId]: { [lotId]: { orderedLampCodes: string[] } } }
  lotPreferences: {},

  // Store party lot importance order: { [partyId]: [ lotId1, lotId2, ... ] }
  lotOrderPreferences: {},

  // Store party location priority: { [partyId]: [ locationId1, locationId2, ... ] }
  locationPreferences: {},

  // Final allocation results generated by algorithm
  allocationResults: null,

  // Historical election preferences for cloning feature
  historicalPreferences: {
    "MUN_2023": {
      title: "Eleccions Municipals 2023",
      lotPreferences: {
        "ERC": { "LOT-01": { category: 1 }, "LOT-02": { category: 1 }, "LOT-07": { category: 2 }, "LOT-13": { category: 1 } },
        "JUNTS": { "LOT-03": { category: 1 }, "LOT-13": { category: 1 }, "LOT-14": { category: 1 }, "LOT-02": { category: 2 } },
        "PSC": { "LOT-02": { category: 1 }, "LOT-06": { category: 1 }, "LOT-08": { category: 2 } }
      },
      locationPreferences: {
        "ERC": ["EMP-01", "EMP-03", "EMP-05", "EMP-02", "EMP-04"],
        "JUNTS": ["EMP-03", "EMP-01", "EMP-04", "EMP-02", "EMP-06"],
        "PSC": ["EMP-02", "EMP-01", "EMP-03", "EMP-04", "EMP-05"]
      }
    },
    "AUT_2024": {
      title: "Eleccions al Parlament de Catalunya 2024",
      lotPreferences: {
        "ERC": { "LOT-01": { category: 1 }, "LOT-03": { category: 1 }, "LOT-14": { category: 2 } },
        "JUNTS": { "LOT-01": { category: 1 }, "LOT-02": { category: 1 }, "LOT-13": { category: 1 } },
        "PSC": { "LOT-03": { category: 1 }, "LOT-04": { category: 1 }, "LOT-07": { category: 2 } }
      },
      locationPreferences: {
        "ERC": ["EMP-01", "EMP-05", "EMP-03", "EMP-02"],
        "JUNTS": ["EMP-01", "EMP-03", "EMP-02", "EMP-04"],
        "PSC": ["EMP-03", "EMP-02", "EMP-01", "EMP-05"]
      }
    }
  }
};

// Default electoral proportionality ratios for Sant Joan de Vilatorrada
const DEFAULT_PARTY_RATIOS = {
  ERC: 0.26,
  JUNTS: 0.22,
  PSC: 0.17,
  AXSJ: 0.12,
  CXSJ: 0.11,
  CUP: 0.08,
  PP: 0.04
};

function distributeQuotaLargestRemainder(totalItems, weights, parties, maxPerParty = Infinity) {
  if (totalItems <= 0 || parties.length === 0) {
    return parties.map(() => 0);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const exactQuotas = weights.map(w => (w / weightSum) * totalItems);
  const alloc = exactQuotas.map(q => Math.min(maxPerParty, Math.floor(q)));
  let remainder = Math.min(totalItems, maxPerParty * parties.length) - alloc.reduce((a, b) => a + b, 0);

  while (remainder > 0) {
    const candidates = exactQuotas
      .map((q, idx) => ({ idx, diff: q - alloc[idx], rank: parties[idx].orderRank || idx }))
      .filter(c => alloc[c.idx] < maxPerParty)
      .sort((a, b) => (b.diff - a.diff) || (a.rank - b.rank));

    if (candidates.length === 0) break;
    alloc[candidates[0].idx] += 1;
    remainder -= 1;
  }
  return alloc;
}

export function isAptSupport(suport) {
  const norm = String(suport || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return norm === 'columna' || norm === 'bacul';
}

/**
 * Identifies secondary luminaires mounted on the exact same physical `Columna`/`Bàcul` support (`< 1.8 m` apart),
 * ensuring 1 physical pole = 1 electoral streetlamp (`codi` -> primary `codi` on that pole).
 */
export function findSecondaryPoleMap(lamps = [], lotMembershipCodes = null, maxDistMeters = 1.8) {
  const candidates = (lamps || []).filter(
    l => isAptSupport(l.suport) && typeof l.lat === 'number' && typeof l.lng === 'number'
  );
  const visited = new Uint8Array(candidates.length);
  const secondaryToPrimary = new Map();

  for (let i = 0; i < candidates.length; i++) {
    if (visited[i]) continue;
    visited[i] = 1;
    const cluster = [candidates[i]];

    for (let h = 0; h < cluster.length; h++) {
      const ref = cluster[h];
      for (let j = i + 1; j < candidates.length; j++) {
        if (visited[j]) continue;
        const cand = candidates[j];
        const dMeters = Math.hypot((ref.lat - cand.lat) * 111320, (ref.lng - cand.lng) * 83000);
        if (dMeters < maxDistMeters) {
          visited[j] = 1;
          cluster.push(cand);
        }
      }
    }

    if (cluster.length > 1) {
      cluster.sort((a, b) => {
        const inLotA = lotMembershipCodes
          ? (lotMembershipCodes.has(String(a.codi)) ? 1 : 0)
          : (a.lotId ? 1 : 0);
        const inLotB = lotMembershipCodes
          ? (lotMembershipCodes.has(String(b.codi)) ? 1 : 0)
          : (b.lotId ? 1 : 0);
        if (inLotB !== inLotA) return inLotB - inLotA;

        const selA = (a.status === 'SELECCIONADA' || a.selected) ? 1 : 0;
        const selB = (b.status === 'SELECCIONADA' || b.selected) ? 1 : 0;
        if (selB !== selA) return selB - selA;

        return String(a.codi || '').localeCompare(String(b.codi || ''), 'ca', { numeric: true });
      });

      const primaryCodi = String(cluster[0].codi);
      for (let k = 1; k < cluster.length; k++) {
        secondaryToPrimary.set(String(cluster[k].codi), primaryCodi);
      }
    }
  }

  return secondaryToPrimary;
}

export function applyPhysicalPoleDeduplication(db) {
  if (!db || !Array.isArray(db.lamps)) return 0;
  const lotCodesSet = new Set();
  (db.lots || []).forEach(lot => {
    const codes = Array.isArray(lot.lampCodes)
      ? lot.lampCodes
      : (lot.lamps || []).map(l => l.codi);
    codes.forEach(c => lotCodesSet.add(String(c)));
  });

  const secondaryMap = findSecondaryPoleMap(db.lamps, lotCodesSet, 1.8);
  let dedupedCount = 0;

  db.lamps.forEach(lamp => {
    const primaryCodi = secondaryMap.get(String(lamp.codi));
    if (primaryCodi) {
      lamp.status = 'NO_APTA';
      lamp.suitable = false;
      lamp.selected = false;
      lamp.lockedUnsuitable = true;
      lamp.unsuitableReason = `Lluminària secundària al mateix suport (${primaryCodi})`;
      dedupedCount += 1;
    }
  });

  recalculateLotsAndQuotas(db);
  return dedupedCount;
}

export function cleanupDeletedLotReferences(db, deletedLotIds) {
  if (!db || !Array.isArray(deletedLotIds) || deletedLotIds.length === 0) return;
  const deletedSet = new Set(deletedLotIds);
  if (db.lotPreferences && typeof db.lotPreferences === 'object') {
    Object.values(db.lotPreferences).forEach(partyPrefs => {
      if (!partyPrefs || typeof partyPrefs !== 'object') return;
      deletedLotIds.forEach(lid => {
        delete partyPrefs[lid];
      });
    });
  }
  if (db.lotOrderPreferences && typeof db.lotOrderPreferences === 'object') {
    Object.keys(db.lotOrderPreferences).forEach(pid => {
      if (Array.isArray(db.lotOrderPreferences[pid])) {
        db.lotOrderPreferences[pid] = db.lotOrderPreferences[pid].filter(lid => !deletedSet.has(lid));
      }
    });
  }
  if (db.allocationResults) {
    deletedLotIds.forEach(lid => {
      if (db.allocationResults.lotLampAssignments?.[lid]) {
        Object.keys(db.allocationResults.lotLampAssignments[lid]).forEach(lampCode => {
          if (db.allocationResults.lampAssignments) {
            delete db.allocationResults.lampAssignments[lampCode];
          }
        });
        delete db.allocationResults.lotLampAssignments[lid];
      }
      if (db.allocationResults.lotPartyCounts) {
        delete db.allocationResults.lotPartyCounts[lid];
      }
      if (db.allocationResults.resolvedLotQuotas) {
        delete db.allocationResults.resolvedLotQuotas[lid];
      }
    });
    if (db.allocationResults.partyAssignedLamps) {
      Object.keys(db.allocationResults.partyAssignedLamps).forEach(pid => {
        db.allocationResults.partyAssignedLamps[pid] = 0;
      });
      if (db.allocationResults.lampAssignments) {
        Object.values(db.allocationResults.lampAssignments).forEach(pid => {
          if (db.allocationResults.partyAssignedLamps[pid] !== undefined) {
            db.allocationResults.partyAssignedLamps[pid] += 1;
          }
        });
      }
    }
  }
}

export function normalizeLampState(lamp) {
  if (!lamp) return lamp;

  let isApt;
  if (lamp.status === 'NO_APTA') {
    isApt = false;
  } else if (lamp.status === 'APTA' || lamp.status === 'SELECCIONADA') {
    isApt = true;
  } else if (lamp.suitable !== undefined) {
    isApt = Boolean(lamp.suitable);
  } else {
    isApt = isAptSupport(lamp.suport);
  }

  if (!isApt) {
    lamp.status = 'NO_APTA';
    lamp.suitable = false;
    lamp.selected = false;
    lamp.lockedUnsuitable = true;
    if (!lamp.unsuitableReason) {
      lamp.unsuitableReason = isAptSupport(lamp.suport)
        ? 'Declarada No Apta manualment'
        : `Suport no apte per defecte (${lamp.suport || 'altres'})`;
    }
  } else {
    const isSelected = lamp.selected !== undefined
      ? Boolean(lamp.selected)
      : lamp.status === 'SELECCIONADA';
    lamp.suitable = true;
    lamp.selected = isSelected;
    lamp.status = isSelected ? 'SELECCIONADA' : 'APTA';
    lamp.lockedUnsuitable = false;
    lamp.unsuitableReason = '';
  }
  return lamp;
}

/**
 * Syncs top-level `db.lamps` (3 states: NO_APTA, APTA, SELECCIONADA) with `db.lots`,
 * hydrates lot coordinates & lamp lists, recalculates each lot's active (`SELECCIONADA`) `lampCount`,
 * and proportionally distributes streetlamp & location quotas across parties (Largest Remainder Method).
 */
export function recalculateLotsAndQuotas(db) {
  if (!db) return db;
  if (!Array.isArray(db.lots)) db.lots = [];

  // Backward-compatible migration if `db.lamps` did not exist yet
  if (!Array.isArray(db.lamps)) {
    const migrated = [];
    const seen = new Set();
    db.lots.forEach(lot => {
      if (Array.isArray(lot.lamps)) {
        lot.lamps.forEach(lamp => {
          const code = lamp.codi || String(lamp.id);
          if (code && !seen.has(code)) {
            seen.add(code);
            migrated.push(normalizeLampState({
              ...lamp,
              codi: code,
              selected: lamp.selected ?? (lamp.suitable === true),
              lotId: lot.id
            }));
          }
        });
      }
    });
    db.lamps = migrated;
  }

  // Normalize all lamps and index ONLY `SELECCIONADA` lamps for lot membership
  // (Business rule: a Lot can ONLY contain streetlamps with status === 'SELECCIONADA')
  const lampByKey = new Map();
  db.lamps.forEach(lamp => {
    normalizeLampState(lamp);
    lamp.lotId = null;
    if (lamp.status === 'SELECCIONADA') {
      if (lamp.codi) lampByKey.set(String(lamp.codi), lamp);
      if (lamp.id !== undefined && lamp.id !== null) lampByKey.set(String(lamp.id), lamp);
    }
  });

  const assignedCodes = new Set();
  let totalAvailableLamps = 0;
  const prunedEmptyLotIds = [];
  const nextLots = [];

  db.lots.forEach(lot => {
    const rawCodes = Array.isArray(lot.lampCodes)
      ? lot.lampCodes
      : Array.isArray(lot.lamps)
        ? lot.lamps.map(l => l.codi || String(l.id))
        : [];

    if (db.lamps.length > 0) {
      const lotLamps = [];
      rawCodes.forEach(rawKey => {
        const lamp = lampByKey.get(String(rawKey));
        if (lamp && lamp.status === 'SELECCIONADA' && !assignedCodes.has(lamp.codi)) {
          assignedCodes.add(lamp.codi);
          lamp.lotId = lot.id;
          lotLamps.push(lamp);
        }
      });

      if (lotLamps.length === 0) {
        prunedEmptyLotIds.push(lot.id);
        return;
      }

      // Keep spatial order along street for clean LineString / ConvexHull geometry
      lotLamps.sort((a, b) => (a.lat - b.lat) || (a.lng - b.lng));

      lot.lampCodes = lotLamps.map(l => l.codi);
      lot.lamps = lotLamps.map(l => ({ ...l }));
      lot.coords = lotLamps.map(l => [l.lat, l.lng]);
      lot.totalLampCount = lotLamps.length;
      lot.lampCount = lotLamps.length;
      delete lot.unsuitable;
      delete lot.unsuitableReason;
    } else if (Array.isArray(lot.lamps) && lot.lamps.length > 0) {
      const selectedOnly = lot.lamps.filter(l => (l.status ? l.status === 'SELECCIONADA' : l.suitable === true));
      if (selectedOnly.length === 0) {
        prunedEmptyLotIds.push(lot.id);
        return;
      }
      lot.lamps = selectedOnly;
      lot.totalLampCount = selectedOnly.length;
      lot.lampCount = selectedOnly.length;
      delete lot.unsuitable;
    } else {
      lot.coords = Array.isArray(lot.coords) ? lot.coords : [];
      lot.totalLampCount = lot.totalLampCount ?? lot.lampCount ?? 0;
      lot.lampCount = lot.totalLampCount;
      delete lot.unsuitable;
    }

    if (!lot.reserved && lot.lampCount > 0) {
      totalAvailableLamps += lot.lampCount;
    }
    nextLots.push(lot);
  });

  db.lots = nextLots;

  if (prunedEmptyLotIds.length > 0) {
    cleanupDeletedLotReferences(db, prunedEmptyLotIds);
  }

  const maxSlotsPerLoc = Array.isArray(db.parties) && db.parties.length > 0 ? db.parties.length : 99;
  const totalAvailableLocations = Array.isArray(db.locations)
    ? db.locations.reduce((acc, loc) => acc + Math.min(Math.max(0, Number(loc.capacity) || 0), maxSlotsPerLoc), 0)
    : 0;

  if (db.electionInfo) {
    db.electionInfo.totalStreetlampsAvailable = totalAvailableLamps;
    db.electionInfo.totalLocationsAvailable = totalAvailableLocations;
  }

  // Proportionally recalculate global AND per-lot streetlamp quotas (with cumulative remainder compensation)
  if (Array.isArray(db.parties) && db.parties.length > 0) {
    db.parties.sort((a, b) => (Number(a.orderRank) || 999) - (Number(b.orderRank) || 999));

    const totalVotes = db.parties.reduce((acc, p) => acc + (Number(p.votes) || 0), 0);
    db.parties.forEach((p, idx) => {
      if (!p.orderRank) p.orderRank = idx + 1;
      if (p.quotaPct === undefined || p.quotaPct === null || Number.isNaN(Number(p.quotaPct))) {
        if (p.quotaRatio !== undefined) {
          p.quotaPct = Number((Number(p.quotaRatio) * 100).toFixed(2));
        } else if (DEFAULT_PARTY_RATIOS[p.id] !== undefined) {
          p.quotaPct = Number((DEFAULT_PARTY_RATIOS[p.id] * 100).toFixed(2));
        } else {
          p.quotaPct = totalVotes > 0
            ? Number((((Number(p.votes) || 0) / totalVotes) * 100).toFixed(2))
            : Number((100 / db.parties.length).toFixed(2));
        }
      } else {
        p.quotaPct = Math.max(0, Number(p.quotaPct));
      }
    });

    const rawWeights = db.parties.map(p => Math.max(0, Number(p.quotaPct) || 0));
    const rawSum = rawWeights.reduce((a, b) => a + b, 0);
    const normWeights = rawSum > 0
      ? rawWeights.map(w => w / rawSum)
      : db.parties.map(() => 1 / db.parties.length);

    const maxLocationsPerParty = Array.isArray(db.locations) ? db.locations.length : 0;
    const lampQuotas = distributeQuotaLargestRemainder(totalAvailableLamps, normWeights, db.parties);
    const locQuotas = distributeQuotaLargestRemainder(totalAvailableLocations, normWeights, db.parties, maxLocationsPerParty);

    db.parties.forEach((p, idx) => {
      p.effectiveQuotaPct = Number((normWeights[idx] * 100).toFixed(2));
      p.allocatedStreetlampsQuota = lampQuotas[idx];
      p.allocatedLocationsQuota = locQuotas[idx];
    });

    // Compute per-lot guaranteed floors (`partyMinQuotas`), proportional ceilings (`partyMaxQuotas`),
    // disputable remainder seats (`remainderSlots`), and default baseline `partyQuotas`.
    const activeLots = db.lots.filter(lot => !lot.reserved && (lot.lampCount || 0) > 0);
    const totalBaseByPartyIdx = db.parties.map((_, idx) =>
      activeLots.reduce((sum, lot) => sum + Math.floor(normWeights[idx] * lot.lampCount), 0)
    );
    const flexByPartyIdx = lampQuotas.map((gq, idx) => Math.max(0, gq - totalBaseByPartyIdx[idx]));

    db.parties.forEach((p, idx) => {
      p.guaranteedBaseLamps = totalBaseByPartyIdx[idx];
      p.flexibleRemainderLamps = flexByPartyIdx[idx];
    });

    const cumExact = db.parties.map(() => 0);
    const cumAssigned = db.parties.map(() => 0);

    db.lots.forEach(lot => {
      if (lot.reserved || (lot.lampCount || 0) <= 0) {
        const zeroMap = Object.fromEntries(db.parties.map(p => [p.id, 0]));
        lot.partyQuotas = zeroMap;
        lot.partyMinQuotas = { ...zeroMap };
        lot.partyMaxQuotas = { ...zeroMap };
        lot.remainderSlots = 0;
        return;
      }

      const n = lot.lampCount;
      const minFloors = db.parties.map((_, idx) => Math.floor(normWeights[idx] * n));
      const remSlotsInLot = Math.max(0, n - minFloors.reduce((a, b) => a + b, 0));

      const partyMinObj = {};
      const partyMaxObj = {};
      db.parties.forEach((p, idx) => {
        const minQ = minFloors[idx];
        const canGainExtra = flexByPartyIdx[idx] > 0 && remSlotsInLot > 0 && minQ < n;
        partyMinObj[p.id] = minQ;
        partyMaxObj[p.id] = canGainExtra ? minQ + 1 : minQ;
      });
      lot.partyMinQuotas = partyMinObj;
      lot.partyMaxQuotas = partyMaxObj;
      lot.remainderSlots = remSlotsInLot;

      const nextCumExact = cumExact.map((ce, idx) => ce + n * normWeights[idx]);
      const rawDesire = nextCumExact.map((nce, idx) => Math.max(0, nce - cumAssigned[idx]));
      const desireSum = rawDesire.reduce((a, b) => a + b, 0);
      const scaledDesire = desireSum > 0
        ? rawDesire.map(d => (d / desireSum) * n)
        : normWeights.map(w => w * n);

      const cap = lampQuotas.map((gq, idx) => Math.max(0, gq - cumAssigned[idx]));
      const alloc = scaledDesire.map((sd, idx) => Math.min(cap[idx], Math.floor(sd)));
      let rem = n - alloc.reduce((a, b) => a + b, 0);

      while (rem > 0) {
        let bestIdx = -1;
        let bestDiff = -Infinity;
        let bestRank = Infinity;

        for (let idx = 0; idx < db.parties.length; idx++) {
          if (alloc[idx] >= cap[idx]) continue;
          const diff = scaledDesire[idx] - alloc[idx];
          const rank = db.parties[idx].orderRank || idx;
          if (diff > bestDiff + 1e-9 || (Math.abs(diff - bestDiff) <= 1e-9 && rank < bestRank)) {
            bestDiff = diff;
            bestRank = rank;
            bestIdx = idx;
          }
        }

        if (bestIdx === -1) break;
        alloc[bestIdx] += 1;
        rem -= 1;
      }

      const partyQuotasObj = {};
      db.parties.forEach((p, idx) => {
        cumExact[idx] = nextCumExact[idx];
        cumAssigned[idx] += alloc[idx];
        partyQuotasObj[p.id] = alloc[idx];
      });
      lot.partyQuotas = partyQuotasObj;
    });
  } else {
    db.lots.forEach(lot => {
      lot.partyQuotas = {};
      lot.partyMinQuotas = {};
      lot.partyMaxQuotas = {};
      lot.remainderSlots = 0;
    });
  }

  return db;
}

/**
 * Strips credentials and isolates private party preferences depending on the caller's role.
 */
export function sanitizeDbForClient(db, auth) {
  const isAdmin = auth?.role === 'ADMIN';
  const safeParties = (db.parties || []).map(({ password, username, ...publicParty }) => (
    isAdmin
      ? { ...publicParty, username, hasPassword: Boolean(password) }
      : publicParty
  ));
  const lampsArr = db.lamps || [];

  let unsuitable = 0;
  let aptAvailable = 0;
  let selected = 0;
  let inLots = 0;
  let selectedUnassigned = 0;

  for (let i = 0; i < lampsArr.length; i++) {
    const l = lampsArr[i];
    if (l.status === 'NO_APTA') {
      unsuitable++;
    } else if (l.status === 'SELECCIONADA') {
      selected++;
      if (l.lotId) inLots++;
      else selectedUnassigned++;
    } else {
      aptAvailable++;
    }
  }

  const lampStats = {
    total: lampsArr.length,
    unsuitable,
    suitable: lampsArr.length - unsuitable,
    aptAvailable,
    selected,
    inLots,
    selectedUnassigned
  };

  let lotPreferences = {};
  let lotOrderPreferences = {};
  let locationPreferences = {};
  let historicalPreferences = {};

  if (auth?.role === 'ADMIN') {
    lotPreferences = db.lotPreferences || {};
    lotOrderPreferences = db.lotOrderPreferences || {};
    locationPreferences = db.locationPreferences || {};
    if (db.historicalPreferences) {
      Object.entries(db.historicalPreferences).forEach(([key, val]) => {
        historicalPreferences[key] = {
          id: key,
          title: val.title || key,
          date: val.date || '',
          archivedAt: val.archivedAt || '',
          electionStatus: val.electionStatus || '',
          isFullSnapshot: Boolean(val.isFullSnapshot),
          summary: val.summary || {
            selectedLampsCount: Array.isArray(val.selectedLampCodes) ? val.selectedLampCodes.length : 0,
            lotsCount: Array.isArray(val.lots) ? val.lots.length : 0,
            locationsCount: Array.isArray(val.locations) ? val.locations.length : 0,
            partiesCount: Array.isArray(val.partiesSnapshot) ? val.partiesSnapshot.length : Object.keys(val.lotPreferences || {}).length,
            hasAllocation: Boolean(val.allocationResults)
          }
        };
      });
    }
  } else if (auth?.role === 'PARTY' && auth.id) {
    const pid = auth.id;
    if (db.lotPreferences?.[pid]) {
      lotPreferences = { [pid]: db.lotPreferences[pid] };
    }
    if (Array.isArray(db.lotOrderPreferences?.[pid])) {
      lotOrderPreferences = { [pid]: db.lotOrderPreferences[pid] };
    }
    if (db.locationPreferences?.[pid]) {
      locationPreferences = { [pid]: db.locationPreferences[pid] };
    }
    if (db.historicalPreferences) {
      Object.entries(db.historicalPreferences).forEach(([key, val]) => {
        const hasPartyLots = Boolean(
          val.lotPreferences?.[pid] && Object.keys(val.lotPreferences[pid]).length > 0
        );
        const hasPartyLotOrder = Boolean(
          Array.isArray(val.lotOrderPreferences?.[pid]) && val.lotOrderPreferences[pid].length > 0
        );
        const hasPartyLampCodes = Boolean(
          Array.isArray(val.partyLampPriority?.[pid]) && val.partyLampPriority[pid].length > 0
        );
        const hasPartyLocs = Boolean(
          Array.isArray(val.locationPreferences?.[pid]) && val.locationPreferences[pid].length > 0
        );
        historicalPreferences[key] = {
          id: key,
          title: val.title || key,
          date: val.date || '',
          archivedAt: val.archivedAt || '',
          hasData: hasPartyLots || hasPartyLotOrder || hasPartyLampCodes || hasPartyLocs
        };
      });
    }
  }

  return {
    electionInfo: db.electionInfo,
    parties: safeParties,
    lamps: auth?.role === 'ADMIN' ? lampsArr : [],
    lampStats,
    lots: db.lots || [],
    locations: db.locations || [],
    lotPreferences,
    lotOrderPreferences,
    locationPreferences,
    allocationResults: db.allocationResults || null,
    historicalPreferences
  };
}

// ==================== SQLITE (WAL) RELATIONAL PERSISTENCE ENGINE ====================

let sqlite = null;
let stmts = null;
let cachedDb = null;
let dbRevision = 1;
const dbBootId = Date.now().toString(36);

const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lamps (
    codi TEXT PRIMARY KEY,
    id INTEGER,
    carrer TEXT NOT NULL,
    num TEXT NOT NULL,
    suport TEXT NOT NULL,
    lampada TEXT NOT NULL,
    potencia TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL,
    suitable INTEGER NOT NULL,
    selected INTEGER NOT NULL,
    locked_unsuitable INTEGER NOT NULL,
    unsuitable_reason TEXT NOT NULL,
    lot_id TEXT,
    sort_idx INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    street TEXT NOT NULL,
    lamp_codes_json TEXT NOT NULL,
    reserved INTEGER NOT NULL DEFAULT 0,
    reserved_reason TEXT NOT NULL DEFAULT '',
    sort_idx INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'CARTELLERA',
    address TEXT NOT NULL DEFAULT 's/n',
    description TEXT NOT NULL DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 1,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    sort_idx INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    acronym TEXT NOT NULL,
    color TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 0,
    votes INTEGER NOT NULL DEFAULT 0,
    quota_pct REAL,
    order_rank INTEGER NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS party_lot_preferences (
    party_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    ordered_lamp_codes_json TEXT NOT NULL,
    PRIMARY KEY (party_id, lot_id)
  );

  CREATE TABLE IF NOT EXISTS party_lot_orders (
    party_id TEXT PRIMARY KEY,
    lot_ids_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS party_location_preferences (
    party_id TEXT PRIMARY KEY,
    location_ids_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS election_history (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT '',
    archived_at TEXT NOT NULL DEFAULT '',
    snapshot_json TEXT NOT NULL,
    sort_idx INTEGER NOT NULL
  );
`;

function prepareStatements(conn) {
  return {
    getMeta: conn.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: conn.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),

    clearLamps: conn.prepare('DELETE FROM lamps'),
    insertLamp: conn.prepare(`
      INSERT INTO lamps (
        codi, id, carrer, num, suport, lampada, potencia, lat, lng,
        status, suitable, selected, locked_unsuitable, unsuitable_reason, lot_id, sort_idx
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    selectLamps: conn.prepare('SELECT * FROM lamps ORDER BY sort_idx ASC'),

    clearLots: conn.prepare('DELETE FROM lots'),
    insertLot: conn.prepare(`
      INSERT INTO lots (id, name, street, lamp_codes_json, reserved, reserved_reason, sort_idx)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    selectLots: conn.prepare('SELECT * FROM lots ORDER BY sort_idx ASC'),

    clearLocations: conn.prepare('DELETE FROM locations'),
    insertLocation: conn.prepare(`
      INSERT INTO locations (id, name, type, address, description, capacity, lat, lng, image_url, sort_idx)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    selectLocations: conn.prepare('SELECT * FROM locations ORDER BY sort_idx ASC'),

    clearParties: conn.prepare('DELETE FROM parties'),
    insertParty: conn.prepare(`
      INSERT INTO parties (id, name, acronym, color, seats, votes, quota_pct, order_rank, username, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    selectParties: conn.prepare('SELECT * FROM parties ORDER BY order_rank ASC'),

    clearLotPrefs: conn.prepare('DELETE FROM party_lot_preferences'),
    upsertLotPref: conn.prepare(`
      INSERT OR REPLACE INTO party_lot_preferences (party_id, lot_id, ordered_lamp_codes_json)
      VALUES (?, ?, ?)
    `),
    deleteLotPref: conn.prepare('DELETE FROM party_lot_preferences WHERE party_id = ? AND lot_id = ?'),
    deletePartyLotPrefs: conn.prepare('DELETE FROM party_lot_preferences WHERE party_id = ?'),
    selectLotPrefs: conn.prepare('SELECT * FROM party_lot_preferences'),

    clearLotOrders: conn.prepare('DELETE FROM party_lot_orders'),
    upsertLotOrder: conn.prepare('INSERT OR REPLACE INTO party_lot_orders (party_id, lot_ids_json) VALUES (?, ?)'),
    deletePartyLotOrder: conn.prepare('DELETE FROM party_lot_orders WHERE party_id = ?'),
    selectLotOrders: conn.prepare('SELECT * FROM party_lot_orders'),

    clearLocPrefs: conn.prepare('DELETE FROM party_location_preferences'),
    upsertLocPref: conn.prepare('INSERT OR REPLACE INTO party_location_preferences (party_id, location_ids_json) VALUES (?, ?)'),
    deletePartyLocPref: conn.prepare('DELETE FROM party_location_preferences WHERE party_id = ?'),
    selectLocPrefs: conn.prepare('SELECT * FROM party_location_preferences'),

    clearHistory: conn.prepare('DELETE FROM election_history'),
    insertHistory: conn.prepare(`
      INSERT INTO election_history (id, title, date, archived_at, snapshot_json, sort_idx)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    selectHistory: conn.prepare('SELECT * FROM election_history ORDER BY sort_idx ASC')
  };
}

function buildInitialSeedData() {
  if (fs.existsSync(SEED_FILE)) {
    try {
      const seedRaw = fs.readFileSync(SEED_FILE, 'utf-8');
      console.log(`[SQLite] Inicialitzant base de dades des de la llavor inicial ${SEED_FILE}...`);
      const parsedSeed = JSON.parse(seedRaw);
      applyPhysicalPoleDeduplication(parsedSeed);
      return parsedSeed;
    } catch (err) {
      console.error(`[SQLite] Error llegint ${SEED_FILE}:`, err);
    }
  }

  const base = structuredClone(initialData);
  const geojsonPath = path.join(__dirname, '../punts_de_llum.geojson');
  if (base.lamps.length === 0 && fs.existsSync(geojsonPath)) {
    try {
      const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
      const seenCodes = new Set();
      (geojson.features || []).forEach(f => {
        const props = f.properties || {};
        if (!props.latitud || !props.longitud || !props.carrer) return;
        const codi = props.codi || `F-${props.id}`;
        if (seenCodes.has(codi)) return;
        seenCodes.add(codi);
        const suport = props.suport || 'Columna';
        const isApt = isAptSupport(suport);
        base.lamps.push({
          id: props.id,
          codi,
          carrer: String(props.carrer).trim(),
          num: props.num || 's/n',
          suport,
          lampada: props.lampada || 'LED',
          potencia: props.potencia || '30',
          lat: parseFloat(props.latitud),
          lng: parseFloat(props.longitud),
          status: isApt ? 'APTA' : 'NO_APTA',
          suitable: isApt,
          selected: false,
          lockedUnsuitable: !isApt,
          unsuitableReason: isApt ? '' : `Suport no apte (${suport})`,
          lotId: null
        });
      });
    } catch (err) {
      console.error('[SQLite] No s\'ha pogut carregar punts_de_llum.geojson per defecte:', err);
    }
  }
  applyPhysicalPoleDeduplication(base);
  return base;
}

function writeFullStateTransaction(data) {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    dbRevision += 1;
    stmts.setMeta.run('initialized', '1');
    stmts.setMeta.run('revision', String(dbRevision));
    stmts.setMeta.run('election_info', JSON.stringify(data.electionInfo || initialData.electionInfo));
    stmts.setMeta.run('admin_account', JSON.stringify(data.admin || initialData.admin));
    stmts.setMeta.run('allocation_results', JSON.stringify(data.allocationResults || null));

    stmts.clearLamps.run();
    (data.lamps || []).forEach((l, idx) => {
      stmts.insertLamp.run(
        String(l.codi),
        l.id ?? idx + 1,
        String(l.carrer || ''),
        String(l.num || 's/n'),
        String(l.suport || 'Columna'),
        String(l.lampada || 'LED'),
        String(l.potencia || '30'),
        Number(l.lat) || 0,
        Number(l.lng) || 0,
        String(l.status || 'APTA'),
        l.suitable ? 1 : 0,
        l.selected ? 1 : 0,
        l.lockedUnsuitable ? 1 : 0,
        String(l.unsuitableReason || ''),
        l.lotId ? String(l.lotId) : null,
        idx
      );
    });

    stmts.clearLots.run();
    (data.lots || []).forEach((lot, idx) => {
      const codes = Array.isArray(lot.lampCodes)
        ? lot.lampCodes
        : (lot.lamps || []).map(lp => lp.codi);
      stmts.insertLot.run(
        String(lot.id),
        String(lot.name || lot.id),
        String(lot.street || ''),
        JSON.stringify(codes),
        lot.reserved ? 1 : 0,
        String(lot.reservedReason || ''),
        idx
      );
    });

    stmts.clearLocations.run();
    (data.locations || []).forEach((loc, idx) => {
      stmts.insertLocation.run(
        String(loc.id),
        String(loc.name || loc.id),
        String(loc.type || 'CARTELLERA'),
        String(loc.address || 's/n'),
        String(loc.description || ''),
        Math.max(1, Number(loc.capacity) || 1),
        Number(loc.lat) || 0,
        Number(loc.lng) || 0,
        String(loc.imageUrl || ''),
        idx
      );
    });

    stmts.clearParties.run();
    (data.parties || []).forEach((p, idx) => {
      stmts.insertParty.run(
        String(p.id),
        String(p.name || p.id),
        String(p.acronym || p.id),
        String(p.color || '#3B82F6'),
        Math.max(0, Number(p.seats) || 0),
        Math.max(0, Number(p.votes) || 0),
        p.quotaPct !== undefined && p.quotaPct !== null ? Number(p.quotaPct) : null,
        Number(p.orderRank) || idx + 1,
        String(p.username || p.id),
        String(p.password || '')
      );
    });

    stmts.clearLotPrefs.run();
    Object.entries(data.lotPreferences || {}).forEach(([pid, byLot]) => {
      Object.entries(byLot || {}).forEach(([lid, pref]) => {
        const codes = Array.isArray(pref)
          ? pref
          : (Array.isArray(pref?.orderedLampCodes) ? pref.orderedLampCodes : []);
        if (codes.length > 0) {
          stmts.upsertLotPref.run(String(pid), String(lid), JSON.stringify(codes));
        }
      });
    });

    stmts.clearLotOrders.run();
    Object.entries(data.lotOrderPreferences || {}).forEach(([pid, lotIds]) => {
      if (Array.isArray(lotIds) && lotIds.length > 0) {
        stmts.upsertLotOrder.run(String(pid), JSON.stringify(lotIds));
      }
    });

    stmts.clearLocPrefs.run();
    Object.entries(data.locationPreferences || {}).forEach(([pid, locIds]) => {
      if (Array.isArray(locIds) && locIds.length > 0) {
        stmts.upsertLocPref.run(String(pid), JSON.stringify(locIds));
      }
    });

    stmts.clearHistory.run();
    Object.entries(data.historicalPreferences || {}).forEach(([hid, snap], idx) => {
      stmts.insertHistory.run(
        String(hid),
        String(snap?.title || hid),
        String(snap?.date || ''),
        String(snap?.archivedAt || ''),
        JSON.stringify(snap),
        idx
      );
    });

    sqlite.exec('COMMIT');
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch { /* ignore rollback error */ }
    throw err;
  }
}

function loadStateFromSqlite() {
  const getJsonMeta = (key, fallback) => {
    const row = stmts.getMeta.get(key);
    if (!row?.value) return structuredClone(fallback);
    try {
      return JSON.parse(row.value);
    } catch {
      return structuredClone(fallback);
    }
  };

  const revRow = stmts.getMeta.get('revision');
  if (revRow?.value) {
    dbRevision = Number(revRow.value) || 1;
  }

  const lamps = stmts.selectLamps.all().map(r => ({
    id: r.id,
    codi: r.codi,
    carrer: r.carrer,
    num: r.num,
    suport: r.suport,
    lampada: r.lampada,
    potencia: r.potencia,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    suitable: Boolean(r.suitable),
    selected: Boolean(r.selected),
    lockedUnsuitable: Boolean(r.locked_unsuitable),
    unsuitableReason: r.unsuitable_reason || '',
    lotId: r.lot_id || null
  }));

  const lots = stmts.selectLots.all().map(r => ({
    id: r.id,
    name: r.name,
    street: r.street,
    lampCodes: JSON.parse(r.lamp_codes_json || '[]'),
    reserved: Boolean(r.reserved),
    reservedReason: r.reserved_reason || '',
    coords: [],
    lamps: []
  }));

  const locations = stmts.selectLocations.all().map(r => ({
    id: r.id,
    name: r.name,
    type: r.type || 'CARTELLERA',
    address: r.address || 's/n',
    description: r.description || '',
    capacity: r.capacity || 1,
    lat: r.lat,
    lng: r.lng,
    imageUrl: r.image_url || ''
  }));

  const parties = stmts.selectParties.all().map(r => ({
    id: r.id,
    name: r.name,
    acronym: r.acronym,
    color: r.color,
    seats: r.seats,
    votes: r.votes,
    ...(r.quota_pct !== null && r.quota_pct !== undefined ? { quotaPct: r.quota_pct } : {}),
    orderRank: r.order_rank,
    username: r.username,
    password: r.password
  }));

  const lotPreferences = {};
  stmts.selectLotPrefs.all().forEach(r => {
    if (!lotPreferences[r.party_id]) lotPreferences[r.party_id] = {};
    lotPreferences[r.party_id][r.lot_id] = {
      orderedLampCodes: JSON.parse(r.ordered_lamp_codes_json || '[]')
    };
  });

  const lotOrderPreferences = {};
  stmts.selectLotOrders.all().forEach(r => {
    lotOrderPreferences[r.party_id] = JSON.parse(r.lot_ids_json || '[]');
  });

  const locationPreferences = {};
  stmts.selectLocPrefs.all().forEach(r => {
    locationPreferences[r.party_id] = JSON.parse(r.location_ids_json || '[]');
  });

  const historicalPreferences = {};
  stmts.selectHistory.all().forEach(r => {
    historicalPreferences[r.id] = JSON.parse(r.snapshot_json);
  });

  const assembled = {
    electionInfo: getJsonMeta('election_info', initialData.electionInfo),
    admin: getJsonMeta('admin_account', initialData.admin),
    parties,
    lamps,
    lots,
    locations,
    lotPreferences,
    lotOrderPreferences,
    locationPreferences,
    allocationResults: getJsonMeta('allocation_results', null),
    historicalPreferences
  };

  return recalculateLotsAndQuotas(assembled);
}

function ensureDbOpen() {
  if (sqlite && cachedDb) return;

  const dataDir = resolveDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlitePath = resolveSqlitePath();
  sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec(SCHEMA_SQL);
  stmts = prepareStatements(sqlite);

  const initRow = stmts.getMeta.get('initialized');
  if (!initRow || initRow.value !== '1') {
    const seeded = buildInitialSeedData();
    writeFullStateTransaction(seeded);
    stmts.setMeta.run('pole_dedup_v1', '1');
    cachedDb = seeded;
  } else {
    cachedDb = loadStateFromSqlite();
    const dedupRow = stmts.getMeta.get('pole_dedup_v1');
    if (!dedupRow || dedupRow.value !== '1') {
      const count = applyPhysicalPoleDeduplication(cachedDb);
      writeFullStateTransaction(cachedDb);
      stmts.setMeta.run('pole_dedup_v1', '1');
      console.log(`[SQLite] Deduplicació d'1 suport físic = 1 fanal aplicada (${count} lluminàries secundàries marcades No Aptes).`);
    }
  }
}

export function getDbVersion() {
  ensureDbOpen();
  return `${dbBootId}-${dbRevision}`;
}

/**
 * Fast read-only access to the in-memory hydrated state (do NOT mutate the returned object).
 */
export function peekDb() {
  ensureDbOpen();
  return cachedDb;
}

/**
 * Safe isolated copy for mutating route handlers (if handler aborts before `saveDb`, cache & SQLite stay untouched).
 */
export function getDb() {
  ensureDbOpen();
  return structuredClone(cachedDb);
}

/**
 * Atomically recalculates quotas and commits the full state into SQLite inside a `BEGIN IMMEDIATE` transaction.
 */
export function saveDb(data) {
  ensureDbOpen();
  recalculateLotsAndQuotas(data);
  writeFullStateTransaction(data);
  cachedDb = structuredClone(data);
}

/**
 * High-concurrency O(1) single-row SQLite transaction for Party Streetlamp Priority inside a Lot.
 */
export function savePartyLotLampPref(partyId, lotId, cleanOrderedCodes) {
  ensureDbOpen();
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    dbRevision += 1;
    stmts.setMeta.run('revision', String(dbRevision));
    if (cleanOrderedCodes.length === 0) {
      stmts.deleteLotPref.run(String(partyId), String(lotId));
    } else {
      stmts.upsertLotPref.run(String(partyId), String(lotId), JSON.stringify(cleanOrderedCodes));
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }

  if (!cachedDb.lotPreferences) cachedDb.lotPreferences = {};
  if (!cachedDb.lotPreferences[partyId]) cachedDb.lotPreferences[partyId] = {};
  if (cleanOrderedCodes.length === 0) {
    delete cachedDb.lotPreferences[partyId][lotId];
  } else {
    cachedDb.lotPreferences[partyId][lotId] = { orderedLampCodes: [...cleanOrderedCodes] };
  }
  return cachedDb.lotPreferences[partyId];
}

/**
 * High-concurrency O(1) single-row SQLite transaction for Party Lot Importance Order.
 */
export function savePartyLotOrderPref(partyId, cleanLotIds) {
  ensureDbOpen();
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    dbRevision += 1;
    stmts.setMeta.run('revision', String(dbRevision));
    if (cleanLotIds.length === 0) {
      stmts.deletePartyLotOrder.run(String(partyId));
    } else {
      stmts.upsertLotOrder.run(String(partyId), JSON.stringify(cleanLotIds));
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }

  if (!cachedDb.lotOrderPreferences) cachedDb.lotOrderPreferences = {};
  cachedDb.lotOrderPreferences[partyId] = [...cleanLotIds];
  return cachedDb.lotOrderPreferences[partyId];
}

/**
 * High-concurrency O(1) single-row SQLite transaction for Party Fixed Locations Priority.
 */
export function savePartyLocationPref(partyId, cleanLocIds) {
  ensureDbOpen();
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    dbRevision += 1;
    stmts.setMeta.run('revision', String(dbRevision));
    if (cleanLocIds.length === 0) {
      stmts.deletePartyLocPref.run(String(partyId));
    } else {
      stmts.upsertLocPref.run(String(partyId), JSON.stringify(cleanLocIds));
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }

  if (!cachedDb.locationPreferences) cachedDb.locationPreferences = {};
  cachedDb.locationPreferences[partyId] = [...cleanLocIds];
  return cachedDb.locationPreferences[partyId];
}

/**
 * Atomic SQLite transaction clearing one party's (or all parties') preferences, optionally resetting allocation.
 */
export function clearPartyPreferencesAtomic(partyId = null, resetAllocation = false) {
  ensureDbOpen();
  const shouldReopen = resetAllocation || cachedDb.electionInfo?.status === 'ALLOCATED';
  const nextElectionInfo = shouldReopen
    ? { ...cachedDb.electionInfo, status: 'OPEN' }
    : cachedDb.electionInfo;

  sqlite.exec('BEGIN IMMEDIATE');
  try {
    dbRevision += 1;
    stmts.setMeta.run('revision', String(dbRevision));
    if (partyId) {
      stmts.deletePartyLotPrefs.run(String(partyId));
      stmts.deletePartyLotOrder.run(String(partyId));
      stmts.deletePartyLocPref.run(String(partyId));
    } else {
      stmts.clearLotPrefs.run();
      stmts.clearLotOrders.run();
      stmts.clearLocPrefs.run();
    }
    if (shouldReopen) {
      stmts.setMeta.run('allocation_results', 'null');
      stmts.setMeta.run('election_info', JSON.stringify(nextElectionInfo));
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }

  if (partyId) {
    if (cachedDb.lotPreferences) delete cachedDb.lotPreferences[partyId];
    if (cachedDb.lotOrderPreferences) delete cachedDb.lotOrderPreferences[partyId];
    if (cachedDb.locationPreferences) delete cachedDb.locationPreferences[partyId];
  } else {
    cachedDb.lotPreferences = {};
    cachedDb.lotOrderPreferences = {};
    cachedDb.locationPreferences = {};
  }
  if (shouldReopen) {
    cachedDb.allocationResults = null;
    cachedDb.electionInfo = nextElectionInfo;
  }
}

/**
 * Checkpoints WAL and closes SQLite cleanly on container shutdown (SIGTERM / SIGINT).
 */
export function closeDb() {
  if (!sqlite) return;
  try {
    sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch { /* ignore */ }
  try {
    sqlite.close();
  } catch { /* ignore */ }
  sqlite = null;
  stmts = null;
  cachedDb = null;
}
