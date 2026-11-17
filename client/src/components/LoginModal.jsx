import React, { useState } from 'react';
import { Lock, User, ShieldCheck, LogIn, Sparkles } from 'lucide-react';

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
      <div className="login-split-card">
        {/* Left / Top Brand Showcase Column */}
        <div className="login-brand-pane">
          <div className="login-logo-showcase">
            <img src="/elefant-logo.png" alt="Logotip oficial EleFanT" />
          </div>

          <div style={{ fontSize: '2.05rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            <span style={{ color: '#fef08a' }}>Ele</span>
            <span style={{ color: '#ffffff' }}>Fan</span>
            <span style={{ color: '#fef08a' }}>T</span>
          </div>

          <div style={{
            fontSize: '0.84rem',
            color: '#f1f5f9',
            marginTop: '0.35rem',
            fontWeight: 500,
            lineHeight: 1.35
          }}>
            <strong style={{ color: '#fef08a' }}>Ele</strong>cció de{' '}
            <strong style={{ color: '#ffffff' }}>Fan</strong>als i{' '}
            <strong style={{ color: '#fef08a' }}>T</strong>aulells
          </div>

          <div style={{
            width: '48px',
            height: '2px',
            background: 'rgba(250, 204, 21, 0.55)',
            borderRadius: '999px',
            margin: '0.9rem 0 0.75rem'
          }} />

          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
            Ajuntament de Sant Joan de Vilatorrada
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.78)', marginTop: '2px' }}>
            Propaganda Electoral
          </div>
        </div>

        {/* Right / Bottom Login Form Column */}
        <form onSubmit={handleSubmit} className="login-form-pane">
          <h2 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.3rem' }}>
            Accés al sistema
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.45 }}>
            Identifiqueu-vos amb les credencials facilitades a la vostra candidatura o a l'administració municipal.
          </p>

          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '0.7rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              marginBottom: '1rem',
              border: '1px solid #fca5a5',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '0.95rem' }}>
            <label style={{ display: 'block', fontSize: '0.81rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Usuari (Sigles del partit / Admin)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex. ERC, JUNTS, PSC, admin"
                autoComplete="username"
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

          <div style={{ marginBottom: '1.3rem' }}>
            <label style={{ display: 'block', fontSize: '0.81rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Contrasenya
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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
              padding: '0.78rem',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(74, 119, 41, 0.3)'
            }}
          >
            <LogIn size={18} />
            <span>Iniciar Sessió</span>
          </button>

          {/* Quick Demo Access Selector (only shown when enabled by server) */}
          {demoLoginEnabled && (
            <div style={{ marginTop: '1.35rem', paddingTop: '1.1rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.65rem' }}>
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
                      padding: '0.32rem 0.58rem',
                      fontSize: '0.77rem',
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
                    padding: '0.32rem 0.62rem',
                    fontSize: '0.77rem',
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
