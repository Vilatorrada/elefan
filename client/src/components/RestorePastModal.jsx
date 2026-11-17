import React, { useState } from 'react';
import { History, AlertTriangle, Check, X } from 'lucide-react';

export default function RestorePastModal({ historicalElections, isSelectionOpen = true, onRestore, onClose }) {
  const entries = historicalElections ? Object.entries(historicalElections) : [];
  const firstAvailable = entries.find(([, d]) => d.hasData !== false)?.[0] || entries[0]?.[0] || '';
  const [selectedElection, setSelectedElection] = useState(firstAvailable);

  const handleConfirm = () => {
    if (selectedElection && isSelectionOpen) {
      onRestore(selectedElection);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <History size={22} color="#4a7729" />
            <span>Importar Preferències d'Eleccions Anteriors</span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.86rem', color: '#475569', marginBottom: '1rem' }}>
            Podeu recuperar l'ordre de preferències de fanals i emplaçaments que vau establir en un procés electoral anterior.
          </p>

          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.8rem',
            marginBottom: '1.2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem'
          }}>
            <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.8rem', color: '#b45309', margin: 0 }}>
              <strong>Atenció:</strong> S'importarà l'ordre d'importància de lots, de les vostres faroles (creuant per codi físic <code>AP.XX</code> i per lot) i dels emplaçaments d'aquella convocatòria, substituint la selecció actual als lots actius d'avui.
            </p>
          </div>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '0.5rem' }}>
            Seleccioneu el procés electoral anterior:
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {entries.map(([key, data]) => {
              const hasPartyData = data.hasData !== false;
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: selectedElection === key ? '2px solid #4a7729' : '1px solid #cbd5e1',
                    background: selectedElection === key ? '#f0fdf4' : 'white',
                    opacity: hasPartyData ? 1 : 0.6,
                    cursor: hasPartyData ? 'pointer' : 'not-allowed'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="radio"
                      name="historicalElection"
                      value={key}
                      disabled={!hasPartyData}
                      checked={selectedElection === key}
                      onChange={() => setSelectedElection(key)}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                        {data.title}
                      </div>
                      {data.date && (
                        <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                          {data.date}
                        </div>
                      )}
                    </div>
                  </div>
                  {!hasPartyData && (
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Sense dades del partit</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel·lar
          </button>

          <button
            disabled={!isSelectionOpen || !selectedElection}
            onClick={handleConfirm}
            style={{
              background: '#4a7729',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.2rem',
              fontWeight: 700,
              cursor: (!isSelectionOpen || !selectedElection) ? 'not-allowed' : 'pointer',
              opacity: (!isSelectionOpen || !selectedElection) ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Check size={16} />
            <span>Aplicar Selecció</span>
          </button>
        </div>
      </div>
    </div>
  );
}
