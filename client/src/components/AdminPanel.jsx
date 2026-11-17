import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  RotateCcw,
  X,
  Plus,
  Trash2,
  MapPin,
  Lock,
  Unlock,
  Crosshair,
  Edit2,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Settings,
  Lightbulb,
  PackagePlus,
  Check,
  Users,
  ArrowUp,
  ArrowDown,
  Save,
  History
} from 'lucide-react';

import { EMPTY_LOCATION_DRAFT, EMPTY_LOT_DRAFT, EMPTY_PARTY_DRAFT } from '../adminDrafts';
import { getLotPaletteColor } from '../lotColors';
import {
  extractOrderedCodes,
  getActiveLotLamps,
  isLampNoApta,
  isLampSelected,
  resizeImageFileToDataUrl
} from '../utils';

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '4px'
};

const inputStyle = {
  width: '100%',
  padding: '0.46rem 0.65rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.83rem',
  backgroundColor: '#ffffff',
  color: '#0f172a'
};

export default function AdminPanel({
  electionInfo,
  parties = [],
  lamps = [],
  lots = [],
  locations = [],
  lotPreferences = {},
  lotOrderPreferences = {},
  locationPreferences = {},
  allocationResults = null,
  initialTab = 'SUITABILITY',
  lotDraft = EMPTY_LOT_DRAFT,
  onChangeLotDraft,
  onSaveLot,
  onDeleteLot,
  onClearAllLots,
  onStartMapSuitabilityMode,
  onStartMapLotBuilder,
  onFocusLampOnMap,
  onFocusLotOnMap,
  locationDraft = EMPTY_LOCATION_DRAFT,
  onChangeLocationDraft,
  onStartMapLocationEditor,
  onFocusLocationOnMap,
  onSaveLocation,
  onDeleteLocation,
  onClearAllLocations,
  onSaveParty,
  onDeleteParty,
  onRecalcPartyQuotas,
  onSaveElectionInfo,
  historicalElections = {},
  onArchiveHistory,
  onRestoreHistory,
  onDeleteHistory,
  onChangeElectionStatus,
  onRunAllocation,
  onResetAllocation,
  onResetPartyPreferences,
  onToggleLotFlag,
  onToggleLampSuitability,
  onBatchLampSuitability,
  onBulkSuitability,
  onChangeLampAptitude,
  onResetDefaultAptitude,
  onClose
}) {
  const [assignUnselectedRandomly, setAssignUnselectedRandomly] = useState(true);
  const [selectedTab, setSelectedTab] = useState(initialTab);

  // Filters for `Faroles` (SUITABILITY) tab
  const [lampSearch, setLampSearch] = useState('');
  const [supportFilter, setSupportFilter] = useState('');
  const [lampStatusFilter, setLampStatusFilter] = useState('ALL');

  // State for `Lots` manual creator inside panel (strictly `SELECCIONADA` streetlamps)
  const [lotBuilderStreetFilter, setLotBuilderStreetFilter] = useState('');
  const [lotFormError, setLotFormError] = useState('');

  // Locations state
  const [locFormError, setLocFormError] = useState('');

  // Parties & Quotas state
  const [partyDraft, setPartyDraft] = useState({ ...EMPTY_PARTY_DRAFT });
  const [partyFormError, setPartyFormError] = useState('');
  const [partyFormSuccess, setPartyFormSuccess] = useState('');
  const [minPctNewParties, setMinPctNewParties] = useState(4);
  const [inlinePartyEdits, setInlinePartyEdits] = useState({});
  const [allocResetNotice, setAllocResetNotice] = useState('');

  const partySelectionStats = useMemo(() => {
    const eligibleLots = (lots || []).filter(l => !l.reserved && (l.lampCount || 0) > 0);
    const activeCodesByLot = new Map();
    eligibleLots.forEach(lot => {
      activeCodesByLot.set(lot.id, new Set(getActiveLotLamps(lot).map(l => String(l.codi))));
    });
    const validLocIds = new Set((locations || []).map(l => l.id));

    let anyPartyHasSelections = false;
    const byPartyId = {};

    (parties || []).forEach(p => {
      const pLotPrefs = lotPreferences?.[p.id] || {};
      let numberedLamps = 0;
      let numberedLots = 0;

      eligibleLots.forEach(lot => {
        const arr = extractOrderedCodes(pLotPrefs[lot.id]);
        const validSet = activeCodesByLot.get(lot.id);
        const count = validSet ? arr.filter(c => validSet.has(String(c))).length : 0;
        if (count > 0) {
          numberedLamps += count;
          numberedLots += 1;
        }
      });

      const rawLocs = Array.isArray(locationPreferences?.[p.id]) ? locationPreferences[p.id] : [];
      const numberedLocs = rawLocs.filter(id => validLocIds.has(id)).length;
      const rawLotOrder = Array.isArray(lotOrderPreferences?.[p.id]) ? lotOrderPreferences[p.id] : [];
      const validLotOrder = rawLotOrder.filter(lid => activeCodesByLot.has(lid));
      const hasCustomLotOrder = validLotOrder.length > 0;

      if (numberedLamps > 0 || numberedLocs > 0 || hasCustomLotOrder) {
        anyPartyHasSelections = true;
      }

      byPartyId[p.id] = {
        numberedLamps,
        numberedLots,
        numberedLocs,
        validLotOrder,
        hasAnySelection: numberedLamps > 0 || numberedLocs > 0 || hasCustomLotOrder,
        assignedLamps: Number(allocationResults?.partyAssignedLamps?.[p.id]) || 0,
        assignedLocs: Number(allocationResults?.partyAssignedLocations?.[p.id]) || 0
      };
    });

    return {
      eligibleLotsCount: eligibleLots.length,
      anyPartyHasSelections,
      byPartyId
    };
  }, [parties, lots, locations, lotPreferences, lotOrderPreferences, locationPreferences, allocationResults]);

  // Election Info state
  const [electionTitleDraft, setElectionTitleDraft] = useState(electionInfo?.title || '');
  const [electionDateDraft, setElectionDateDraft] = useState(electionInfo?.date || '');
  const [electionInfoSavedMsg, setElectionInfoSavedMsg] = useState('');

  // History / Snapshots state
  const [archiveTitleDraft, setArchiveTitleDraft] = useState(electionInfo?.title || '');
  const [archiveDateDraft, setArchiveDateDraft] = useState(electionInfo?.date || '');
  const [restoreIncludeParties, setRestoreIncludeParties] = useState(false);
  const [historyNotice, setHistoryNotice] = useState('');
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setElectionTitleDraft(electionInfo?.title || '');
    setElectionDateDraft(electionInfo?.date || '');
    setArchiveTitleDraft(electionInfo?.title || '');
    setArchiveDateDraft(electionInfo?.date || '');
  }, [electionInfo?.title, electionInfo?.date]);

  // Reset inline party edits whenever server parties refresh
  useEffect(() => {
    setInlinePartyEdits({});
  }, [parties]);

  // Unified inventory of streetlamps (prefers top-level `lamps`)
  const allLamps = useMemo(() => {
    if (Array.isArray(lamps) && lamps.length > 0) {
      return lamps;
    }
    const fallback = [];
    (lots || []).forEach(lot => {
      (lot.lamps || []).forEach(l => {
        fallback.push({ ...l, lotId: lot.id });
      });
    });
    return fallback;
  }, [lamps, lots]);

  const {
    aptTotal,
    noAptTotal,
    selectedTotal,
    aptPendingTotal,
    selectedUnassigned,
    selectedCodesSet
  } = useMemo(() => {
    let apt = 0;
    let noApt = 0;
    let sel = 0;
    let selFree = 0;
    const selSet = new Set();

    for (let i = 0; i < allLamps.length; i++) {
      const l = allLamps[i];
      if (isLampNoApta(l)) {
        noApt++;
      } else {
        apt++;
        if (isLampSelected(l)) {
          sel++;
          selSet.add(l.codi);
          if (!l.lotId) selFree++;
        }
      }
    }

    return {
      aptTotal: apt,
      noAptTotal: noApt,
      selectedTotal: sel,
      aptPendingTotal: apt - sel,
      selectedUnassigned: selFree,
      selectedCodesSet: selSet
    };
  }, [allLamps]);

  // Streets summary for manual lot creation (ONLY `SELECCIONADA` streetlamps can form a lot)
  const streetsSummary = useMemo(() => {
    const byStreet = new Map();
    allLamps.forEach(l => {
      if (!isLampSelected(l)) return;
      const st = l.carrer || 'Sense carrer';
      if (!byStreet.has(st)) {
        byStreet.set(st, { street: st, totalSelected: 0, selectedFree: 0 });
      }
      const entry = byStreet.get(st);
      entry.totalSelected += 1;
      if (!l.lotId || (lotDraft.isEditing && l.lotId === lotDraft.id)) {
        entry.selectedFree += 1;
      }
    });
    return Array.from(byStreet.values()).sort((a, b) => a.street.localeCompare(b.street, 'ca'));
  }, [allLamps, lotDraft.isEditing, lotDraft.id]);

  useEffect(() => {
    if (lotBuilderStreetFilter && !streetsSummary.some(s => s.street === lotBuilderStreetFilter)) {
      setLotBuilderStreetFilter('');
    }
  }, [lotBuilderStreetFilter, streetsSummary]);

  const supportOptions = useMemo(() => {
    const preferredOrder = [
      'Columna',
      'Bàcul',
      'A paret',
      'Braç a façana',
      'Braç a pal de fusta',
      'Focus a façana'
    ];
    const counts = new Map();
    allLamps.forEach(l => {
      const s = l.suport || 'Altres';
      if (!counts.has(s)) {
        counts.set(s, { suport: s, total: 0, apt: 0, noApt: 0 });
      }
      const entry = counts.get(s);
      entry.total += 1;
      if (isLampNoApta(l)) {
        entry.noApt += 1;
      } else {
        entry.apt += 1;
      }
    });
    return Array.from(counts.values()).sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.suport);
      const idxB = preferredOrder.indexOf(b.suport);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.suport.localeCompare(b.suport, 'ca');
    });
  }, [allLamps]);

  const filteredLamps = useMemo(() => {
    const q = lampSearch.trim().toLowerCase();
    const sup = supportFilter.trim().toLowerCase();

    return allLamps.filter(lamp => {
      if (q) {
        const hay = `${lamp.codi || ''} ${lamp.carrer || ''} ${lamp.num || ''} ${lamp.lotId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sup && String(lamp.suport || '').trim().toLowerCase() !== sup) {
        return false;
      }
      const noApta = isLampNoApta(lamp);
      const sel = isLampSelected(lamp);

      if (lampStatusFilter === 'SELECTABLE' && noApta) return false;
      if (lampStatusFilter === 'APTA' && (noApta || sel)) return false;
      if (lampStatusFilter === 'SELECCIONADA' && !sel) return false;
      if (lampStatusFilter === 'SELECTED_FREE' && (!sel || Boolean(lamp.lotId))) return false;
      if (lampStatusFilter === 'NO_APTA' && !noApta) return false;
      if (lampStatusFilter === 'UNASSIGNED' && (noApta || Boolean(lamp.lotId))) return false;
      return true;
    });
  }, [allLamps, lampSearch, supportFilter, lampStatusFilter]);

  const selectableFilteredLamps = useMemo(
    () => filteredLamps.filter(l => !isLampNoApta(l)),
    [filteredLamps]
  );

  const noAptFilteredLamps = useMemo(
    () => filteredLamps.filter(l => isLampNoApta(l)),
    [filteredLamps]
  );

  const updateLotDraft = (patch) => {
    if (onChangeLotDraft) {
      onChangeLotDraft({ ...lotDraft, ...patch });
    }
  };

  const handleSaveLotSubmit = async (e) => {
    e.preventDefault();
    setLotFormError('');

    let targetCodes = (lotDraft.lampCodes || []).filter(code => selectedCodesSet.has(code));

    // When creating a new lot from the street selector, automatically gather free `SELECCIONADA` lamps of that street
    if (!lotDraft.isEditing && targetCodes.length === 0 && lotBuilderStreetFilter) {
      targetCodes = allLamps
        .filter(l => isLampSelected(l) && !l.lotId && l.carrer === lotBuilderStreetFilter)
        .map(l => l.codi);
    }

    if (targetCodes.length === 0) {
      setLotFormError(
        lotBuilderStreetFilter
          ? `No queden faroles Seleccionades lliures a ${lotBuilderStreetFilter}.`
          : 'Seleccioneu un carrer amb faroles ✔ Seleccionades lliures o feu servir l\'editor sobre el mapa.'
      );
      return;
    }
    if (!onSaveLot) return;
    const ok = await onSaveLot({
      id: lotDraft.id || undefined,
      name: lotDraft.name?.trim() || '',
      street: lotDraft.street?.trim() || lotBuilderStreetFilter || '',
      lampCodes: targetCodes,
      markLampsSelected: false,
      markLampsSuitable: false,
      reserved: Boolean(lotDraft.reserved),
      reservedReason: lotDraft.reservedReason || ''
    });
    if (ok !== false && onChangeLotDraft) {
      onChangeLotDraft({ ...EMPTY_LOT_DRAFT });
      setLotBuilderStreetFilter('');
    }
  };

  const loadLotIntoEditor = (lot) => {
    setLotFormError('');
    const codes = Array.isArray(lot.lampCodes) && lot.lampCodes.length > 0
      ? lot.lampCodes
      : (lot.lamps || []).map(l => l.codi);
    if (lot.street) {
      setLotBuilderStreetFilter(lot.street);
    }
    if (onChangeLotDraft) {
      onChangeLotDraft({
        id: lot.id,
        isEditing: true,
        name: lot.name || '',
        street: lot.street || '',
        lampCodes: codes,
        markLampsSuitable: true,
        reserved: Boolean(lot.reserved),
        reservedReason: lot.reservedReason || ''
      });
    }
  };

  const updateLocationDraft = (patch) => {
    if (onChangeLocationDraft) {
      onChangeLocationDraft({ ...locationDraft, ...patch });
    }
  };

  const handleSaveLocationSubmit = async (e) => {
    e.preventDefault();
    setLocFormError('');
    if (!locationDraft.name?.trim()) {
      setLocFormError('Introduïu un nom per a l\'emplaçament.');
      return;
    }
    const latNum = Number(locationDraft.lat);
    const lngNum = Number(locationDraft.lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setLocFormError('Introduïu unes coordenades vàlides o trieu un punt al mapa.');
      return;
    }
    const ok = await onSaveLocation({
      id: locationDraft.id || undefined,
      name: locationDraft.name.trim(),
      type: locationDraft.type || 'CARTELLERA',
      address: locationDraft.address?.trim() || 's/n',
      description: locationDraft.description?.trim() || '',
      capacity: Math.max(1, Number(locationDraft.capacity) || 1),
      lat: latNum,
      lng: lngNum,
      imageUrl: locationDraft.imageUrl?.trim() || ''
    });
    if (ok !== false && onChangeLocationDraft) {
      onChangeLocationDraft({ ...EMPTY_LOCATION_DRAFT });
    }
  };

  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      updateLocationDraft({ imageUrl: dataUrl });
    } catch {
      setLocFormError('No s\'ha pogut processar la imatge seleccionada.');
    }
  };

  // Party Form & Inline Quota Handlers
  const loadPartyIntoEditor = (party) => {
    setPartyFormError('');
    setPartyFormSuccess('');
    setPartyDraft({
      id: party.id,
      isEditing: true,
      name: party.name || '',
      acronym: party.acronym || '',
      color: party.color || '#3B82F6',
      seats: party.seats ?? 0,
      votes: party.votes ?? 0,
      quotaPct: party.quotaPct ?? party.effectiveQuotaPct ?? 0,
      orderRank: party.orderRank ?? 1,
      username: party.username || party.id,
      password: ''
    });
  };

  const handleSavePartySubmit = async (e) => {
    e.preventDefault();
    setPartyFormError('');
    setPartyFormSuccess('');

    if (!partyDraft.name?.trim() || !partyDraft.acronym?.trim()) {
      setPartyFormError('El nom complet i les sigles de la candidatura són obligatoris.');
      return;
    }
    if (!partyDraft.isEditing && !partyDraft.password?.trim()) {
      setPartyFormError('Introduïu una contrasenya d\'accés per a la nova candidatura.');
      return;
    }
    if (!onSaveParty) return;

    const result = await onSaveParty({
      id: partyDraft.id || undefined,
      isEditing: Boolean(partyDraft.isEditing),
      name: partyDraft.name.trim(),
      acronym: partyDraft.acronym.trim(),
      color: partyDraft.color || '#3B82F6',
      seats: Number(partyDraft.seats) || 0,
      votes: Number(partyDraft.votes) || 0,
      quotaPct: partyDraft.quotaPct === '' ? undefined : Number(partyDraft.quotaPct),
      orderRank: partyDraft.orderRank === '' ? undefined : Number(partyDraft.orderRank),
      username: (partyDraft.username || partyDraft.acronym).trim(),
      password: partyDraft.password
    });

    if (result?.ok) {
      setPartyFormSuccess(partyDraft.isEditing ? '✔ Dades de la candidatura actualitzades.' : '✔ Nova candidatura creada correctament.');
      setPartyDraft({ ...EMPTY_PARTY_DRAFT });
    } else {
      setPartyFormError(result?.error || 'No s\'ha pogut desar la candidatura.');
    }
  };

  const setInlineField = (partyId, field, value, originalParty) => {
    setInlinePartyEdits(prev => {
      const curr = prev[partyId] || {
        seats: originalParty.seats ?? 0,
        votes: originalParty.votes ?? 0,
        quotaPct: originalParty.quotaPct ?? originalParty.effectiveQuotaPct ?? 0
      };
      return {
        ...prev,
        [partyId]: {
          ...curr,
          [field]: value
        }
      };
    });
  };

  const hasInlinePartyChanges = Object.keys(inlinePartyEdits).length > 0;

  const handleSaveInlinePartyEdits = async () => {
    if (!onRecalcPartyQuotas || !hasInlinePartyChanges) return;
    setPartyFormError('');
    setPartyFormSuccess('');
    const updates = Object.entries(inlinePartyEdits).map(([id, vals]) => ({
      id,
      seats: Number(vals.seats) || 0,
      votes: Number(vals.votes) || 0,
      quotaPct: Math.max(0, Number(vals.quotaPct) || 0)
    }));
    const ok = await onRecalcPartyQuotas({ updates });
    if (ok !== false) {
      setInlinePartyEdits({});
      setPartyFormSuccess('✔ Quotes, regidors i vots desats i recalculats.');
    }
  };

  const handleMovePartyRank = async (idx, delta) => {
    if (!onRecalcPartyQuotas) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= parties.length) return;
    const reordered = [...parties];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    const updates = reordered.map((p, newIdx) => ({
      id: p.id,
      orderRank: newIdx + 1
    }));
    await onRecalcPartyQuotas({ updates });
  };

  const handleSaveElectionInfoSubmit = async (e) => {
    e.preventDefault();
    if (!onSaveElectionInfo) return;
    const ok = await onSaveElectionInfo({
      title: electionTitleDraft.trim(),
      date: electionDateDraft.trim()
    });
    if (ok !== false) {
      setElectionInfoSavedMsg('✔ Dades de la convocatòria desades.');
      setTimeout(() => setElectionInfoSavedMsg(''), 3000);
    }
  };

  const totalQuotaPctSum = useMemo(
    () => parties.reduce((acc, p) => {
      const val = inlinePartyEdits[p.id]?.quotaPct ?? p.quotaPct ?? p.effectiveQuotaPct ?? 0;
      return acc + (Number(val) || 0);
    }, 0),
    [parties, inlinePartyEdits]
  );

  const statusLabel = electionInfo?.status === 'ALLOCATED'
    ? 'REPARTIMENT ADJUDICAT'
    : electionInfo?.status === 'CLOSED'
      ? 'PERÍODE DE SELECCIÓ TANCAT'
      : 'PERÍODE DE SELECCIÓ OBERT';

  const historyEntries = useMemo(() => {
    const raw = Object.entries(historicalElections || {}).map(([id, item]) => ({
      id,
      ...item
    }));
    return raw.sort((a, b) => {
      if (Boolean(a.isFullSnapshot) !== Boolean(b.isFullSnapshot)) {
        return a.isFullSnapshot ? -1 : 1;
      }
      return String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''));
    });
  }, [historicalElections]);

  const handleArchiveSubmit = async (e) => {
    e.preventDefault();
    if (!onArchiveHistory) return;
    setHistoryError('');
    setHistoryNotice('');
    const res = await onArchiveHistory({
      title: archiveTitleDraft.trim() || electionInfo?.title || 'Convocatòria Arxivada',
      date: archiveDateDraft.trim() || electionInfo?.date || ''
    });
    if (res?.ok) {
      setHistoryNotice('✔ Convocatòria desada a l\'Històric correctament.');
    } else {
      setHistoryError(res?.error || 'No s\'ha pogut desar la convocatòria.');
    }
  };

  const handleTriggerRestore = async (entry, mode) => {
    if (!onRestoreHistory) return;
    const confirmMsg = mode === 'FULL'
      ? `Voleu restaurar la còpia completa «${entry.title}» (incloent preferències dels partits i resultat del sorteig)? Això substituirà l'estat actual en pantalla.`
      : `Voleu carregar els espais municipals de «${entry.title}» (faroles seleccionades, lots i emplaçaments) per iniciar unes noves eleccions en estat OBERT?`;
    if (!window.confirm(confirmMsg)) return;

    setHistoryError('');
    setHistoryNotice('');
    const res = await onRestoreHistory(entry.id, {
      mode,
      includeParties: mode === 'FULL' ? true : Boolean(restoreIncludeParties)
    });
    if (res?.ok) {
      setHistoryNotice(
        mode === 'FULL'
          ? `✔ Còpia completa «${entry.title}» restaurada.`
          : `✔ Espais municipals de «${entry.title}» carregats i període obert per a noves eleccions.`
      );
    } else {
      setHistoryError(res?.error || 'Error recuperant l\'històric.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="modal-header" style={{ background: '#b91c1c', color: 'white' }}>
          <div className="modal-title" style={{ color: 'white' }}>
            <Settings size={22} color="#fef08a" style={{ flexShrink: 0 }} />
            <span>Gestió Municipal d'Espais Electorals</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'rgba(255,255,255,0.18)', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: 'white', display: 'flex' }}
            title="Tancar Gestió Municipal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Non-shrinking High-Contrast Municipal Setup Tabs */}
        <div className="admin-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'SUITABILITY'}
            className={`admin-tab-btn ${selectedTab === 'SUITABILITY' ? 'active' : ''}`}
            onClick={() => setSelectedTab('SUITABILITY')}
          >
            <span>💡 Faroles ({selectedTotal}/{aptTotal} sel.)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'LOTS'}
            className={`admin-tab-btn ${selectedTab === 'LOTS' ? 'active' : ''}`}
            onClick={() => setSelectedTab('LOTS')}
          >
            <span>📦 Lots ({lots?.length || 0})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'LOCATIONS'}
            className={`admin-tab-btn ${selectedTab === 'LOCATIONS' ? 'active' : ''}`}
            onClick={() => setSelectedTab('LOCATIONS')}
          >
            <span>📍 Emplaçaments ({locations.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'PARTIES'}
            className={`admin-tab-btn ${selectedTab === 'PARTIES' ? 'active' : ''}`}
            onClick={() => setSelectedTab('PARTIES')}
          >
            <span>👥 Partits i Quotes ({parties.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'ALLOCATE'}
            className={`admin-tab-btn ${selectedTab === 'ALLOCATE' ? 'active' : ''}`}
            onClick={() => setSelectedTab('ALLOCATE')}
          >
            <span>⚖️ Sorteig i Estat</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'HISTORY'}
            className={`admin-tab-btn ${selectedTab === 'HISTORY' ? 'active' : ''}`}
            onClick={() => setSelectedTab('HISTORY')}
          >
            <span>🗂️ Històric ({historyEntries.length})</span>
          </button>
        </div>

        <div className="modal-body">
          {/* ==================== TAB 1: FAROLES ==================== */}
          {selectedTab === 'SUITABILITY' && (
            <div>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.85rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#14532d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lightbulb size={18} color="#16a34a" />
                    <span>Inventari, Aptitud i Selecció de Faroles</span>
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '5px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>Total: <strong>{allLamps.length}</strong></span>
                    <span style={{ color: '#b91c1c' }}>🔒 No Aptes: <strong>{noAptTotal}</strong></span>
                    <span style={{ color: '#a16207' }}>⚪ Aptes disp.: <strong>{aptPendingTotal}</strong> (total aptes: <strong>{aptTotal}</strong>)</span>
                    <span style={{ color: '#15803d' }}>✔ Seleccionades: <strong>{selectedTotal}</strong> (sense lot: <strong>{selectedUnassigned}</strong>)</span>
                  </div>
                </div>

                {onStartMapSuitabilityMode && (
                  <button
                    type="button"
                    onClick={onStartMapSuitabilityMode}
                    style={{
                      background: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 0.95rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <MapPin size={15} />
                    <span>Gestionar Faroles i Lots al Mapa</span>
                  </button>
                )}
              </div>

              {/* Filter Bar */}
              <div className="admin-grid-3" style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Cercar per carrer, codi o lot (ex. Carrer Major, AP.01)..."
                  value={lampSearch}
                  onChange={(e) => setLampSearch(e.target.value)}
                  style={inputStyle}
                />

                <select
                  value={supportFilter}
                  onChange={(e) => {
                    const nextSupport = e.target.value;
                    setSupportFilter(nextSupport);
                    if (nextSupport) {
                      const opt = supportOptions.find(o => o.suport === nextSupport);
                      if (opt && opt.apt === 0 && lampStatusFilter !== 'ALL' && lampStatusFilter !== 'NO_APTA') {
                        setLampStatusFilter('ALL');
                      } else if (opt && opt.noApt === 0 && lampStatusFilter === 'NO_APTA') {
                        setLampStatusFilter('ALL');
                      }
                    }
                  }}
                  style={inputStyle}
                >
                  <option value="">Tots els tipus de suport ({allLamps.length})</option>
                  {supportOptions.map((opt) => (
                    <option key={opt.suport} value={opt.suport}>
                      {opt.suport} ({opt.apt}/{opt.total} aptes{opt.apt === 0 ? ' · 🔒 No aptes' : ''})
                    </option>
                  ))}
                </select>

                <select
                  value={lampStatusFilter}
                  onChange={(e) => setLampStatusFilter(e.target.value)}
                  style={inputStyle}
                >
                  <option value="ALL">Tot l'inventari municipal ({allLamps.length})</option>
                  <option value="SELECTABLE">Aptes totals: Seleccionades + No seleccionades ({aptTotal})</option>
                  <option value="APTA">⚪ Aptes no seleccionades ({aptPendingTotal})</option>
                  <option value="SELECCIONADA">✔ Només Seleccionades ({selectedTotal})</option>
                  <option value="SELECTED_FREE">✔ Seleccionades sense lot ({selectedUnassigned})</option>
                  <option value="UNASSIGNED">Aptes sense lot</option>
                  <option value="NO_APTA">🔒 Només No Aptes ({noAptTotal})</option>
                </select>
              </div>

              {/* Contextual Bulk Actions */}
              <div style={{
                background: '#f8fafc',
                padding: '0.7rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                marginBottom: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 700 }}>
                    Resultat del filtre: <strong>{filteredLamps.length}</strong> faroles (
                    <span style={{ color: '#15803d' }}>{selectableFilteredLamps.length} aptes</span>
                    {' · '}
                    <span style={{ color: '#b91c1c' }}>{noAptFilteredLamps.length} no aptes</span>)
                  </span>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {onBulkSuitability && selectedTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Segur que voleu desmarcar totes les faroles Seleccionades? Si hi havia lots creats també es buidaran.')) {
                            onBulkSuitability('', false, '');
                          }
                        }}
                        style={{
                          background: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fcd34d',
                          borderRadius: '6px',
                          padding: '0.3rem 0.65rem',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⚪ Desmarcar totes les Seleccionades ({selectedTotal})
                      </button>
                    )}

                    {onResetDefaultAptitude && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Voleu restaurar l\'aptitud per defecte? Columna i Bàcul quedaran com a Aptes i la resta de suports com a No Aptes.')) {
                            onResetDefaultAptitude();
                          }
                        }}
                        style={{
                          background: '#ffffff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0.3rem 0.65rem',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>Aptitud per defecte (Columna + Bàcul)</span>
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {onChangeLampAptitude && noAptFilteredLamps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChangeLampAptitude(noAptFilteredLamps.map(l => l.codi), true)}
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #7dd3fc',
                        borderRadius: '6px',
                        padding: '0.35rem 0.72rem',
                        fontWeight: 700,
                        fontSize: '0.77rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Unlock size={13} />
                      <span>Declarar filtrades ({noAptFilteredLamps.length}) com a Aptes</span>
                    </button>
                  )}

                  {onChangeLampAptitude && selectableFilteredLamps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const count = selectableFilteredLamps.length;
                        const hasLot = selectableFilteredLamps.some(l => Boolean(l.lotId));
                        const msg = hasLot
                          ? `Segur que voleu declarar ${count} faroles com a No Aptes? Les que estiguin dins d'algun lot s'esborraran d'aquell lot.`
                          : `Segur que voleu declarar aquestes ${count} faroles com a No Aptes (bloquejades)?`;
                        if (count === 1 || window.confirm(msg)) {
                          onChangeLampAptitude(selectableFilteredLamps.map(l => l.codi), false);
                        }
                      }}
                      style={{
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        padding: '0.35rem 0.72rem',
                        fontWeight: 700,
                        fontSize: '0.77rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Lock size={13} />
                      <span>Declarar filtrades ({selectableFilteredLamps.length}) com a No Aptes</span>
                    </button>
                  )}

                  {onBatchLampSuitability && selectableFilteredLamps.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => onBatchLampSuitability(selectableFilteredLamps.map(l => l.codi), true)}
                        style={{
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          borderRadius: '6px',
                          padding: '0.35rem 0.72rem',
                          fontWeight: 700,
                          fontSize: '0.77rem',
                          cursor: 'pointer'
                        }}
                      >
                        ✔ Marcar filtrades ({selectableFilteredLamps.length}) com a Seleccionades
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const anyInLot = selectableFilteredLamps.some(l => Boolean(l.lotId));
                          if (anyInLot && !window.confirm('Algunes de les faroles filtrades formen part d\'un lot. En desmarcar-les com a Seleccionades es retiraran del seu lot. Voleu continuar?')) {
                            return;
                          }
                          onBatchLampSuitability(selectableFilteredLamps.map(l => l.codi), false);
                        }}
                        style={{
                          background: '#fffbeb',
                          color: '#a16207',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '0.35rem 0.72rem',
                          fontWeight: 700,
                          fontSize: '0.77rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⚪ Desmarcar filtrades ({selectableFilteredLamps.length}) com a Seleccionades
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Streetlamps Table */}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Codi</th>
                      <th>Carrer i Núm.</th>
                      <th>Suport</th>
                      <th>Lot</th>
                      <th>Estat i Aptitud</th>
                      <th style={{ textAlign: 'right' }}>Mapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLamps.slice(0, 250).map((lamp) => {
                      const noApta = isLampNoApta(lamp);
                      const sel = isLampSelected(lamp);
                      return (
                        <tr
                          key={lamp.codi}
                          style={{
                            background: noApta ? '#f8fafc' : (sel ? '#f0fdf4' : '#ffffff')
                          }}
                        >
                          <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{lamp.codi}</td>
                          <td>
                            {lamp.carrer} ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'})
                          </td>
                          <td style={{ color: '#475569', whiteSpace: 'nowrap' }}>{lamp.suport}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {lamp.lotId ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#0f172a' }}>
                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: getLotPaletteColor(lamp.lotId), flexShrink: 0 }} />
                                <span>{lamp.lotId}</span>
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Sense lot</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                              {noApta ? (
                                <>
                                  <span
                                    title={lamp.unsuitableReason || 'Farola marcada com a No Apta'}
                                    style={{
                                      display: 'inline-block',
                                      background: '#fee2e2',
                                      color: '#b91c1c',
                                      border: '1px solid #fca5a5',
                                      borderRadius: '6px',
                                      padding: '0.18rem 0.5rem',
                                      fontWeight: 700,
                                      fontSize: '0.72rem',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    🔒 NO APTA
                                  </span>
                                  {onChangeLampAptitude && (
                                    <button
                                      type="button"
                                      onClick={() => onChangeLampAptitude(lamp.codi, true)}
                                      style={{
                                        background: '#e0f2fe',
                                        color: '#0369a1',
                                        border: '1px solid #7dd3fc',
                                        borderRadius: '6px',
                                        padding: '0.18rem 0.5rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        fontSize: '0.72rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <Unlock size={11} />
                                      <span>Declarar Apta</span>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (sel && lamp.lotId) {
                                        if (!window.confirm(`Aquesta farola forma part del ${lamp.lotId}. Si la desmarqueu com a Seleccionada es retirarà automàticament del lot. Voleu continuar?`)) {
                                          return;
                                        }
                                      }
                                      if (onToggleLampSuitability) {
                                        onToggleLampSuitability(lamp.lotId || null, lamp.codi, !sel);
                                      }
                                    }}
                                    style={{
                                      background: sel ? '#dcfce7' : '#fef9c3',
                                      color: sel ? '#15803d' : '#a16207',
                                      border: `1px solid ${sel ? '#86efac' : '#fde047'}`,
                                      borderRadius: '6px',
                                      padding: '0.2rem 0.55rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      fontSize: '0.73rem',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={sel ? 'Clic per desmarcar com a Seleccionada' : 'Clic per marcar com a Seleccionada'}
                                  >
                                    {sel ? '✔ Seleccionada (desmarcar)' : '⚪ Marcar com a Seleccionada'}
                                  </button>
                                  {onChangeLampAptitude && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!lamp.lotId || window.confirm(`Aquesta farola pertany al lot ${lamp.lotId}. Si la declareu No Apta es retirarà del lot. Voleu continuar?`)) {
                                          onChangeLampAptitude(lamp.codi, false);
                                        }
                                      }}
                                      style={{
                                        background: '#ffffff',
                                        color: '#64748b',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '0.18rem 0.45rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.7rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <Lock size={11} />
                                      <span>No apta</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {onFocusLampOnMap && (
                              <button
                                type="button"
                                onClick={() => onFocusLampOnMap(lamp)}
                                style={{
                                  background: '#f0f9ff',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '5px',
                                  padding: '0.22rem 0.48rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Centrar aquesta farola al mapa"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredLamps.length > 250 && (
                  <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.76rem', color: '#64748b', background: '#f8fafc' }}>
                    Mostrant les primeres 250 faroles de {filteredLamps.length}. Afineu el cercador per carrer o codi per acotar la llista.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: LOTS ==================== */}
          {selectedTab === 'LOTS' && (
            <div>
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.85rem',
                flexWrap: 'wrap'
              }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PackagePlus size={18} />
                      <span>Creació i Edició Manual de Lots de Fanals</span>
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#0c4a6e' }}>
                      Un lot només el poden conformar <strong>faroles amb estat ✔ Seleccionada</strong> ({selectedTotal} seleccionades · {selectedUnassigned} sense lot).
                    </p>
                  </div>

                  {onStartMapLotBuilder && (
                    <button
                      type="button"
                      onClick={() => onStartMapLotBuilder(lotDraft.isEditing ? lotDraft : null)}
                      style={{
                        background: '#0284c7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.55rem 0.95rem',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Crosshair size={15} />
                      <span>{lotDraft.isEditing ? `Editar ${lotDraft.id} al Mapa` : 'Seleccionar i Crear Lots al Mapa'}</span>
                    </button>
                  )}
                </div>

                {selectedTotal === 0 && (
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: '8px',
                    padding: '0.7rem 0.9rem',
                    marginBottom: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.7rem',
                    flexWrap: 'wrap',
                    fontSize: '0.8rem',
                    color: '#92400e'
                  }}>
                    <span>
                      ⚠️ Encara no hi ha cap farola marcada com a <strong>✔ Seleccionada</strong>. Seleccioneu-les des de la pestanya <strong>💡 Faroles</strong> o directament des de l'editor unificat al mapa.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTab('SUITABILITY')}
                      style={{
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Anar a 💡 Faroles
                    </button>
                  </div>
                )}

                <form
                  onSubmit={handleSaveLotSubmit}
                  style={{
                    background: lotDraft.isEditing ? '#fffbeb' : '#f8fafc',
                    border: `1.5px solid ${lotDraft.isEditing ? '#f59e0b' : '#cbd5e1'}`,
                    borderRadius: '10px',
                    padding: '0.95rem',
                    marginBottom: '1.1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {lotDraft.isEditing ? <Edit2 size={16} color="#b45309" /> : <Plus size={16} color="#4a7729" />}
                      <span>
                        {lotDraft.isEditing
                          ? `Editant ${lotDraft.id} (${lotDraft.lampCodes?.length || 0} faroles seleccionades)`
                          : 'Alta Ràpida de Lot per Carrer (o feu servir el Mapa per triar faroles concretes)'}
                      </span>
                    </div>

                    {lotDraft.isEditing && (
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {onStartMapLotBuilder && (
                          <button
                            type="button"
                            onClick={() => onStartMapLotBuilder(lotDraft)}
                            style={{
                              background: '#0284c7',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.28rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Crosshair size={13} />
                            <span>Editar faroles al Mapa</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onChangeLotDraft) onChangeLotDraft({ ...EMPTY_LOT_DRAFT });
                          }}
                          style={{
                            background: 'white',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.28rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel·lar edició
                        </button>
                      </div>
                    )}
                  </div>

                  {lotFormError && (
                    <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.79rem', marginBottom: '0.7rem' }}>
                      {lotFormError}
                    </div>
                  )}

                  <div className="admin-grid-3" style={{ alignItems: 'end' }}>
                    {!lotDraft.isEditing && (
                      <div>
                        <label style={labelStyle}>Carrer amb faroles ✔ Seleccionades lliures</label>
                        <select
                          value={lotBuilderStreetFilter}
                          onChange={(e) => setLotBuilderStreetFilter(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">-- Trieu un carrer ({selectedUnassigned} faroles lliures) --</option>
                          {streetsSummary.filter(s => s.selectedFree > 0).map(s => (
                            <option key={s.street} value={s.street}>
                              {s.street} ({s.selectedFree} seleccionades lliures)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ gridColumn: lotDraft.isEditing ? 'span 2' : 'auto' }}>
                      <label style={labelStyle}>Nom descriptiu del lot (s&apos;autogenera si es deixa en blanc)</label>
                      <input
                        type="text"
                        placeholder={lotBuilderStreetFilter ? `Ex. Lot - ${lotBuilderStreetFilter}` : 'Ex. Lot 01 - Carrer Major'}
                        value={lotDraft.name || ''}
                        onChange={(e) => updateLotDraft({ name: e.target.value })}
                        style={inputStyle}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!lotDraft.isEditing && !lotBuilderStreetFilter && (lotDraft.lampCodes || []).length === 0}
                      style={{
                        background: (!lotDraft.isEditing && !lotBuilderStreetFilter && (lotDraft.lampCodes || []).length === 0)
                          ? '#94a3b8'
                          : (lotDraft.isEditing ? '#b45309' : '#4a7729'),
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.52rem 1.1rem',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: (!lotDraft.isEditing && !lotBuilderStreetFilter && (lotDraft.lampCodes || []).length === 0) ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Check size={15} />
                      <span>{lotDraft.isEditing ? 'Desar Canvis' : 'Crear Lot del Carrer'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.6rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#334155' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(lotDraft.reserved)}
                        onChange={(e) => updateLotDraft({ reserved: e.target.checked })}
                      />
                      <span>Reservar lot per a actes municipals / Festa Major</span>
                    </label>
                  </div>
                </form>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                  Lots Configurats ({lots.length} lots · {electionInfo?.totalStreetlampsAvailable ?? 0} faroles seleccionades disponibles)
                </div>

                {lots.length > 0 && onClearAllLots && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Segur que voleu eliminar TOTS els lots creats? L\'inventari de faroles es mantindrà intacte.')) {
                        onClearAllLots();
                      }
                    }}
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      padding: '0.32rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Esborrar tots els lots</span>
                  </button>
                )}
              </div>

              {lots.length === 0 ? (
                <div style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1'
                }}>
                  Encara no hi ha cap lot definit. Utilitzeu <strong>«Seleccionar i Crear Lots al Mapa»</strong> o el selector de carrer superior.
                </div>
              ) : (
                <div className="admin-table-wrap" style={{ maxHeight: '310px' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Codi</th>
                        <th>Nom / Carrer</th>
                        <th>Faroles</th>
                        <th>Reserva</th>
                        <th style={{ textAlign: 'right' }}>Accions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lots.map((lot, lotIdx) => {
                        const lotSwatch = lot.reserved ? '#dc2626' : getLotPaletteColor(lot, lotIdx);
                        return (
                          <tr key={lot.id}>
                            <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: lotSwatch, flexShrink: 0 }} />
                                <span>{lot.id}</span>
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{lot.name}</div>
                              <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{lot.street}</div>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <strong style={{ color: '#15803d' }}>{lot.lampCount}</strong> seleccionades
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => onToggleLotFlag(lot.id, 'reserved', !lot.reserved)}
                                style={{
                                  background: lot.reserved ? '#fef2f2' : '#f0fdf4',
                                  color: lot.reserved ? '#dc2626' : '#15803d',
                                  border: `1px solid ${lot.reserved ? '#fca5a5' : '#86efac'}`,
                                  borderRadius: '6px',
                                  padding: '0.2rem 0.55rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {lot.reserved ? '✖ Reservat' : '✔ Actiu al sorteig'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                {onFocusLotOnMap && (
                                  <button
                                    type="button"
                                    onClick={() => onFocusLotOnMap(lot)}
                                    style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '5px', padding: '0.24rem 0.48rem', cursor: 'pointer' }}
                                    title="Veure al mapa"
                                  >
                                    <Eye size={13} />
                                  </button>
                                )}
                                {onStartMapLotBuilder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const codes = Array.isArray(lot.lampCodes) && lot.lampCodes.length > 0
                                        ? lot.lampCodes
                                        : (lot.lamps || []).map(l => l.codi);
                                      const draft = {
                                        id: lot.id,
                                        isEditing: true,
                                        name: lot.name || '',
                                        street: lot.street || '',
                                        lampCodes: codes,
                                        markLampsSuitable: true,
                                        reserved: Boolean(lot.reserved),
                                        reservedReason: lot.reservedReason || ''
                                      };
                                      if (onChangeLotDraft) onChangeLotDraft(draft);
                                      onStartMapLotBuilder(draft);
                                    }}
                                    style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #7dd3fc', borderRadius: '5px', padding: '0.24rem 0.48rem', cursor: 'pointer' }}
                                    title="Editar faroles d'aquest lot directament al mapa"
                                  >
                                    <Crosshair size={13} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => loadLotIntoEditor(lot)}
                                  style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '5px', padding: '0.24rem 0.48rem', cursor: 'pointer' }}
                                  title="Editar nom o reserva del lot"
                                >
                                  <Edit2 size={13} />
                                </button>
                                {onDeleteLot && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Segur que voleu eliminar el ${lot.id} (${lot.name})?`)) {
                                        onDeleteLot(lot.id);
                                      }
                                    }}
                                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '5px', padding: '0.24rem 0.48rem', cursor: 'pointer' }}
                                    title="Eliminar lot"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: EMPLAÇAMENTS ==================== */}
          {selectedTab === 'LOCATIONS' && (
            <div>
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #86efac',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.85rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#14532d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={18} color="#16a34a" />
                    <span>Catàleg d'Emplaçaments Fixos (Panells, Cartelleres i Pancartes)</span>
                  </h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#166534' }}>
                    Podeu donar d'alta emplaçaments des d'aquí o fer clic directament sobre el mapa per ubicar-los un darrere l'altre.
                  </p>
                </div>

                {onStartMapLocationEditor && (
                  <button
                    type="button"
                    onClick={() => onStartMapLocationEditor(locationDraft.isEditing ? locationDraft : null)}
                    style={{
                      background: '#4a7729',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 0.95rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <MapPin size={15} />
                    <span>{locationDraft.isEditing ? `Editar ${locationDraft.id} al Mapa` : 'Afegir Emplaçaments al Mapa'}</span>
                  </button>
                )}
              </div>

              <form
                onSubmit={handleSaveLocationSubmit}
                style={{
                  background: locationDraft.isEditing ? '#fffbeb' : '#f8fafc',
                  border: `1.5px solid ${locationDraft.isEditing ? '#f59e0b' : '#cbd5e1'}`,
                  borderRadius: '10px',
                  padding: '1rem',
                  marginBottom: '1.1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {locationDraft.isEditing ? <Edit2 size={17} color="#b45309" /> : <Plus size={17} color="#4a7729" />}
                    <span>
                      {locationDraft.isEditing
                        ? `Editant Emplaçament ${locationDraft.id}`
                        : 'Alta de Nou Emplaçament Fix (Panell / Pancarta)'}
                    </span>
                  </h4>

                  {locationDraft.isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onChangeLocationDraft) onChangeLocationDraft({ ...EMPTY_LOCATION_DRAFT });
                      }}
                      style={{
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.28rem 0.65rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel·lar edició
                    </button>
                  )}
                </div>

                {locFormError && (
                  <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                    {locFormError}
                  </div>
                )}

                <div className="admin-grid-loc-top" style={{ marginBottom: '0.65rem' }}>
                  <div>
                    <label style={labelStyle}>Nom de l'emplaçament *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. Plaça Major - Façana Cal Gallifa"
                      value={locationDraft.name}
                      onChange={(e) => updateLocationDraft({ name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Tipus de suport</label>
                    <select
                      value={locationDraft.type || 'CARTELLERA'}
                      onChange={(e) => updateLocationDraft({ type: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="CARTELLERA">CARTELLERA</option>
                      <option value="PANCARTA">PANCARTA</option>
                      <option value="PANELL">PANELL / MONÒLIT</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Capacitat (partits) *</label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      required
                      value={locationDraft.capacity}
                      onChange={(e) => updateLocationDraft({ capacity: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="admin-grid-loc-coords" style={{ marginBottom: '0.65rem' }}>
                  <div>
                    <label style={labelStyle}>Adreça postal / Referència</label>
                    <input
                      type="text"
                      placeholder="Ex. Plaça Major, s/n"
                      value={locationDraft.address}
                      onChange={(e) => updateLocationDraft({ address: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Latitud *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={locationDraft.lat}
                      onChange={(e) => updateLocationDraft({ lat: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Longitud *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={locationDraft.lng}
                      onChange={(e) => updateLocationDraft({ lng: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  {onStartMapLocationEditor && (
                    <button
                      type="button"
                      onClick={() => onStartMapLocationEditor(locationDraft)}
                      style={{
                        background: '#0284c7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.5rem 0.85rem',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Crosshair size={15} />
                      <span>Ubicar al Mapa</span>
                    </button>
                  )}
                </div>

                <div className="admin-grid-loc-photo" style={{ marginBottom: '0.8rem' }}>
                  <div>
                    <label style={labelStyle}>Descripció / Observacions</label>
                    <input
                      type="text"
                      placeholder="Ex. Panell metàl·lic davant l'accés principal"
                      value={locationDraft.description}
                      onChange={(e) => updateLocationDraft({ description: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Fotografia (URL opcional o fitxer)</label>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="https://... (o puja una imatge)"
                        value={locationDraft.imageUrl?.startsWith('data:') ? '(Imatge carregada)' : (locationDraft.imageUrl || '')}
                        onChange={(e) => updateLocationDraft({ imageUrl: e.target.value })}
                        readOnly={Boolean(locationDraft.imageUrl?.startsWith('data:'))}
                        style={inputStyle}
                      />
                      {locationDraft.imageUrl && (
                        <button
                          type="button"
                          onClick={() => updateLocationDraft({ imageUrl: '' })}
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            padding: '0.45rem 0.55rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexShrink: 0
                          }}
                          title="Treure imatge"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <label
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '0.48rem 0.8rem',
                      fontSize: '0.79rem',
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <ImageIcon size={15} />
                    <span>Pujar Foto</span>
                    <input type="file" accept="image/*" onChange={handleImageFileSelect} style={{ display: 'none' }} />
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${locationDraft.lat},${locationDraft.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.79rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Comprovar coordenades a Google Street View</span>
                    <ExternalLink size={13} />
                  </a>

                  <button
                    type="submit"
                    style={{
                      background: locationDraft.isEditing ? '#b45309' : '#4a7729',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 1.15rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {locationDraft.isEditing ? <Edit2 size={15} /> : <Plus size={16} />}
                    <span>{locationDraft.isEditing ? 'Desar Canvis' : 'Afegir Emplaçament'}</span>
                  </button>
                </div>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.7rem' }}>
                <div style={{ fontSize: '0.84rem', color: '#334155', fontWeight: 700 }}>
                  Emplaçaments Registrats ({locations.length} ubicacions · {electionInfo?.totalLocationsAvailable ?? 0} places disponibles)
                </div>

                {locations.length > 0 && onClearAllLocations && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Segur que voleu eliminar TOTS els emplaçaments actuals per començar de zero?')) {
                        onClearAllLocations();
                      }
                    }}
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      padding: '0.34rem 0.7rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Esborrar tots</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {locations.length === 0 ? (
                  <div style={{ padding: '1.6rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    Cap emplaçament registrat. Feu servir el formulari superior o «Ubicar al Mapa».
                  </div>
                ) : (
                  locations.map((loc) => (
                    <div
                      key={loc.id}
                      style={{
                        background: 'white',
                        border: locationDraft.isEditing && locationDraft.id === loc.id ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.65rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 240px' }}>
                        {loc.imageUrl ? (
                          <img
                            src={loc.imageUrl}
                            alt={loc.name}
                            style={{ width: '48px', height: '36px', borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: '48px', height: '36px', borderRadius: '5px', background: '#ecfdf5', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            📍
                          </div>
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ background: '#f1f5f9', color: '#334155', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                              {loc.id}
                            </span>
                            <span style={{ background: '#ecfdf5', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                              {loc.type || 'CARTELLERA'}
                            </span>
                            <span>{loc.name}</span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            {loc.address} · <strong>Capacitat: {loc.capacity}</strong> · ({Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)})
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {onFocusLocationOnMap && (
                          <button
                            type="button"
                            onClick={() => onFocusLocationOnMap(loc)}
                            style={{
                              background: '#f0f9ff',
                              color: '#0369a1',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '0.32rem 0.6rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Eye size={13} />
                            <span>Mapa</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setLocFormError('');
                            if (onChangeLocationDraft) {
                              onChangeLocationDraft({
                                id: loc.id,
                                isEditing: true,
                                hasCoords: true,
                                name: loc.name || '',
                                type: loc.type || 'CARTELLERA',
                                address: loc.address || '',
                                description: loc.description || '',
                                capacity: loc.capacity || 1,
                                lat: loc.lat,
                                lng: loc.lng,
                                imageUrl: loc.imageUrl || ''
                              });
                            }
                          }}
                          style={{
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            borderRadius: '6px',
                            padding: '0.32rem 0.6rem',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Edit2 size={13} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Segur que voleu eliminar l'emplaçament ${loc.id} (${loc.name})?`)) {
                              if (onDeleteLocation) onDeleteLocation(loc.id);
                            }
                          }}
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            padding: '0.32rem 0.6rem',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 4: PARTITS POLÍTICS I QUOTES ==================== */}
          {selectedTab === 'PARTIES' && (
            <div>
              {/* Create / Edit Political Party Form */}
              <form
                onSubmit={handleSavePartySubmit}
                style={{
                  background: partyDraft.isEditing ? '#fffbeb' : '#f8fafc',
                  border: `1.5px solid ${partyDraft.isEditing ? '#f59e0b' : '#cbd5e1'}`,
                  borderRadius: '10px',
                  padding: '1rem',
                  marginBottom: '1.1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {partyDraft.isEditing ? <Edit2 size={17} color="#b45309" /> : <Users size={17} color="#4a7729" />}
                    <span>
                      {partyDraft.isEditing
                        ? `Editant Candidatura: ${partyDraft.acronym} (${partyDraft.id})`
                        : 'Alta de Nova Candidatura / Partit Polític'}
                    </span>
                  </h4>

                  {partyDraft.isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setPartyFormError('');
                        setPartyDraft({ ...EMPTY_PARTY_DRAFT });
                      }}
                      style={{
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.28rem 0.65rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel·lar edició
                    </button>
                  )}
                </div>

                {partyFormError && (
                  <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                    {partyFormError}
                  </div>
                )}

                {partyFormSuccess && (
                  <div style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    {partyFormSuccess}
                  </div>
                )}

                <div className="admin-grid-party-main" style={{ marginBottom: '0.65rem' }}>
                  <div>
                    <label style={labelStyle}>Nom complet de la candidatura *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. Esquerra Republicana de Catalunya - Acord Municipal"
                      value={partyDraft.name}
                      onChange={(e) => setPartyDraft({ ...partyDraft, name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Sigles / Acrònim *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. ERC-AM"
                      value={partyDraft.acronym}
                      onChange={(e) => {
                        const acr = e.target.value;
                        const autoUser = !partyDraft.isEditing && (!partyDraft.username || partyDraft.username === partyDraft.acronym.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                          ? acr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                          : partyDraft.username;
                        setPartyDraft({ ...partyDraft, acronym: acr, username: autoUser });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Color</label>
                    <input
                      type="color"
                      value={partyDraft.color || '#3B82F6'}
                      onChange={(e) => setPartyDraft({ ...partyDraft, color: e.target.value })}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '2px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>

                <div className="admin-grid-party-stats" style={{ marginBottom: '0.8rem' }}>
                  <div>
                    <label style={labelStyle}>Regidors</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={partyDraft.seats}
                      onChange={(e) => setPartyDraft({ ...partyDraft, seats: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Vots anteriors</label>
                    <input
                      type="number"
                      min={0}
                      value={partyDraft.votes}
                      onChange={(e) => setPartyDraft({ ...partyDraft, votes: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>% Quota (pes)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="Auto segons vots"
                      value={partyDraft.quotaPct}
                      onChange={(e) => setPartyDraft({ ...partyDraft, quotaPct: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Usuari d'accés *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. ERC"
                      value={partyDraft.username}
                      onChange={(e) => setPartyDraft({ ...partyDraft, username: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      {partyDraft.isEditing ? 'Nova contrasenya (opcional)' : 'Contrasenya *'}
                    </label>
                    <input
                      type="password"
                      required={!partyDraft.isEditing}
                      placeholder={partyDraft.isEditing ? 'En blanc = mantenir' : 'Contrasenya del partit'}
                      value={partyDraft.password}
                      onChange={(e) => setPartyDraft({ ...partyDraft, password: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    En desar es recalcularan automàticament les quotes globals i les quotes dins de cada lot.
                  </span>

                  <button
                    type="submit"
                    style={{
                      background: partyDraft.isEditing ? '#b45309' : '#4a7729',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.52rem 1.15rem',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {partyDraft.isEditing ? <Check size={15} /> : <Plus size={16} />}
                    <span>{partyDraft.isEditing ? 'Actualitzar Candidatura' : 'Crear Candidatura'}</span>
                  </button>
                </div>
              </form>

              {/* Quick Proportional Calculation Toolbar */}
              {parties.length > 0 && onRecalcPartyQuotas && (
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '0.75rem 0.95rem',
                  marginBottom: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0c4a6e' }}>
                      Càlcul ràpid de % de quota:
                    </span>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#0369a1', background: 'white', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                      <span>Mínim noves (0 vots):</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step="0.5"
                        value={minPctNewParties}
                        onChange={(e) => setMinPctNewParties(e.target.value)}
                        style={{ width: '48px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.76rem' }}
                      />
                      <span>%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRecalcPartyQuotas({ mode: 'VOTES', minPctForZero: Number(minPctNewParties) || 0 })}
                      style={{
                        background: '#0284c7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Calcula el % de quota de cada partit proporcionalment als seus vots"
                    >
                      Segons Vots
                    </button>

                    <button
                      type="button"
                      onClick={() => onRecalcPartyQuotas({ mode: 'SEATS', minPctForZero: Number(minPctNewParties) || 0 })}
                      style={{
                        background: '#ffffff',
                        color: '#0369a1',
                        border: '1px solid #7dd3fc',
                        borderRadius: '6px',
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Calcula el % de quota segons el nombre de regidors"
                    >
                      Segons Regidors
                    </button>

                    <button
                      type="button"
                      onClick={() => onRecalcPartyQuotas({ mode: 'EQUAL' })}
                      style={{
                        background: '#ffffff',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Assigna el mateix percentatge a totes les candidatures"
                    >
                      Parts Iguals
                    </button>

                    <button
                      type="button"
                      onClick={() => onRecalcPartyQuotas({ mode: 'SORT_BY_RESULTS' })}
                      style={{
                        background: '#ffffff',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Reordena l'ordre de prelació (1r, 2n, 3r...) de major a menor representació"
                    >
                      Ordenar per Regidors/Vots
                    </button>
                  </div>

                  {hasInlinePartyChanges && (
                    <button
                      type="button"
                      onClick={handleSaveInlinePartyEdits}
                      style={{
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.42rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 3px 10px rgba(22, 163, 74, 0.3)'
                      }}
                    >
                      <Save size={14} />
                      <span>Desar Canvis de la Taula</span>
                    </button>
                  )}
                </div>
              )}

              {/* Parties & Quotas Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#334155' }}>
                  Candidatures Registrades ({parties.length}) · Suma pesos actual: <strong>{Number(totalQuotaPctSum.toFixed(2))}%</strong>
                  {Math.abs(totalQuotaPctSum - 100) > 0.2 && parties.length > 0 && (
                    <span style={{ color: '#0369a1', fontWeight: 600 }}> (es normalitza automàticament al 100%)</span>
                  )}
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Podeu editar regidors, vots i % quota directament a les caselles de la taula.
                </span>
              </div>

              <div className="admin-table-wrap" style={{ maxHeight: '380px' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ordre</th>
                      <th>Candidatura</th>
                      <th>Usuari</th>
                      <th>Regidors</th>
                      <th>Vots</th>
                      <th>% Quota</th>
                      <th>Fanals</th>
                      <th>Emplaç.</th>
                      <th style={{ textAlign: 'right' }}>Accions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No hi ha cap partit polític registrat. Utilitzeu el formulari superior per donar d'alta les candidatures.
                        </td>
                      </tr>
                    ) : (
                      parties.map((p, idx) => {
                        const rowEdits = inlinePartyEdits[p.id];
                        const seatsVal = rowEdits !== undefined ? rowEdits.seats : (p.seats ?? 0);
                        const votesVal = rowEdits !== undefined ? rowEdits.votes : (p.votes ?? 0);
                        const pctVal = rowEdits !== undefined ? rowEdits.quotaPct : (p.quotaPct ?? p.effectiveQuotaPct ?? 0);

                        return (
                          <tr
                            key={p.id}
                            style={{
                              background: partyDraft.isEditing && partyDraft.id === p.id ? '#fffbeb' : '#ffffff'
                            }}
                          >
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <strong style={{ minWidth: '20px', color: '#334155' }}>{idx + 1}r</strong>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMovePartyRank(idx, -1)}
                                  style={{
                                    border: '1px solid #cbd5e1',
                                    background: idx === 0 ? '#f1f5f9' : 'white',
                                    borderRadius: '4px',
                                    padding: '2px',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer'
                                  }}
                                  title="Pujar ordre de prelació"
                                >
                                  <ArrowUp size={12} color={idx === 0 ? '#cbd5e1' : '#334155'} />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === parties.length - 1}
                                  onClick={() => handleMovePartyRank(idx, 1)}
                                  style={{
                                    border: '1px solid #cbd5e1',
                                    background: idx === parties.length - 1 ? '#f1f5f9' : 'white',
                                    borderRadius: '4px',
                                    padding: '2px',
                                    cursor: idx === parties.length - 1 ? 'not-allowed' : 'pointer'
                                  }}
                                  title="Baixar ordre de prelació"
                                >
                                  <ArrowDown size={12} color={idx === parties.length - 1 ? '#cbd5e1' : '#334155'} />
                                </button>
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <span style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: p.color,
                                  flexShrink: 0,
                                  border: '1px solid rgba(0,0,0,0.2)'
                                }} />
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.acronym}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                                    {p.name}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#334155', whiteSpace: 'nowrap' }}>
                              {p.username || p.id}
                            </td>

                            <td>
                              <input
                                type="number"
                                min={0}
                                max={50}
                                value={seatsVal}
                                onChange={(e) => setInlineField(p.id, 'seats', e.target.value, p)}
                                style={{ width: '58px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem' }}
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                min={0}
                                value={votesVal}
                                onChange={(e) => setInlineField(p.id, 'votes', e.target.value, p)}
                                style={{ width: '76px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem' }}
                              />
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.1"
                                  value={pctVal}
                                  onChange={(e) => setInlineField(p.id, 'quotaPct', e.target.value, p)}
                                  style={{ width: '68px', padding: '4px 6px', border: '1px solid #7dd3fc', borderRadius: '5px', fontSize: '0.8rem', fontWeight: 700 }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700 }}>%</span>
                              </div>
                            </td>

                            <td style={{ fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap' }}>
                              {p.allocatedStreetlampsQuota ?? 0}
                            </td>

                            <td style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                              {p.allocatedLocationsQuota ?? 0}
                            </td>

                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => loadPartyIntoEditor(p)}
                                  style={{
                                    background: '#fffbeb',
                                    color: '#b45309',
                                    border: '1px solid #fde68a',
                                    borderRadius: '5px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.73rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="Editar nom, sigles, color i contrasenya"
                                >
                                  <Edit2 size={12} />
                                  <span>Editar</span>
                                </button>

                                {onDeleteParty && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Segur que voleu eliminar la candidatura "${p.name} (${p.acronym})"? Es recalcularan les quotes entre la resta de partits.`)) {
                                        onDeleteParty(p.id);
                                        if (partyDraft.isEditing && partyDraft.id === p.id) {
                                          setPartyDraft({ ...EMPTY_PARTY_DRAFT });
                                        }
                                      }
                                    }}
                                    style={{
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      borderRadius: '5px',
                                      padding: '0.25rem 0.48rem',
                                      cursor: 'pointer'
                                    }}
                                    title="Eliminar candidatura"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== TAB 5: SORTEIG I ESTAT ==================== */}
          {selectedTab === 'ALLOCATE' && (
            <div>
              {/* General Election Title & Date Editor */}
              {onSaveElectionInfo && (
                <form
                  onSubmit={handleSaveElectionInfoSubmit}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '0.95rem 1rem',
                    marginBottom: '1.1rem'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.65rem' }}>
                    Dades Generals de la Convocatòria Electoral (Capçalera i Acta PDF)
                  </div>
                  <div className="admin-grid-loc-photo">
                    <div>
                      <label style={labelStyle}>Títol del procés electoral</label>
                      <input
                        type="text"
                        value={electionTitleDraft}
                        onChange={(e) => setElectionTitleDraft(e.target.value)}
                        placeholder="Ex. Eleccions Municipals 2027 - Sant Joan de Vilatorrada"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Data dels comicis</label>
                      <input
                        type="text"
                        value={electionDateDraft}
                        onChange={(e) => setElectionDateDraft(e.target.value)}
                        placeholder="Ex. 24 de Maig de 2027"
                        style={inputStyle}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
                        background: '#334155',
                        color: 'white',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.48rem 0.9rem',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Save size={14} />
                      <span>Desar Títol</span>
                    </button>
                  </div>
                  {electionInfoSavedMsg && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>
                      {electionInfoSavedMsg}
                    </div>
                  )}
                </form>
              )}

              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: '1 1 260px' }}>
                  <h4 style={{ margin: 0, color: '#991b1b', fontSize: '0.96rem' }}>
                    Estat actual: {statusLabel}
                  </h4>
                  <p style={{ fontSize: '0.83rem', color: '#7f1d1d', margin: '6px 0 0 0' }}>
                    Candidatures: <strong>{parties.length}</strong> · Lots actius: <strong>{lots.length}</strong> ({electionInfo?.totalStreetlampsAvailable ?? 0} faroles seleccionades) · Emplaçaments fixos: <strong>{locations.length}</strong> ({electionInfo?.totalLocationsAvailable ?? 0} places).
                  </p>
                </div>

                {electionInfo?.status !== 'ALLOCATED' && onChangeElectionStatus && (
                  <button
                    type="button"
                    onClick={() => onChangeElectionStatus(electionInfo?.status === 'OPEN' ? 'CLOSED' : 'OPEN')}
                    style={{
                      background: electionInfo?.status === 'OPEN' ? '#f59e0b' : '#0284c7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 0.95rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {electionInfo?.status === 'OPEN' ? <Lock size={15} /> : <Unlock size={15} />}
                    <span>{electionInfo?.status === 'OPEN' ? 'Tancar Període de Selecció' : 'Reobrir Període de Selecció'}</span>
                  </button>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '1.1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={assignUnselectedRandomly}
                    onChange={(e) => setAssignUnselectedRandomly(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>Assignar aleatòriament les faroles restants no numerades dins de cada lot (i emplaçaments restants) fins a cobrir totes les quotes</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAllocResetNotice('');
                    onRunAllocation(assignUnselectedRandomly);
                  }}
                  style={{
                    flex: '1 1 250px',
                    background: '#4a7729',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.8rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(74, 119, 41, 0.3)'
                  }}
                >
                  <Zap size={18} />
                  <span>Executar Sorteig i Repartiment Automàtic</span>
                </button>

                {electionInfo?.status === 'ALLOCATED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedTab('HISTORY')}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #93c5fd',
                        borderRadius: '10px',
                        padding: '0.8rem 1rem',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem'
                      }}
                    >
                      <History size={16} />
                      <span>Desar a l'Històric</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Voleu reiniciar l\'adjudicació del sorteig i reobrir el període de selecció (mantenint les prioritats ja marcades pels partits)?')) {
                          return;
                        }
                        const ok = await onResetAllocation();
                        if (ok !== false) {
                          setAllocResetNotice('✔ Adjudicació reiniciada. S\'han mantingut les prioritats dels partits i s\'ha reobert la selecció.');
                        }
                      }}
                      style={{
                        background: '#e2e8f0',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '0.8rem 1.05rem',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem'
                      }}
                      title="Anul·la el resultat del sorteig i torna a obrir el procés sense esborrar l'ordre que havien triat els partits"
                    >
                      <RotateCcw size={16} />
                      <span>Reiniciar Adjudicació (mantenir seleccions)</span>
                    </button>
                  </>
                )}

                {onResetPartyPreferences && (partySelectionStats.anyPartyHasSelections || electionInfo?.status === 'ALLOCATED') && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('Segur que voleu REINICIAR TOTES les seleccions i assignacions de TOTS els partits (fanals i emplaçaments)? Els espais municipals (lots, faroles seleccionades i emplaçaments) es mantindran intactes.')) {
                        return;
                      }
                      const ok = await onResetPartyPreferences(null);
                      if (ok !== false) {
                        setAllocResetNotice('✔ S\'han reiniciat totes les seleccions i assignacions dels partits (0 fanals i 0 emplaçaments marcats).');
                      }
                    }}
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '10px',
                      padding: '0.8rem 1.05rem',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem'
                    }}
                    title="Esborra totes les prioritats de fanals i emplaçaments marcades per tots els partits i anul·la qualsevol adjudicació activa"
                  >
                    <Trash2 size={16} />
                    <span>Reiniciar Seleccions i Assignacions dels Partits</span>
                  </button>
                )}
              </div>

              {allocResetNotice && (
                <div style={{
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  marginBottom: '1rem'
                }}>
                  {allocResetNotice}
                </div>
              )}

              {/* Per-Party Selection & Allocation Tracking Table with Individual Reset */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0.9rem 1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                    Seguiment de Seleccions i Assignacions per Candidatura
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Podeu reiniciar la selecció d&apos;un partit concret o de tots alhora.
                  </span>
                </div>

                <div className="admin-table-wrap" style={{ maxHeight: 'none' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Candidatura</th>
                        <th>Prioritats Fanals</th>
                        <th>Prioritats Emplaçaments</th>
                        <th>Adjudicació Actual</th>
                        <th style={{ textAlign: 'right' }}>Acció</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parties.map(p => {
                        const st = partySelectionStats.byPartyId[p.id] || {
                          numberedLamps: 0,
                          numberedLots: 0,
                          numberedLocs: 0,
                          hasAnySelection: false,
                          assignedLamps: 0,
                          assignedLocs: 0
                        };
                        const isAlloc = electionInfo?.status === 'ALLOCATED';
                        return (
                          <tr key={p.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, color: '#0f172a' }}>
                                <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: p.color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.2)' }} />
                                <span>{p.acronym}</span>
                                <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.76rem' }}>({p.name})</span>
                              </div>
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              {st.numberedLamps > 0 ? (
                                <span style={{ color: '#15803d', fontWeight: 700 }}>
                                  {st.numberedLamps} faroles ({st.numberedLots}/{partySelectionStats.eligibleLotsCount} lots)
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>Sense numerar (Q: {p.allocatedStreetlampsQuota ?? 0})</span>
                              )}
                              {st.validLotOrder?.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, marginTop: '2px' }}>
                                  Ordre lots: {st.validLotOrder.slice(0, 4).join(' → ')}{st.validLotOrder.length > 4 ? '…' : ''}
                                </div>
                              )}
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              {st.numberedLocs > 0 ? (
                                <span style={{ color: '#0369a1', fontWeight: 700 }}>
                                  {st.numberedLocs} / {locations.length} ubicacions
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>Sense numerar (Q: {p.allocatedLocationsQuota ?? 0})</span>
                              )}
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              {isAlloc ? (
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                  {st.assignedLamps}/{p.allocatedStreetlampsQuota ?? 0} fanals · {st.assignedLocs}/{p.allocatedLocationsQuota ?? 0} empl.
                                </span>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.77rem' }}>Pendent de sorteig</span>
                              )}
                            </td>

                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {onResetPartyPreferences && (
                                <button
                                  type="button"
                                  disabled={!st.hasAnySelection}
                                  onClick={async () => {
                                    if (!window.confirm(`Voleu reiniciar totes les prioritats de fanals i emplaçaments marcades per «${p.acronym} (${p.name})»${isAlloc ? ' (això també reobrirà l\'adjudicació actual)' : ''}?`)) {
                                      return;
                                    }
                                    const ok = await onResetPartyPreferences(p.id);
                                    if (ok !== false) {
                                      setAllocResetNotice(`✔ Selecció de ${p.acronym} reiniciada correctament.`);
                                    }
                                  }}
                                  style={{
                                    background: st.hasAnySelection ? '#fff7ed' : '#f8fafc',
                                    color: st.hasAnySelection ? '#c2410c' : '#94a3b8',
                                    border: `1px solid ${st.hasAnySelection ? '#fdba74' : '#e2e8f0'}`,
                                    borderRadius: '6px',
                                    padding: '0.26rem 0.6rem',
                                    fontSize: '0.73rem',
                                    fontWeight: 700,
                                    cursor: st.hasAnySelection ? 'pointer' : 'not-allowed',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title={st.hasAnySelection ? `Esborrar les seleccions de ${p.acronym}` : `${p.acronym} no té cap selecció registrada`}
                                >
                                  <RotateCcw size={12} />
                                  <span>Reiniciar</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 6: HISTÒRIC DE CONVOCATÒRIES ==================== */}
          {selectedTab === 'HISTORY' && (
            <div>
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '0.95rem'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={18} color="#2563eb" />
                  <span>Històric i Reutilització de Convocatòries Electorals</span>
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#1e40af' }}>
                  Deseu una còpia de la configuració actual (faroles seleccionades, lots, emplaçaments, partits i preferències) per poder recuperar els espais municipals en properes eleccions i permetre als partits importar la seva selecció anterior.
                </p>
              </div>

              {historyNotice && (
                <div style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.85rem' }}>
                  {historyNotice}
                </div>
              )}

              {historyError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.55rem 0.8rem', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.85rem' }}>
                  {historyError}
                </div>
              )}

              {/* Card 1: Archive Current Election */}
              <form
                onSubmit={handleArchiveSubmit}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '0.95rem',
                  marginBottom: '1.1rem'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.55rem' }}>
                  📥 Desar la configuració actual a l'Històric
                </div>

                <div style={{ fontSize: '0.78rem', color: '#334155', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '0.45rem 0.7rem', marginBottom: '0.7rem' }}>
                  Contingut actual que es guardarà: <strong>{selectedTotal}</strong> faroles seleccionades · <strong>{lots.length}</strong> lots · <strong>{locations.length}</strong> emplaçaments · <strong>{parties.length}</strong> candidatures · Estat: <strong>{statusLabel}</strong>
                </div>

                <div className="admin-grid-3" style={{ alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Títol per identificar la convocatòria a l'històric</label>
                    <input
                      type="text"
                      value={archiveTitleDraft}
                      onChange={(e) => setArchiveTitleDraft(e.target.value)}
                      placeholder="Ex. Eleccions Municipals Maig 2027"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Data / Referència</label>
                    <input
                      type="text"
                      value={archiveDateDraft}
                      onChange={(e) => setArchiveDateDraft(e.target.value)}
                      placeholder="Ex. 24 de Maig de 2027"
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.52rem 1rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Save size={15} />
                    <span>Desar a l'Històric</span>
                  </button>
                </div>
              </form>

              {/* Card 2: Saved Historical Snapshots */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#334155' }}>
                  Convocatòries registrades ({historyEntries.length})
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={restoreIncludeParties}
                    onChange={(e) => setRestoreIncludeParties(e.target.checked)}
                  />
                  <span>En «Preparar Noves Eleccions», recuperar també quotes i partits d'aquell procés</span>
                </label>
              </div>

              {historyEntries.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  Encara no hi ha cap convocatòria desada a l'històric.
                </div>
              ) : (
                <div className="admin-table-wrap" style={{ maxHeight: '310px' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Convocatòria</th>
                        <th>Contingut Arxivat</th>
                        <th style={{ textAlign: 'right' }}>Recuperació / Accions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyEntries.map((entry) => {
                        const s = entry.summary || {};
                        return (
                          <tr key={entry.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{entry.title}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {entry.date ? `${entry.date} · ` : ''}
                                {entry.archivedAt ? `Arxivat: ${new Date(entry.archivedAt).toLocaleString('ca-ES')}` : `ID: ${entry.id}`}
                              </div>
                            </td>
                            <td>
                              {entry.isFullSnapshot ? (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '0.74rem' }}>
                                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                                    ✔ {s.selectedLampsCount ?? 0} faroles sel.
                                  </span>
                                  <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                                    📦 {s.lotsCount ?? 0} lots
                                  </span>
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                                    📍 {s.locationsCount ?? 0} emplaçaments
                                  </span>
                                  {s.hasAllocation && (
                                    <span style={{ background: '#fef9c3', color: '#a16207', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                                      🏆 Amb sorteig
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                  Preferències anteriors dels partits (sense inventari municipal de lots)
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {entry.isFullSnapshot && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerRestore(entry, 'TEMPLATE')}
                                      style={{
                                        background: '#4a7729',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0.28rem 0.62rem',
                                        fontSize: '0.73rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                      title="Recupera faroles seleccionades, lots i emplaçaments al mapa i obre un nou període net perquè els partits triïn"
                                    >
                                      ♻️ Preparar Noves Eleccions
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleTriggerRestore(entry, 'FULL')}
                                      style={{
                                        background: '#f1f5f9',
                                        color: '#1e293b',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '0.28rem 0.6rem',
                                        fontSize: '0.73rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                      title="Restaura exactament tot l'estat d'aquella convocatòria (incloses preferències dels partits i acta del sorteig)"
                                    >
                                      📂 Restaurar Completa
                                    </button>
                                  </>
                                )}

                                {onDeleteHistory && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Segur que voleu eliminar «${entry.title}» de l'històric?`)) {
                                        onDeleteHistory(entry.id);
                                      }
                                    }}
                                    style={{
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      borderRadius: '6px',
                                      padding: '0.28rem 0.45rem',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    title="Eliminar de l'històric"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.58rem 1.25rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Tancar Gestió
          </button>
        </div>
      </div>
    </div>
  );
}
