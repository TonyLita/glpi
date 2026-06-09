import { useEffect, useMemo, useState } from 'react';
import { getItemCount } from '../../../api/items';
import { initSession, killSession } from '../../../api/session';
import {
  DASHBOARD_ASSET_TYPES,
  DASHBOARD_TICKET_TYPES,
} from '../../../constants/selectOptions';

export default function BackofficeHome() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assetStats, setAssetStats] = useState([]);
  const [ticketStats, setTicketStats] = useState([]);

  var totalAssets = useMemo(function () {
    return assetStats.reduce(function (sum, row) { return sum + row.count; }, 0);
  }, [assetStats]);

  var totalTickets = useMemo(function () {
    return ticketStats.reduce(function (sum, row) { return sum + row.count; }, 0);
  }, [ticketStats]);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    var sessionToken = null;
    try {
      sessionToken = await initSession();

      var assetCountPromises = DASHBOARD_ASSET_TYPES.map(function (typeInfo) {
        return getItemCount(sessionToken, typeInfo.itemtype).then(function (count) {
          return {
            label: typeInfo.label,
            itemtype: typeInfo.itemtype,
            count: count,
          };
        });
      });

      var ticketCountPromises = DASHBOARD_TICKET_TYPES.map(function (typeInfo) {
        return getItemCount(sessionToken, typeInfo.itemtype).then(function (count) {
          return {
            label: typeInfo.label,
            itemtype: typeInfo.itemtype,
            count: count,
          };
        });
      });

      var [assetRows, ticketRows] = await Promise.all([
        Promise.all(assetCountPromises),
        Promise.all(ticketCountPromises),
      ]);

      setAssetStats(assetRows);
      setTicketStats(ticketRows);
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement du dashboard');
    } finally {
      if (sessionToken) {
        killSession(sessionToken);
      }
      setLoading(false);
    }
  }

  useEffect(function () {
    loadDashboard();
  }, []);

  return (
    <div className="reinit-card">
      <h2>Backoffice</h2>
      <p className="reinit-desc">
        Espace administratif protégé. Utilisez la sidebar pour accéder aux actions.
      </p>

      <div className="import-actions">
        <button className="btn btn-secondary" onClick={loadDashboard} disabled={loading}>
          {loading ? 'Chargement...' : 'Rafraichir dashboard'}
        </button>
      </div>

      {error && <div className="status-banner error">{error}</div>}

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Éléments</h3>
          <div className="dashboard-total">{totalAssets}</div>
          <div className="dashboard-subtitle">Total général</div>
          <div className="table-scroll">
            <table className="csv-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Nombre</th>
                </tr>
              </thead>
              <tbody>
                {assetStats.map(function (row) {
                  return (
                    <tr key={row.itemtype}>
                      <td>{row.label}</td>
                      <td>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Tickets</h3>
          <div className="dashboard-total">{totalTickets}</div>
          <div className="dashboard-subtitle">Total général</div>
          <div className="table-scroll">
            <table className="csv-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Nombre</th>
                </tr>
              </thead>
              <tbody>
                {ticketStats.map(function (row) {
                  return (
                    <tr key={row.itemtype}>
                      <td>{row.label}</td>
                      <td>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
