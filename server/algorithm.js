/**
 * Algorisme de repartiment automàtic de fanals (Opció A: proporcional dins de cada lot segons numeració individual)
 * i d'emplaçaments fixos (cartelleres, panells i pancartes).
 */

export function getActiveLotLamps(lot) {
  if (!lot || lot.reserved) return [];
  if (Array.isArray(lot.lamps) && lot.lamps.length > 0) {
    return lot.lamps.filter(l => (l.status ? l.status === 'SELECCIONADA' : l.suitable !== false));
  }
  return [];
}

export function getEffectiveLampCount(lot) {
  if (!lot || lot.reserved) return 0;
  if (Array.isArray(lot.lamps) && lot.lamps.length > 0) {
    return getActiveLotLamps(lot).length;
  }
  return Math.max(0, Number(lot.lampCount) || 0);
}

export function getOrderedLampCodesForPartyLot(lotPreferences, partyId, lotId) {
  const pref = lotPreferences?.[partyId]?.[lotId];
  if (!pref) return [];
  if (Array.isArray(pref)) return pref.map(String);
  if (Array.isArray(pref.orderedLampCodes)) return pref.orderedLampCodes.map(String);
  return [];
}

function pickRandom(items) {
  if (!items || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computePartyWeights(sortedParties) {
  const totalVotes = sortedParties.reduce((acc, p) => acc + (Number(p.votes) || 0), 0);
  const raw = sortedParties.map(p => {
    if (p.effectiveQuotaPct !== undefined && p.effectiveQuotaPct !== null) {
      return Math.max(0, Number(p.effectiveQuotaPct) || 0);
    }
    if (p.quotaPct !== undefined && p.quotaPct !== null) {
      return Math.max(0, Number(p.quotaPct) || 0);
    }
    if (p.quotaRatio !== undefined) {
      return Math.max(0, Number(p.quotaRatio) * 100 || 0);
    }
    return totalVotes > 0 ? (Number(p.votes) || 0) / totalVotes : 1 / (sortedParties.length || 1);
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return sum > 0
    ? raw.map(w => w / sum)
    : sortedParties.map(() => 1 / (sortedParties.length || 1));
}

/**
 * Edmonds-Karp feasibility check verifying that all remaining party remainder needs (`remParty`)
 * can be satisfied across remaining lot remainder capacities (`remLot`) using allowed 0/1 edges (`allowedEdge`).
 */
function hasFeasibleRemainderFlow(remParty, remLot, allowedEdge) {
  const P = remParty.length;
  const L = remLot.length;
  let totalNeed = 0;
  for (let i = 0; i < P; i++) totalNeed += remParty[i];
  if (totalNeed <= 0) return true;

  const V = 2 + P + L;
  const SRC = 0;
  const SNK = V - 1;
  const cap = Array.from({ length: V }, () => new Int32Array(V));

  for (let i = 0; i < P; i++) {
    cap[SRC][1 + i] = remParty[i];
    for (let j = 0; j < L; j++) {
      if (allowedEdge[i][j] > 0) {
        cap[1 + i][1 + P + j] = allowedEdge[i][j];
      }
    }
  }
  for (let j = 0; j < L; j++) {
    cap[1 + P + j][SNK] = remLot[j];
  }

  let flow = 0;
  const parent = new Int32Array(V);

  while (flow < totalNeed) {
    parent.fill(-1);
    parent[SRC] = SRC;
    const queue = [SRC];
    let head = 0;

    while (head < queue.length && parent[SNK] === -1) {
      const u = queue[head++];
      for (let v = 0; v < V; v++) {
        if (parent[v] === -1 && cap[u][v] > 0) {
          parent[v] = u;
          if (v === SNK) break;
          queue.push(v);
        }
      }
    }

    if (parent[SNK] === -1) break;

    let push = Infinity;
    for (let v = SNK; v !== SRC; v = parent[v]) {
      const u = parent[v];
      if (cap[u][v] < push) push = cap[u][v];
    }

    for (let v = SNK; v !== SRC; v = parent[v]) {
      const u = parent[v];
      cap[u][v] -= push;
      cap[v][u] += push;
    }
    flow += push;
  }

  return flow === totalNeed;
}

/**
 * Opció 1: Computes exact per-lot quotas (`lotId -> { [partyId]: count }`) combining:
 * 1. Guaranteed proportional integer floor per lot (`floor(w_p * N_lot)`).
 * 2. Flexible remainder slots (`+1` max per lot) assigned via interleaved D'Hondt turns
 *    following each party's Lot Importance Order (`lotOrderPreferences`, then lots with numbered lamps).
 */
function computePartyLotQuotasWithPriorities(
  availableLots,
  sortedParties,
  lotPreferences,
  lotOrderPreferences,
  stepLogs
) {
  const P = sortedParties.length;
  const L = availableLots.length;
  if (P === 0 || L === 0) return {};

  const normWeights = computePartyWeights(sortedParties);
  const lotSizes = availableLots.map(lot => getActiveLotLamps(lot).length);
  const totalLamps = lotSizes.reduce((a, b) => a + b, 0);

  // Global quotas per party (use precomputed `allocatedStreetlampsQuota` if exact, else Largest Remainder)
  const preSum = sortedParties.reduce((acc, p) => acc + (Number(p.allocatedStreetlampsQuota) || 0), 0);
  let globalQuotas;
  if (preSum === totalLamps) {
    globalQuotas = sortedParties.map(p => Number(p.allocatedStreetlampsQuota) || 0);
  } else {
    const exactGlobal = normWeights.map(w => w * totalLamps);
    const floored = exactGlobal.map(q => Math.floor(q));
    const rem = totalLamps - floored.reduce((a, b) => a + b, 0);
    const order = exactGlobal
      .map((q, idx) => ({ idx, diff: q - floored[idx], rank: sortedParties[idx].orderRank || idx }))
      .sort((a, b) => (b.diff - a.diff) || (a.rank - b.rank));
    for (let k = 0; k < rem; k++) {
      floored[order[k % order.length].idx] += 1;
    }
    globalQuotas = floored;
  }

  // 1. Guaranteed integer floor `minMatrix[i][j]`
  const minMatrix = Array.from({ length: P }, (_, i) =>
    lotSizes.map(n => Math.floor(normWeights[i] * n))
  );
  const extraMatrix = Array.from({ length: P }, () => Array.from({ length: L }, () => 0));

  const remParty = globalQuotas.map((gq, i) =>
    Math.max(0, gq - minMatrix[i].reduce((a, b) => a + b, 0))
  );
  const remLot = lotSizes.map((n, j) => {
    let colSum = 0;
    for (let i = 0; i < P; i++) colSum += minMatrix[i][j];
    return Math.max(0, n - colSum);
  });

  // 2. Build each party's effective Lot Priority Order (`[lotIdx1, lotIdx2, ...]`)
  const lotIdxById = new Map(availableLots.map((lot, idx) => [lot.id, idx]));
  const activeLampSetByLotIdx = availableLots.map(lot =>
    new Set(getActiveLotLamps(lot).map(l => String(l.codi)))
  );

  const partyLotOrderIndices = sortedParties.map((party) => {
    const pid = party.id;
    const explicitIds = Array.isArray(lotOrderPreferences?.[pid]) ? lotOrderPreferences[pid] : [];
    const seen = new Set();
    const orderedIdx = [];

    // 2a. Explicit lot order set by the party
    explicitIds.forEach(lid => {
      const idx = lotIdxById.get(lid);
      if (idx !== undefined && !seen.has(idx)) {
        seen.add(idx);
        orderedIdx.push(idx);
      }
    });

    // 2b. Remaining lots where the party numbered at least 1 active streetlamp
    for (let j = 0; j < L; j++) {
      if (seen.has(j)) continue;
      const codes = getOrderedLampCodesForPartyLot(lotPreferences, pid, availableLots[j].id);
      const validSet = activeLampSetByLotIdx[j];
      if (codes.some(c => validSet.has(String(c)))) {
        seen.add(j);
        orderedIdx.push(j);
      }
    }

    // 2c. Remaining lots in default order
    for (let j = 0; j < L; j++) {
      if (!seen.has(j)) {
        seen.add(j);
        orderedIdx.push(j);
      }
    }

    return orderedIdx;
  });

  // 3. Assign flexible remainder slots (+1 max per lot) via D'Hondt turns & feasibility guard
  const allowedEdge = Array.from({ length: P }, (_, i) =>
    lotSizes.map((n, j) => (minMatrix[i][j] + 1 <= n ? 1 : 0))
  );

  // Safety relaxation only if manual quota overrides made strict +1 infeasible at step 0
  if (!hasFeasibleRemainderFlow(remParty, remLot, allowedEdge)) {
    for (let i = 0; i < P; i++) {
      for (let j = 0; j < L; j++) {
        allowedEdge[i][j] = Math.max(0, lotSizes[j] - minMatrix[i][j]);
      }
    }
  }

  let totalRemaining = remParty.reduce((a, b) => a + b, 0);
  const extraAssigned = new Int32Array(P);

  while (totalRemaining > 0) {
    let bestPartyIdx = -1;
    let bestScore = -1;

    for (let i = 0; i < P; i++) {
      if (remParty[i] <= 0) continue;
      const score = Math.max(0.0001, normWeights[i] * 100) / (extraAssigned[i] + 1);
      if (score > bestScore + 1e-9) {
        bestScore = score;
        bestPartyIdx = i;
      }
    }

    if (bestPartyIdx === -1) break;

    let chosenLotIdx = -1;
    let chosenLotPrefRank = 0;
    const prefList = partyLotOrderIndices[bestPartyIdx];

    for (let pos = 0; pos < prefList.length; pos++) {
      const j = prefList[pos];
      if (remLot[j] <= 0 || allowedEdge[bestPartyIdx][j] <= 0) continue;

      // Tentatively commit `(bestPartyIdx, j)` and verify remaining system stays 100% feasible
      remParty[bestPartyIdx] -= 1;
      remLot[j] -= 1;
      allowedEdge[bestPartyIdx][j] -= 1;

      if (hasFeasibleRemainderFlow(remParty, remLot, allowedEdge)) {
        chosenLotIdx = j;
        chosenLotPrefRank = pos + 1;
        break;
      }

      // Roll back tentative step
      remParty[bestPartyIdx] += 1;
      remLot[j] += 1;
      allowedEdge[bestPartyIdx][j] += 1;
    }

    if (chosenLotIdx === -1) {
      // Fallback: pick first lot with remaining capacity so loop always terminates
      const fallbackLotIdx = remLot.findIndex(r => r > 0);
      if (fallbackLotIdx === -1) break;
      remParty[bestPartyIdx] -= 1;
      remLot[fallbackLotIdx] -= 1;
      chosenLotIdx = fallbackLotIdx;
      chosenLotPrefRank = prefList.indexOf(fallbackLotIdx) + 1;
    }

    extraMatrix[bestPartyIdx][chosenLotIdx] += 1;
    extraAssigned[bestPartyIdx] += 1;
    totalRemaining -= 1;

    const pObj = sortedParties[bestPartyIdx];
    const lotObj = availableLots[chosenLotIdx];
    const newLotQuota = minMatrix[bestPartyIdx][chosenLotIdx] + extraMatrix[bestPartyIdx][chosenLotIdx];
    if (stepLogs) {
      stepLogs.push({
        type: 'INFO',
        partyId: pObj.id,
        partyName: pObj.name,
        partyColor: pObj.color,
        lotId: lotObj.id,
        message: `Prioritat de Lots: ${pObj.acronym} obté plaça al ${lotObj.id} (lot #${chosenLotPrefRank} de la seva prioritat → quota al lot: ${newLotQuota}).`
      });
    }
  }

  const resultByLotId = {};
  for (let j = 0; j < L; j++) {
    const lotId = availableLots[j].id;
    const perParty = {};
    for (let i = 0; i < P; i++) {
      perParty[sortedParties[i].id] = minMatrix[i][j] + extraMatrix[i][j];
    }
    resultByLotId[lotId] = perParty;
  }
  return resultByLotId;
}

export function runAllocation(dbData, options = { assignUnselectedRandomly: true }) {
  const {
    parties = [],
    lots = [],
    locations = [],
    lotPreferences = {},
    lotOrderPreferences = {},
    locationPreferences = {}
  } = dbData;

  // Sort parties by electoral rank (orderRank ascending: 1, 2, 3...)
  const sortedParties = [...parties].sort((a, b) => (a.orderRank || 99) - (b.orderRank || 99));

  const partyQuotas = {};
  const partyAssignedLamps = {};
  const lampAssignments = {};       // { [lampCode]: partyId }
  const lotLampAssignments = {};    // { [lotId]: { [lampCode]: partyId } }
  const lotPartyCounts = {};        // { [lotId]: { [partyId]: count } }

  sortedParties.forEach(p => {
    partyQuotas[p.id] = p.allocatedStreetlampsQuota || 0;
    partyAssignedLamps[p.id] = 0;
  });

  const availableLots = lots.filter(l => !l.reserved && getEffectiveLampCount(l) > 0);
  const stepLogs = [];

  stepLogs.push({
    type: 'INFO',
    message: `Iniciant el repartiment proporcional de faroles dins de ${availableLots.length} lot(s) actiu(s).`
  });

  // Compute exact per-lot quotas honoring guaranteed integer floors + party Lot Priority Order (`Opció 1`)
  const dynamicLotQuotasById = computePartyLotQuotasWithPriorities(
    availableLots,
    sortedParties,
    lotPreferences,
    lotOrderPreferences,
    stepLogs
  );

  // Allocate streetlamps proportionally inside each Lot using interleaved D'Hondt turns
  for (const lot of availableLots) {
    const lotLamps = getActiveLotLamps(lot);
    const totalInLot = lotLamps.length;
    if (totalInLot === 0) continue;

    const lampByCode = new Map(lotLamps.map(l => [String(l.codi), l]));
    const unassignedCodes = new Set(lotLamps.map(l => String(l.codi)));

    const lotQuotas = dynamicLotQuotasById[lot.id] || lot.partyQuotas || {};

    const assignedInLot = Object.fromEntries(sortedParties.map(p => [p.id, 0]));
    lotLampAssignments[lot.id] = {};

    stepLogs.push({
      type: 'INFO',
      lotId: lot.id,
      message: `Repartint ${lot.id} (${lot.name}, ${totalInLot} fanals seleccionats)...`
    });

    // Phase 1: Interleaved D'Hondt turns over parties' explicit numbered lamp lists
    while (unassignedCodes.size > 0) {
      let bestParty = null;
      let bestChosenCode = null;
      let bestPrefRank = 0;
      let bestScore = -1;

      for (const party of sortedParties) {
        const pid = party.id;
        const pLotQuota = Number(lotQuotas[pid]) || 0;
        if (assignedInLot[pid] >= pLotQuota) continue;

        const orderedCodes = getOrderedLampCodesForPartyLot(lotPreferences, pid, lot.id);
        let nextAvailableCode = null;
        let nextRank = 0;
        for (let i = 0; i < orderedCodes.length; i++) {
          const code = String(orderedCodes[i]);
          if (unassignedCodes.has(code)) {
            nextAvailableCode = code;
            nextRank = i + 1;
            break;
          }
        }

        if (!nextAvailableCode) continue;

        // D'Hondt quotient inside the lot: quota / (assigned + 1)
        // Tie-breaking falls through naturally to `sortedParties` order (`orderRank` ascending)
        const score = pLotQuota / (assignedInLot[pid] + 1);
        if (score > bestScore + 1e-9) {
          bestScore = score;
          bestParty = party;
          bestChosenCode = nextAvailableCode;
          bestPrefRank = nextRank;
        }
      }

      if (!bestParty || !bestChosenCode) break;

      const pid = bestParty.id;
      const lampObj = lampByCode.get(bestChosenCode);
      unassignedCodes.delete(bestChosenCode);
      lampAssignments[bestChosenCode] = pid;
      lotLampAssignments[lot.id][bestChosenCode] = pid;
      assignedInLot[pid] += 1;
      partyAssignedLamps[pid] += 1;

      stepLogs.push({
        type: 'ASSIGN_LAMP',
        partyId: pid,
        partyName: bestParty.name,
        partyColor: bestParty.color,
        lotId: lot.id,
        lotName: lot.name,
        lampCode: bestChosenCode,
        street: lampObj?.carrer || lot.street,
        prefRank: bestPrefRank,
        lotCurrent: assignedInLot[pid],
        lotQuota: Number(lotQuotas[pid]) || 0,
        currentTotal: partyAssignedLamps[pid],
        quota: partyQuotas[pid],
        message: `${lot.id}: Farola ${bestChosenCode} (opció #${bestPrefRank}) assignada a ${bestParty.acronym} (${assignedInLot[pid]}/${lotQuotas[pid]} al lot · Total ${partyAssignedLamps[pid]}/${partyQuotas[pid]}).`
      });
    }

    // Phase 2: Supplemental random assignment of remaining unnumbered lamps inside this lot
    if (options.assignUnselectedRandomly && unassignedCodes.size > 0) {
      const remainingShuffled = shuffleArray(Array.from(unassignedCodes));

      for (const freeCode of remainingShuffled) {
        let bestParty = null;
        let bestScore = -1;

        for (const party of sortedParties) {
          const pid = party.id;
          const pLotQuota = Number(lotQuotas[pid]) || 0;
          if (assignedInLot[pid] >= pLotQuota) continue;

          const score = pLotQuota / (assignedInLot[pid] + 1);
          if (score > bestScore + 1e-9) {
            bestScore = score;
            bestParty = party;
          }
        }

        if (!bestParty) break;

        const pid = bestParty.id;
        const lampObj = lampByCode.get(freeCode);
        unassignedCodes.delete(freeCode);
        lampAssignments[freeCode] = pid;
        lotLampAssignments[lot.id][freeCode] = pid;
        assignedInLot[pid] += 1;
        partyAssignedLamps[pid] += 1;

        stepLogs.push({
          type: 'ASSIGN_LAMP_FALLBACK',
          partyId: pid,
          partyName: bestParty.name,
          partyColor: bestParty.color,
          lotId: lot.id,
          lotName: lot.name,
          lampCode: freeCode,
          street: lampObj?.carrer || lot.street,
          lotCurrent: assignedInLot[pid],
          lotQuota: Number(lotQuotas[pid]) || 0,
          currentTotal: partyAssignedLamps[pid],
          quota: partyQuotas[pid],
          message: `${lot.id}: Farola suplementària ${freeCode} assignada aleatòriament a ${bestParty.acronym} (${assignedInLot[pid]}/${lotQuotas[pid]} al lot · Total ${partyAssignedLamps[pid]}/${partyQuotas[pid]}).`
        });
      }
    }

    lotPartyCounts[lot.id] = assignedInLot;
  }

  // Phase 3: Fixed Locations (Emplaçaments) Allocation — Treated as a Priority Lot (D'Hondt interleaved turns)
  const locationAssignments = {};
  const locationCapacities = {};
  const partyAssignedLocations = {};
  const locById = new Map();

  locations.forEach(loc => {
    locationAssignments[loc.id] = [];
    locationCapacities[loc.id] = Math.max(1, Number(loc.capacity) || 1);
    locById.set(loc.id, loc);
  });

  sortedParties.forEach(p => {
    partyAssignedLocations[p.id] = 0;
  });

  // Phase 3A: Assign numbered preferred locations (`#1, #2, #3...`) using interleaved D'Hondt quotients
  while (true) {
    let bestParty = null;
    let bestScore = -1;
    let bestChosenLocId = null;
    let bestPrefRank = -1;

    for (const party of sortedParties) {
      const pid = party.id;
      const partyLocQuota = Number(party.allocatedLocationsQuota) || 0;
      if (partyAssignedLocations[pid] >= partyLocQuota) continue;

      const prefs = locationPreferences[pid];
      if (!Array.isArray(prefs) || prefs.length === 0) continue;

      let chosenLocId = null;
      let chosenRank = -1;
      for (let i = 0; i < prefs.length; i++) {
        const locId = prefs[i];
        if ((locationCapacities[locId] || 0) > 0 && !locationAssignments[locId]?.includes(pid)) {
          chosenLocId = locId;
          chosenRank = i + 1;
          break;
        }
      }

      if (!chosenLocId) continue;

      const score = partyLocQuota / (partyAssignedLocations[pid] + 1);
      if (score > bestScore + 1e-9) {
        bestScore = score;
        bestParty = party;
        bestChosenLocId = chosenLocId;
        bestPrefRank = chosenRank;
      }
    }

    if (!bestParty || !bestChosenLocId) break;

    const pid = bestParty.id;
    locationAssignments[bestChosenLocId].push(pid);
    locationCapacities[bestChosenLocId] -= 1;
    partyAssignedLocations[pid] += 1;

    const locObj = locById.get(bestChosenLocId);
    stepLogs.push({
      type: 'ASSIGN_LOCATION',
      partyId: pid,
      partyName: bestParty.name,
      partyColor: bestParty.color,
      locationId: bestChosenLocId,
      locationName: locObj ? locObj.name : bestChosenLocId,
      prefRank: bestPrefRank,
      message: `Emplaçaments: ${locObj ? locObj.name : bestChosenLocId} (opció #${bestPrefRank}) assignat a ${bestParty.acronym} (${partyAssignedLocations[pid]}/${bestParty.allocatedLocationsQuota || 0}).`
    });
  }

  // Phase 3B: Supplemental random assignment of remaining unnumbered location slots (D'Hondt order)
  if (options.assignUnselectedRandomly) {
    while (true) {
      let bestParty = null;
      let bestScore = -1;
      let candidateLocsForBest = [];

      for (const party of sortedParties) {
        const pid = party.id;
        const partyLocQuota = Number(party.allocatedLocationsQuota) || 0;
        if (partyAssignedLocations[pid] >= partyLocQuota) continue;

        const availableLocs = locations.filter(
          loc => (locationCapacities[loc.id] || 0) > 0 && !locationAssignments[loc.id].includes(pid)
        );
        if (availableLocs.length === 0) continue;

        const score = partyLocQuota / (partyAssignedLocations[pid] + 1);
        if (score > bestScore + 1e-9) {
          bestScore = score;
          bestParty = party;
          candidateLocsForBest = availableLocs;
        }
      }

      if (!bestParty || candidateLocsForBest.length === 0) break;

      const pid = bestParty.id;
      const chosenLoc = pickRandom(candidateLocsForBest);
      locationAssignments[chosenLoc.id].push(pid);
      locationCapacities[chosenLoc.id] -= 1;
      partyAssignedLocations[pid] += 1;

      stepLogs.push({
        type: 'ASSIGN_LOCATION',
        partyId: pid,
        partyName: bestParty.name,
        partyColor: bestParty.color,
        locationId: chosenLoc.id,
        locationName: chosenLoc.name,
        message: `Emplaçaments: ${chosenLoc.name} assignat suplementàriament a ${bestParty.acronym} (${partyAssignedLocations[pid]}/${bestParty.allocatedLocationsQuota || 0}).`
      });
    }
  }

  stepLogs.push({
    type: 'SUCCESS',
    message: 'Repartiment automàtic de faroles per lot i emplaçaments finalitzat amb èxit.'
  });

  return {
    timestamp: new Date().toISOString(),
    lampAssignments,
    lotLampAssignments,
    lotPartyCounts,
    resolvedLotQuotas: dynamicLotQuotasById,
    locationAssignments,
    partyAssignedLamps,
    partyAssignedLocations,
    stepLogs
  };
}
