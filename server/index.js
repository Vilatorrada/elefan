import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getDb,
  peekDb,
  saveDb,
  closeDb,
  getDbVersion,
  sanitizeDbForClient,
  recalculateLotsAndQuotas,
  isAptSupport,
  findSecondaryPoleMap,
  cleanupDeletedLotReferences,
  savePartyLotLampPref,
  savePartyLotOrderPref,
  savePartyLocationPref,
  clearPartyPreferencesAtomic
} from './db.js';
import { runAllocation, getActiveLotLamps, getEffectiveLampCount } from './algorithm.js';
import { generateReportPdf } from './pdf.js';
import { signToken, optionalAuth, requireAdmin, requireParty } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3001;
const DEMO_LOGIN_ENABLED =
  process.env.ENABLE_DEMO_LOGIN === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.DISABLE_DEMO_LOGIN !== 'true');

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Healthcheck endpoint for Docker & Dokploy / Traefik
app.get('/api/health', (_req, res) => {
  peekDb();
  res.json({ status: 'ok', engine: 'sqlite-wal', version: '1.0.0', uptime: Math.round(process.uptime()) });
});

function ensureSelectionOpen(db, res) {
  if (db.electionInfo?.status !== 'OPEN') {
    res.status(403).json({
      error: db.electionInfo?.status === 'ALLOCATED'
        ? 'El repartiment ja s\'ha realitzat. Les preferències estan bloquejades.'
        : 'El període de selecció de preferències està tancat.'
    });
    return false;
  }
  return true;
}

function toUpperSlug(rawText, fallback = 'ITEM') {
  return String(rawText || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function clearPartyPreferencesInDb(db, partyId = null) {
  if (partyId) {
    if (db.lotPreferences) delete db.lotPreferences[partyId];
    if (db.lotOrderPreferences) delete db.lotOrderPreferences[partyId];
    if (db.locationPreferences) delete db.locationPreferences[partyId];
  } else {
    db.lotPreferences = {};
    db.lotOrderPreferences = {};
    db.locationPreferences = {};
  }
}

function issueAuthSession(res, db, partyOrAdmin) {
  if (partyOrAdmin === 'ADMIN') {
    const adminUsername = process.env.ADMIN_USERNAME || db.admin.username;
    const user = { id: 'ADMIN', name: db.admin.name, username: adminUsername };
    const token = signToken({ id: 'ADMIN', role: 'ADMIN', username: adminUsername });
    return res.json({ success: true, token, role: 'ADMIN', user });
  }
  const user = {
    id: partyOrAdmin.id,
    name: partyOrAdmin.name,
    acronym: partyOrAdmin.acronym,
    color: partyOrAdmin.color
  };
  const token = signToken({ id: partyOrAdmin.id, role: 'PARTY', acronym: partyOrAdmin.acronym });
  return res.json({ success: true, token, role: 'PARTY', user });
}

// Auth Endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Introduïu usuari i contrasenya.' });
  }

  const db = peekDb();
  const adminUsername = process.env.ADMIN_USERNAME || db.admin.username;
  const adminPassword = process.env.ADMIN_PASSWORD || db.admin.password;

  if (username.toLowerCase() === adminUsername.toLowerCase() && password === adminPassword) {
    return issueAuthSession(res, db, 'ADMIN');
  }

  const party = db.parties.find(
    p => p.username.toLowerCase() === username.toLowerCase() && p.password === password
  );
  if (party) {
    return issueAuthSession(res, db, party);
  }

  return res.status(401).json({ success: false, message: 'Usuari o contrasenya incorrectes.' });
});

// Quick Demo Login (Dev-only; avoids exposing plaintext passwords in GET /api/data)
app.post('/api/auth/demo-login', (req, res) => {
  if (!DEMO_LOGIN_ENABLED) {
    return res.status(403).json({ success: false, message: 'L\'accés ràpid de prova està desactivat.' });
  }

  const { targetId } = req.body || {};
  const db = peekDb();

  if (targetId === 'ADMIN') {
    return issueAuthSession(res, db, 'ADMIN');
  }

  const party = db.parties.find(p => p.id === targetId);
  if (party) {
    return issueAuthSession(res, db, party);
  }

  return res.status(404).json({ success: false, message: 'Perfil de prova no trobat.' });
});

// Sanitized state endpoint with ETag / 304 Not Modified support
app.get('/api/data', optionalAuth, (req, res) => {
  const authScope = req.auth ? `${req.auth.role}:${req.auth.id}` : 'ANON';
  const etag = `W/"${getDbVersion()}-${authScope}"`;

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const db = peekDb();
  const payload = sanitizeDbForClient(db, req.auth);
  payload.demoLoginEnabled = DEMO_LOGIN_ENABLED;
  res.json(payload);
});

// Save numbered lamp priority list inside a Lot for the authenticated party (O(1) single-row SQLite transaction)
function handleSavePartyLotLampOrder(req, res) {
  const partyId = req.auth.id;
  const db = peekDb();
  if (!db.parties.some(p => p.id === partyId)) {
    return res.status(401).json({ error: 'La candidatura ja no existeix al sistema.' });
  }

  const { lotId, orderedLampCodes } = req.body || {};
  if (!lotId) return res.status(400).json({ error: 'Falta l\'identificador del lot.' });
  if (!Array.isArray(orderedLampCodes)) {
    return res.status(400).json({ error: 'orderedLampCodes ha de ser una llista de codis de farola.' });
  }

  if (!ensureSelectionOpen(db, res)) return;

  const lot = db.lots.find(l => l.id === lotId);
  if (!lot) return res.status(404).json({ error: 'Lot no trobat.' });

  if (orderedLampCodes.length === 0) {
    const partyPrefs = savePartyLotLampPref(partyId, lotId, []);
    return res.json({ success: true, lotPreferences: partyPrefs });
  }

  if (lot.reserved) {
    return res.status(400).json({ error: 'Aquest lot està reservat i no es pot seleccionar.' });
  }
  const activeLamps = getActiveLotLamps(lot);
  if (activeLamps.length === 0) {
    return res.status(400).json({ error: 'Aquest lot no disposa de faroles seleccionades per al sorteig.' });
  }

  const validCodeSet = new Set(activeLamps.map(l => String(l.codi)));
  const seen = new Set();
  const cleanOrderedCodes = [];

  orderedLampCodes.forEach(rawCode => {
    const code = String(rawCode);
    if (validCodeSet.has(code) && !seen.has(code)) {
      seen.add(code);
      cleanOrderedCodes.push(code);
    }
  });

  const partyPrefs = savePartyLotLampPref(partyId, lotId, cleanOrderedCodes);
  return res.json({ success: true, lotPreferences: partyPrefs });
}

app.post('/api/preferences/lot-lamps', requireParty, handleSavePartyLotLampOrder);
app.post('/api/preferences/lot', requireParty, handleSavePartyLotLampOrder);

// Save Lot Importance Order (`lotOrderPreferences`) for the authenticated party (O(1) single-row SQLite transaction)
app.post('/api/preferences/lot-order', requireParty, (req, res) => {
  const partyId = req.auth.id;
  const db = peekDb();
  if (!db.parties.some(p => p.id === partyId)) {
    return res.status(401).json({ error: 'La candidatura ja no existeix al sistema.' });
  }

  const { lotIds } = req.body || {};
  if (!Array.isArray(lotIds)) {
    return res.status(400).json({ error: 'lotIds ha de ser una llista d\'identificadors de lot.' });
  }
  if (!ensureSelectionOpen(db, res)) return;

  const validLotIds = new Set(
    (db.lots || [])
      .filter(l => !l.reserved && getEffectiveLampCount(l) > 0)
      .map(l => l.id)
  );
  const seen = new Set();
  const cleanOrder = [];
  lotIds.forEach(rawId => {
    const lid = String(rawId);
    if (validLotIds.has(lid) && !seen.has(lid)) {
      seen.add(lid);
      cleanOrder.push(lid);
    }
  });

  const savedOrder = savePartyLotOrderPref(partyId, cleanOrder);
  return res.json({ success: true, lotOrderPreferences: savedOrder });
});

// Save Location Preferences for the authenticated party (O(1) single-row SQLite transaction)
app.post('/api/preferences/location', requireParty, (req, res) => {
  const partyId = req.auth.id;
  const db = peekDb();
  if (!db.parties.some(p => p.id === partyId)) {
    return res.status(401).json({ error: 'La candidatura ja no existeix al sistema.' });
  }

  const { locationIds } = req.body || {};
  if (!Array.isArray(locationIds)) return res.status(400).json({ error: 'Dades no vàlides.' });
  if (!ensureSelectionOpen(db, res)) return;

  const validIds = new Set((db.locations || []).map(l => l.id));
  const seen = new Set();
  const cleanLocs = [];
  locationIds.forEach(id => {
    if (validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      cleanLocs.push(id);
    }
  });

  const savedLocs = savePartyLocationPref(partyId, cleanLocs);
  res.json({ success: true, locationPreferences: savedLocs });
});

// Party: Clear all own lot & location priority selections while selection is OPEN
app.post('/api/preferences/reset', requireParty, (req, res) => {
  const partyId = req.auth.id;
  const db = peekDb();
  if (!db.parties.some(p => p.id === partyId)) {
    return res.status(401).json({ error: 'La candidatura ja no existeix al sistema.' });
  }
  if (!ensureSelectionOpen(db, res)) return;

  clearPartyPreferencesAtomic(partyId, false);
  res.json({ success: true });
});

// Restore preferences from previous elections (matches both Lot IDs and physical Streetlamp Codes `codi` across elections!)
app.post('/api/preferences/restore-past', requireParty, (req, res) => {
  const partyId = req.auth.id;
  const { historicalElectionId } = req.body || {};
  const db = getDb();
  if (!db.parties.some(p => p.id === partyId)) {
    return res.status(401).json({ error: 'La candidatura ja no existeix al sistema.' });
  }
  if (!ensureSelectionOpen(db, res)) return;

  const past = db.historicalPreferences?.[historicalElectionId];
  if (!past) return res.status(404).json({ error: 'Elecció històrica no trobada.' });

  const validEligibleLots = db.lots.filter(
    l => !l.reserved && getEffectiveLampCount(l) > 0
  );

  // Build global physical-lamp-code priority map for this party from the historical snapshot
  // so even if Lot IDs or boundaries changed between elections, prioritized streetlamps (`AP.XX`) are recovered!
  const globalLampOrderScore = new Map();
  if (Array.isArray(past.partyLampPriority?.[partyId])) {
    past.partyLampPriority[partyId].forEach((codi, idx) => {
      const sc = String(codi);
      if (!globalLampOrderScore.has(sc)) globalLampOrderScore.set(sc, idx);
    });
  } else if (past.lotPreferences?.[partyId]) {
    let cursor = 0;
    Object.values(past.lotPreferences[partyId]).forEach(pref => {
      const codes = Array.isArray(pref)
        ? pref
        : Array.isArray(pref?.orderedLampCodes)
          ? pref.orderedLampCodes
          : [];
      codes.forEach(c => {
        const sc = String(c);
        if (!globalLampOrderScore.has(sc)) {
          globalLampOrderScore.set(sc, cursor++);
        }
      });
    });
  }

  if (!db.lotPreferences) db.lotPreferences = {};
  const nextPrefs = {};

  validEligibleLots.forEach(lot => {
    const activeCodes = getActiveLotLamps(lot).map(l => String(l.codi));
    const activeSet = new Set(activeCodes);
    const ordered = [];
    const seen = new Set();

    // 1. Direct match on same lotId if present
    const sameLotPref = past.lotPreferences?.[partyId]?.[lot.id];
    const directCodes = Array.isArray(sameLotPref)
      ? sameLotPref
      : Array.isArray(sameLotPref?.orderedLampCodes)
        ? sameLotPref.orderedLampCodes
        : (sameLotPref?.category >= 1 && sameLotPref?.category <= 5 ? activeCodes : []);

    directCodes.forEach(c => {
      const sc = String(c);
      if (activeSet.has(sc) && !seen.has(sc)) {
        seen.add(sc);
        ordered.push(sc);
      }
    });

    // 2. Cross-lot physical streetlamp match (for streetlamps whose Lot ID changed across elections!)
    const crossMatched = activeCodes
      .filter(sc => !seen.has(sc) && globalLampOrderScore.has(sc))
      .sort((a, b) => globalLampOrderScore.get(a) - globalLampOrderScore.get(b));

    crossMatched.forEach(sc => {
      seen.add(sc);
      ordered.push(sc);
    });

    if (ordered.length > 0) {
      nextPrefs[lot.id] = { orderedLampCodes: ordered };
    }
  });

  db.lotPreferences[partyId] = nextPrefs;

  // Restore Lot Importance Order (matching same Lot IDs first, then lots ordered by earliest recovered physical lamp rank)
  if (!db.lotOrderPreferences) db.lotOrderPreferences = {};
  const validLotSet = new Set(validEligibleLots.map(l => l.id));
  const restoredLotOrder = [];
  const seenRestoredLots = new Set();

  if (Array.isArray(past.lotOrderPreferences?.[partyId])) {
    past.lotOrderPreferences[partyId].forEach(lid => {
      if (validLotSet.has(lid) && !seenRestoredLots.has(lid)) {
        seenRestoredLots.add(lid);
        restoredLotOrder.push(lid);
      }
    });
  }

  // Append any remaining lots where physical lamps matched, sorted by their best recovered physical lamp score
  const remainingMatchedLots = validEligibleLots
    .filter(l => !seenRestoredLots.has(l.id) && nextPrefs[l.id]?.orderedLampCodes?.length > 0)
    .sort((a, b) => {
      const firstA = nextPrefs[a.id].orderedLampCodes[0];
      const firstB = nextPrefs[b.id].orderedLampCodes[0];
      const sA = globalLampOrderScore.has(firstA) ? globalLampOrderScore.get(firstA) : 999999;
      const sB = globalLampOrderScore.has(firstB) ? globalLampOrderScore.get(firstB) : 999999;
      return sA - sB;
    });
  remainingMatchedLots.forEach(l => restoredLotOrder.push(l.id));
  db.lotOrderPreferences[partyId] = restoredLotOrder;

  // Match fixed locations by ID first, with fallback by normalized location name
  const validLocById = new Map((db.locations || []).map(l => [l.id, l]));
  const currentLocByName = new Map(
    (db.locations || []).map(l => [String(l.name || '').trim().toLowerCase(), l.id])
  );
  const pastLocById = new Map(
    (Array.isArray(past.locations) ? past.locations : []).map(l => [l.id, l])
  );

  if (Array.isArray(past.locationPreferences?.[partyId])) {
    const restoredLocs = [];
    const seenLocs = new Set();
    past.locationPreferences[partyId].forEach(oldId => {
      let matchedId = validLocById.has(oldId) ? oldId : null;
      if (!matchedId && pastLocById.has(oldId)) {
        const oldName = String(pastLocById.get(oldId)?.name || '').trim().toLowerCase();
        if (oldName && currentLocByName.has(oldName)) {
          matchedId = currentLocByName.get(oldName);
        }
      }
      if (matchedId && !seenLocs.has(matchedId)) {
        seenLocs.add(matchedId);
        restoredLocs.push(matchedId);
      }
    });
    db.locationPreferences[partyId] = restoredLocs;
  } else {
    db.locationPreferences[partyId] = [];
  }

  saveDb(db);
  res.json({
    success: true,
    lotPreferences: db.lotPreferences[partyId] || {},
    lotOrderPreferences: db.lotOrderPreferences[partyId] || [],
    locationPreferences: db.locationPreferences[partyId] || []
  });
});

// Admin: Open or Close Preference Selection Period
app.post('/api/admin/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['OPEN', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Estat no vàlid (valors permesos: OPEN, CLOSED).' });
  }

  const db = getDb();
  if (status === 'OPEN') {
    db.allocationResults = null;
  }
  db.electionInfo.status = status;
  saveDb(db);
  res.json({ success: true, electionInfo: db.electionInfo });
});

// Admin: Run Allocation Algorithm
app.post('/api/admin/allocate', requireAdmin, (req, res) => {
  const { assignUnselectedRandomly } = req.body || {};
  const db = getDb();
  recalculateLotsAndQuotas(db);

  const results = runAllocation(db, { assignUnselectedRandomly: assignUnselectedRandomly ?? true });
  db.allocationResults = results;
  db.electionInfo.status = 'ALLOCATED';
  saveDb(db);

  res.json({ success: true, results });
});

// Admin: Reset Allocation (optionally also clearing all party preferences)
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  const { clearPreferences } = req.body || {};
  const db = getDb();
  db.allocationResults = null;
  db.electionInfo.status = 'OPEN';
  if (clearPreferences) {
    clearPartyPreferencesInDb(db);
  }
  saveDb(db);
  res.json({ success: true });
});

// Admin: Reset Party Preferences / Selections (for one specific party or all parties, plus allocation if active)
app.post('/api/admin/preferences/reset', requireAdmin, (req, res) => {
  const { partyId, resetAllocation = true } = req.body || {};
  const db = peekDb();

  if (partyId && !db.parties.some(p => p.id === partyId)) {
    return res.status(404).json({ error: 'Candidatura no trobada.' });
  }

  clearPartyPreferencesAtomic(partyId || null, Boolean(resetAllocation));
  res.json({ success: true });
});

// Admin: Toggle Reserved status on an existing Lot
app.post('/api/admin/lot', requireAdmin, (req, res) => {
  const { lotId, reserved, reservedReason } = req.body || {};
  const db = getDb();

  const lot = db.lots.find(l => l.id === lotId);
  if (!lot) return res.status(404).json({ error: 'Lot no trobat.' });

  if (reserved !== undefined) {
    lot.reserved = Boolean(reserved);
    lot.reservedReason = lot.reserved
      ? (reservedReason ?? lot.reservedReason ?? 'Reservat per a la Festa Major i actes municipals')
      : '';
  }

  saveDb(db);
  const updatedLot = db.lots.find(l => l.id === lotId);
  res.json({ success: true, lot: updatedLot });
});

// Admin: Create or Update a Streetlamp Lot manually (strictly `SELECCIONADA` streetlamps)
app.post('/api/admin/lots', requireAdmin, (req, res) => {
  const {
    id,
    name,
    street,
    lampCodes,
    markLampsSelected,
    markLampsSuitable,
    reserved,
    reservedReason
  } = req.body || {};

  if (!Array.isArray(lampCodes) || lampCodes.length === 0) {
    return res.status(400).json({ error: 'Seleccioneu almenys una farola per formar el lot.' });
  }

  const db = getDb();
  if (!Array.isArray(db.lamps)) db.lamps = [];
  if (!Array.isArray(db.lots)) db.lots = [];

  const lampByKey = new Map();
  db.lamps.forEach(l => {
    if (l.codi) lampByKey.set(String(l.codi), l);
    if (l.id !== undefined && l.id !== null) lampByKey.set(String(l.id), l);
  });

  const selectedLamps = [];
  const selectedCodesSet = new Set();
  let rejectedNonApt = 0;

  lampCodes.forEach(rawKey => {
    const found = lampByKey.get(String(rawKey));
    if (!found) return;
    if (found.status === 'NO_APTA') {
      rejectedNonApt++;
      return;
    }
    if (!selectedCodesSet.has(found.codi)) {
      selectedCodesSet.add(found.codi);
      selectedLamps.push(found);
    }
  });

  if (selectedLamps.length === 0) {
    return res.status(400).json({
      error: rejectedNonApt > 0
        ? 'Només es poden incloure faroles declarades com a Aptes. Les faroles No Aptes no es poden afegir a lots.'
        : 'Cap de les faroles indicades existeix a l\'inventari municipal.'
    });
  }

  const shouldMarkSelected = markLampsSelected !== undefined
    ? Boolean(markLampsSelected)
    : Boolean(markLampsSuitable);

  if (shouldMarkSelected) {
    selectedLamps.forEach(l => {
      l.selected = true;
      l.status = 'SELECCIONADA';
    });
  }

  // Enforce strict invariant: a Lot can ONLY contain streetlamps with status === 'SELECCIONADA'
  const strictlySelectedLamps = selectedLamps.filter(l => l.status === 'SELECCIONADA');
  if (strictlySelectedLamps.length === 0) {
    return res.status(400).json({
      error: 'Un lot només el poden conformar faroles amb estat Seleccionada (✔). Marqueu-les primer com a Seleccionades.'
    });
  }

  const finalCodesSet = new Set(strictlySelectedLamps.map(l => l.codi));

  // Derive main street from most common street among selected lamps if omitted
  let derivedStreet = street && String(street).trim() ? String(street).trim() : '';
  if (!derivedStreet) {
    const counts = {};
    strictlySelectedLamps.forEach(l => {
      const st = l.carrer || 'Sense carrer';
      counts[st] = (counts[st] || 0) + 1;
    });
    derivedStreet = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sant Joan de Vilatorrada';
  }

  let targetLot = id ? db.lots.find(l => l.id === id) : null;
  let targetId = targetLot ? targetLot.id : null;

  if (!targetLot) {
    let maxNum = 0;
    db.lots.forEach(l => {
      const m = /^LOT-(\d+)$/i.exec(l.id || '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const nextNumStr = String(maxNum + 1).padStart(2, '0');
    targetId = id && String(id).trim() ? String(id).trim() : `LOT-${nextNumStr}`;

    if (db.lots.some(l => l.id === targetId)) {
      return res.status(409).json({ error: `Ja existeix un lot amb l'identificador ${targetId}.` });
    }
  }

  // Remove selected lamps from any other lot (and prune any lot left empty)
  const emptiedLotIds = [];
  db.lots = db.lots.filter(other => {
    if (other.id === targetId) return true;
    const prevCodes = Array.isArray(other.lampCodes)
      ? other.lampCodes
      : (other.lamps || []).map(l => l.codi);
    const remaining = prevCodes.filter(c => !finalCodesSet.has(c));
    other.lampCodes = remaining;
    if (remaining.length === 0) {
      emptiedLotIds.push(other.id);
      return false;
    }
    return true;
  });

  if (emptiedLotIds.length > 0) {
    cleanupDeletedLotReferences(db, emptiedLotIds);
  }

  const numMatch = /^LOT-(\d+)$/i.exec(targetId);
  const defaultLotLabel = numMatch ? `Lot ${numMatch[1]} - ${derivedStreet}` : `${targetId} - ${derivedStreet}`;
  const derivedName = name && String(name).trim() ? String(name).trim() : defaultLotLabel;

  if (targetLot) {
    targetLot.name = derivedName;
    targetLot.street = derivedStreet;
    targetLot.lampCodes = Array.from(finalCodesSet);
    if (reserved !== undefined) {
      targetLot.reserved = Boolean(reserved);
      targetLot.reservedReason = targetLot.reserved
        ? (reservedReason ?? targetLot.reservedReason ?? 'Reservat per a actes municipals')
        : '';
    }
  } else {
    targetLot = {
      id: targetId,
      name: derivedName,
      street: derivedStreet,
      lampCodes: Array.from(finalCodesSet),
      lampCount: strictlySelectedLamps.length,
      totalLampCount: strictlySelectedLamps.length,
      reserved: Boolean(reserved),
      reservedReason: reserved ? (reservedReason || 'Reservat per a actes municipals') : '',
      coords: [],
      lamps: []
    };
    db.lots.push(targetLot);
  }

  saveDb(db);
  const hydratedLot = db.lots.find(l => l.id === targetLot.id);
  res.json({ success: true, lot: hydratedLot, lots: db.lots });
});

app.delete('/api/admin/lots/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (!Array.isArray(db.lots)) db.lots = [];

  const before = db.lots.length;
  db.lots = db.lots.filter(l => l.id !== id);
  if (db.lots.length === before) {
    return res.status(404).json({ error: 'Lot no trobat.' });
  }

  cleanupDeletedLotReferences(db, [id]);
  saveDb(db);
  res.json({ success: true, lots: db.lots });
});

app.delete('/api/admin/lots', requireAdmin, (_req, res) => {
  const db = getDb();
  const allIds = (db.lots || []).map(l => l.id);
  db.lots = [];
  if (allIds.length > 0) {
    cleanupDeletedLotReferences(db, allIds);
  }
  saveDb(db);
  res.json({ success: true, lots: [] });
});

// Admin: Toggle selection state (`APTA` <-> `SELECCIONADA`) for one or multiple `Columna` streetlamps
function handleAdminLampSelection(req, res) {
  const { lampId, lampIds, selected, status, suitable } = req.body || {};
  const targets = Array.isArray(lampIds)
    ? lampIds.map(String)
    : lampId !== undefined && lampId !== null
      ? [String(lampId)]
      : [];

  if (targets.length === 0) {
    return res.status(400).json({ error: 'Indiqueu almenys una farola a actualitzar.' });
  }

  const markSelected = selected !== undefined
    ? Boolean(selected)
    : status !== undefined
      ? status === 'SELECCIONADA'
      : Boolean(suitable);

  const db = getDb();
  const targetSet = new Set(targets);
  let modifiedCount = 0;
  let blockedCount = 0;

  if (Array.isArray(db.lamps) && db.lamps.length > 0) {
    db.lamps.forEach(lamp => {
      if (targetSet.has(String(lamp.codi)) || targetSet.has(String(lamp.id))) {
        if (lamp.status === 'NO_APTA') {
          blockedCount++;
          return;
        }
        lamp.selected = markSelected;
        lamp.status = markSelected ? 'SELECCIONADA' : 'APTA';
        modifiedCount++;
      }
    });
  }

  if (modifiedCount === 0) {
    if (blockedCount > 0) {
      return res.status(400).json({
        error: 'Aquestes faroles estan marcades com a No Aptes. Declareu-les primer com a Aptes des de Gestió Municipal si voleu seleccionar-les.'
      });
    }
    return res.status(404).json({ error: 'Farola no trobada a l\'inventari.' });
  }

  saveDb(db);
  res.json({ success: true, modifiedCount, blockedCount });
}

app.post('/api/admin/lamp/suitable', requireAdmin, handleAdminLampSelection);
app.post('/api/admin/lamp/select', requireAdmin, handleAdminLampSelection);

// Admin: Bulk update selection (`APTA` <-> `SELECCIONADA`) across all lamps currently declared Apta
app.post('/api/admin/bulk-suitability', requireAdmin, (req, res) => {
  const { street, supportType, onlyUnassigned, selected, suitable } = req.body || {};
  const db = getDb();
  const markSelected = selected !== undefined ? Boolean(selected) : Boolean(suitable);
  let modifiedCount = 0;

  const qStreet = street ? String(street).trim().toLowerCase() : '';
  const qSupport = supportType ? String(supportType).trim().toLowerCase() : '';

  if (Array.isArray(db.lamps)) {
    db.lamps.forEach(lamp => {
      if (lamp.status === 'NO_APTA') return;
      if (qSupport && !(lamp.suport && lamp.suport.toLowerCase().includes(qSupport))) return;
      if (qStreet) {
        const matchText = `${lamp.codi || ''} ${lamp.carrer || ''} ${lamp.lotId || ''}`.toLowerCase();
        if (!matchText.includes(qStreet)) return;
      }
      if (onlyUnassigned && lamp.lotId) return;

      lamp.selected = markSelected;
      lamp.status = markSelected ? 'SELECCIONADA' : 'APTA';
      modifiedCount++;
    });
  }

  saveDb(db);
  res.json({ success: true, modifiedCount });
});

// Admin: Declare streetlamps as Apta or No Apta (`NO_APTA` <-> `APTA`), individually, in bulk, or reset to default (Columna + Bàcul)
app.post('/api/admin/lamp/aptitude', requireAdmin, (req, res) => {
  const { lampId, lampIds, apta, resetDefault, unsuitableReason } = req.body || {};
  const db = getDb();
  if (!Array.isArray(db.lamps)) db.lamps = [];
  if (!Array.isArray(db.lots)) db.lots = [];

  let modifiedCount = 0;

  if (resetDefault) {
    const secondaryMap = findSecondaryPoleMap(db.lamps, null, 1.8);
    db.lamps.forEach(lamp => {
      const defaultApt = isAptSupport(lamp.suport);
      const primaryPoleCodi = secondaryMap.get(String(lamp.codi));

      if (defaultApt && !primaryPoleCodi) {
        if (lamp.status === 'NO_APTA') {
          lamp.status = 'APTA';
          lamp.suitable = true;
          lamp.selected = false;
          lamp.lockedUnsuitable = false;
          lamp.unsuitableReason = '';
          modifiedCount++;
        } else {
          lamp.suitable = true;
          lamp.lockedUnsuitable = false;
          lamp.unsuitableReason = '';
        }
      } else {
        if (lamp.status !== 'NO_APTA') {
          modifiedCount++;
        }
        lamp.status = 'NO_APTA';
        lamp.suitable = false;
        lamp.selected = false;
        lamp.lockedUnsuitable = true;
        lamp.unsuitableReason = primaryPoleCodi
          ? `Lluminària secundària al mateix suport (${primaryPoleCodi})`
          : `Suport no apte per defecte (${lamp.suport || 'altres'})`;
      }
    });
  } else {
    const targets = Array.isArray(lampIds)
      ? lampIds.map(String)
      : lampId !== undefined && lampId !== null
        ? [String(lampId)]
        : [];

    if (targets.length === 0) {
      return res.status(400).json({ error: 'Indiqueu almenys una farola per canviar-ne l\'aptitud.' });
    }

    const targetSet = new Set(targets);
    const markApta = Boolean(apta);

    db.lamps.forEach(lamp => {
      if (targetSet.has(String(lamp.codi)) || targetSet.has(String(lamp.id))) {
        if (markApta) {
          if (lamp.status === 'NO_APTA') {
            lamp.status = 'APTA';
            lamp.suitable = true;
            lamp.selected = false;
            lamp.lockedUnsuitable = false;
            lamp.unsuitableReason = '';
            modifiedCount++;
          }
        } else {
          if (lamp.status !== 'NO_APTA' || (unsuitableReason && lamp.unsuitableReason !== unsuitableReason)) {
            modifiedCount++;
          }
          lamp.status = 'NO_APTA';
          lamp.suitable = false;
          lamp.selected = false;
          lamp.lockedUnsuitable = true;
          lamp.unsuitableReason = unsuitableReason || 'Declarada No Apta manualment';
        }
      }
    });
  }

  // `saveDb(db)` -> `recalculateLotsAndQuotas(db)` automatically detaches `NO_APTA` lamps from lots
  // and cleans up any emptied lots (`lotPreferences` + `allocationResults`).
  saveDb(db);
  res.json({ success: true, modifiedCount });
});

// Admin: Manage Fixed Locations / Emplaçaments (Create / Update / Delete / Clear)
app.post('/api/admin/locations', requireAdmin, (req, res) => {
  const { id, name, type, address, description, capacity, lat, lng, imageUrl } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'El nom de l\'emplaçament és obligatori.' });
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
    return res.status(400).json({ error: 'Les coordenades (latitud i longitud) no són vàlides.' });
  }

  const parsedCap = Math.max(1, Math.round(Number(capacity) || 1));

  const db = getDb();
  if (!Array.isArray(db.locations)) db.locations = [];

  let loc = id ? db.locations.find(l => l.id === id) : null;

  if (loc) {
    loc.name = String(name).trim();
    loc.type = type || loc.type || 'CARTELLERA';
    loc.address = address !== undefined ? String(address).trim() : loc.address;
    loc.description = description !== undefined ? String(description).trim() : loc.description;
    loc.capacity = parsedCap;
    loc.lat = parsedLat;
    loc.lng = parsedLng;
    if (imageUrl !== undefined) loc.imageUrl = String(imageUrl).trim();
  } else {
    // Generate next sequential EMP-XX code
    let maxNum = 0;
    db.locations.forEach(l => {
      const m = /^EMP-(\d+)$/i.exec(l.id || '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const newId = id && String(id).trim()
      ? String(id).trim()
      : `EMP-${String(maxNum + 1).padStart(2, '0')}`;

    if (db.locations.some(l => l.id === newId)) {
      return res.status(409).json({ error: `Ja existeix un emplaçament amb el codi ${newId}.` });
    }

    loc = {
      id: newId,
      name: String(name).trim(),
      type: type || 'CARTELLERA',
      address: address ? String(address).trim() : 's/n',
      description: description ? String(description).trim() : '',
      capacity: parsedCap,
      lat: parsedLat,
      lng: parsedLng,
      imageUrl: imageUrl ? String(imageUrl).trim() : ''
    };
    db.locations.push(loc);
  }

  saveDb(db);
  res.json({ success: true, location: loc, locations: db.locations });
});

app.delete('/api/admin/locations/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (!Array.isArray(db.locations)) db.locations = [];

  const beforeLen = db.locations.length;
  db.locations = db.locations.filter(l => l.id !== id);
  if (db.locations.length === beforeLen) {
    return res.status(404).json({ error: 'Emplaçament no trobat.' });
  }

  // Clean up preferences & allocation references
  if (db.locationPreferences) {
    Object.keys(db.locationPreferences).forEach(pid => {
      if (Array.isArray(db.locationPreferences[pid])) {
        db.locationPreferences[pid] = db.locationPreferences[pid].filter(locId => locId !== id);
      }
    });
  }
  if (db.allocationResults?.locationAssignments?.[id]) {
    const affectedParties = db.allocationResults.locationAssignments[id];
    delete db.allocationResults.locationAssignments[id];
    if (db.allocationResults.partyAssignedLocations) {
      affectedParties.forEach(pid => {
        if (db.allocationResults.partyAssignedLocations[pid] > 0) {
          db.allocationResults.partyAssignedLocations[pid] -= 1;
        }
      });
    }
  }

  saveDb(db);
  res.json({ success: true, locations: db.locations });
});

app.delete('/api/admin/locations', requireAdmin, (_req, res) => {
  const db = getDb();
  db.locations = [];
  db.locationPreferences = {};
  if (db.allocationResults) {
    db.allocationResults.locationAssignments = {};
    if (db.allocationResults.partyAssignedLocations) {
      Object.keys(db.allocationResults.partyAssignedLocations).forEach(pid => {
        db.allocationResults.partyAssignedLocations[pid] = 0;
      });
    }
  }
  saveDb(db);
  res.json({ success: true, locations: [] });
});

// Admin: Create or Update Political Party & Credentials / Quotas
app.post('/api/admin/parties', requireAdmin, (req, res) => {
  const {
    id,
    isEditing,
    name,
    acronym,
    color,
    seats,
    votes,
    quotaPct,
    orderRank,
    username,
    password
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'El nom complet de la candidatura és obligatori.' });
  }
  if (!acronym || !String(acronym).trim()) {
    return res.status(400).json({ error: 'Les sigles (acrònim) de la candidatura són obligatòries.' });
  }

  const db = getDb();
  if (!Array.isArray(db.parties)) db.parties = [];

  const cleanName = String(name).trim();
  const cleanAcronym = String(acronym).trim();
  const cleanColor = color && /^#[0-9a-fA-F]{6}$/.test(String(color).trim())
    ? String(color).trim()
    : '#3B82F6';
  const parsedSeats = Math.max(0, Math.round(Number(seats) || 0));
  const parsedVotes = Math.max(0, Math.round(Number(votes) || 0));
  const cleanUsername = String(username || cleanAcronym).trim();

  if (!cleanUsername) {
    return res.status(400).json({ error: 'Cal indicar un nom d\'usuari d\'accés per al partit.' });
  }
  if (cleanUsername.toLowerCase() === String(db.admin?.username || 'admin').toLowerCase()) {
    return res.status(409).json({ error: 'Aquest nom d\'usuari està reservat per a l\'administració municipal.' });
  }

  let targetParty = isEditing && id
    ? db.parties.find(p => p.id === id)
    : null;

  if (isEditing && !targetParty) {
    return res.status(404).json({ error: 'Candidatura no trobada.' });
  }

  const duplicateUser = db.parties.find(
    p => (!targetParty || p.id !== targetParty.id) && String(p.username || '').toLowerCase() === cleanUsername.toLowerCase()
  );
  if (duplicateUser) {
    return res.status(409).json({ error: `Ja existeix una altra candidatura amb l'usuari "${cleanUsername}".` });
  }

  if (targetParty) {
    targetParty.name = cleanName;
    targetParty.acronym = cleanAcronym;
    targetParty.color = cleanColor;
    targetParty.seats = parsedSeats;
    targetParty.votes = parsedVotes;
    targetParty.username = cleanUsername;

    if (quotaPct !== undefined && quotaPct !== '' && !Number.isNaN(Number(quotaPct))) {
      targetParty.quotaPct = Math.max(0, Number(Number(quotaPct).toFixed(2)));
      delete targetParty.quotaRatio;
    }
    if (password !== undefined && String(password).trim() !== '') {
      targetParty.password = String(password).trim();
    }

    if (orderRank !== undefined && !Number.isNaN(Number(orderRank))) {
      const desiredIdx = Math.max(0, Math.min(db.parties.length - 1, Math.round(Number(orderRank)) - 1));
      const currIdx = db.parties.findIndex(p => p.id === targetParty.id);
      if (currIdx !== -1 && currIdx !== desiredIdx) {
        const [moved] = db.parties.splice(currIdx, 1);
        db.parties.splice(desiredIdx, 0, moved);
      }
    }
  } else {
    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'Cal indicar una contrasenya d\'accés per a la nova candidatura.' });
    }

    const baseSlug = toUpperSlug(id || cleanAcronym || cleanUsername, 'PARTIT');

    let newId = baseSlug === 'ADMIN' ? 'PARTIT_1' : baseSlug;
    let suffix = 2;
    while (db.parties.some(p => p.id === newId)) {
      newId = `${baseSlug}_${suffix++}`;
    }

    let computedQuotaPct;
    if (quotaPct !== undefined && quotaPct !== '' && !Number.isNaN(Number(quotaPct))) {
      computedQuotaPct = Math.max(0, Number(Number(quotaPct).toFixed(2)));
    } else {
      const existingVotes = db.parties.reduce((acc, p) => acc + (Number(p.votes) || 0), 0);
      const nextTotalVotes = existingVotes + parsedVotes;
      computedQuotaPct = nextTotalVotes > 0 && parsedVotes > 0
        ? Number(((parsedVotes / nextTotalVotes) * 100).toFixed(2))
        : Number((100 / (db.parties.length + 1)).toFixed(2));
    }

    targetParty = {
      id: newId,
      name: cleanName,
      acronym: cleanAcronym,
      color: cleanColor,
      seats: parsedSeats,
      votes: parsedVotes,
      quotaPct: computedQuotaPct,
      orderRank: db.parties.length + 1,
      allocatedStreetlampsQuota: 0,
      allocatedLocationsQuota: 0,
      username: cleanUsername,
      password: String(password).trim()
    };

    if (orderRank !== undefined && !Number.isNaN(Number(orderRank))) {
      const insertIdx = Math.max(0, Math.min(db.parties.length, Math.round(Number(orderRank)) - 1));
      db.parties.splice(insertIdx, 0, targetParty);
    } else {
      db.parties.push(targetParty);
    }
  }

  db.parties.forEach((p, idx) => {
    p.orderRank = idx + 1;
  });

  if (db.electionInfo?.status === 'ALLOCATED') {
    db.allocationResults = null;
    db.electionInfo.status = 'OPEN';
  }

  saveDb(db);
  const sanitized = sanitizeDbForClient(db, req.auth);
  res.json({
    success: true,
    party: sanitized.parties.find(p => p.id === targetParty.id),
    parties: sanitized.parties
  });
});

// Admin: Delete a Political Party
app.delete('/api/admin/parties/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (!Array.isArray(db.parties)) db.parties = [];

  const beforeLen = db.parties.length;
  db.parties = db.parties.filter(p => p.id !== id);
  if (db.parties.length === beforeLen) {
    return res.status(404).json({ error: 'Candidatura no trobada.' });
  }

  db.parties.forEach((p, idx) => {
    p.orderRank = idx + 1;
  });

  clearPartyPreferencesInDb(db, id);

  if (db.allocationResults) {
    db.allocationResults = null;
    if (db.electionInfo?.status === 'ALLOCATED') {
      db.electionInfo.status = 'OPEN';
    }
  }

  saveDb(db);
  const sanitized = sanitizeDbForClient(db, req.auth);
  res.json({ success: true, parties: sanitized.parties });
});

// Admin: Recalculate Party Quota Percentages / Order or Batch-Update Quotas
app.post('/api/admin/parties/recalc-quotas', requireAdmin, (req, res) => {
  const { mode, minPctForZero = 0, updates } = req.body || {};
  const db = getDb();
  if (!Array.isArray(db.parties) || db.parties.length === 0) {
    return res.status(400).json({ error: 'No hi ha candidatures registrades.' });
  }

  if (Array.isArray(updates) && updates.length > 0) {
    const byId = new Map(updates.map(u => [u.id, u]));
    db.parties.forEach(p => {
      const u = byId.get(p.id);
      if (!u) return;
      if (u.quotaPct !== undefined && !Number.isNaN(Number(u.quotaPct))) {
        p.quotaPct = Math.max(0, Number(Number(u.quotaPct).toFixed(2)));
        delete p.quotaRatio;
      }
      if (u.seats !== undefined && !Number.isNaN(Number(u.seats))) {
        p.seats = Math.max(0, Math.round(Number(u.seats)));
      }
      if (u.votes !== undefined && !Number.isNaN(Number(u.votes))) {
        p.votes = Math.max(0, Math.round(Number(u.votes)));
      }
      if (u.orderRank !== undefined && !Number.isNaN(Number(u.orderRank))) {
        p.orderRank = Math.max(1, Math.round(Number(u.orderRank)));
      }
    });
    db.parties.sort((a, b) => (a.orderRank || 999) - (b.orderRank || 999));
    db.parties.forEach((p, idx) => { p.orderRank = idx + 1; });
  } else if (mode === 'SORT_BY_RESULTS') {
    db.parties.sort((a, b) => (
      ((b.seats || 0) - (a.seats || 0)) ||
      ((b.votes || 0) - (a.votes || 0)) ||
      String(a.acronym || '').localeCompare(String(b.acronym || ''), 'ca')
    ));
    db.parties.forEach((p, idx) => { p.orderRank = idx + 1; });
  } else if (mode === 'VOTES' || mode === 'SEATS') {
    const field = mode === 'VOTES' ? 'votes' : 'seats';
    const minShare = Math.max(0, Math.min(20, Number(minPctForZero) || 0));
    const zeroParties = db.parties.filter(p => (Number(p[field]) || 0) <= 0);
    const positiveSum = db.parties.reduce((acc, p) => acc + Math.max(0, Number(p[field]) || 0), 0);

    if (positiveSum <= 0) {
      const eq = Number((100 / db.parties.length).toFixed(2));
      db.parties.forEach(p => {
        p.quotaPct = eq;
        delete p.quotaRatio;
      });
    } else {
      const reservedPct = Math.min(80, zeroParties.length * minShare);
      const remainingPct = Math.max(0, 100 - reservedPct);
      db.parties.forEach(p => {
        const val = Math.max(0, Number(p[field]) || 0);
        p.quotaPct = val > 0
          ? Number(((val / positiveSum) * remainingPct).toFixed(2))
          : Number(minShare.toFixed(2));
        delete p.quotaRatio;
      });
    }
  } else if (mode === 'EQUAL') {
    const eq = Number((100 / db.parties.length).toFixed(2));
    db.parties.forEach(p => {
      p.quotaPct = eq;
      delete p.quotaRatio;
    });
  } else {
    return res.status(400).json({ error: 'Mode de recàlcul no vàlid.' });
  }

  if (db.electionInfo?.status === 'ALLOCATED') {
    db.allocationResults = null;
    db.electionInfo.status = 'OPEN';
  }

  saveDb(db);
  const sanitized = sanitizeDbForClient(db, req.auth);
  res.json({ success: true, parties: sanitized.parties });
});

// Admin: Update Election General Info (Title & Date)
app.post('/api/admin/election-info', requireAdmin, (req, res) => {
  const { title, date } = req.body || {};
  const db = getDb();
  if (!db.electionInfo) db.electionInfo = {};
  if (title !== undefined && String(title).trim()) {
    db.electionInfo.title = String(title).trim();
  }
  if (date !== undefined && String(date).trim()) {
    db.electionInfo.date = String(date).trim();
  }
  saveDb(db);
  res.json({ success: true, electionInfo: db.electionInfo });
});

// PDF Report Download (Admin only)
app.get('/api/reports/pdf', requireAdmin, (_req, res) => {
  const db = peekDb();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Assignacio_Fanals_SantJoan.pdf"');
  generateReportPdf(db, res);
});

// GeoJSON Export Endpoint (Point features per streetlamp inside lots + Fixed Locations `Emplaçaments`)
app.get('/api/reports/geojson', requireAdmin, (_req, res) => {
  const db = peekDb();
  const results = db.allocationResults || {};
  const partyById = new Map((db.parties || []).map(p => [p.id, p]));
  const features = [];

  db.lots.forEach(lot => {
    const activeLamps = getActiveLotLamps(lot);
    const lotLampMap = results.lotLampAssignments?.[lot.id] || {};

    if (lot.reserved || activeLamps.length === 0) {
      const coordinates = (lot.coords || []).map(c => [c[1], c[0]]);
      if (coordinates.length > 0) {
        features.push({
          type: 'Feature',
          geometry: coordinates.length === 1
            ? { type: 'Point', coordinates: coordinates[0] }
            : { type: 'LineString', coordinates },
          properties: {
            featureType: 'LOT',
            lotId: lot.id,
            lotName: lot.name,
            street: lot.street,
            reserved: Boolean(lot.reserved),
            assignedPartyId: null,
            assignedPartyName: null,
            color: lot.reserved ? '#DC2626' : '#B45309'
          }
        });
      }
      return;
    }

    activeLamps.forEach(lamp => {
      const assignedPartyId = lotLampMap[lamp.codi] || results.lampAssignments?.[lamp.codi] || null;
      const party = assignedPartyId ? partyById.get(assignedPartyId) : null;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lamp.lng, lamp.lat]
        },
        properties: {
          featureType: 'LAMP',
          codi: lamp.codi,
          lotId: lot.id,
          lotName: lot.name,
          street: lamp.carrer || lot.street,
          num: lamp.num || 's/n',
          suport: lamp.suport || '',
          reserved: false,
          assignedPartyId: assignedPartyId || null,
          assignedPartyAcronym: party ? party.acronym : null,
          assignedPartyName: party ? party.name : null,
          color: party ? party.color : '#64748B'
        }
      });
    });
  });

  (db.locations || []).forEach(loc => {
    const assignedIds = results.locationAssignments?.[loc.id] || [];
    const assignedAcronyms = assignedIds.map(pid => partyById.get(pid)?.acronym || pid);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [loc.lng, loc.lat]
      },
      properties: {
        featureType: 'LOCATION',
        codi: loc.id,
        name: loc.name,
        type: loc.type || 'CARTELLERA',
        address: loc.address || 's/n',
        capacity: loc.capacity || 1,
        assignedPartyIds: assignedIds,
        assignedPartyAcronyms: assignedAcronyms.join(', ') || null,
        color: '#15803D'
      }
    });
  });

  const geojson = {
    type: 'FeatureCollection',
    municipality: 'Sant Joan de Vilatorrada',
    election: db.electionInfo.title,
    features
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="fanals_santjoan.geojson"');
  res.json(geojson);
});

// CSV Export Endpoint (Streetlamps inside lots + Fixed Locations `Emplaçaments`)
app.get('/api/reports/csv', requireAdmin, (_req, res) => {
  const db = peekDb();
  const results = db.allocationResults || {};
  const partyById = new Map((db.parties || []).map(p => [p.id, p]));

  let csv = 'Tipus;Codi Grup;Nom Grup;Codi Element;Carrer / Adreça;Número;Suport / Capacitat;Estat;Partit Assignat\n';

  db.lots.forEach(lot => {
    const activeLamps = getActiveLotLamps(lot);
    const lotLampMap = results.lotLampAssignments?.[lot.id] || {};

    if (lot.reserved || activeLamps.length === 0) {
      const status = lot.reserved ? 'Reservat' : 'Sense fanals seleccionats';
      csv += `"Fanal";"${lot.id}";"${lot.name}";"-";"${lot.street}";"-";"-";"${status}";"-"\n`;
      return;
    }

    activeLamps.forEach(lamp => {
      const assignedPartyId = lotLampMap[lamp.codi] || results.lampAssignments?.[lamp.codi] || null;
      const party = assignedPartyId ? partyById.get(assignedPartyId) : null;
      const status = party ? 'Assignada' : 'Disponible';
      csv += `"Fanal";"${lot.id}";"${lot.name}";"${lamp.codi}";"${lamp.carrer || lot.street}";"${lamp.num || 's/n'}";"${lamp.suport || ''}";"${status}";"${party ? `${party.acronym} - ${party.name}` : '-'}"\n`;
    });
  });

  (db.locations || []).forEach(loc => {
    const assignedIds = results.locationAssignments?.[loc.id] || [];
    const assignedText = assignedIds
      .map(pid => {
        const p = partyById.get(pid);
        return p ? p.acronym : pid;
      })
      .join(', ');
    const status = assignedIds.length > 0 ? `Assignat (${assignedIds.length}/${loc.capacity})` : 'Disponible';
    csv += `"Emplaçament";"${loc.id}";"${loc.name}";"${loc.id}";"${loc.address || 's/n'}";"-";"${loc.type || 'CARTELLERA'} (Cap. ${loc.capacity})";"${status}";"${assignedText || '-'}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fanals_santjoan.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel UTF-8
});

// ==================== ADMIN ELECTION HISTORY / SNAPSHOTS ====================

// Archive current municipal configuration, lots, locations, parties & preferences as a reusable snapshot
app.post('/api/admin/history/archive', requireAdmin, (req, res) => {
  const { id: requestedId, title, date } = req.body || {};
  const db = getDb();

  const cleanTitle = (title ? String(title).trim() : '') || db.electionInfo?.title || 'Convocatòria Arxivada';
  const cleanDate = (date ? String(date).trim() : '') || db.electionInfo?.date || '';

  if (!db.historicalPreferences || typeof db.historicalPreferences !== 'object') {
    db.historicalPreferences = {};
  }

  let snapshotId = requestedId ? String(requestedId).trim() : '';
  if (!snapshotId) {
    const baseSlug = toUpperSlug(cleanTitle, 'ELECCIONS').slice(0, 26) || 'ELECCIONS';
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    snapshotId = `${baseSlug}_${stamp}`;
    let suffix = 2;
    while (db.historicalPreferences[snapshotId]) {
      snapshotId = `${baseSlug}_${stamp}_${suffix++}`;
    }
  }

  const lampsArr = Array.isArray(db.lamps) ? db.lamps : [];
  const selectedLampCodes = lampsArr.filter(l => l.status === 'SELECCIONADA').map(l => l.codi);
  const customAptLampCodes = lampsArr
    .filter(l => !isAptSupport(l.suport) && l.status !== 'NO_APTA')
    .map(l => l.codi);
  const customNoAptLamps = lampsArr
    .filter(l => isAptSupport(l.suport) && l.status === 'NO_APTA')
    .map(l => ({ codi: l.codi, reason: l.unsuitableReason || '' }));

  const lotsSnapshot = (db.lots || []).map(l => ({
    id: l.id,
    name: l.name,
    street: l.street,
    lampCodes: Array.isArray(l.lampCodes) ? [...l.lampCodes] : (l.lamps || []).map(lp => lp.codi),
    reserved: Boolean(l.reserved),
    reservedReason: l.reservedReason || ''
  }));

  const locationsSnapshot = structuredClone(db.locations || []);
  const partiesSnapshot = (db.parties || []).map(p => ({
    id: p.id,
    name: p.name,
    acronym: p.acronym,
    color: p.color,
    seats: p.seats ?? 0,
    votes: p.votes ?? 0,
    quotaPct: p.quotaPct ?? p.effectiveQuotaPct ?? 0,
    orderRank: p.orderRank ?? 1
  }));

  const lotPreferencesCopy = structuredClone(db.lotPreferences || {});
  const lotOrderPreferencesCopy = structuredClone(db.lotOrderPreferences || {});
  const locationPreferencesCopy = structuredClone(db.locationPreferences || {});
  const allocationResultsCopy = db.allocationResults
    ? structuredClone(db.allocationResults)
    : null;

  // Build flat physical lamp priority list per party (interleaved by rank 1, rank 2... across lots ordered by party importance)
  // so future elections can match preferred physical streetlamps even if Lot IDs change!
  const partyLampPriority = {};
  Object.entries(lotPreferencesCopy).forEach(([pid, prefsByLot]) => {
    const orderRankMap = new Map(
      (Array.isArray(lotOrderPreferencesCopy[pid]) ? lotOrderPreferencesCopy[pid] : []).map((lid, idx) => [lid, idx])
    );
    const lists = Object.entries(prefsByLot || {})
      .sort(([lidA], [lidB]) => {
        const rA = orderRankMap.has(lidA) ? orderRankMap.get(lidA) : 9999;
        const rB = orderRankMap.has(lidB) ? orderRankMap.get(lidB) : 9999;
        return rA - rB;
      })
      .map(([, pref]) =>
        Array.isArray(pref) ? pref : (Array.isArray(pref?.orderedLampCodes) ? pref.orderedLampCodes : [])
      );
    const maxLen = lists.reduce((m, arr) => Math.max(m, arr.length), 0);
    const seen = new Set();
    const flat = [];
    for (let r = 0; r < maxLen; r++) {
      for (const arr of lists) {
        if (r < arr.length) {
          const code = String(arr[r]);
          if (!seen.has(code)) {
            seen.add(code);
            flat.push(code);
          }
        }
      }
    }
    if (flat.length > 0) {
      partyLampPriority[pid] = flat;
    }
  });

  const snapshot = {
    id: snapshotId,
    isFullSnapshot: true,
    title: cleanTitle,
    date: cleanDate,
    archivedAt: new Date().toISOString(),
    electionStatus: db.electionInfo?.status || 'OPEN',
    selectedLampCodes,
    customAptLampCodes,
    customNoAptLamps,
    lots: lotsSnapshot,
    locations: locationsSnapshot,
    partiesSnapshot,
    lotPreferences: lotPreferencesCopy,
    lotOrderPreferences: lotOrderPreferencesCopy,
    partyLampPriority,
    locationPreferences: locationPreferencesCopy,
    allocationResults: allocationResultsCopy,
    summary: {
      selectedLampsCount: selectedLampCodes.length,
      lotsCount: lotsSnapshot.length,
      locationsCount: locationsSnapshot.length,
      partiesCount: partiesSnapshot.length,
      hasAllocation: Boolean(allocationResultsCopy)
    }
  };

  db.historicalPreferences[snapshotId] = snapshot;
  saveDb(db);

  res.json({
    success: true,
    snapshotId,
    summary: snapshot.summary
  });
});

// Restore an archived snapshot for preparing a new election (`TEMPLATE`) or full state inspection (`FULL`)
app.post('/api/admin/history/:id/restore', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { mode = 'TEMPLATE', includeParties = false } = req.body || {};
  const db = getDb();

  const past = db.historicalPreferences?.[id];
  if (!past) {
    return res.status(404).json({ error: 'Convocatòria històrica no trobada.' });
  }
  if (!past.isFullSnapshot) {
    return res.status(400).json({
      error: 'Aquest registre antic només conté preferències de mostra dels partits i no inclou l\'inventari municipal de faroles i lots.'
    });
  }

  const selectedSet = new Set((past.selectedLampCodes || []).map(String));
  const customAptSet = new Set((past.customAptLampCodes || []).map(String));
  const customNoAptMap = new Map(
    (past.customNoAptLamps || []).map(item => [String(item.codi), item.reason || ''])
  );

  // 1. Restore streetlamp aptitude & `SELECCIONADA` states onto the municipal inventory
  if (Array.isArray(db.lamps)) {
    db.lamps.forEach(lamp => {
      const code = String(lamp.codi);
      const defaultApt = isAptSupport(lamp.suport);
      const isNoApta = defaultApt ? customNoAptMap.has(code) : !customAptSet.has(code) && !selectedSet.has(code);

      if (isNoApta) {
        lamp.status = 'NO_APTA';
        lamp.suitable = false;
        lamp.selected = false;
        lamp.lockedUnsuitable = true;
        lamp.unsuitableReason = customNoAptMap.get(code) || lamp.unsuitableReason || `Suport no apte (${lamp.suport})`;
      } else if (selectedSet.has(code)) {
        lamp.status = 'SELECCIONADA';
        lamp.suitable = true;
        lamp.selected = true;
        lamp.lockedUnsuitable = false;
        lamp.unsuitableReason = '';
      } else {
        lamp.status = 'APTA';
        lamp.suitable = true;
        lamp.selected = false;
        lamp.lockedUnsuitable = false;
        lamp.unsuitableReason = '';
      }
    });
  }

  // 2. Restore Lots & Fixed Locations
  db.lots = structuredClone(past.lots || []);
  db.locations = structuredClone(past.locations || []);

  // 3. Optionally restore Party Quotas / Representation (preserving existing login credentials!)
  if ((includeParties || mode === 'FULL') && Array.isArray(past.partiesSnapshot) && past.partiesSnapshot.length > 0) {
    const existingById = new Map((db.parties || []).map(p => [p.id, p]));
    db.parties = past.partiesSnapshot.map((sp, idx) => {
      const prev = existingById.get(sp.id);
      return {
        id: sp.id,
        name: sp.name,
        acronym: sp.acronym,
        color: sp.color || prev?.color || '#3B82F6',
        seats: sp.seats ?? 0,
        votes: sp.votes ?? 0,
        quotaPct: sp.quotaPct ?? 0,
        orderRank: sp.orderRank ?? (idx + 1),
        username: prev?.username || sp.id,
        password: prev?.password || sp.id.toLowerCase()
      };
    });
  }

  // 4. Apply `FULL` vs `TEMPLATE` (New Election) state
  if (mode === 'FULL') {
    if (db.electionInfo) {
      db.electionInfo.title = past.title || db.electionInfo.title;
      db.electionInfo.date = past.date || db.electionInfo.date;
      db.electionInfo.status = past.electionStatus || (past.allocationResults ? 'ALLOCATED' : 'OPEN');
    }
    db.lotPreferences = structuredClone(past.lotPreferences || {});
    db.lotOrderPreferences = structuredClone(past.lotOrderPreferences || {});
    db.locationPreferences = structuredClone(past.locationPreferences || {});
    db.allocationResults = past.allocationResults
      ? structuredClone(past.allocationResults)
      : null;
  } else {
    // TEMPLATE mode: municipal spaces ready, period OPEN, clean slate for new party selections
    if (db.electionInfo) {
      db.electionInfo.status = 'OPEN';
    }
    clearPartyPreferencesInDb(db);
    db.allocationResults = null;
  }

  saveDb(db);
  res.json({ success: true, mode });
});

app.delete('/api/admin/history/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (!db.historicalPreferences?.[id]) {
    return res.status(404).json({ error: 'Convocatòria històrica no trobada.' });
  }
  delete db.historicalPreferences[id];
  saveDb(db);
  res.json({ success: true });
});

// Serve built frontend in production if dist exists
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export { app };

if (path.resolve(process.argv[1] || '') === __filename) {
  const server = http.createServer(app);
  let listenRetries = 0;

  const startListening = () => {
    server.listen(PORT, '0.0.0.0');
  };

  server.on('listening', () => {
    peekDb(); // Ensure SQLite WAL database is initialized on boot
    console.log(`Servei Backend (SQLite WAL) de Sant Joan de Vilatorrada actiu a http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && listenRetries < 5) {
      listenRetries += 1;
      setTimeout(() => {
        server.close();
        startListening();
      }, 400);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(`[ERROR] El port ${PORT} ja està ocupat per una altra terminal o procés Node.`);
    } else {
      console.error('[ERROR SERVIDOR]', err);
    }
    closeDb();
    process.exit(1);
  });

  let shuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${signal}] Tancant connexions i consolidant SQLite WAL...`);
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => {
      closeDb();
      process.exit(0);
    }, 1500).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  startListening();
}
