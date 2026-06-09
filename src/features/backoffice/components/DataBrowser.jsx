import { useState } from 'react';
import { initSession, killSession, listItems } from '../../../api/glpi';
import { BROWSER_ITEM_TYPES } from '../../../constants/selectOptions';

const PAGE_SIZE = 20;

function pickDisplay(item) {
  return item.name || item.completename || item.comment || item.id || '';
}

export default function DataBrowser() {
  const [itemtype, setItemtype] = useState('Computer');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadData(nextPage) {
    setLoading(true);
    setError('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();
      const start = nextPage * PAGE_SIZE;
      const data = await listItems(sessionToken, itemtype, start, start + PAGE_SIZE - 1);
      setRows(data);
      setPage(nextPage);
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement.');
      setRows([]);
    } finally {
      if (sessionToken) await killSession(sessionToken).catch(() => {});
      setLoading(false);
    }
  }

  // Filtrage (sans .filter)
  const search = query.trim().toLowerCase();
  const filtered = [];
  for (const item of rows) {
    if (!search || JSON.stringify(item).toLowerCase().includes(search)) {
      filtered.push(item);
    }
  }

  // Colonnes affichables (sans .filter)
  const columns = [];
  if (filtered.length > 0) {
    const first = filtered[0];
    for (const key of Object.keys(first)) {
      const v = first[key];
      if (typeof v !== 'object' || v === null) columns.push(key);
    }
  }

  function exportJson() {
    if (!filtered.length) return;
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${itemtype.toLowerCase()}-page-${page + 1}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="reinit-card">
      <h2>Consultation des données GLPI</h2>
      <p className="reinit-desc">Chargez les données d'un itemtype depuis l'API principale, page par page.</p>

      <div className="browser-toolbar">
        <div className="form-group">
          <label htmlFor="browser-itemtype">Type d'objet</label>
          <select
            id="browser-itemtype"
            className="form-select"
            value={itemtype}
            onChange={e => setItemtype(e.target.value)}
            disabled={loading}
          >
            {BROWSER_ITEM_TYPES.map(t => (
              <option key={t.itemtype} value={t.itemtype}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="browser-query">Filtre local</label>
          <input
            id="browser-query"
            className="form-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nom, id, commentaire..."
            disabled={loading}
          />
        </div>
      </div>

      <div className="browser-actions">
        <button className="btn btn-primary" onClick={() => loadData(0)} disabled={loading}>
          Charger
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => loadData(Math.max(0, page - 1))}
          disabled={loading || page === 0}
        >
          Page précédente
        </button>
        <button className="btn btn-secondary" onClick={() => loadData(page + 1)} disabled={loading}>
          Page suivante
        </button>
        <button
          className="btn btn-secondary"
          onClick={exportJson}
          disabled={loading || !filtered.length}
        >
          Export JSON
        </button>
        <span className="browser-page">Page {page + 1}</span>
      </div>

      {loading && (
        <div className="spinner-wrap">
          <span className="spinner" /> Chargement en cours...
        </div>
      )}

      {error && <div className="status-banner error">{error}</div>}

      {!loading && filtered.length > 0 && (
        <div className="csv-preview">
          <p className="preview-label">{filtered.length} résultat(s) affiché(s)</p>
          <div className="table-scroll">
            <table className="csv-table">
              <thead>
                <tr>
                  {columns.map(c => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={(item.id || pickDisplay(item) || 'row') + '-' + idx}>
                    {columns.map(c => <td key={c}>{String(item[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="status-banner">Aucune donnée chargée.</div>
      )}
    </div>
  );
}
