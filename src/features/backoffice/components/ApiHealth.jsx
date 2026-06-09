import { useState } from 'react';
import { initSession, killSession } from '../../../api/glpi';

const STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
};

export default function ApiHealth() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState('Prêt à tester la connexion API.');

  async function runHealthCheck() {
    setStatus(STATUS.RUNNING);
    setMessage('Test en cours...');

    var sessionToken = null;
    try {
      sessionToken = await initSession();
      setStatus(STATUS.SUCCESS);
      setMessage('Connexion API OK. Session ouverte puis fermée avec succès.');
    } catch (e) {
      setStatus(STATUS.ERROR);
      setMessage('Erreur API: ' + (e.message || 'échec de connexion'));
    } finally {
      if (sessionToken) {
        await killSession(sessionToken).catch(function () {});
      }
    }
  }

  return (
    <div className="reinit-card">
      <h2>Test connexion API</h2>
      <p className="reinit-desc">
        Vérifie l'accès à l'API GLPI du projet principal via initSession et killSession.
      </p>

      <div className="browser-actions">
        <button className="btn btn-primary" onClick={runHealthCheck} disabled={status === STATUS.RUNNING}>
          Tester la connexion
        </button>
      </div>

      {status === STATUS.RUNNING && (
        <div className="spinner-wrap">
          <span className="spinner" /> Test en cours...
        </div>
      )}

      {status === STATUS.SUCCESS && <div className="status-banner success">{message}</div>}
      {status === STATUS.ERROR && <div className="status-banner error">{message}</div>}
      {status === STATUS.IDLE && <div className="status-banner">{message}</div>}
    </div>
  );
}
