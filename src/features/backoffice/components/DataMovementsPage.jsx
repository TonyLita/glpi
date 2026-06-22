import { useEffect, useState } from 'react';
import {
  listerReouvertures, modifierReouverture, supprimerReouverture,
  listerCouts, modifierCout, supprimerCout, recalculerTousLesBaseExtra,
} from '../../../api/backendApi';

const MODES = [
  { value: 'mode1', label: 'Mode 1 – Dernier coût' },
  { value: 'mode2', label: 'Mode 2 – Premier coût' },
  { value: 'mode3', label: 'Mode 3 – Moyenne' },
  { value: 'mode4', label: 'Mode 4 – Somme' },
];

const th = { padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' };
const td = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
const inp = { padding: '0.25rem 0.4rem', width: '100%', boxSizing: 'border-box' };

export default function DataMovementsPage() {
  const [reouvertures, setReouvertures] = useState([]);
  const [couts, setCouts] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  // état édition réouverture: { id, percentage, mode }
  const [editReouv, setEditReouv] = useState(null);
  // état édition coût: { id, cost_fixed }
  const [editCout, setEditCout] = useState(null);

  const [saving, setSaving] = useState(false);

  async function charger() {
    setChargement(true);
    setErreur('');
    try {
      const [r, c] = await Promise.all([listerReouvertures(), listerCouts()]);
      setReouvertures(r);
      setCouts(c);
    } catch (e) {
      setErreur(e.message || 'Erreur chargement');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function sauvegarderReouverture() {
    setSaving(true);
    setErreur(''); setSucces('');
    try {
      await modifierReouverture(editReouv.id, {
        percentage: parseFloat(String(editReouv.percentage).replace(',', '.')),
        mode: editReouv.mode,
      });
      setSucces('Réouverture modifiée');
      setEditReouv(null);
      await charger();
    } catch (e) {
      setErreur(e.message || 'Erreur modification');
    } finally {
      setSaving(false);
    }
  }

  async function supprimerUneReouverture(id) {
    if (!confirm(`Supprimer réouverture #${id} ?`)) return;
    try {
      await supprimerReouverture(id);
      setSucces(`Réouverture #${id} supprimée`);
      await charger();
    } catch (e) {
      setErreur(e.message || 'Erreur suppression');
    }
  }

  async function sauvegarderCout() {
    setSaving(true);
    setErreur(''); setSucces('');
    try {
      await modifierCout(editCout.id, {
        cost_fixed: parseFloat(String(editCout.cost_fixed).replace(',', '.')),
      });
      setSucces('Coût modifié — réouvertures recalculées');
      setEditCout(null);
      await charger();
    } catch (e) {
      setErreur(e.message || 'Erreur modification');
    } finally {
      setSaving(false);
    }
  }

  async function supprimerUnCout(id) {
    if (!confirm(`Supprimer coût #${id} ?`)) return;
    try {
      await supprimerCout(id);
      setSucces(`Coût #${id} supprimé`);
      await charger();
    } catch (e) {
      setErreur(e.message || 'Erreur suppression');
    }
  }

  async function recalculerTous() {
    if (!confirm('Recalculer TOUS les base_extra selon leurs modes réels?\nCette opération est irréversible.')) return;
    setSaving(true);
    setErreur(''); setSucces('');
    try {
      const res = await recalculerTousLesBaseExtra();
      setSucces(`${res.count} base_extra recalculés`);
      await charger();
    } catch (e) {
      setErreur(e.message || 'Erreur recalcul');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="reinit-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Données mouvements</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={charger} disabled={chargement || saving}>
            {chargement ? 'Chargement...' : 'Actualiser'}
          </button>
          <button className="btn btn-secondary" onClick={recalculerTous} disabled={chargement || saving} style={{ color: '#d32f2f', borderColor: '#d32f2f' }}>
            🔄 Recalculer tous
          </button>
        </div>
      </div>

      {erreur && <div className="status-banner error" style={{ marginBottom: '1rem' }}>{erreur}</div>}
      {succes && <div className="status-banner success" style={{ marginBottom: '1rem' }}>{succes}</div>}

      {/* ── Réouvertures ── */}
      <h3>Réouvertures ({reouvertures.length})</h3>
      <p className="reinit-desc" style={{ marginTop: 0 }}>Modifier le % ou le mode recalcule automatiquement le base_extra.</p>
      <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={th}>ID</th>
              <th style={th}>Ticket</th>
              <th style={th}>%</th>
              <th style={th}>Base extra</th>
              <th style={{ ...th, textAlign: 'right' }}>Coût réouv.</th>
              <th style={th}>Mode</th>
              <th style={th}>Créé le</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reouvertures.length === 0 && (
              <tr><td colSpan="8" style={{ ...td, color: '#999', textAlign: 'center' }}>Aucune réouverture</td></tr>
            )}
            {reouvertures.map(r => {
              const enEdition = editReouv?.id === r.id;
              return (
                <tr key={r.id} style={{ backgroundColor: enEdition ? '#fffde7' : 'transparent' }}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.refTicket}</td>
                  <td style={{ ...td, width: '140px', minWidth: '140px' }}>
                    <input
                      style={{ ...inp, fontSize: '1rem', padding: '0.35rem 0.5rem' }}
                      type="number"
                      step="0.01"
                      value={enEdition ? editReouv.percentage : r.percentage}
                      onFocus={() => { if (!enEdition) setEditReouv({ id: r.id, percentage: r.percentage, mode: r.mode || 'mode1' }); }}
                      onChange={e => setEditReouv({ ...(editReouv?.id === r.id ? editReouv : { id: r.id, mode: r.mode || 'mode1' }), percentage: e.target.value })}
                    />
                  </td>
                  <td style={td}>{r.baseExtra}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', color: '#1a6b3c' }}>
                    {((enEdition ? parseFloat(editReouv.percentage) || 0 : r.percentage) / 100 * r.baseExtra).toFixed(3)}
                  </td>
                  <td style={{ ...td, minWidth: '160px' }}>
                    {enEdition
                      ? <select style={inp} value={editReouv.mode}
                          onChange={e => setEditReouv({ ...editReouv, mode: e.target.value })}>
                          {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      : (MODES.find(m => m.value === r.mode)?.label || r.mode)}
                  </td>
                  <td style={{ ...td, fontSize: '0.8rem', color: '#666' }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR') : '-'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {enEdition ? (
                      <>
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', marginRight: '0.25rem' }}
                          onClick={sauvegarderReouverture} disabled={saving}>
                          {saving ? '...' : 'Enregistrer'}
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}
                          onClick={() => setEditReouv(null)} disabled={saving}>
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', marginRight: '0.25rem' }}
                          onClick={() => setEditReouv({ id: r.id, percentage: r.percentage, mode: r.mode || 'mode1' })}>
                          Modifier
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', color: '#c0392b', borderColor: '#c0392b' }}
                          onClick={() => supprimerUneReouverture(r.id)}>
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Supercosts ── */}
      <h3>Supercosts ({couts.length})</h3>
      <p className="reinit-desc" style={{ marginTop: 0 }}>Modifier un coût recalcule automatiquement le base_extra de toutes les réouvertures du même ticket.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={th}>ID</th>
              <th style={th}>Ticket</th>
              <th style={th}>Coût (€)</th>
              <th style={th}>Créé le</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {couts.length === 0 && (
              <tr><td colSpan="5" style={{ ...td, color: '#999', textAlign: 'center' }}>Aucun coût</td></tr>
            )}
            {couts.map(c => {
              const enEdition = editCout?.id === c.id;
              return (
                <tr key={c.id} style={{ backgroundColor: enEdition ? '#fffde7' : 'transparent' }}>
                  <td style={td}>{c.id}</td>
                  <td style={td}>{c.refTicket}</td>
                  <td style={{ ...td, width: '130px' }}>
                    {enEdition
                      ? <input style={inp} type="number" step="0.001" value={editCout.cost_fixed}
                          onChange={e => setEditCout({ ...editCout, cost_fixed: e.target.value })} />
                      : c.costFixed}
                  </td>
                  <td style={{ ...td, fontSize: '0.8rem', color: '#666' }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleString('fr-FR') : '-'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {enEdition ? (
                      <>
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', marginRight: '0.25rem' }}
                          onClick={sauvegarderCout} disabled={saving}>
                          {saving ? '...' : 'Enregistrer'}
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}
                          onClick={() => setEditCout(null)} disabled={saving}>
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', marginRight: '0.25rem' }}
                          onClick={() => setEditCout({ id: c.id, cost_fixed: c.costFixed })}>
                          Modifier
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', color: '#c0392b', borderColor: '#c0392b' }}
                          onClick={() => supprimerUnCout(c.id)}>
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
