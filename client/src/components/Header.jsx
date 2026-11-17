import React, { useState } from 'react';
import {
  Building2,
  Info,
  Settings,
  LogOut,
  ShieldAlert,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  FileText,
  Menu,
  X
} from 'lucide-react';
import { downloadReportFile } from '../api';

export default function Header({
  user,
  role,
  electionInfo,
  onOpenInfo,
  onOpenAdmin,
  onLogout,
  partyLampsAssigned,
  partyLampsQuota,
  partyLocsAssigned,
  partyLocsQuota
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const status = electionInfo?.status || 'OPEN';

  const runAction = (fn) => {
    setMobileMenuOpen(false);
    if (fn) fn();
  };

  return (
    <header className="app-header">
      {/* Top Row: Branding + Mobile Toggle */}
      <div className="header-top-row">
        <div className="brand-badge">
          <div className="brand-crest" title="Escut de Sant Joan de Vilatorrada">
            <Building2 size={22} color="#4a7729" />
          </div>
          <div className="brand-title">
            <h1>Ajuntament de Sant Joan de Vilatorrada</h1>
            <p>{electionInfo?.title || 'Gestió i Repartiment d\'Espais de Propaganda Electoral'}</p>
          </div>
        </div>

        {user && (
          <button
            type="button"
            className="header-mobile-toggle"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Obrir o tancar menú"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            <span>{mobileMenuOpen ? 'Tancar' : 'Menú'}</span>
          </button>
        )}
      </div>

      {/* Collapsible Status + Actions Area (inline on Desktop, expandable on Mobile) */}
      {user && (
        <div className={`header-collapsible ${mobileMenuOpen ? 'open' : ''}`}>
          {/* Center: Party Status & Quota Widget */}
          {role === 'PARTY' && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.26)',
              padding: '0.35rem 0.85rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.22)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  backgroundColor: user.color || '#daaa00',
                  border: '1px solid rgba(255,255,255,0.7)',
                  display: 'inline-block'
                }} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{user.acronym}</span>
              </div>

              <div style={{ fontSize: '0.79rem', opacity: 0.96, display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <span>Fanals: </span>
                  <strong style={{ color: '#fef08a' }}>{partyLampsAssigned} / {partyLampsQuota}</strong>
                </div>
                <div>
                  <span>Emplaçaments: </span>
                  <strong style={{ color: '#fef08a' }}>{partyLocsAssigned} / {partyLocsQuota}</strong>
                </div>

                {status !== 'OPEN' && (
                  <span style={{
                    background: status === 'ALLOCATED' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.38)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.71rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {status === 'ALLOCATED' ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                    <span>{status === 'ALLOCATED' ? 'Adjudicat' : 'Selecció Tancada'}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {role === 'ADMIN' && (
            <div style={{
              background: '#b91c1c',
              color: 'white',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.79rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              alignSelf: 'flex-start'
            }}>
              <ShieldAlert size={15} />
              <span>Administració Municipal</span>
            </div>
          )}

          {/* Right: Actions */}
          <div className="header-actions">
            {role !== 'ADMIN' && (
              <button
                type="button"
                className="btn-hdr"
                onClick={() => runAction(onOpenInfo)}
                title="Candidatures registrades i quotes proporcionals"
              >
                <Info size={15} />
                <span>Quotes i Partits</span>
              </button>
            )}

            {role === 'ADMIN' && (
              <>
                <button
                  type="button"
                  className="btn-hdr btn-hdr-accent"
                  onClick={() => runAction(onOpenAdmin)}
                  title="Obrir la gestió municipal de faroles, lots, emplaçaments, partits i sorteig"
                >
                  <Settings size={15} />
                  <span>Gestió Municipal</span>
                </button>

                {/* Downloads Actions (Admin only) */}
                <button
                  type="button"
                  className="btn-hdr"
                  title="Generar i descarregar l'Acta oficial d'assignació en PDF"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    downloadReportFile('/reports/pdf', 'Assignacio_Fanals_SantJoan.pdf').catch(console.error);
                  }}
                >
                  <FileText size={14} />
                  <span>Generar Acta</span>
                </button>

                <button
                  type="button"
                  className="btn-hdr"
                  title="Exportar capa GIS GeoJSON"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    downloadReportFile('/reports/geojson', 'fanals_santjoan.geojson').catch(console.error);
                  }}
                >
                  <FileCode size={14} />
                  <span>GeoJSON</span>
                </button>

                <button
                  type="button"
                  className="btn-hdr"
                  title="Exportar taula CSV per a Excel"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    downloadReportFile('/reports/csv', 'fanals_santjoan.csv').catch(console.error);
                  }}
                >
                  <FileSpreadsheet size={14} />
                  <span>CSV</span>
                </button>
              </>
            )}

            {/* Logout */}
            <button
              type="button"
              className="btn-hdr"
              onClick={() => runAction(onLogout)}
              style={{ background: 'rgba(239, 68, 68, 0.3)', border: '1px solid rgba(252, 165, 165, 0.55)' }}
              title="Tancar sessió"
            >
              <LogOut size={15} />
              <span>Sortir</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
