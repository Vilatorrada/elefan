import React from 'react';
import { Lightbulb, Edit2, Trash2, X } from 'lucide-react';
import { isLampNoApta, isLampSelected } from '../utils';

export default function LotSelectionModal({
  lot,
  role,
  electionStatus = 'OPEN',
  allocationResults,
  parties = [],
  onToggleLampSuitability,
  onEditLotOnMap,
  onDeleteLot,
  onClose
}) {
  if (!lot) return null;

  const isAllocated = electionStatus === 'ALLOCATED';
  const lotLampMap = allocationResults?.lotLampAssignments?.[lot.id] || {};

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title">
            <Lightbulb size={22} color="#4a7729" />
            <span>Fitxa del {lot.id}</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <div className="modal-body">
          <div style={{
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.3rem' }}>{lot.name}</h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.6rem' }}>
              Ubicació: <strong>{lot.street}</strong> | Faroles del lot:{' '}
              <strong style={{ color: '#4a7729' }}>{lot.lampCount} faroles seleccionades</strong>
            </p>

            {/* Proportional Quotas per Party inside this Lot */}
            {!lot.reserved && lot.lampCount > 0 && parties.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Repartiment proporcional de quotes en aquest lot ({lot.lampCount} fanals):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {parties.map(p => {
                    const minQ = Number(lot.partyMinQuotas?.[p.id] ?? lot.partyQuotas?.[p.id] ?? 0);
                    const maxQ = Number(lot.partyMaxQuotas?.[p.id] ?? lot.partyQuotas?.[p.id] ?? minQ);
                    const resQ = Number(allocationResults?.resolvedLotQuotas?.[lot.id]?.[p.id] ?? lot.partyQuotas?.[p.id] ?? minQ);
                    const won = Number(allocationResults?.lotPartyCounts?.[lot.id]?.[p.id]) || 0;
                    const rangeLabel = minQ === maxQ ? `${minQ}` : `${minQ}–${maxQ}`;
                    return (
                      <span
                        key={p.id}
                        style={{
                          background: 'white',
                          border: `1.5px solid ${p.color}`,
                          borderRadius: '999px',
                          padding: '2px 9px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                        <span>{p.acronym}:</span>
                        <strong>{isAllocated ? `${won}/${resQ}` : rangeLabel}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Streetlamps list */}
            {lot.lamps && lot.lamps.length > 0 && (
              <div style={{ maxHeight: '240px', overflowY: 'auto', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lot.lamps.map((lamp, idx) => {
                  const isLockedUnsuitable = isLampNoApta(lamp);
                  const lampSelected = isLampSelected(lamp);
                  const winnerId = lotLampMap[lamp.codi] || allocationResults?.lampAssignments?.[lamp.codi] || null;
                  const winnerParty = winnerId ? parties.find(p => p.id === winnerId) : null;

                  return (
                    <div
                      key={lamp.codi || idx}
                      style={{
                        background: lampSelected ? '#f0fdf4' : (isLockedUnsuitable ? '#fef2f2' : '#f8fafc'),
                        border: `1px solid ${lampSelected ? '#86efac' : (isLockedUnsuitable ? '#fca5a5' : '#cbd5e1')}`,
                        padding: '5px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        fontSize: '0.76rem'
                      }}
                    >
                      <div>
                        <strong>{lamp.codi}</strong> ({lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n'}) — <span>{lamp.suport}</span>
                        {winnerParty && (
                          <span
                            style={{
                              marginLeft: '6px',
                              background: winnerParty.color,
                              color: 'white',
                              borderRadius: '999px',
                              padding: '1px 7px',
                              fontSize: '0.68rem',
                              fontWeight: 800
                            }}
                          >
                            {winnerParty.acronym}
                          </span>
                        )}
                      </div>

                      {role === 'ADMIN' && !isLockedUnsuitable ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (lot.lamps.length <= 1) {
                              if (!window.confirm(`Si desmarqueu com a Seleccionada l'última farola del ${lot.id}, el lot s'eliminarà. Voleu continuar?`)) {
                                return;
                              }
                            }
                            if (onToggleLampSuitability) onToggleLampSuitability(lot.id, lamp.codi, false);
                            if (lot.lamps.length <= 1) onClose();
                          }}
                          style={{
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fcd34d',
                            borderRadius: '5px',
                            padding: '2px 7px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.72rem'
                          }}
                          title="Desmarca aquesta farola com a Seleccionada i la retira del lot"
                        >
                          ⚪ Desmarcar com a Seleccionada
                        </button>
                      ) : (
                        <span style={{
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '0.72rem'
                        }}>
                          ✔ SELECCIONADA
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: role === 'ADMIN' ? 'space-between' : 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
          {role === 'ADMIN' && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {onEditLotOnMap && (
                <button
                  type="button"
                  onClick={() => {
                    onEditLotOnMap(lot);
                    onClose();
                  }}
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
                    gap: '5px'
                  }}
                >
                  <Edit2 size={14} />
                  <span>Editar Lot al Mapa</span>
                </button>
              )}
              {onDeleteLot && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Segur que voleu eliminar el ${lot.id} (${lot.name})? Les faroles es mantindran a l'inventari.`)) {
                      onDeleteLot(lot.id);
                      onClose();
                    }
                  }}
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '0.55rem 0.9rem',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Eliminar Lot</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#4a7729',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.2rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Tancar
          </button>
        </div>
      </div>
    </div>
  );
}
