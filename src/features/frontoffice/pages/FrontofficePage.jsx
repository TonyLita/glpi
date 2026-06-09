import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import CreateTicketPage from '../components/CreateTicketPage';
import ElementsListPage from '../components/ElementsListPage';
import KanbanBoard from '../components/KanbanBoard';
import TicketInfoPage from '../components/TicketInfoPage';

function buildFrontofficePath(path) {
  return path ? `/frontoffice/${path}` : '/frontoffice';
}

export default function FrontofficePage() {
  return (
    <div className="frontoffice-layout">
      <nav className="frontoffice-nav">
        <NavLink to={buildFrontofficePath('create')} className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}>Créer un ticket</NavLink>
        <NavLink to={buildFrontofficePath('elements')} className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}>Mes éléments</NavLink>
        <NavLink to={buildFrontofficePath('kanban')} className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}>Kanban</NavLink>
        <NavLink to="/backoffice" className="nav-link">→ Backoffice</NavLink>
      </nav>

      <main>
        <Routes>
          <Route index element={<Navigate to="create" replace />} />
          <Route path="create"   element={<CreateTicketPage />} />
          <Route path="elements" element={<ElementsListPage />} />
          <Route path="kanban"   element={<KanbanBoard />} />
          <Route path="ticket/:ticketId" element={<TicketInfoPage />} />
        </Routes>
      </main>
    </div>
  );
}
