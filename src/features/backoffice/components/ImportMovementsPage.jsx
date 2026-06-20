import { useEffect, useState } from 'react';
import { importer } from '../../../api/backendApi';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';
import { updateTicketStatus } from '../../../api/tickets';

function extractRefTicket(content) {
  if (!content) return null;
  const match = String(content).match(/Ref_Ticket:\s*(\S+)/);
  return match ? match[1] : null;
}

export default function ImportMovementsPage() {
  const [fichier, setFichier] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [resultats, setResultats] = useState([]);

  const [ticket, setTicket] = useState('');
  const [mouvement, setMouvement] = useState('');
  const [valeur, setValeur] = useState('');
  const [modeCalcul, setModeCalcul] = useState('mode1');
  const [chargementManuel, setChargementManuel] = useState(false);

  const [ticketsGlpi, setTicketsGlpi] = useState([]);
  const [ticketsMap, setTicketsMap] = useState({});
  useEffect(() => {
    async function chargerTickets() {
      let sessionToken = null;
      try {
        sessionToken = await initSession();
        const rows = await listItems(sessionToken, 'Ticket', 0, 499);
        const map = {};
        const avec_ref = rows
          .map(t => ({ id: t.id, name: t.name || '', ref: extractRefTicket(t.content) }))
          .map(t => {
            const ref = extractRefTicket(t.content);
            if (ref) map[ref] = { glpiId: t.id, status: t.status };
            return { id: t.id, name: t.name || '', ref };
          })
          .filter(t => t.ref);
          setTicketsMap(map);
        setTicketsGlpi(avec_ref);
      } catch (e) {
        // Silencieux: saisie manuelle reste disponible
      } finally {
        if (sessionToken) await killSession(sessionToken).catch(() => {});
      }
    }
    chargerTickets();
  }, []);

  // Fonction métier unique (source de vérité)
  async function ajouterMouvement(refTicket, typeMovement, valeurInput, mode = 'mode1') {
    const res = await fetch('/backend/api/mouvements/ajouter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refTicket, type: typeMovement, valeur: valeurInput, mode })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Handler saisie manuelle
  async function changeTicketStatus(glpiId, fromStatus, toStatus) {
    let sessionToken = null;
    try {
      sessionToken = await initSession();
      await updateTicketStatus(sessionToken, glpiId, toStatus);
    } finally {
      if (sessionToken) await killSession(sessionToken).catch(() => { });
    }
  }



  async function handleClickManuel() {
    if (!ticket || !mouvement) { setErreur('Complétez ticket et mouvement'); return; }
    if (mouvement === 'open' && !valeur) { setErreur('Saisir un % pour "open"'); return; }

    setChargementManuel(true);
    setErreur('');
    setSucces('');
    try {
      const ticketInfo = TicketMap [ticket];
      const res = await ajouterMouvement(ticket, mouvement, valeur ? parseFloat(valeur.replace(',', '.')) : null, modeCalcul);

      // Change statut GLPI selon mouvement
      if (ticketInfo) {
        if (mouvement === 'open') {
          await changeTicketStatus(ticketInfo.glpiId, 5, 2);  // 5→2 (Closed→In Progress)
        } else if (mouvement === 'close') {
          await changeTicketStatus(ticketInfo.glpiId, ticketInfo.status, 5);  // →5 (Closed)
        }
      }

      setResultats([...resultats, res]);
      setSucces(`Mouvement ajouté (#${ticket})`);
      setTicket(''); setMouvement(''); setValeur('');
    } catch (e) {
      setErreur(e.message || 'Erreur ajout');
    } finally {
      setChargementManuel(false);
    }
  }

  // Handler import CSV refactorisé
  async function traiterCsv() {
    if (!fichier) { setErreur('Sélectionnez un fichier CSV'); return; }
    setChargement(true);
    setErreur(''); setSucces('');
    let ok = 0;
    const erreurs = [];
    try {
      const text = await fichier.text();
      const toutes = text.split('\n').filter(l => l.trim());
      if (toutes.length < 2) { setErreur('Fichier CSV vide ou sans données'); return; }

      // Auto-détecter délimiteur depuis la ligne d'entête
      const entete = toutes[0];
      const sep = entete.includes(';') ? ';' : ',';

      // Normaliser mode: "3" → "mode3", "mode3" → "mode3"
      function normaliserMode(m) {
        if (!m) return null;
        const s = m.trim();
        if (['mode1','mode2','mode3','mode4'].includes(s)) return s;
        if (['1','2','3','4'].includes(s)) return 'mode' + s;
        return null;
      }

      const lignes = toutes.slice(1);
      for (let i = 0; i < lignes.length; i++) {
        const [tickStr, mouvStr, valStr, modeStr] = lignes[i].split(sep).map(s => s.trim());
        if (!tickStr || !mouvStr) continue;
        try {
          const modeToUse = normaliserMode(modeStr) || modeCalcul;
          const ticketInfo = ticketsMap[tickStr];
          const res = await ajouterMouvement(tickStr, mouvStr, valStr ? parseFloat(valStr.replace(',', '.')) : null, modeToUse);


          // Change statut GLPI selon mouvement
          if (ticketInfo) {
            if (mouvStr === 'open') {
              await changeTicketStatus(ticketInfo.glpiId, 5, 2);  // 5→2 (Closed→In Progress)
            } else if (mouvStr === 'close') {
              await changeTicketStatus(ticketInfo.glpiId, ticketInfo.status, 5);  // →5 (Closed)
            }
          }

          setResultats(prev => [...prev, res]);
          ok++;
        } catch (e) {
          erreurs.push(`Ligne ${i + 2}: ${e.message}`);
        }
      }
      if (erreurs.length > 0) {
        setErreur(`${erreurs.length} erreur(s): ${erreurs.join(' | ')}`);
      }
      setSucces(`${ok}/${lignes.length} mouvement(s) importé(s) avec succès`);
      setFichier(null);
    } catch (e) {
      setErreur(e.message || 'Erreur import');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="reinit-card">
      <h2>Importer mouvements</h2>
      <p className="reinit-desc">CSV 3 colonnes: ticket; mouvement; valeur</p>

      {erreur && <div className="status-banner error" style={{ marginBottom: '1rem' }}>{erreur}</div>}
      {succes && <div className="status-banner success" style={{ marginBottom: '1rem' }}>{succes}</div>}

      {/* Saisie manuelle */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>Saisie manuelle</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Ticket (Ref)</label>
            {ticketsGlpi.length > 0 ? (
              <select value={ticket} onChange={e => setTicket(e.target.value)} className="form-input" disabled={chargementManuel} style={{ margin: 0 }}>
                <option value="">— Sélectionner —</option>
                {ticketsGlpi.map(t => (
                  <option key={t.id} value={t.ref}>#{t.ref} – {t.name}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="Ref ticket" className="form-input" disabled={chargementManuel} style={{ margin: 0 }} />
            )}
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Mouvement</label>
            <select value={mouvement} onChange={e => setMouvement(e.target.value)} className="form-input" disabled={chargementManuel} style={{ margin: 0 }}>
              <option value="">— Sélectionner —</option>
              <option value="open">Open (réouverture %)</option>
              <option value="close">Close (coût final)</option>
              <option value="cancel">Cancel (annulation)</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Valeur</label>
            <input type="text" value={valeur} onChange={e => setValeur(e.target.value)} placeholder={mouvement === 'open' ? '% (requis)' : 'optionnel'} className="form-input" disabled={chargementManuel} style={{ margin: 0 }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Mode calcul</label>
            <select value={modeCalcul} onChange={e => setModeCalcul(e.target.value)} className="form-input" style={{ margin: 0 }}>
              <option value="mode1">Dernier coût</option>
              <option value="mode2">Premier coût</option>
              <option value="mode3">Moyenne coûts</option>
              <option value="mode4">Somme coûts</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleClickManuel} disabled={chargementManuel || !ticket || !mouvement} style={{ margin: 0 }}>{chargementManuel ? 'Ajout...' : 'Ajouter'}</button>
        </div>
      </div>

      {/* Import CSV */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>Importer CSV</h3>
        <p className="reinit-desc">Colonnes: ticket; mouvement; valeur; [mode optionnel: mode1|mode2|mode3|mode4]</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Fichier CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={e => setFichier(e.target.files?.[0] || null)}
              disabled={chargement}
              className="form-input"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Mode calcul</label>
            <select value={modeCalcul} onChange={e => setModeCalcul(e.target.value)} className="form-input" style={{ margin: 0 }}>
              <option value="mode1">Dernier coût</option>
              <option value="mode2">Premier coût</option>
              <option value="mode3">Moyenne coûts</option>
              <option value="mode4">Somme coûts</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={traiterCsv}
            disabled={chargement || !fichier}
          >
            {chargement ? 'Import...' : 'Importer'}
          </button>
        </div>
      </div>

      {resultats.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Résultats</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginTop: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #ddd' }}>ID</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #ddd' }}>Ticket</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #ddd' }}>Action</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #ddd' }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((mvt, i) => {
                  const valeur = mvt.percentage !== undefined ? mvt.percentage : mvt.cost_fixed;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', borderRight: '1px solid #eee' }}>{mvt.id || '-'}</td>
                      <td style={{ padding: '0.5rem', borderRight: '1px solid #eee' }}>#{mvt.ref_ticket}</td>
                      <td style={{ padding: '0.5rem', borderRight: '1px solid #eee' }}>
                        <span style={{
                          backgroundColor: mvt.action === 'reouverture' ? '#e8f5e9' : mvt.action === 'cout_final' ? '#fff3e0' : '#ffebee',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold'
                        }}>
                          {mvt.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #eee' }}>
                        {valeur !== undefined ? valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
