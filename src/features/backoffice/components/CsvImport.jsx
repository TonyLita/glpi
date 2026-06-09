import { useState, useRef } from 'react';
import { initSession, killSession, createItems } from '../../../api/index';
import { IMPORT_ITEM_TYPES } from '../../../constants/selectOptions';
import { STATUS } from '../../../constants/status';
import { parseCsv } from '../../../utils/csv';

export default function CsvImport() {
  const [itemtype, setItemtype] = useState(IMPORT_ITEM_TYPES[0].itemtype);
  const [rows, setRows] = useState([]);
  const [filename, setFilename] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [logs, setLogs] = useState([]);
  const logCounter = useRef(0);
  const fileRef = useRef(null);

  function addLog(msg, type = 'info') {
    const id = logCounter.current++;
    setLogs((prev) => [...prev, { msg, type, id }]);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFilename(file.name);
    setLogs([]);
    setStatus(STATUS.IDLE);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCsv(ev.target.result);
        setRows(parsed);
        addLog(`${parsed.length} ligne(s) chargée(s) depuis « ${file.name} ».`, 'success');
      } catch (err) {
        setRows([]);
        addLog(`Erreur de parsing : ${err.message}`, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function handleImport() {
    if (!rows.length) return;
    setStatus(STATUS.RUNNING);
    setLogs([]);
    let sessionToken = null;

    try {
      addLog('Ouverture de session GLPI…');
      sessionToken = await initSession();
      addLog('Session ouverte.', 'success');

      addLog(`Envoi de ${rows.length} enregistrement(s) vers ${itemtype}…`);

      // Envoi en une seule requête batch POST /:itemtype { input: [...] }
      const results = await createItems(sessionToken, itemtype, rows);

      const ok = results.filter((r) => r.id && r.id !== false).length;
      const failed = results.length - ok;

      if (failed > 0) {
        addLog(`${ok}/${results.length} créé(s). ${failed} erreur(s).`, 'warn');
        results.forEach((r) => {
          if (!r.id || r.id === false) addLog(`→ Erreur : ${r.message || 'inconnue'}`, 'error');
        });
      } else {
        addLog(`${ok} enregistrement(s) importé(s) avec succès.`, 'success');
      }

      setStatus(failed === results.length ? STATUS.ERROR : STATUS.SUCCESS);
    } catch (err) {
      setStatus(STATUS.ERROR);
      addLog(`Erreur : ${err.message}`, 'error');
    } finally {
      if (sessionToken) {
        await killSession(sessionToken).catch(() => {});
        addLog('Session fermée.');
      }
    }
  }

  function handleReset() {
    setRows([]);
    setFilename('');
    setLogs([]);
    setStatus(STATUS.IDLE);
    if (fileRef.current) fileRef.current.value = '';
  }

  const logClass = (type) =>
    ({ success: 'log-success', error: 'log-error', warn: 'log-warn' }[type] ?? 'log-info');

  return (
    <div className="reinit-card">
      <h2>Import CSV → GLPI</h2>
      <p className="reinit-desc">
        Importez un fichier CSV pour créer des items en masse via l'API GLPI.
      </p>

      <div className="import-controls">
        {/* Sélection du type */}
        <div className="form-group">
          <label htmlFor="itemtype-select">Type d'objet</label>
          <select
            id="itemtype-select"
            className="form-select"
            value={itemtype}
            onChange={(e) => setItemtype(e.target.value)}
            disabled={status === STATUS.RUNNING}
          >
            {IMPORT_ITEM_TYPES.map(({ label, itemtype: it }) => (
              <option key={it} value={it}>{label}</option>
            ))}
          </select>
        </div>

        {/* Upload fichier */}
        <div className="form-group">
          <label htmlFor="csv-file">Fichier CSV</label>
          <input
            id="csv-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="form-file"
            onChange={handleFile}
            disabled={status === STATUS.RUNNING}
          />
        </div>
      </div>

      {/* Aperçu du tableau */}
      {rows.length > 0 && (
        <div className="csv-preview">
          <p className="preview-label">Aperçu — {rows.length} ligne(s)</p>
          <div className="table-scroll">
            <table className="csv-table">
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => <td key={j}>{v}</td>)}
                  </tr>
                ))}
                {rows.length > 5 && (
                  <tr>
                    <td colSpan={Object.keys(rows[0]).length} className="preview-more">
                      … {rows.length - 5} ligne(s) supplémentaire(s)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Boutons */}
      <div className="import-actions">
        {status !== STATUS.RUNNING && rows.length > 0 && (
          <button className="btn btn-primary" onClick={handleImport}>
            Importer {rows.length} ligne(s)
          </button>
        )}
        {status === STATUS.RUNNING && (
          <span className="spinner" />
        )}
        {(filename || logs.length > 0) && status !== STATUS.RUNNING && (
          <button className="btn btn-secondary" onClick={handleReset}>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="log-box">
          {logs.map(({ id, msg, type }) => (
            <div key={id} className={`log-line ${logClass(type)}`}>{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
