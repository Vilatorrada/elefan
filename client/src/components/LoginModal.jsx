import React, { useState } from 'react';
import { Building2, Lock, User, ShieldCheck, LogIn, Sparkles } from 'lucide-react';

export default function LoginModal({ onLogin, onDemoLogin, demoLoginEnabled, parties }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    onLogin(username, password, (errMsg) => {
      if (errMsg) setError(errMsg);
    });
  };

  const handleQuickDemo = (targetId) => {
    setError('');
    if (onDemoLogin) {
      onDemoLogin(targetId, (errMsg) => {
        if (errMsg) setError(errMsg);
      });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '480px' }}>
        <div className="modal-header" style={{ background: '#4a7729', color: 'white' }}>
          <div className="modal-title" style={{ color: 'white' }}>
            <Building2 size={22} color="#daaa00" />
            <span>Accés al Programa de Fanals i Emplaçaments</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.2rem' }}>
            Identifiqueu-vos amb les credencials proporcionades per l'Ajuntament de Sant Joan de Vilatorrada per gestionar les preferències de propaganda electoral.
          </p>

          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              border: '1px solid #fca5a5'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Usuari (Sigles del partit / Admin)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex. ERC, JUNTS, PSC, admin"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.4rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Contrasenya
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              background: '#4a7729',
              color: 'white',
              border: 'none',
              padding: '0.75rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 10px rgba(74, 119, 41, 0.3)'
            }}
          >
            <LogIn size={18} />
            <span>Iniciar Sessió</span>
          </button>

          {/* Quick Demo Access Selector (only shown when enabled by server) */}
          {demoLoginEnabled && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem' }}>
                <Sparkles size={14} color="#daaa00" />
                <span>Accés ràpid de prova (Fes clic per entrar):</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {parties && parties.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleQuickDemo(p.id)}
                    style={{
                      background: '#f1f5f9',
                      border: `1px solid ${p.color}`,
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                    {p.acronym}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleQuickDemo('ADMIN')}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#991b1b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <ShieldCheck size={13} />
                  ADMIN
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
