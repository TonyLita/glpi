import { useRef, useState } from 'react';
import { REINIT_TYPES } from '../../../constants/itemtypes';
import { STATUS } from '../../../constants/status';
import { getTokenV2, listItemsV2, deleteItemV2 } from '../../../api/v2';

const STEPS = {
  CREDS: 'creds',
  TOKEN_OK: 'token_ok',
  CONFIRM: 'confirm',
  RUNNING: 'running',
  DONE: 'done',
};

export default function ReInitV2Button() {
  const [step, setStep] = useState(STEPS.CREDS);
  const [result, setResult] = useState(null); // 'success' | 'error'
  const [logs, setLogs] = useState([]);
  const [oauthToken, setOauthToken] = useState('');

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [glpiUser, setGlpiUser] = useState('glpi');
  const [glpiPass, setGlpiPass] = useState('');

  const logCounter = useRef(0);
  const running = step === STEPS.RUNNING;

  function addLog(msg, type) {
    var id = logCounter.current++;
    setLogs(function (prev) { return [...prev, { msg: msg, type: type || 'info', id: id }]; });
  }

  async function handleGetToken() {
    if (!clientId.trim() || !clientSecret.trim() || !glpiUser.trim() || !glpiPass.trim()) {
      addLog('Tous les champs sont requis pour obtenir le token.', 'error');
      return;
    }
    setLogs([]);
    addLog('Obtention du token OAuth v2...', 'info');
    try {
      var token = await getTokenV2(clientId.trim(), clientSecret.trim(), glpiUser.trim(), glpiPass.trim());
      setOauthToken(token);
      setStep(STEPS.TOKEN_OK);
      addLog('Token obtenu. Prêt pour la réinitialisation.', 'success');
    } catch (e) {
      addLog('Erreur token: ' + e.message, 'error');
    }
  }

  async function handleReInitV2() {
    setStep(STEPS.RUNNING);
    setResult(null);

    try {
      for (const typeInfo of REINIT_TYPES) {
        var label = typeInfo.label;
        var itemtype = typeInfo.itemtype;

        addLog(label + ': récupération...', 'info');
        var items = await listItemsV2(oauthToken, itemtype);

        if (!items.length) {
          addLog(label + ': aucun élément.', 'warn');
          continue;
        }

        addLog(label + ': ' + items.length + ' élément(s) trouvé(s).', 'info');

        var ok = 0;
        var ko = 0;
        for (const item of items) {
          if (!item || item.id == null) continue;
          try {
            var deleted = await deleteItemV2(oauthToken, itemtype, item.id);
            if (deleted) ok++; else ko++;
          } catch (err) {
            ko++;
            addLog(label + ' #' + item.id + ': ' + err.message, 'error');
          }
        }
        addLog(label + ': ' + ok + ' supprimé(s), ' + ko + ' erreur(s).', ko ? 'warn' : 'success');
      }

      setResult('success');
      addLog('Réinitialisation V2 terminée.', 'success');
    } catch (e) {
      setResult('error');
      addLog('Erreur: ' + e.message, 'error');
    }
    setStep(STEPS.DONE);
  }

  function handleReset() {
    setStep(STEPS.CREDS);
    setResult(null);
    setLogs([]);
    setOauthToken('');
    setGlpiPass('');
  }

  return (
    <div className="reinit-card">
      <h2>Réinitialisation de base (API v2)</h2>
      <p className="reinit-desc">
        Utilise la HL API v2 (OAuth + JWT). Remplis les identifiants OAuth pour obtenir un token, puis lance la suppression.
      </p>

      {/* Etape 1 : Formulaire d'identifiants */}
      {(step === STEPS.CREDS || step === STEPS.TOKEN_OK) && (
        <div className="import-controls">
          <div className="browser-toolbar">
            <div className="form-group">
              <label>Client ID (fiche OAuth GLPI)</label>
              <input
                className="form-input"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="ex: a1b2c3d4e5..."
                disabled={running || step === STEPS.TOKEN_OK}
              />
            </div>
            <div className="form-group">
              <label>Client Secret</label>
              <input
                className="form-input"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="ex: 81a787..."
                disabled={running || step === STEPS.TOKEN_OK}
              />
            </div>
            <div className="form-group">
              <label>Login GLPI</label>
              <input
                className="form-input"
                type="text"
                value={glpiUser}
                onChange={(e) => setGlpiUser(e.target.value)}
                disabled={running || step === STEPS.TOKEN_OK}
              />
            </div>
            <div className="form-group">
              <label>Mot de passe GLPI</label>
              <input
                className="form-input"
                type="password"
                value={glpiPass}
                onChange={(e) => setGlpiPass(e.target.value)}
                placeholder="glpi"
                disabled={running || step === STEPS.TOKEN_OK}
              />
            </div>
          </div>

          {step === STEPS.CREDS && (
            <div className="import-actions">
              <button className="btn btn-primary" onClick={handleGetToken}>
                Obtenir le token JWT
              </button>
            </div>
          )}

          {step === STEPS.TOKEN_OK && (
            <div className="import-actions">
              <span style={{ color: '#2f9e44', fontWeight: 600, fontSize: '0.9rem' }}>Token valide</span>
              <button className="btn btn-danger" onClick={() => setStep(STEPS.CONFIRM)}>
                Lancer la reinit V2
              </button>
              <button className="btn btn-secondary" onClick={handleReset}>
                Recommencer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Etape 2 : Confirmation */}
      {step === STEPS.CONFIRM && (
        <div className="confirm-box">
          <p>Supprimer tous les elements GLPI via API v2 ? Cette action est irreversible.</p>
          <button className="btn btn-danger" onClick={handleReInitV2}>
            Oui, supprimer tout
          </button>
          <button className="btn btn-secondary" onClick={() => setStep(STEPS.TOKEN_OK)}>
            Annuler
          </button>
        </div>
      )}

      {/* Spinner */}
      {step === STEPS.RUNNING && (
        <div className="spinner-wrap">
          <span className="spinner" /> Reinitialisation V2 en cours...
        </div>
      )}

      {/* Etape 3 : Résultat final */}
      {step === STEPS.DONE && (
        <div className="import-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            Recommencer
          </button>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="log-box">
          {logs.map((l) => (
            <div key={l.id} className={'log-line log-' + l.type}>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {result === 'success' && (
        <div className="status-banner success">Reinitialisation V2 reussie</div>
      )}
      {result === 'error' && (
        <div className="status-banner error">Erreur lors de la reinitialisation V2</div>
      )}
    </div>
  );
}
