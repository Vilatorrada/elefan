import React from 'react';
import { Info, CheckCircle2, Clock, X } from 'lucide-react';

export default function InfoModal({
  parties,
  allocationResults,
  electionInfo,
  onClose
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '820px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <Info size={22} color="#4a7729" />
            <span>Candidatures i Quotes Electorals</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.86rem', color: '#475569', margin: '0 0 1rem 0' }}>
            Candidatures registrades per a <strong>{electionInfo?.title}</strong>, amb vots/regidors, percentatge de representació i quotes proporcionals de fanals ({electionInfo?.totalStreetlampsAvailable ?? 0} disponibles) i emplaçaments ({electionInfo?.totalLocationsAvailable ?? 0} places).
          </p>

          <div className="admin-table-wrap" style={{ maxHeight: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Partit Polític</th>
                  <th>Regidors / Vots</th>
                  <th>% Quota</th>
                  <th>Quota Fanals</th>
                  <th>Quota Emplaçaments</th>
                  <th>Estat</th>
                </tr>
              </thead>
              <tbody>
                {(!parties || parties.length === 0) && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      Cap candidatura registrada actualment.
                    </td>
                  </tr>
                )}
                {parties && parties.map((p, idx) => {
                  const assignedLamps = allocationResults?.partyAssignedLamps ? (allocationResults.partyAssignedLamps[p.id] || 0) : 0;
                  const assignedLocs = allocationResults?.partyAssignedLocations ? (allocationResults.partyAssignedLocations[p.id] || 0) : 0;
                  const isAllocated = electionInfo?.status === 'ALLOCATED';
                  const pct = p.effectiveQuotaPct ?? p.quotaPct ?? 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700, color: '#64748b' }}>
                        {p.orderRank || idx + 1}r
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#0f172a' }}>
                          <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: p.color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }} />
                          <span>{p.name} ({p.acronym})</span>
                        </div>
                      </td>
                      <td style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                        <strong>{p.seats}</strong> reg. · {p.votes} vots
                      </td>
                      <td style={{ fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>
                        {pct}%
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {isAllocated ? `${assignedLamps} / ${p.allocatedStreetlampsQuota}` : p.allocatedStreetlampsQuota}
                      </td>
                      <td style={{ color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {isAllocated ? `${assignedLocs} / ${p.allocatedLocationsQuota}` : p.allocatedLocationsQuota}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isAllocated ? (
                          <span style={{ color: '#047857', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle2 size={15} /> Assignat
                          </span>
                        ) : (
                          <span style={{ color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={15} /> Pendent
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
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
