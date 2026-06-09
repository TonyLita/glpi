import { useEffect, useState } from 'react';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';

const PAGE_SIZE = 50;
const PREFERRED_COLS = ['id', 'name', 'status', 'date', 'date_mod'];

function ticketLabel(ticket) {
  return ticket.name || ticket.content || ticket.id || '';
}

function toDisplay(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function pickColumns(rows) {
  if (!rows.length) return [];
  const first = rows[0];
  const cols = [];
  for (const key of PREFERRED_COLS) {
    if (key in first) cols.push(key);
  }
  if (cols.length) return cols;
  return Object.keys(first).slice(0, 5);
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  // Filtrage (sans useMemo, sans .filter)
  const search = query.trim().toLowerCase();
  const filteredTickets = [];
  for (const ticket of tickets) {
    if (!search || JSON.stringify(ticket).toLowerCase().includes(search)) {
      filteredTickets.push(ticket);
    }
  }

  // Ticket sélectionné
  let selectedTicket = null;
  for (const t of tickets) {
    if (t.id === selectedId) {
      selectedTicket = t;
      break;
    }
  }

  const tableColumns = pickColumns(filteredTickets);

  async function loadTickets() {
    let sessionToken = null;
    setLoading(true);
    setError('');

    try {
      sessionToken = await initSession();
      const rows = await listItems(sessionToken, 'Ticket', 0, PAGE_SIZE - 1);
      setTickets(rows);
      setSelectedId(rows.length > 0 ? rows[0].id : null);
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement des tickets');
      setTickets([]);
      setSelectedId(null);
    } finally {
      if (sessionToken) await killSession(sessionToken).catch(() => {});
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  return (
    <div className="reinit-card tickets-page">
      <h2>Tickets</h2>
      <p className="reinit-desc">Liste des tickets GLPI avec fiche détaillée.</p>

      <div className="browser-actions">
        <button className="btn btn-primary" onClick={loadTickets} disabled={loading}>
          {loading ? 'Chargement...' : 'Rafraîchir'}
        </button>
        <input
          className="form-input tickets-search"
          type="text"
          placeholder="Filtrer les tickets"
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && <div className="status-banner error">{error}</div>}

      {!loading && !error && filteredTickets.length === 0 && (
        <div className="status-banner">Aucun ticket trouvé.</div>
      )}

      <div className="tickets-layout">
        {/* --- Liste des tickets --- */}
        <section className="tickets-panel">
          <h3>Liste</h3>
          <div className="table-scroll">
            <table className="csv-table">
              <thead>
                <tr>
                  {tableColumns.map(col => <th key={col}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    className={'ticket-row' + (selectedId === ticket.id ? ' active' : '')}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    {tableColumns.map(col => (
                      <td key={col}>{toDisplay(ticket[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Fiche détaillée --- */}
        <section className="tickets-panel">
          <h3>Fiche ticket</h3>
          {!selectedTicket ? (
            <div className="status-banner">Sélectionnez un ticket dans la liste.</div>
          ) : (
            <div className="ticket-fiche">
              <div className="ticket-fiche-title">
                #{selectedTicket.id} - {ticketLabel(selectedTicket)}
              </div>
              <div className="ticket-fiche-grid">
                {Object.keys(selectedTicket).map(key => (
                  <div className="ticket-fiche-row" key={key}>
                    <div className="ticket-fiche-key">{key}</div>
                    <div className="ticket-fiche-value">{toDisplay(selectedTicket[key])}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
