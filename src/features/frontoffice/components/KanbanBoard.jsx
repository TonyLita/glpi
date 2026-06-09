import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';
import { updateTicketStatus } from '../../../api/tickets';
import { KANBAN_COLUMNS, TICKET_URGENCY_OPTIONS, TICKET_IMPACT_OPTIONS, TICKET_TYPE_OPTIONS, TICKET_STATUS_OPTIONS, ASSET_ELEMENT_TYPES } from '../../../constants/selectOptions';
import StatusChangeModal from './StatusChangeModal';
import { createTicket, linkTicketItems } from '../../../api/tickets';
import { getKanbanSettings } from '../../../api/backendApi';

function defaultDatetime() {
  return new Date().toISOString().slice(0, 16);
}

function toGlpiDatetime(dtLocal) {
  if (!dtLocal) return undefined;
  return dtLocal.replace('T', ' ') + ':00';
}

function typeLabel(value) {
  const opt = TICKET_TYPE_OPTIONS.find(o => o.value === String(value));
  return opt ? opt.label : 'N/A';
}

function urgencyLabel(value) {
  const opt = TICKET_URGENCY_OPTIONS.find(o => o.value === String(value));
  return opt ? opt.label : 'N/A';
}

function impactLabel(value) {
  const opt = TICKET_IMPACT_OPTIONS.find(o => o.value === String(value));
  return opt ? opt.label : 'N/A';
}

export default function KanbanBoard() {
  const navigate = useNavigate();
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [creatingInStatus, setCreatingInStatus] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', content: '', urgency: '3', impact: '3', type: '1', status: '1', ticketDate: defaultDatetime(), selected: [] });
  const [submitting, setSubmitting] = useState(false);
  const [kanbanElements, setKanbanElements] = useState([]);
  const [kanbanElemLoading, setKanbanElemLoading] = useState(false);
  const [kanbanElemQuery, setKanbanElemQuery] = useState('');
  const [kanbanElemTypeFilter, setKanbanElemTypeFilter] = useState('all');
  const [kanbanSettings, setKanbanSettings] = useState({});

  async function loadTickets() {
    setLoading(true);
    setError('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();
      const tickets = await listItems(sessionToken, 'Ticket');

      const grouped = {};
      for (const col of KANBAN_COLUMNS) {
        grouped[col.status] = [];
      }

      for (const ticket of tickets) {
        const status = ticket.status || 1;
        if (grouped[status] !== undefined) {
          grouped[status].push(ticket);
        }
      }

      setColumns(grouped);
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement des tickets');
      setColumns({});
    } finally {
      if (sessionToken) killSession(sessionToken);
      setLoading(false);
    }
  }

  async function loadKanbanElements() {
    setKanbanElemLoading(true);
    let sessionToken = null;
    try {
      sessionToken = await initSession();
      const pages = await Promise.all(
        ASSET_ELEMENT_TYPES.map(({ itemtype }) =>
          listItems(sessionToken, itemtype, 0, 99).then(page => ({ itemtype, page }))
        )
      );
      const rows = [];
      for (const { itemtype, page } of pages) {
        for (const item of page) {
          rows.push({
            id: item.id,
            itemtype,
            name: item.name || item.completename || '-',
            serial: item.serial || '',
          });
        }
      }
      setKanbanElements(rows);
    } catch {
      setKanbanElements([]);
    } finally {
      if (sessionToken) killSession(sessionToken);
      setKanbanElemLoading(false);
    }
  }

  function onCheckKanbanElement(item) {
    const next = [];
    let found = false;
    for (const x of createForm.selected) {
      if (x.itemtype === item.itemtype && x.id === item.id) {
        found = true;
      } else {
        next.push(x);
      }
    }
    if (!found) {
      next.push({ itemtype: item.itemtype, id: item.id, name: item.name });
    }
    setCreateForm({ ...createForm, selected: next });
  }

  useEffect(() => {
    loadTickets();
    async function loadSettings() {
      try {
        const data = await getKanbanSettings();
        const map = {};
        for (const item of data) {
          map[item.status] = item;
        }
        setKanbanSettings(map);
      } catch {
        // Use defaults if fetch fails
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (creatingInStatus !== null) {
      loadKanbanElements();
      setKanbanElemQuery('');
      setKanbanElemTypeFilter('all');
    }
  }, [creatingInStatus]);

  function onDragStart(e, ticketId, fromStatus) {
    setDraggedTicket({ id: ticketId, fromStatus });
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function onDrop(e, toStatus) {
    e.preventDefault();
    if (!draggedTicket || draggedTicket.fromStatus === toStatus) {
      setDraggedTicket(null);
      return;
    }

    if (toStatus === 5) {
      setPendingStatusChange({ ticketId: draggedTicket.id, fromStatus: draggedTicket.fromStatus, toStatus });
      setDraggedTicket(null);
    } else {
      await changeStatus(draggedTicket.id, draggedTicket.fromStatus, toStatus);
      setDraggedTicket(null);
    }
  }

  async function changeStatus(ticketId, fromStatus, toStatus) {
    try {
      let sessionToken = null;
      sessionToken = await initSession();
      await updateTicketStatus(sessionToken, ticketId, toStatus);
      if (sessionToken) killSession(sessionToken);

      const newCols = { ...columns };
      newCols[fromStatus] = newCols[fromStatus].filter(t => t.id !== ticketId);
      const ticket = columns[fromStatus].find(t => t.id === ticketId);
      if (ticket) {
        ticket.status = toStatus;
        newCols[toStatus].push(ticket);
      }
      setColumns(newCols);
    } catch (e) {
      setError(e.message || 'Erreur lors du changement de statut');
    }
  }

  async function submitTicket(status) {
    if (!createForm.name.trim() || !createForm.content.trim()) {
      setError('Le titre et la description sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();
      const created = await createTicket(sessionToken, {
        name: createForm.name.trim(),
        content: createForm.content.trim(),
        urgency: Number(createForm.urgency),
        impact: Number(createForm.impact),
        type: Number(createForm.type),
        status: status,
        date: toGlpiDatetime(createForm.ticketDate),
      });

      if (createForm.selected.length > 0) {
        try {
          await linkTicketItems(sessionToken, created.id, createForm.selected);
        } catch {
          // Erreur lien, on continue
        }
      }

      if (sessionToken) killSession(sessionToken);

      const newTicket = {
        id: created.id,
        name: createForm.name.trim(),
        content: createForm.content.trim(),
        urgency: createForm.urgency,
        impact: createForm.impact,
        type: createForm.type,
        status: status,
        date: createForm.ticketDate,
        date_creation: new Date().toISOString().split('T')[0],
      };

      const newCols = { ...columns };
      newCols[status].push(newTicket);
      setColumns(newCols);

      setCreateForm({ name: '', content: '', urgency: '3', impact: '3', type: '1', status: '1', ticketDate: defaultDatetime(), selected: [] });
      setCreatingInStatus(null);
    } catch (e) {
      setError(e.message || 'Erreur lors de la création du ticket');
    } finally {
      setSubmitting(false);
    }
  }

  function onStatusChangeConfirm() {
    setPendingStatusChange(null);
    loadTickets();
  }

  function onStatusChangeCancel() {
    setPendingStatusChange(null);
  }

  function isKanbanElemSelected(item) {
    for (const x of createForm.selected) {
      if (x.itemtype === item.itemtype && x.id === item.id) return true;
    }
    return false;
  }

  const kanbanSearch = kanbanElemQuery.toLowerCase().trim();
  const visibleKanbanElements = [];
  for (const el of kanbanElements) {
    const okType = kanbanElemTypeFilter === 'all' || el.itemtype === kanbanElemTypeFilter;
    const okSearch = !kanbanSearch || JSON.stringify(el).toLowerCase().includes(kanbanSearch);
    if (okType && okSearch) visibleKanbanElements.push(el);
  }

  return (
    <div className="reinit-card front-card-wide">
      <h2>Frontoffice - Kanban Tickets</h2>
      <p className="reinit-desc">Glissez les tickets pour changer de statut. Cliquez pour détails.</p>

      {error && <div className="status-banner error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && <p>Chargement des tickets...</p>}

      {!loading && (
        <div className="kanban-board">
          {KANBAN_COLUMNS.map(col => (
            <div key={col.status} className="kanban-column" style={{ backgroundColor: kanbanSettings[col.status]?.bgColor || '#fff' }}>
              <h3 className="kanban-header">
                {kanbanSettings[col.status]?.labelMg || col.label} ({(columns[col.status] || []).length})
                {kanbanSettings[col.status]?.labelMg && <span style={{ display: 'block', fontSize: '0.75rem', color: '#999', fontWeight: 'normal', marginTop: '0.25rem' }}>{col.label}</span>}
              </h3>

              <div
                className="kanban-drop-zone"
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, col.status)}
              >
                {(columns[col.status] || []).map(ticket => (
                  <div
                    key={ticket.id}
                    className="kanban-card"
                    draggable
                    onDragStart={e => onDragStart(e, ticket.id, col.status)}
                    onClick={() => navigate(`/frontoffice/ticket/${ticket.id}`)}
                  >
                    <div className="kanban-card-header">
                      <strong>#{ticket.id}</strong> {ticket.name}
                    </div>
                    <div className="kanban-card-body">
                      <span className="kanban-badge type">T: {typeLabel(ticket.type)}</span>
                      <span className="kanban-badge urgency">U: {urgencyLabel(ticket.urgency)}</span>
                      <span className="kanban-badge impact">I: {impactLabel(ticket.impact)}</span>
                    </div>
                  </div>
                ))}

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={() => setCreatingInStatus(col.status)}
                  disabled={creatingInStatus !== null || submitting}
                >
                  + Ajouter un ticket
                </button>
              </div>

              {creatingInStatus === col.status && (
                <div className="kanban-create-form">
                  <h4>Créer un ticket</h4>

                  <div className="form-group">
                    <label>Titre *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={createForm.name}
                      onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="Titre du ticket"
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label>Description *</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={createForm.content}
                      onChange={e => setCreateForm({ ...createForm, content: e.target.value })}
                      placeholder="Décrivez votre besoin"
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date d'ouverture</label>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={createForm.ticketDate}
                      onChange={e => setCreateForm({ ...createForm, ticketDate: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        className="form-select"
                        value={createForm.type}
                        onChange={e => setCreateForm({ ...createForm, type: e.target.value })}
                        disabled={submitting}
                      >
                        {TICKET_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Statut</label>
                      <select
                        className="form-select"
                        value={createForm.status}
                        onChange={e => setCreateForm({ ...createForm, status: e.target.value })}
                        disabled={submitting}
                      >
                        {TICKET_STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="form-group">
                      <label>Urgence</label>
                      <select
                        className="form-select"
                        value={createForm.urgency}
                        onChange={e => setCreateForm({ ...createForm, urgency: e.target.value })}
                        disabled={submitting}
                      >
                        {TICKET_URGENCY_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Impact</label>
                      <select
                        className="form-select"
                        value={createForm.impact}
                        onChange={e => setCreateForm({ ...createForm, impact: e.target.value })}
                        disabled={submitting}
                      >
                        {TICKET_IMPACT_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.5rem', borderTop: '1px solid #ddd', paddingTop: '0.5rem' }}>
                    <h5>Associer des éléments</h5>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div className="form-group">
                        <label>Type d'élément</label>
                        <select
                          className="form-select"
                          value={kanbanElemTypeFilter}
                          onChange={e => setKanbanElemTypeFilter(e.target.value)}
                          disabled={kanbanElemLoading || submitting}
                        >
                          <option value="all">Tous</option>
                          {ASSET_ELEMENT_TYPES.map(t => (
                            <option key={t.itemtype} value={t.itemtype}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Recherche</label>
                        <input
                          className="form-input"
                          type="text"
                          value={kanbanElemQuery}
                          onChange={e => setKanbanElemQuery(e.target.value)}
                          placeholder="nom, serial, id"
                          disabled={kanbanElemLoading || submitting}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                      Sélectionnés: {createForm.selected.length} | {kanbanElemLoading ? 'Chargement...' : `${visibleKanbanElements.length} élément(s)`}
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem' }}>
                      <table style={{ width: '100%', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', width: '40px' }}>✓</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Nom</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', width: '100px' }}>Serial</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleKanbanElements.map(item => (
                            <tr key={`${item.itemtype}-${item.id}`} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isKanbanElemSelected(item)}
                                  onChange={() => onCheckKanbanElement(item)}
                                  disabled={submitting}
                                />
                              </td>
                              <td style={{ padding: '0.5rem' }}>{item.id}</td>
                              <td style={{ padding: '0.5rem' }}>{item.name}</td>
                              <td style={{ padding: '0.5rem' }}>{item.serial || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => submitTicket(col.status)}
                      disabled={submitting}
                    >
                      {submitting ? 'Création...' : 'Créer'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setCreatingInStatus(null);
                        setCreateForm({ name: '', content: '', urgency: '3', impact: '3', type: '1', status: '1', ticketDate: defaultDatetime(), selected: [] });
                      }}
                      disabled={submitting}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingStatusChange && (
        <StatusChangeModal
          ticketId={pendingStatusChange.ticketId}
          onConfirm={onStatusChangeConfirm}
          onCancel={onStatusChangeCancel}
        />
      )}
    </div>
  );
}
