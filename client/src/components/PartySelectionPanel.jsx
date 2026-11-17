import React, { useState, useMemo } from 'react';
import {
  Lightbulb,
  MapPin,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GripVertical,
  Eye,
  Plus,
  Trash2,
  RotateCcw,
  History,
  Zap,
  Lock,
  ShieldAlert,
  ExternalLink,
  CheckCircle2,
  Minimize2,
  ClipboardList,
  X
} from 'lucide-react';
import { getLotPaletteColor } from '../lotColors';
import {
  extractOrderedCodes,
  getActiveLotLamps,
  buildEffectiveLotOrder,
  formatOrdinalCa,
  moveItemInArray
} from '../utils';

function BatchOrderToolbar({
  canNumberAll,
  canReverse,
  canClear,
  primaryColor = '#4a7729',
  numberAllLabel = 'Numerar totes',
  onNumberAll,
  onReverse,
  onClear
}) {
  return (
    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
      <button
        type="button"
        disabled={!canNumberAll}
        onClick={onNumberAll}
        style={{
          flex: 1,
          background: !canNumberAll ? '#e2e8f0' : primaryColor,
          color: !canNumberAll ? '#94a3b8' : 'white',
          border: 'none',
          borderRadius: '7px',
          padding: '0.38rem 0.55rem',
          fontSize: '0.73rem',
          fontWeight: 700,
          cursor: !canNumberAll ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}
      >
        <Zap size={12} />
        <span>{numberAllLabel}</span>
      </button>

      <button
        type="button"
        disabled={!canReverse}
        onClick={onReverse}
        style={{
          background: 'white',
          color: !canReverse ? '#94a3b8' : '#334155',
          border: '1px solid #cbd5e1',
          borderRadius: '7px',
          padding: '0.38rem 0.55rem',
          fontSize: '0.73rem',
          fontWeight: 700,
          cursor: !canReverse ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Invertir l'ordre actual"
      >
        <ArrowUpDown size={12} />
        <span>Invertir</span>
      </button>

      <button
        type="button"
        disabled={!canClear}
        onClick={onClear}
        style={{
          background: '#fef2f2',
          color: !canClear ? '#fca5a5' : '#dc2626',
          border: '1px solid #fca5a5',
          borderRadius: '7px',
          padding: '0.38rem 0.55rem',
          fontSize: '0.73rem',
          fontWeight: 700,
          cursor: !canClear ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Buidar la numeració actual"
      >
        <RotateCcw size={12} />
        <span>Buidar</span>
      </button>
    </div>
  );
}

function RankedItemButtons({ idx, total, canEdit, onMove, onRemove }) {
  if (!canEdit) return null;
  const isFirst = idx === 0;
  const isLast = idx === total - 1;
  return (
    <>
      <button
        type="button"
        disabled={isFirst}
        onClick={() => onMove(idx, idx - 1)}
        style={{ border: '1px solid #cbd5e1', background: isFirst ? '#f1f5f9' : 'white', borderRadius: '4px', padding: '2px', cursor: isFirst ? 'not-allowed' : 'pointer' }}
        title="Pujar posició"
      >
        <ArrowUp size={11} color={isFirst ? '#cbd5e1' : '#334155'} />
      </button>
      <button
        type="button"
        disabled={isLast}
        onClick={() => onMove(idx, idx + 1)}
        style={{ border: '1px solid #cbd5e1', background: isLast ? '#f1f5f9' : 'white', borderRadius: '4px', padding: '2px', cursor: isLast ? 'not-allowed' : 'pointer' }}
        title="Baixar posició"
      >
        <ArrowDown size={11} color={isLast ? '#cbd5e1' : '#334155'} />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: '4px', padding: '2px 4px', cursor: 'pointer' }}
          title="Treure de la llista"
        >
          <Trash2 size={11} />
        </button>
      )}
    </>
  );
}

export default function PartySelectionPanel({
  lots = [],
  locations = [],
  parties = [],
  partyId,
  partyAcronym = 'Partit',
  partyColor = '#4a7729',
  partyQuota = 0,
  partyLocsQuota = 0,
  electionStatus = 'OPEN',
  isSelectionOpen = true,
  activeTab = 'LOTS', // 'LOTS' | 'LOCATIONS'
  onChangeTab,
  selectedLotId = null,
  onSelectLotId,
  isMinimized = false,
  onChangeMinimized,
  lotPreferences = {},
  lotOrder = [],
  locationPreferences = [],
  allocationResults,
  onSaveLotOrder,
  onSaveLotLampOrder,
  onSaveLocationPreferences,
  onFocusLot,
  onFocusLamp,
  onFocusLocation,
  onHighlightLot,
  onOpenRestorePast,
  onResetOwnPreferences
}) {
  const isAllocated = electionStatus === 'ALLOCATED';
  const canEdit = isSelectionOpen && !isAllocated;

  const originalLotIdxById = useMemo(() => {
    const m = new Map();
    lots.forEach((l, idx) => m.set(l.id, idx));
    return m;
  }, [lots]);

  const orderedLots = useMemo(
    () => buildEffectiveLotOrder(lots, lotPreferences, lotOrder),
    [lots, lotPreferences, lotOrder]
  );

  const selectedLot = useMemo(
    () => (selectedLotId ? lots.find(l => l.id === selectedLotId) || null : null),
    [selectedLotId, lots]
  );

  // Aggregate lamp selection stats across eligible lots
  const { totalAvailableLamps, totalNumberedLamps, lotsWithSelectionCount } = useMemo(() => {
    let avail = 0;
    let numbered = 0;
    let withSel = 0;
    orderedLots.forEach(lot => {
      const activeCodes = new Set(getActiveLotLamps(lot).map(l => String(l.codi)));
      avail += activeCodes.size || lot.lampCount || 0;
      const count = extractOrderedCodes(lotPreferences[lot.id]).filter(c => activeCodes.has(String(c))).length;
      numbered += count;
      if (count > 0) withSel += 1;
    });
    return {
      totalAvailableLamps: avail,
      totalNumberedLamps: numbered,
      lotsWithSelectionCount: withSel
    };
  }, [orderedLots, lotPreferences]);

  // Locations state & helpers
  const locById = useMemo(() => {
    const m = new Map();
    locations.forEach(l => m.set(l.id, l));
    return m;
  }, [locations]);

  const orderedLocIds = useMemo(() => {
    if (!Array.isArray(locationPreferences)) return [];
    const seen = new Set();
    const valid = [];
    locationPreferences.forEach(id => {
      if (locById.has(id) && !seen.has(id)) {
        seen.add(id);
        valid.push(id);
      }
    });
    return valid;
  }, [locationPreferences, locById]);

  const numberedLocSet = useMemo(() => new Set(orderedLocIds), [orderedLocIds]);
  const unnumberedLocations = useMemo(
    () => locations.filter(l => !numberedLocSet.has(l.id)),
    [locations, numberedLocSet]
  );

  const hasNothingSelectedYet = totalNumberedLamps === 0 && orderedLocIds.length === 0 && lotOrder.length === 0;
  const [helpToggled, setHelpToggled] = useState(null);
  const showHelp = helpToggled !== null ? helpToggled : (canEdit && hasNothingSelectedYet);

  const [dragLotIdx, setDragLotIdx] = useState(null);
  const [dragLampIdx, setDragLampIdx] = useState(null);
  const [dragLocIdx, setDragLocIdx] = useState(null);

  // Selected Lot active lamps & numbered codes
  const activeLotLamps = useMemo(
    () => (selectedLot ? getActiveLotLamps(selectedLot) : []),
    [selectedLot]
  );
  const activeLampByCode = useMemo(() => {
    const m = new Map();
    activeLotLamps.forEach(l => m.set(String(l.codi), l));
    return m;
  }, [activeLotLamps]);

  const orderedLampCodes = useMemo(() => {
    if (!selectedLot) return [];
    const raw = extractOrderedCodes(lotPreferences[selectedLot.id]);
    const seen = new Set();
    const valid = [];
    raw.forEach(c => {
      const sc = String(c);
      if (activeLampByCode.has(sc) && !seen.has(sc)) {
        seen.add(sc);
        valid.push(sc);
      }
    });
    return valid;
  }, [selectedLot, lotPreferences, activeLampByCode]);

  const orderedLampSet = useMemo(() => new Set(orderedLampCodes), [orderedLampCodes]);
  const unnumberedLotLamps = useMemo(
    () => activeLotLamps.filter(l => !orderedLampSet.has(String(l.codi))),
    [activeLotLamps, orderedLampSet]
  );

  // Handlers for Lot Priority Ordering (Step 1)
  const moveLotInOrder = (fromIdx, toIdx) => {
    if (!canEdit || !onSaveLotOrder) return;
    const nextIds = moveItemInArray(orderedLots.map(l => l.id), fromIdx, toIdx);
    if (nextIds) onSaveLotOrder(nextIds);
  };

  // Handlers for Streetlamp Numbering inside Selected Lot (Step 2)
  const saveLotLamps = (nextCodes) => {
    if (!canEdit || !selectedLot || selectedLot.reserved || !onSaveLotLampOrder) return;
    onSaveLotLampOrder(selectedLot.id, nextCodes);
  };

  const moveLampInOrder = (fromIdx, toIdx) => {
    saveLotLamps(moveItemInArray(orderedLampCodes, fromIdx, toIdx));
  };

  // Handlers for Fixed Locations Numbering (Tab 2)
  const saveLocationsOrder = (nextIds) => {
    if (!canEdit || !onSaveLocationPreferences) return;
    onSaveLocationPreferences(nextIds);
  };

  const moveLocationInOrder = (fromIdx, toIdx) => {
    saveLocationsOrder(moveItemInArray(orderedLocIds, fromIdx, toIdx));
  };

  const partyWonTotalLamps = Number(allocationResults?.partyAssignedLamps?.[partyId]) || 0;
  const partyWonTotalLocs = Number(allocationResults?.partyAssignedLocations?.[partyId]) || 0;

  // Minimized floating launcher pill so user can inspect the full map unobstructed anytime
  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => onChangeMinimized && onChangeMinimized(false)}
        style={{
          position: 'absolute',
          bottom: '18px',
          right: '18px',
          zIndex: 1100,
          background: '#0f172a',
          color: 'white',
          border: `2.5px solid ${partyColor || '#4a7729'}`,
          borderRadius: '999px',
          padding: '0.6rem 1.05rem',
          fontWeight: 800,
          fontSize: '0.82rem',
          boxShadow: '0 8px 22px rgba(15, 23, 42, 0.38)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px'
        }}
        title="Obrir el panell de selecció de lots, faroles i emplaçaments"
      >
        <ClipboardList size={17} color="#fde047" />
        <span>Selecció {partyAcronym}:</span>
        <span style={{ color: '#fef08a' }}>
          {isAllocated
            ? `${partyWonTotalLamps}/${partyQuota} fanals · ${partyWonTotalLocs}/${partyLocsQuota} empl.`
            : `${lotsWithSelectionCount}/${orderedLots.length} lots · ${orderedLocIds.length}/${locations.length} empl.`}
        </span>
      </button>
    );
  }

  const selectedLotRankIdx = selectedLot ? orderedLots.findIndex(l => l.id === selectedLot.id) : -1;

  return (
    <div
      className="map-side-panel"
      style={{
        width: '390px',
        border: `2px solid ${partyColor || '#4a7729'}`
      }}
    >
      {/* Top Panel Header */}
      <div
        style={{
          background: '#0f172a',
          color: 'white',
          padding: '0.65rem 0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: partyColor || '#4a7729',
              border: '2px solid white',
              flexShrink: 0
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Selecció Electoral — {partyAcronym}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
              Quota global: <strong>{partyQuota} fanals</strong> · <strong>{partyLocsQuota} emplaçaments</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setHelpToggled(!showHelp)}
            style={{
              background: showHelp ? '#fde047' : 'rgba(255,255,255,0.14)',
              color: showHelp ? '#0f172a' : '#ffffff',
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: '6px',
              padding: '3px 7px',
              fontSize: '0.71rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Mostrar o ocultar les instruccions pas a pas"
          >
            <HelpCircle size={13} />
            <span>Ajuda</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMinimized && onChangeMinimized(true)}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex'
            }}
            title="Minimitzar panell per veure tot el mapa"
          >
            <Minimize2 size={15} />
          </button>
        </div>
      </div>

      {/* Collapsible Step-by-Step Instructions Banner */}
      {showHelp && (
        <div
          style={{
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            padding: '0.65rem 0.85rem',
            fontSize: '0.74rem',
            color: '#1e3a8a',
            lineHeight: 1.4,
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong style={{ fontSize: '0.77rem' }}>📋 Com fer la vostra selecció en 3 passos:</strong>
            <button
              type="button"
              onClick={() => setHelpToggled(false)}
              style={{ border: 'none', background: 'transparent', color: '#1e40af', cursor: 'pointer', padding: '1px', display: 'flex' }}
              title="Tancar instruccions"
            >
              <X size={14} />
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <li>
              <strong>Ordre dels Lots (`1r, 2n...`):</strong> Ordeneu la llista de lots de més a menys important. Serveix per repartir les places de resta (sobretot si teniu menys faroles que lots).
            </li>
            <li>
              <strong>Faroles de cada Lot (`#1, #2...`):</strong> Premeu <strong>«Numerar →»</strong> a un lot (o cliqueu-lo al mapa) i cliqueu les xinxetes del mapa en l&apos;ordre que les vulgueu.
            </li>
            <li>
              <strong>Emplaçaments (`📍`):</strong> A la pestanya <strong>Emplaçaments</strong>, ordeneu els panells/pancartes (màxim 1 plaça per partit a cada punt).
            </li>
          </ol>
        </div>
      )}

      {/* Closed Selection Notice */}
      {!isSelectionOpen && !isAllocated && (
        <div
          style={{
            background: '#fef3c7',
            borderBottom: '1px solid #fde68a',
            color: '#92400e',
            padding: '0.45rem 0.85rem',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}
        >
          <Lock size={14} />
          <span>Període de selecció tancat (mode consulta).</span>
        </div>
      )}

      {/* 2 Top Mode Tabs: Lots i Fanals vs Emplaçaments */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#f1f5f9',
          borderBottom: '1px solid #cbd5e1',
          padding: '4px',
          gap: '4px',
          flexShrink: 0
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (onChangeTab) onChangeTab('LOTS');
          }}
          style={{
            background: activeTab === 'LOTS' ? '#ffffff' : 'transparent',
            color: activeTab === 'LOTS' ? '#0f172a' : '#475569',
            border: activeTab === 'LOTS' ? '1px solid #cbd5e1' : '1px solid transparent',
            borderRadius: '7px',
            padding: '0.42rem 0.5rem',
            fontSize: '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            boxShadow: activeTab === 'LOTS' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
          }}
        >
          <Lightbulb size={14} color={activeTab === 'LOTS' ? '#4a7729' : '#64748b'} />
          <span>Lots i Fanals</span>
          <span
            style={{
              background: activeTab === 'LOTS' ? '#ecfdf5' : '#e2e8f0',
              color: activeTab === 'LOTS' ? '#15803d' : '#334155',
              borderRadius: '999px',
              padding: '0 6px',
              fontSize: '0.68rem'
            }}
          >
            {isAllocated ? `${partyWonTotalLamps}/${partyQuota}` : `${lotsWithSelectionCount}/${orderedLots.length}`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onSelectLotId) onSelectLotId(null);
            if (onChangeTab) onChangeTab('LOCATIONS');
          }}
          style={{
            background: activeTab === 'LOCATIONS' ? '#ffffff' : 'transparent',
            color: activeTab === 'LOCATIONS' ? '#0f172a' : '#475569',
            border: activeTab === 'LOCATIONS' ? '1px solid #cbd5e1' : '1px solid transparent',
            borderRadius: '7px',
            padding: '0.42rem 0.5rem',
            fontSize: '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            boxShadow: activeTab === 'LOCATIONS' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
          }}
        >
          <MapPin size={14} color={activeTab === 'LOCATIONS' ? '#0f766e' : '#64748b'} />
          <span>Emplaçaments</span>
          <span
            style={{
              background: activeTab === 'LOCATIONS' ? '#f0fdfa' : '#e2e8f0',
              color: activeTab === 'LOCATIONS' ? '#0f766e' : '#334155',
              borderRadius: '999px',
              padding: '0 6px',
              fontSize: '0.68rem'
            }}
          >
            {isAllocated ? `${partyWonTotalLocs}/${partyLocsQuota}` : `${orderedLocIds.length}/${locations.length}`}
          </span>
        </button>
      </div>

      {/* ==================== BODY CONTENT ==================== */}
      <div style={{ padding: '0.75rem 0.85rem', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {/* ==================== TAB 1: LOTS & STREETLAMPS ==================== */}
        {activeTab === 'LOTS' && !selectedLot && (
          <>
            {/* Step 1 Intro Box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '9px',
                padding: '0.55rem 0.75rem',
                fontSize: '0.75rem',
                color: '#334155',
                lineHeight: 1.38
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <strong style={{ color: '#0f172a', fontSize: '0.79rem' }}>
                  Pas 1 — Ordre d&apos;importància dels Lots
                </strong>
                <span style={{ fontSize: '0.71rem', fontWeight: 700, color: '#15803d' }}>
                  {totalNumberedLamps}/{totalAvailableLamps} fanals numerats
                </span>
              </div>
              {isAllocated ? (
                <span>
                  Resultat adjudicat: <strong>{partyWonTotalLamps} de {partyQuota} fanals</strong> repartits entre els lots següents. Cliqueu un lot per veure quines faroles us han tocat.
                </span>
              ) : (
                <span>
                  Useu <strong>↑ / ↓</strong> (o arrossegueu <strong>⋮⋮</strong>) per posar primer els lots que més us interessen, i premeu <strong>«Numerar →»</strong> per triar-ne les faroles al mapa.
                </span>
              )}
              {!isAllocated && partyQuota > 0 && partyQuota < orderedLots.length && (
                <div style={{
                  marginTop: '5px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '4px 7px',
                  color: '#92400e',
                  fontWeight: 600,
                  fontSize: '0.72rem'
                }}>
                  💡 Teniu una quota de <strong>{partyQuota} fanals</strong> per a <strong>{orderedLots.length} lots</strong>: situeu a les primeres posicions els lots prioritaris i numereu-hi faroles (afegiu-ne algun més de reserva).
                </div>
              )}
            </div>

            {orderedLots.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem', background: '#f8fafc', borderRadius: '9px', border: '1px dashed #cbd5e1' }}>
                L&apos;Ajuntament encara no ha publicat cap lot actiu per a aquesta convocatòria.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {orderedLots.map((lot, idx) => {
                  const activeCodes = new Set(getActiveLotLamps(lot).map(l => String(l.codi)));
                  const totalInLot = activeCodes.size || lot.lampCount || 0;
                  const numberedCount = extractOrderedCodes(lotPreferences[lot.id]).filter(c => activeCodes.has(String(c))).length;
                  const minQ = Number(lot.partyMinQuotas?.[partyId] ?? lot.partyQuotas?.[partyId] ?? 0);
                  const maxQ = Number(lot.partyMaxQuotas?.[partyId] ?? lot.partyQuotas?.[partyId] ?? minQ);
                  const resolvedQ = Number(allocationResults?.resolvedLotQuotas?.[lot.id]?.[partyId] ?? lot.partyQuotas?.[partyId] ?? minQ);
                  const wonInLot = Number(allocationResults?.lotPartyCounts?.[lot.id]?.[partyId]) || 0;
                  const origIdx = originalLotIdxById.get(lot.id) ?? idx;
                  const lotColor = getLotPaletteColor(lot, origIdx);

                  const quotaLabel = minQ === maxQ
                    ? `${minQ} fanal(s)`
                    : `${minQ}–${maxQ} fanals`;
                  const isReady = maxQ > 0 ? numberedCount >= maxQ : numberedCount > 0;

                  return (
                    <div
                      key={lot.id}
                      draggable={canEdit && orderedLots.length > 1}
                      onDragStart={() => setDragLotIdx(idx)}
                      onDragOver={(e) => {
                        if (canEdit) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragLotIdx !== null && dragLotIdx !== idx) {
                          moveLotInOrder(dragLotIdx, idx);
                        }
                        setDragLotIdx(null);
                      }}
                      onDragEnd={() => setDragLotIdx(null)}
                      onMouseEnter={() => onHighlightLot && onHighlightLot(lot.id)}
                      onMouseLeave={() => onHighlightLot && onHighlightLot(null)}
                      style={{
                        background: '#ffffff',
                        border: `1.5px solid ${isReady && !isAllocated ? '#86efac' : '#cbd5e1'}`,
                        borderLeft: `5px solid ${lotColor}`,
                        borderRadius: '9px',
                        padding: '0.5rem 0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        opacity: dragLotIdx === idx ? 0.5 : 1,
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
                      }}
                    >
                      {/* Left: Priority Rank + Reorder Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        {canEdit && orderedLots.length > 1 && (
                          <GripVertical size={14} color="#94a3b8" style={{ cursor: 'grab' }} />
                        )}
                        <div
                          style={{
                            background: lotColor,
                            color: 'white',
                            borderRadius: '7px',
                            minWidth: '30px',
                            height: '28px',
                            padding: '0 5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.76rem'
                          }}
                          title={`Lot en posició ${formatOrdinalCa(idx + 1)} d'importància`}
                        >
                          {formatOrdinalCa(idx + 1)}
                        </div>

                        {canEdit && orderedLots.length > 1 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveLotInOrder(idx, idx - 1)}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: idx === 0 ? '#f1f5f9' : '#ffffff',
                                borderRadius: '4px',
                                padding: '1px 3px',
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex'
                              }}
                              title="Pujar importància d'aquest lot"
                            >
                              <ArrowUp size={11} color={idx === 0 ? '#cbd5e1' : '#334155'} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedLots.length - 1}
                              onClick={() => moveLotInOrder(idx, idx + 1)}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: idx === orderedLots.length - 1 ? '#f1f5f9' : '#ffffff',
                                borderRadius: '4px',
                                padding: '1px 3px',
                                cursor: idx === orderedLots.length - 1 ? 'not-allowed' : 'pointer',
                                display: 'flex'
                              }}
                              title="Baixar importància d'aquest lot"
                            >
                              <ArrowDown size={11} color={idx === orderedLots.length - 1 ? '#cbd5e1' : '#334155'} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Center: Lot Name, Street, Quota & Numbered Status */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.79rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${lot.id} — ${lot.name}`}>
                          {lot.id} · {lot.street || lot.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {isAllocated ? (
                            <strong style={{ color: wonInLot > 0 ? '#15803d' : '#64748b' }}>
                              Adjudicats: {wonInLot}/{resolvedQ}
                            </strong>
                          ) : (
                            <>
                              <span>Quota: <strong>{quotaLabel}</strong></span>
                              <span>·</span>
                              <span style={{
                                color: numberedCount > 0 ? (isReady ? '#15803d' : '#b45309') : '#64748b',
                                fontWeight: numberedCount > 0 ? 700 : 500
                              }}>
                                {numberedCount > 0 ? `${isReady ? '✔ ' : ''}${numberedCount}/${totalInLot} num.` : `0/${totalInLot} num.`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Focus & Drill-In Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {onFocusLot && (
                          <button
                            type="button"
                            onClick={() => onFocusLot(lot)}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              borderRadius: '6px',
                              padding: '4px 5px',
                              cursor: 'pointer',
                              display: 'flex'
                            }}
                            title="Centrar aquest lot al mapa"
                          >
                            <Eye size={13} color="#0369a1" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onHighlightLot) onHighlightLot(null);
                            if (onSelectLotId) onSelectLotId(lot.id);
                          }}
                          style={{
                            background: numberedCount > 0 && !isAllocated ? '#16a34a' : '#0f172a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '7px',
                            padding: '0.34rem 0.58rem',
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span>{canEdit ? 'Numerar' : 'Veure'}</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ==================== TAB 1 DRILL-IN: SELECTED LOT STREETLAMPS ==================== */}
        {activeTab === 'LOTS' && selectedLot && (() => {
          const minQ = Number(selectedLot.partyMinQuotas?.[partyId] ?? selectedLot.partyQuotas?.[partyId] ?? 0);
          const maxQ = Number(selectedLot.partyMaxQuotas?.[partyId] ?? selectedLot.partyQuotas?.[partyId] ?? minQ);
          const resolvedQ = Number(allocationResults?.resolvedLotQuotas?.[selectedLot.id]?.[partyId] ?? selectedLot.partyQuotas?.[partyId] ?? minQ);
          const lotLampMap = allocationResults?.lotLampAssignments?.[selectedLot.id] || {};
          const wonInLot = activeLotLamps.filter(
            l => (lotLampMap[l.codi] || allocationResults?.lampAssignments?.[l.codi]) === partyId
          ).length;

          return (
            <>
              {/* Back to All Lots + Prev/Next Lot Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => onSelectLotId && onSelectLotId(null)}
                  style={{
                    background: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    padding: '0.32rem 0.62rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Tornar a l&apos;ordre de Lots</span>
                </button>

                {selectedLotRankIdx !== -1 && orderedLots.length > 1 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={selectedLotRankIdx <= 0}
                      onClick={() => onSelectLotId(orderedLots[selectedLotRankIdx - 1].id)}
                      style={{
                        border: '1px solid #cbd5e1',
                        background: selectedLotRankIdx <= 0 ? '#f8fafc' : '#ffffff',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        cursor: selectedLotRankIdx <= 0 ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                      title="Anar al lot anterior"
                    >
                      <ChevronLeft size={13} color={selectedLotRankIdx <= 0 ? '#cbd5e1' : '#334155'} />
                    </button>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>
                      Lot {formatOrdinalCa(selectedLotRankIdx + 1)}/{orderedLots.length}
                    </span>
                    <button
                      type="button"
                      disabled={selectedLotRankIdx >= orderedLots.length - 1}
                      onClick={() => onSelectLotId(orderedLots[selectedLotRankIdx + 1].id)}
                      style={{
                        border: '1px solid #cbd5e1',
                        background: selectedLotRankIdx >= orderedLots.length - 1 ? '#f8fafc' : '#ffffff',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        cursor: selectedLotRankIdx >= orderedLots.length - 1 ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                      title="Anar al lot següent"
                    >
                      <ChevronRight size={13} color={selectedLotRankIdx >= orderedLots.length - 1 ? '#cbd5e1' : '#334155'} />
                    </button>
                  </div>
                )}
              </div>

              {/* Selected Lot Card & Instructions */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9px',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.76rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem' }}>
                      {selectedLot.id} — {selectedLot.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                      {selectedLot.street} · {activeLotLamps.length} faroles seleccionades
                    </div>
                  </div>
                  {selectedLotRankIdx !== -1 && !isAllocated && (
                    <span
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '2px 7px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Prioritat {formatOrdinalCa(selectedLotRankIdx + 1)}
                    </span>
                  )}
                </div>

                {selectedLot.reserved ? (
                  <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '7px', padding: '0.45rem 0.6rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <ShieldAlert size={16} />
                    <span><strong>Lot reservat:</strong> {selectedLot.reservedReason || 'ús institucional municipal'}</span>
                  </div>
                ) : isAllocated ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 700, color: '#334155' }}>Adjudicats en aquest lot:</span>
                    <strong style={{ color: '#15803d', fontSize: '0.88rem' }}>{wonInLot} / {resolvedQ} fanals</strong>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#334155', fontWeight: 700 }}>
                        Quota al lot:{' '}
                        <strong style={{ color: '#0f172a' }}>
                          {minQ === maxQ ? `${minQ} fanal(s)` : `${minQ}–${maxQ} fanals`}
                        </strong>
                      </span>
                      <span style={{
                        background: orderedLampCodes.length >= Math.max(1, maxQ) ? '#dcfce7' : '#fef9c3',
                        color: orderedLampCodes.length >= Math.max(1, maxQ) ? '#15803d' : '#a16207',
                        borderRadius: '999px',
                        padding: '1px 8px',
                        fontSize: '0.71rem',
                        fontWeight: 800
                      }}>
                        Numerades: {orderedLampCodes.length}/{activeLotLamps.length}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                      👆 Feu clic a les xinxetes <strong>+</strong> sobre el mapa (o a la llista) per numerar les faroles per ordre de preferència (<strong>#1, #2, #3...</strong>).
                    </div>
                  </>
                )}
              </div>

              {/* Batch Streetlamp Actions + Lists */}
              {!selectedLot.reserved && activeLotLamps.length > 0 && (
                <>
                  {canEdit && (
                    <BatchOrderToolbar
                      canNumberAll={unnumberedLotLamps.length > 0}
                      canReverse={orderedLampCodes.length >= 2}
                      canClear={orderedLampCodes.length > 0}
                      primaryColor="#4a7729"
                      numberAllLabel="Numerar totes"
                      onNumberAll={() => saveLotLamps([...orderedLampCodes, ...unnumberedLotLamps.map(l => String(l.codi))])}
                      onReverse={() => saveLotLamps([...orderedLampCodes].reverse())}
                      onClear={() => saveLotLamps([])}
                    />
                  )}

                  {/* Ranked Streetlamps in this Lot */}
                  {isAllocated ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {activeLotLamps.map(lamp => {
                        const codeStr = String(lamp.codi);
                        const winnerId = lotLampMap[codeStr] || allocationResults?.lampAssignments?.[codeStr] || null;
                        const winnerParty = winnerId ? parties.find(p => p.id === winnerId) : null;
                        const isMine = winnerId === partyId;
                        const myPrefIdx = orderedLampCodes.indexOf(codeStr);
                        return (
                          <div
                            key={codeStr}
                            style={{
                              background: isMine ? '#f0fdf4' : '#ffffff',
                              border: isMine ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                              borderRadius: '7px',
                              padding: '0.38rem 0.55rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              fontSize: '0.75rem'
                            }}
                          >
                            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <strong>{lamp.codi}</strong> ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'})
                              {myPrefIdx !== -1 && <span style={{ color: '#64748b' }}> · Vostra #{myPrefIdx + 1}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              {winnerParty && (
                                <span style={{ background: winnerParty.color, color: 'white', borderRadius: '999px', padding: '1px 7px', fontSize: '0.68rem', fontWeight: 800 }}>
                                  {winnerParty.acronym}
                                </span>
                              )}
                              {onFocusLamp && (
                                <button type="button" onClick={() => onFocusLamp(lamp)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', cursor: 'pointer' }}>
                                  <Eye size={12} color="#0369a1" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                          Ordre de preferència al lot ({orderedLampCodes.length}):
                        </div>
                        {orderedLampCodes.length === 0 ? (
                          <div style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', background: '#f8fafc', borderRadius: '7px', border: '1px dashed #cbd5e1' }}>
                            Cap farola numerada encara en aquest lot. Cliqueu les xinxetes <strong>+</strong> al mapa o afegiu-les de la llista inferior.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {orderedLampCodes.map((code, idx) => {
                              const lamp = activeLampByCode.get(code);
                              if (!lamp) return null;
                              return (
                                <div
                                  key={code}
                                  draggable={canEdit}
                                  onDragStart={() => setDragLampIdx(idx)}
                                  onDragOver={(e) => {
                                    if (canEdit) e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (dragLampIdx !== null && dragLampIdx !== idx) {
                                      moveLampInOrder(dragLampIdx, idx);
                                    }
                                    setDragLampIdx(null);
                                  }}
                                  onDragEnd={() => setDragLampIdx(null)}
                                  style={{
                                    background: '#ffffff',
                                    border: idx < Math.max(1, maxQ) ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                                    borderRadius: '7px',
                                    padding: '0.35rem 0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '6px',
                                    fontSize: '0.75rem',
                                    opacity: dragLampIdx === idx ? 0.5 : 1
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                    {canEdit && <GripVertical size={13} color="#94a3b8" style={{ cursor: 'grab', flexShrink: 0 }} />}
                                    <span style={{
                                      background: partyColor || '#16a34a',
                                      color: 'white',
                                      borderRadius: '999px',
                                      minWidth: '22px',
                                      height: '22px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      flexShrink: 0
                                    }}>
                                      {idx + 1}
                                    </span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <strong>{lamp.codi}</strong> · {lamp.num !== 's/n' ? `N.${lamp.num}` : 's/n'}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                    {onFocusLamp && (
                                      <button type="button" onClick={() => onFocusLamp(lamp)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', cursor: 'pointer' }} title="Centrar farola">
                                        <Eye size={12} color="#0369a1" />
                                      </button>
                                    )}
                                    <RankedItemButtons
                                      idx={idx}
                                      total={orderedLampCodes.length}
                                      canEdit={canEdit}
                                      onMove={moveLampInOrder}
                                      onRemove={() => saveLotLamps(orderedLampCodes.filter(c => c !== code))}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {unnumberedLotLamps.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Faroles disponibles sense numerar ({unnumberedLotLamps.length}):
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {unnumberedLotLamps.map(lamp => (
                              <div
                                key={lamp.codi}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '7px',
                                  padding: '0.32rem 0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                  fontSize: '0.74rem'
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <strong>{lamp.codi}</strong> — {lamp.carrer} ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'})
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  {onFocusLamp && (
                                    <button type="button" onClick={() => onFocusLamp(lamp)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', cursor: 'pointer' }}>
                                      <Eye size={12} color="#0369a1" />
                                    </button>
                                  )}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => saveLotLamps([...orderedLampCodes, String(lamp.codi)])}
                                      style={{
                                        background: '#ecfdf5',
                                        color: '#15803d',
                                        border: '1px solid #86efac',
                                        borderRadius: '6px',
                                        padding: '2px 7px',
                                        fontSize: '0.71rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px'
                                      }}
                                    >
                                      <Plus size={11} />
                                      <span>#{orderedLampCodes.length + 1}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          );
        })()}

        {/* ==================== TAB 2: FIXED LOCATIONS (EMPLAÇAMENTS) ==================== */}
        {activeTab === 'LOCATIONS' && (
          <>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '9px',
                padding: '0.55rem 0.75rem',
                fontSize: '0.75rem',
                color: '#334155',
                lineHeight: 1.38
              }}
            >
              {isAllocated ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>Emplaçaments adjudicats a {partyAcronym}:</span>
                  <strong style={{ color: '#15803d', fontSize: '0.88rem' }}>{partyWonTotalLocs} / {partyLocsQuota}</strong>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.79rem' }}>
                      Quota: {partyLocsQuota} emplaçament(s)
                    </strong>
                    <span style={{
                      fontWeight: 800,
                      color: orderedLocIds.length >= partyLocsQuota && orderedLocIds.length > 0 ? '#15803d' : '#b45309'
                    }}>
                      Numerats: {orderedLocIds.length}/{locations.length}
                    </span>
                  </div>
                  <div>
                    👆 Feu clic a les xinxetes <strong>📍+</strong> del mapa (o afegiu-les aquí sota) per ordenar els emplaçaments que preferiu. Màxim <strong>1 plaça per partit</strong> a cada emplaçament.
                  </div>
                  {canEdit && orderedLocIds.length > 0 && orderedLocIds.length < partyLocsQuota && (
                    <div style={{ marginTop: '5px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '4px 7px', fontSize: '0.71rem', fontWeight: 700, color: '#b45309' }}>
                      ⚠️ Heu numerat {orderedLocIds.length} emplaçament(s) i teniu dret a {partyLocsQuota}. Numereu almenys {partyLocsQuota - orderedLocIds.length} ubicació(ns) més.
                    </div>
                  )}
                </>
              )}
            </div>

            {canEdit && locations.length > 0 && (
              <BatchOrderToolbar
                canNumberAll={unnumberedLocations.length > 0}
                canReverse={orderedLocIds.length >= 2}
                canClear={orderedLocIds.length > 0}
                primaryColor="#0f766e"
                numberAllLabel="Numerar tots"
                onNumberAll={() => saveLocationsOrder([...orderedLocIds, ...unnumberedLocations.map(l => l.id)])}
                onReverse={() => saveLocationsOrder([...orderedLocIds].reverse())}
                onClear={() => saveLocationsOrder([])}
              />
            )}

            {isAllocated ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {locations.map(loc => {
                  const winners = allocationResults?.locationAssignments?.[loc.id] || [];
                  const isMine = winners.includes(partyId);
                  return (
                    <div
                      key={loc.id}
                      style={{
                        background: isMine ? '#f0fdf4' : '#ffffff',
                        border: isMine ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.45rem 0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {loc.id} — {loc.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {loc.address} · Cap: {loc.capacity}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {isMine && <CheckCircle2 size={15} color="#16a34a" />}
                        {onFocusLocation && (
                          <button type="button" onClick={() => onFocusLocation(loc)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', cursor: 'pointer' }}>
                            <Eye size={12} color="#0369a1" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    Ordre de prioritat d&apos;emplaçaments ({orderedLocIds.length}):
                  </div>
                  {orderedLocIds.length === 0 ? (
                    <div style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', background: '#f8fafc', borderRadius: '7px', border: '1px dashed #cbd5e1' }}>
                      Cap emplaçament numerat encara. Cliqueu una xinxeta <strong>📍+</strong> al mapa o afegiu-los aquí sota.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {orderedLocIds.map((locId, idx) => {
                        const loc = locById.get(locId);
                        if (!loc) return null;
                        return (
                          <div
                            key={loc.id}
                            draggable={canEdit}
                            onDragStart={() => setDragLocIdx(idx)}
                            onDragOver={(e) => {
                              if (canEdit) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragLocIdx !== null && dragLocIdx !== idx) {
                                moveLocationInOrder(dragLocIdx, idx);
                              }
                              setDragLocIdx(null);
                            }}
                            onDragEnd={() => setDragLocIdx(null)}
                            style={{
                              background: '#ffffff',
                              border: idx < partyLocsQuota ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                              borderRadius: '7px',
                              padding: '0.38rem 0.52rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              fontSize: '0.75rem',
                              opacity: dragLocIdx === idx ? 0.5 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                              {canEdit && <GripVertical size={13} color="#94a3b8" style={{ cursor: 'grab', flexShrink: 0 }} />}
                              <span style={{
                                background: partyColor || '#0f766e',
                                color: 'white',
                                borderRadius: '999px',
                                minWidth: '22px',
                                height: '22px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                {idx + 1}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {loc.id} — {loc.name}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                  {loc.type || 'PANELL'} · Cap: {loc.capacity}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                              {onFocusLocation && (
                                <button type="button" onClick={() => onFocusLocation(loc)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', cursor: 'pointer' }} title="Centrar al mapa">
                                  <Eye size={12} color="#0369a1" />
                                </button>
                              )}
                              <a
                                href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${loc.lat},${loc.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', display: 'inline-flex', color: '#2563eb' }}
                                title="Obrir Google Street View"
                              >
                                <ExternalLink size={12} />
                              </a>
                              <RankedItemButtons
                                idx={idx}
                                total={orderedLocIds.length}
                                canEdit={canEdit}
                                onMove={moveLocationInOrder}
                                onRemove={() => saveLocationsOrder(orderedLocIds.filter(id => id !== loc.id))}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {unnumberedLocations.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Emplaçaments sense numerar ({unnumberedLocations.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {unnumberedLocations.map(loc => (
                        <div
                          key={loc.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '7px',
                            padding: '0.35rem 0.52rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                            fontSize: '0.74rem'
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {loc.id} — {loc.name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              {loc.address} · Cap: {loc.capacity}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {onFocusLocation && (
                              <button type="button" onClick={() => onFocusLocation(loc)} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '5px', padding: '2px 4px', cursor: 'pointer' }}>
                                <Eye size={12} color="#0369a1" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => saveLocationsOrder([...orderedLocIds, loc.id])}
                                style={{
                                  background: '#f0fdfa',
                                  color: '#0f766e',
                                  border: '1px solid #5eead4',
                                  borderRadius: '6px',
                                  padding: '2px 7px',
                                  fontSize: '0.71rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                              >
                                <Plus size={11} />
                                <span>#{orderedLocIds.length + 1}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom Utility Footer (Import Historical & Reset Own Selection) */}
      {canEdit && (
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexShrink: 0
          }}
        >
          {onOpenRestorePast ? (
            <button
              type="button"
              onClick={onOpenRestorePast}
              style={{
                background: 'white',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Importar preferències d'una convocatòria anterior"
            >
              <History size={13} />
              <span>Importar Històric</span>
            </button>
          ) : <span />}

          {onResetOwnPreferences && !hasNothingSelectedYet && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Segur que voleu esborrar tota la vostra selecció i ordre de lots i emplaçaments per començar de zero?')) {
                  onResetOwnPreferences();
                }
              }}
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={12} />
              <span>Reiniciar tot</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
