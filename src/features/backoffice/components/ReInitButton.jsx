import { useState, useRef } from 'react';
import { initSession, killSession, getAllIds, deleteItemsBatch, deleteUsersExcludingSystem } from '../../../api/index';
import { cleanupDatabase } from '../../../api/backendApi';
import { REINIT_TYPES } from '../../../constants/itemtypes';
import { STATUS } from '../../../constants/status';

export default function ReInitButton() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [logs, setLogs] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
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
        // User = traitement spécial (exclut users système)
        if (itemtype === 'User') {
          addLog(`${label}: recherche des utilisateurs NON-système…`);
          try {
            addLog(`${label}: ⚠️ Protection users système [1,2,3,4,5,6]`);
            const deleted = await deleteUsersExcludingSystem(sessionToken);
            if (deleted === 0) {
              addLog(`${label}: aucun utilisateur à supprimer (seulement users système).`, 'warn');
            } else {
              addLog(`${label}: ${deleted} utilisateur(s) supprimé(s).`, 'success');
            }
          } catch (e) {
            addLog(`${label}: erreur — ${e.message}`, 'error');
          }
          continue;
        }

        // Autres itemtypes
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

  async function handleCleanupDB() {
    setConfirmCleanup(false);
    setStatus(STATUS.RUNNING);
    setLogs([]);

    try {
      addLog('Nettoyage de la base de données SQLite…');
      const result = await cleanupDatabase();
      addLog(result.message || 'Nettoyage réussi', 'success');
      setStatus(STATUS.SUCCESS);
      addLog('Nettoyage terminé.', 'success');
    } catch (e) {
      setStatus(STATUS.ERROR);
      addLog(`Erreur: ${e.message}`, 'error');
    }
  }

  return (
    <div className="reinit-card">
      <h2>Réinitialisation des données GLPI</h2>
      <p className="reinit-desc">
        Suppression définitive de toutes les données GLPI.
      </p>

      {!confirm && !confirmCleanup && status !== STATUS.RUNNING && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-danger" onClick={() => setConfirm(true)}>
            Re_Init
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmCleanup(true)}>
            Nettoyer SQLite
          </button>
        </div>
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

      {confirmCleanup && (
        <div className="confirm-box">
          <p>Supprimer tout les coûts et réouvertures SQLite ?</p>
          <button className="btn btn-danger" onClick={handleCleanupDB}>
            Oui, nettoyer
          </button>
          <button className="btn btn-secondary" onClick={() => setConfirmCleanup(false)}>
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
