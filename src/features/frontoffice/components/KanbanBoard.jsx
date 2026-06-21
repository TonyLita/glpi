import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';
import { updateTicketStatus } from '../../../api/tickets';
import { KANBAN_COLUMNS, TICKET_URGENCY_OPTIONS, TICKET_IMPACT_OPTIONS, TICKET_TYPE_OPTIONS, TICKET_STATUS_OPTIONS, ASSET_ELEMENT_TYPES } from '../../../constants/selectOptions';
import { createTicket, linkTicketItems } from '../../../api/tickets';
import { getKanbanSettings, ajouterCoutTicket, supprimerCoutsTicket, ajouterMouvement, supprimerDernierCoutTicket } from '../../../api/backendApi';

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

function extractRefTicket(content) {
  if (!content) return null;
  const match = String(content).match(/Ref_Ticket:\s*(\S+)/);
  return match ? match[1] : null;
}

export default function KanbanBoard() {
  const navigate = useNavigate();
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [creatingInStatus, setCreatingInStatus] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', content: '', urgency: '3', impact: '3', type: '1', status: '1', ticketDate: defaultDatetime(), selected: [] });
  const [submitting, setSubmitting] = useState(false);
  const [kanbanElements, setKanbanElements] = useState([]);
  const [kanbanElemLoading, setKanbanElemLoading] = useState(false);
  const [kanbanElemQuery, setKanbanElemQuery] = useState('');
  const [kanbanElemTypeFilter, setKanbanElemTypeFilter] = useState('all');
  const [kanbanSettings, setKanbanSettings] = useState({});
  const [editingCout, setEditingCout] = useState(null);
  const [coutMontant, setCoutMontant] = useState('');
  const [submittingCout, setSubmittingCout] = useState(false);
  const [pendingDeleteCosts, setPendingDeleteCosts] = useState(null);
  const [pendingReouverture, setPendingReouverture] = useState(null);
  const [pourcentageReouverture, setPourcentageReouverture] = useState('');
  const [modeReouverture, setModeReouverture] = useState('mode1');
  const [supprimerDernierCout, setSupprimerDernierCout] = useState(false);
  const [submittingReouverture, setSubmittingReouverture] = useState(false);

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

    if (draggedTicket.fromStatus === 5 && toStatus !== 5) {
      const ticket = (columns[5] || []).find(t => t.id === draggedTicket.id);
      const ref = ticket ? extractRefTicket(ticket.content) : null;
      if (!ref) {
        setError(`Ticket #${draggedTicket.id} sans Ref_Ticket — réouverture impossible`);
        setDraggedTicket(null);
        return;
      }
      setPendingReouverture({ ticketId: ref, glpiId: draggedTicket.id, fromStatus: draggedTicket.fromStatus, toStatus });
      setPourcentageReouverture('');
      setModeReouverture('mode1');
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

  async function onDeleteCostsConfirm() {
    if (!pendingDeleteCosts) return;
    try {
      await supprimerCoutsTicket(pendingDeleteCosts.ticketId);
      await changeStatus(pendingDeleteCosts.ticketId, pendingDeleteCosts.fromStatus, pendingDeleteCosts.toStatus);
      setPendingDeleteCosts(null);
    } catch (e) {
      setError(e.message || 'Erreur lors de la suppression des coûts');
    }
  }

  function onDeleteCostsCancel() {
    setPendingDeleteCosts(null);
  }

  async function onDeleteCostsSkip() {
    if (!pendingDeleteCosts) return;
    await changeStatus(pendingDeleteCosts.ticketId, pendingDeleteCosts.fromStatus, pendingDeleteCosts.toStatus);
    setPendingDeleteCosts(null);
  }

  async function confirmerReouverture() {
    const pct = Number(pourcentageReouverture);
    if (pourcentageReouverture === '' || isNaN(pct) || pct < 0 || pct > 100) {
      setError('Pourcentage invalide (0-100)');
      return;
    }
    setSubmittingReouverture(true);
    try {
      if (supprimerDernierCout) {
        await supprimerDernierCoutTicket(pendingReouverture.ticketId);
      }
      await ajouterMouvement(pendingReouverture.ticketId, 'open', pct, modeReouverture);
      await changeStatus(pendingReouverture.glpiId, pendingReouverture.fromStatus, pendingReouverture.toStatus);
      setPendingReouverture(null);
      setPourcentageReouverture('');
      setModeReouverture('mode1');
      setSupprimerDernierCout(false);
    } catch (e) {
      setError(e.message || 'Erreur réouverture');
    } finally {
      setSubmittingReouverture(false);
    }
  }

  async function ajouterCoutFinal() {
    if (!coutMontant.trim()) {
      setError('Montant requis');
      return;
    }

    setSubmittingCout(true);
    setError('');

    try {
      const nbItems = editingCout.nbItems || 1;
      const montantParItem = Number(coutMontant) / nbItems;
      await ajouterCoutTicket(editingCout.ticketId, montantParItem);

      setEditingCout(null);
      setCoutMontant('');
      setError('');
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'ajout du coût');
    } finally {
      setSubmittingCout(false);
    }
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
                  <div key={ticket.id}>
                    <div
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
                    {col.status === 5 && creatingInStatus === null && (
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, fontSize: '0.85rem', padding: '0.25rem' }}
                          onClick={e => {
                            e.stopPropagation();
                            const ref = extractRefTicket(ticket.content);
                            if (!ref) { setError(`Ticket #${ticket.id} sans Ref_Ticket dans le contenu`); return; }
                            setEditingCout({ ticketId: ref, glpiId: ticket.id, nbItems: 1 });
                          }}
                          disabled={submittingCout}
                        >
                          + Coût supp.
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, fontSize: '0.85rem', padding: '0.25rem' }}
                          onClick={e => {
                            e.stopPropagation();
                            const ref = extractRefTicket(ticket.content);
                            if (!ref) { setError(`Ticket #${ticket.id} sans Ref_Ticket dans le contenu`); return; }
                            setPendingReouverture({ ticketId: ref, glpiId: ticket.id, fromStatus: 5, toStatus: 2 });
                            setPourcentageReouverture('');
                            setModeReouverture('mode1');
                          }}
                          disabled={submittingReouverture}
                        >
                          Réouvrir
                        </button>
                      </div>
                    )}
                    {editingCout && editingCout.glpiId === ticket.id && (
                      <div style={{ padding: '0.5rem', marginTop: '0.25rem', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Montant total (÷ {editingCout.nbItems})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={coutMontant}
                          onChange={e => setCoutMontant(e.target.value)}
                          placeholder="0.00"
                          style={{ width: '100%', marginTop: '0.25rem', marginBottom: '0.5rem', padding: '0.25rem', boxSizing: 'border-box' }}
                          disabled={submittingCout}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary"
                            onClick={ajouterCoutFinal}
                            disabled={submittingCout}
                            style={{ flex: 1, fontSize: '0.85rem', padding: '0.25rem' }}
                          >
                            {submittingCout ? 'Enreg...' : 'Enregister'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingCout(null);
                              setCoutMontant('');
                            }}
                            disabled={submittingCout}
                            style={{ flex: 1, fontSize: '0.85rem', padding: '0.25rem' }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
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

      {pendingReouverture && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', minWidth: '380px' }}>
            <h3 style={{ marginTop: 0 }}>Réouverture du ticket ref #{pendingReouverture.ticketId}</h3>
            <p style={{ color: '#666' }}>Pourcentage du coût total à ajouter lors de la réouverture:</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Pourcentage</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={pourcentageReouverture}
                  onChange={e => setPourcentageReouverture(e.target.value)}
                  placeholder="Ex: 10"
                  style={{ flex: 1, padding: '0.5rem', fontSize: '1rem' }}
                  autoFocus
                  disabled={submittingReouverture}
                />
                <span style={{ fontWeight: 'bold' }}>%</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Mode de calcul</label>
              <select
                className="form-select"
                value={modeReouverture}
                onChange={e => setModeReouverture(e.target.value)}
                disabled={submittingReouverture}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.95rem' }}
              >
                <option value="mode1">Mode 1 - Dernier coût enregistré</option>
                <option value="mode2">Mode 2 - Premier coût enregistré</option>
                <option value="mode3">Mode 3 - Moyenne des coûts</option>
                <option value="mode4">Mode 4 - Somme des coûts</option>
              </select>
            </div>
            <div style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', borderRadius: '4px', marginBottom: '1.5rem', border: '1px solid #eee' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={supprimerDernierCout}
                  onChange={e => setSupprimerDernierCout(e.target.checked)}
                  disabled={submittingReouverture}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem', color: '#333' }}>Annuler le dernier coût supplémentaire (optionnel)</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setPendingReouverture(null);
                  setPourcentageReouverture('');
                  setModeReouverture('mode1');
                  setSupprimerDernierCout(false);
                }}
                disabled={submittingReouverture}
              >
                Annuler
              </button>
              <button
                className="btn btn-secondary"
                style={{ color: '#c0392b', borderColor: '#c0392b' }}
                disabled={submittingReouverture}
                onClick={async () => {
                  setSubmittingReouverture(true);
                  try {
                    await supprimerDernierCoutTicket(pendingReouverture.ticketId); // ticketId = ref_ticket
                    setPendingReouverture(null);
                    setPourcentageReouverture('');
                    setModeReouverture('mode1');
                    setSupprimerDernierCout(false);
                  } catch (e) {
                    setError(e.message || 'Erreur annulation clôture');
                  } finally {
                    setSubmittingReouverture(false);
                  }
                }}
              >
                Annuler la clôture ⚠️
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmerReouverture}
                disabled={submittingReouverture}
              >
                {submittingReouverture ? 'Enregistrement...' : 'Confirmer réouverture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteCosts && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '500px',
          }}>
            <h3 style={{ marginTop: 0 }}>Supprimer les coûts supplémentaires?</h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Ce ticket passait du statut "Terminé" à "En cours". Voulez-vous supprimer les coûts supplémentaires associés?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={onDeleteCostsCancel}
                style={{ padding: '0.5rem 1rem' }}
              >
                Annuler
              </button>
              <button
                className="btn btn-secondary"
                onClick={onDeleteCostsSkip}
                style={{ padding: '0.5rem 1rem' }}
              >
                Garder les coûts
              </button>
              <button
                className="btn btn-primary"
                onClick={onDeleteCostsConfirm}
                style={{ padding: '0.5rem 1rem' }}
              >
                Supprimer les coûts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
