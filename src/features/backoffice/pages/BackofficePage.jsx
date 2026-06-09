import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  Activity, ClipboardList, Database, FilePlus2, Home, LogOut,
  RotateCcw, ServerCrash, Settings, Ticket, Upload,
} from 'lucide-react';

import BackofficeHome from '../components/BackofficeHome';
import BulkImport from '../components/BulkImport';
import ReInitButton from '../components/ReInitButton';
import ReInitV2Button from '../components/ReInitV2Button';
import CsvImport from '../components/CsvImport';
import DataBrowser from '../components/DataBrowser';
import ApiHealth from '../components/ApiHealth';
import TicketsPage from '../components/TicketsPage';
import KanbanSettingsPage from '../components/KanbanSettingsPage';

const BACKOFFICE_CODE = import.meta.env.VITE_BACKOFFICE_CODE || 'GLPI-BO-2026';
const AUTH_KEY = 'glpi_backoffice_unlocked';

const NAV_ITEMS = [
  { path: '',            label: 'Backoffice',          Icon: Home,        end: true },
  { path: 'tickets',     label: 'Tickets',             Icon: Ticket },
  { path: 'reinit',      label: 'Réinitialisation',    Icon: ServerCrash },
  { path: 'reinit-v2',   label: 'Réinitialisation v2', Icon: RotateCcw },
  { path: 'import',      label: 'Import CSV',          Icon: FilePlus2 },
  { path: 'browse',      label: 'Consultation',        Icon: Database },
  { path: 'api',         label: 'Test API',            Icon: Activity },
  { path: 'bulk-import', label: 'Import groupé',       Icon: Upload },
  { path: 'kanban-settings', label: 'Personnalisation Kanban', Icon: Settings },
];

function buildBackofficePath(path) {
  return path ? `/backoffice/${path}` : '/backoffice';
}

export default function BackofficePage() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === '1'
  );
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  function handleUnlock(e) {
    e.preventDefault();
    if (code.trim() === BACKOFFICE_CODE) {
      sessionStorage.setItem(AUTH_KEY, '1');
      setAuthError('');
      setCode('');
      setShowCode(false);
      setUnlocked(true);
    } else {
      setAuthError('Code invalide.');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(AUTH_KEY);
    setCode('');
    setShowCode(false);
    setAuthError('');
    setUnlocked(false);
    navigate('/frontoffice');
  }

  if (!unlocked) {
    return (
      <div className="auth-screen">
        <form onSubmit={handleUnlock} className="auth-card">
          <h1>Accès Backoffice</h1>
          <p>Entrez le code unique pour accéder aux pages d'administration.</p>

          <div className="form-group">
            <label htmlFor="backoffice-code">Code unique</label>
            <input
              id="backoffice-code"
              type={showCode ? 'text' : 'password'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code d'accès"
              className="form-input"
              autoComplete="off"
              autoFocus
            />
            <div className="import-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCode((v) => !v)}
              >
                {showCode ? 'Masquer le code' : 'Afficher le code'}
              </button>
            </div>
          </div>

          {authError && <div className="status-banner error">{authError}</div>}

          <div className="import-actions">
            <button className="btn btn-primary" type="submit">Déverrouiller</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="backoffice-layout">
      <aside className="backoffice-sidebar">
        <nav>
          {NAV_ITEMS.map(({ path, label, Icon, end }) => (
            <NavLink
              key={path || 'home'}
              to={buildBackofficePath(path)}
              end={end}
              className={({ isActive }) =>
                'nav-link' + (isActive ? ' nav-link-active' : '')
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary" onClick={handleLogout}>
          <LogOut size={16} /> Quitter
        </button>
      </aside>

      <main className="backoffice-main">
        <Routes>
          <Route index element={<BackofficeHome />} />
          <Route path="tickets"     element={<TicketsPage />} />
          <Route path="reinit"      element={<ReInitButton />} />
          <Route path="reinit-v2"   element={<ReInitV2Button />} />
          <Route path="import"      element={<CsvImport />} />
          <Route path="browse"      element={<DataBrowser />} />
          <Route path="api"         element={<ApiHealth />} />
          <Route path="bulk-import" element={<BulkImport />} />
          <Route path="kanban-settings" element={<KanbanSettingsPage />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </main>
    </div>
  );
}
