import { useState, useRef } from 'react';
import { initSession, killSession, getAllIds, deleteItemsBatch } from '../../../api/index';
import { REINIT_TYPES } from '../../../constants/itemtypes';
import { STATUS } from '../../../constants/status';

export default function ReInitButton() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [logs, setLogs] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const logCounter = useRef(0);

  function addLog(msg, type = 'info') {
    const id = logCounter.current++;
    setLogs((prev) => [...prev, { msg, type, id }]);
  }

  async function handleReInit() {
    setConfirm(false);
    setStatus(STATUS.RUNNING);
    setLogs([]);
    let sessionToken = null;

    try {
      addLog('Ouverture de session GLPI…');
      sessionToken = await initSession();
      addLog(`Session ouverte.`, 'success');

      for (const { label, itemtype } of REINIT_TYPES) {
        addLog(`Récupération des IDs — ${label}…`);
        let ids = [];
        try {
          ids = await getAllIds(sessionToken, itemtype);
        } catch (e) {
          addLog(`${label}: erreur lors de la récupération — ${e.message}`, 'error');
          continue;
        }

        if (ids.length === 0) {
          addLog(`${label}: aucun élément à supprimer.`, 'warn');
          continue;
        }

        addLog(`${label}: suppression batch de ${ids.length} élément(s)…`);
        try {
          // DELETE /:itemtype  body: { input: [{id:1},...], force_purge: true }
          const results = await deleteItemsBatch(sessionToken, itemtype, ids);
          const ok = Array.isArray(results)
            ? results.filter((r) => Object.values(r).some((v) => v === true)).length
            : 0;
          addLog(`${label}: ${ok}/${ids.length} supprimé(s).`, ok === ids.length ? 'success' : 'warn');
        } catch (e) {
          addLog(`${label}: erreur batch — ${e.message}`, 'error');
        }
      }

      setStatus(STATUS.SUCCESS);
      addLog('Réinitialisation terminée.', 'success');
    } catch (e) {
      setStatus(STATUS.ERROR);
      addLog(`Erreur: ${e.message}`, 'error');
    } finally {
      if (sessionToken) {
        await killSession(sessionToken).catch(() => {});
        addLog('Session fermée.');
      }
    }
  }

  return (
    <div className="reinit-card">
      <h2>Réinitialisation des données GLPI</h2>
      <p className="reinit-desc">
        Suppression définitive de toutes les données GLPI.
      </p>

      {!confirm && status !== STATUS.RUNNING && (
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>
          Re_Init
        </button>
      )}

      {confirm && (
        <div className="confirm-box">
          <p>Confirmer la réinitialisation complète ?</p>
          <button className="btn btn-danger" onClick={handleReInit}>
            Oui, supprimer tout
          </button>
          <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
            Annuler
          </button>
        </div>
      )}

      {status === STATUS.RUNNING && (
        <div className="spinner-wrap">
          <span className="spinner" /> Réinitialisation en cours…
        </div>
      )}

      {logs.length > 0 && (
        <div className="log-box">
          {logs.map((l) => (
            <div key={l.id} className={`log-line log-${l.type}`}>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {status === STATUS.SUCCESS && (
        <div className="status-banner success">Réinitialisation réussie</div>
      )}
      {status === STATUS.ERROR && (
        <div className="status-banner error">Erreur lors de la réinitialisation</div>
      )}
    </div>
  );
}
