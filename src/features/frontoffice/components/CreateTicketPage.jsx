import { useEffect, useState } from 'react';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';
import { createTicket, linkTicketItems } from '../../../api/tickets';
import {
  ASSET_ELEMENT_TYPES,
  TICKET_IMPACT_OPTIONS,
  TICKET_URGENCY_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from '../../../constants/selectOptions';

function defaultDatetime() {
  return new Date().toISOString().slice(0, 16);
}

function toGlpiDatetime(dtLocal) {
  if (!dtLocal) return undefined;
  return dtLocal.replace('T', ' ') + ':00';
}

function typeLabel(itemtype) {
  for (const t of ASSET_ELEMENT_TYPES) {
    if (t.itemtype === itemtype) return t.label;
  }
  return itemtype;
}

function isSelected(list, item) {
  for (const x of list) {
    if (x.itemtype === item.itemtype && x.id === item.id) return true;
  }
  return false;
}

export default function CreateTicketPage() {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [urgency, setUrgency] = useState('3');
  const [impact, setImpact] = useState('3');
  const [type, setType] = useState('1');
  const [status, setStatus] = useState('1');
  const [ticketDate, setTicketDate] = useState(defaultDatetime());
  const [elements, setElements] = useState([]);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loadingElements, setLoadingElements] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Construction de la liste visible (sans .filter)
  const search = query.toLowerCase().trim();
  const visibleElements = [];
  for (const el of elements) {
    const okType = typeFilter === 'all' || el.itemtype === typeFilter;
    const okSearch = !search || JSON.stringify(el).toLowerCase().includes(search);
    if (okType && okSearch) visibleElements.push(el);
  }

  async function loadElements() {
    setLoadingElements(true);
    setError('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();

      const pagePromises = ASSET_ELEMENT_TYPES.map(({ itemtype }) =>
        listItems(sessionToken, itemtype, 0, 99).then(page => ({
          itemtype,
          page,
        }))
      );

      const pages = await Promise.all(pagePromises);
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

      setElements(rows);
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement des éléments');
      setElements([]);
    } finally {
      if (sessionToken) killSession(sessionToken);
      setLoadingElements(false);
    }
  }

  useEffect(() => { loadElements(); }, []);

  // Ajoute ou retire un élément (sans fonction "toggle")
  function onCheckElement(item) {
    const next = [];
    let found = false;

    for (const x of selected) {
      if (x.itemtype === item.itemtype && x.id === item.id) {
        found = true; // on ne le remet pas → il est retiré
      } else {
        next.push(x);
      }
    }

    if (!found) {
      next.push({ itemtype: item.itemtype, id: item.id, name: item.name });
    }

    setSelected(next);
  }

  async function submitTicket() {
    if (!name.trim() || !content.trim()) {
      setError('Le titre et la description sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();
      const created = await createTicket(sessionToken, {
        name: name.trim(),
        content: content.trim(),
        urgency: Number(urgency),
        impact: Number(impact),
        type: Number(type),
        status: Number(status),
        date: toGlpiDatetime(ticketDate),
      });

      let warning = '';
      if (selected.length > 0) {
        try {
          await linkTicketItems(sessionToken, created.id, selected);
        } catch {
          warning = ' Ticket créé, mais association des éléments en échec.';
        }
      }

      setSuccess(`Ticket #${created.id} créé avec succès.${warning}`);
      setName('');
      setContent('');
      setTicketDate(defaultDatetime());
      setType('1');
      setStatus('1');
      setSelected([]);
    } catch (e) {
      setError(e.message || 'Erreur lors de la création du ticket');
    } finally {
      if (sessionToken) killSession(sessionToken);
      setSubmitting(false);
    }
  }

  return (
    <div className="reinit-card front-card-wide">
      <h2>Frontoffice - Créer un ticket</h2>
      <p className="reinit-desc">Créer un ticket et associer plusieurs éléments.</p>

      <div className="import-controls">
        <div className="form-group">
          <label htmlFor="ticket-title">Titre</label>
          <input
            id="ticket-title"
            className="form-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Titre du ticket"
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ticket-content">Description</label>
          <textarea
            id="ticket-content"
            className="form-input"
            rows={4}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Décrivez votre besoin"
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ticket-date">Date d'ouverture</label>
          <input
            id="ticket-date"
            className="form-input"
            type="datetime-local"
            value={ticketDate}
            onChange={e => setTicketDate(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="front-inline-grid">
          <div className="form-group">
            <label htmlFor="ticket-type">Type</label>
            <select
              id="ticket-type"
              className="form-select"
              value={type}
              onChange={e => setType(e.target.value)}
              disabled={submitting}
            >
              {TICKET_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="ticket-status">Statut</label>
            <select
              id="ticket-status"
              className="form-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
              disabled={submitting}
            >
              {TICKET_STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="front-inline-grid">
          <div className="form-group">
            <label htmlFor="ticket-urgency">Urgence</label>
            <select
              id="ticket-urgency"
              className="form-select"
              value={urgency}
              onChange={e => setUrgency(e.target.value)}
              disabled={submitting}
            >
              {TICKET_URGENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="ticket-impact">Impact</label>
            <select
              id="ticket-impact"
              className="form-select"
              value={impact}
              onChange={e => setImpact(e.target.value)}
              disabled={submitting}
            >
              {TICKET_IMPACT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <h3>Associer des éléments</h3>

      <div className="browser-toolbar front-filters-grid">
        <div className="form-group">
          <label htmlFor="elem-type">Type</label>
          <select
            id="elem-type"
            className="form-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            disabled={loadingElements || submitting}
          >
            <option value="all">Tous</option>
            {ASSET_ELEMENT_TYPES.map(t => (
              <option key={t.itemtype} value={t.itemtype}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="elem-search">Recherche</label>
          <input
            id="elem-search"
            className="form-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="nom, serial, id"
            disabled={loadingElements || submitting}
          />
        </div>
      </div>

      <div className="browser-actions">
        <button
          className="btn btn-secondary"
          onClick={loadElements}
          disabled={loadingElements || submitting}
        >
          {loadingElements ? 'Chargement...' : 'Rafraîchir les éléments'}
        </button>
        <span className="browser-page">Sélectionnés: {selected.length}</span>
      </div>

      <div className="table-scroll">
        <table className="csv-table">
          <thead>
            <tr>
              <th>Choix</th>
              <th>ID</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Serial</th>
            </tr>
          </thead>
          <tbody>
            {visibleElements.map(item => (
              <tr key={`${item.itemtype}-${item.id}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected(selected, item)}
                    onChange={() => onCheckElement(item)}
                    disabled={submitting}
                  />
                </td>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td>{typeLabel(item.itemtype)}</td>
                <td>{item.serial || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      <div className="import-actions" style={{ marginTop: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={submitTicket}
          disabled={submitting}
        >
          {submitting ? 'Création...' : 'Créer le ticket'}
        </button>
      </div>
    </div>
  );
}
