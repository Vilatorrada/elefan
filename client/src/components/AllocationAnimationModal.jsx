import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, FastForward, X, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AllocationAnimationModal({ 
  allocationResults, 
  onClose,
  onHighlightLot
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(600); // ms per step

  const logs = useMemo(() => allocationResults?.stepLogs || [], [allocationResults]);
  const totalSteps = logs.length;

  useEffect(() => {
    let timer = null;
    if (isPlaying && currentStepIndex < totalSteps - 1) {
      timer = setTimeout(() => {
        const nextIdx = currentStepIndex + 1;
        setCurrentStepIndex(nextIdx);

        // Highlight lot on map if step is ASSIGN_LOT
        const currentLog = logs[nextIdx];
        if (currentLog && currentLog.lotId) {
          onHighlightLot(currentLog.lotId);
        }

        if (nextIdx === totalSteps - 1) {
          setIsPlaying(false);
          // Trigger victory confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }, speed);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, totalSteps, speed, logs, onHighlightLot]);

  const handleJumpToEnd = () => {
    setCurrentStepIndex(totalSteps - 1);
    setIsPlaying(false);
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const currentLog = logs[currentStepIndex] || {};

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div className="modal-header" style={{ background: '#4a7729', color: 'white' }}>
          <div className="modal-title" style={{ color: 'white' }}>
            <Activity size={22} color="#daaa00" />
            <span>Resultat i Simulació del Repartiment</span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'white' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Progress Bar */}
          <div style={{ marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
              <span>{totalSteps > 0 ? `Pas ${currentStepIndex + 1} de ${totalSteps}` : 'Sense passos d\'assignació'}</span>
              <span>{totalSteps > 0 ? `${Math.round(((currentStepIndex + 1) / totalSteps) * 100)}% Completat` : '100% Completat'}</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #4a7729 0%, #daaa00 100%)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Current Active Step Box */}
          <div style={{
            background: currentLog.partyColor ? `${currentLog.partyColor}15` : '#f8fafc',
            border: `2px solid ${currentLog.partyColor || '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '1.1rem',
            marginBottom: '1.2rem',
            minHeight: '90px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {currentLog.partyColor && (
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: currentLog.partyColor,
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }} />
            )}
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', margin: 0 }}>
                {currentLog.message || 'Processant repartiment...'}
              </p>
              {currentLog.currentTotal !== undefined && (
                <span style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', display: 'block' }}>
                  Acumulat: <strong>{currentLog.currentTotal} / {currentLog.quota} fanals</strong>
                </span>
              )}
            </div>
          </div>

          {/* Log History Scroll Box */}
          <div style={{
            background: '#0f172a',
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            padding: '0.85rem',
            borderRadius: '10px',
            height: '180px',
            overflowY: 'auto'
          }}>
            {logs.slice(0, currentStepIndex + 1).map((log, idx) => (
              <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}>
                <span style={{ color: '#94a3b8' }}>[{idx + 1}]</span>{' '}
                <span style={{ color: log.partyColor || '#38bdf8' }}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: '#4a7729',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaying ? 'Pausar' : 'Reproduir'}</span>
            </button>

            <button
              onClick={handleJumpToEnd}
              style={{
                background: '#e2e8f0',
                color: '#334155',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FastForward size={16} />
              <span>Finalitzar Simulació</span>
            </button>

            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.45rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer'
              }}
              title="Velocitat de reproducció"
            >
              <option value={900}>0.7x</option>
              <option value={600}>1x</option>
              <option value={250}>2.5x</option>
              <option value={80}>Ràpid</option>
            </select>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#0f172a',
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
