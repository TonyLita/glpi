import { useEffect, useMemo, useState } from 'react';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';
import { ASSET_ELEMENT_TYPES } from '../../../constants/selectOptions';

function typeLabel(itemtype) {
  var found = ASSET_ELEMENT_TYPES.find(function (t) { return t.itemtype === itemtype; });
  return found ? found.label : itemtype;
}

function str(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export default function ElementsListPage() {
  var [rows, setRows] = useState([]);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var [query, setQuery] = useState('');
  var [selectedType, setSelectedType] = useState('all');
  var [idFilter, setIdFilter] = useState('');
  var [serialFilter, setSerialFilter] = useState('');

  var filteredRows = useMemo(function () {
    return rows.filter(function (row) {
      if (selectedType !== 'all' && row.itemtype !== selectedType) return false;

      if (idFilter.trim()) {
        if (!str(row.id).includes(idFilter.trim())) return false;
      }

      if (serialFilter.trim()) {
        var s = (row.serial || '').toLowerCase();
        if (!s.includes(serialFilter.toLowerCase().trim())) return false;
      }

      if (query.trim()) {
        var full = JSON.stringify(row).toLowerCase();
        if (!full.includes(query.toLowerCase().trim())) return false;
      }

      return true;
    });
  }, [rows, selectedType, idFilter, serialFilter, query]);

  async function loadElements() {
    var sessionToken = null;
    setLoading(true);
    setError('');

    try {
      sessionToken = await initSession();

      var pagePromises = ASSET_ELEMENT_TYPES.map(function (current) {
        return listItems(sessionToken, current.itemtype, 0, 99).then(function (page) {
          return {
            itemtype: current.itemtype,
            rows: page,
          };
        });
      });

      var pages = await Promise.all(pagePromises);

      var all = [];
      for (var i = 0; i < pages.length; i += 1) {
        var page = pages[i];
        for (var j = 0; j < page.rows.length; j += 1) {
          var row = page.rows[j];
          all.push({
            id: row.id,
            name: row.name || row.completename || '-',
            serial: row.serial || '',
            states_id: row.states_id || '',
            itemtype: page.itemtype,
          });
        }
      }

      setRows(all);
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement des éléments');
      setRows([]);
    } finally {
      if (sessionToken) {
        killSession(sessionToken);
      }
      setLoading(false);
    }
  }

  useEffect(function () {
    loadElements();
  }, []);

  return (
    <div className="reinit-card front-card-wide">
      <h2>Frontoffice - Liste des éléments</h2>
      <p className="reinit-desc">Recherche multi-critère: type, ID, serial, texte libre.</p>

      <div className="browser-actions">
        <button className="btn btn-primary" onClick={loadElements} disabled={loading}>
          {loading ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      <div className="browser-toolbar front-filters-grid">
        <div className="form-group">
          <label htmlFor="fo-type">Type</label>
          <select
            id="fo-type"
            className="form-select"
            value={selectedType}
            onChange={function (e) { setSelectedType(e.target.value); }}
            disabled={loading}
          >
            <option value="all">Tous</option>
            {ASSET_ELEMENT_TYPES.map(function (t) {
              return <option key={t.itemtype} value={t.itemtype}>{t.label}</option>;
            })}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="fo-id">ID</label>
          <input
            id="fo-id"
            className="form-input"
            type="text"
            value={idFilter}
            onChange={function (e) { setIdFilter(e.target.value); }}
            placeholder="ex: 120"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="fo-serial">Serial</label>
          <input
            id="fo-serial"
            className="form-input"
            type="text"
            value={serialFilter}
            onChange={function (e) { setSerialFilter(e.target.value); }}
            placeholder="ex: SN-..."
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="fo-query">Recherche globale</label>
          <input
            id="fo-query"
            className="form-input"
            type="text"
            value={query}
            onChange={function (e) { setQuery(e.target.value); }}
            placeholder="nom, commentaire, etc."
            disabled={loading}
          />
        </div>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      {!loading && !error && filteredRows.length === 0 ? (
        <div className="status-banner">Aucun élément trouvé.</div>
      ) : null}

      {filteredRows.length > 0 ? (
        <div className="table-scroll">
          <table className="csv-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Type</th>
                <th>Serial</th>
                <th>State ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(function (row) {
                return (
                  <tr key={row.itemtype + '-' + row.id}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{typeLabel(row.itemtype)}</td>
                    <td>{row.serial || '-'}</td>
                    <td>{row.states_id || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
