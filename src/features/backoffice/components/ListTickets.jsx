import { useState, useEffect } from 'react';
import { initSession, killSession } from '../../../api/session';
import { listItems } from '../../../api/items';
import { obtenirResumeCouts } from '../../../api/backendApi';

const ASSET_TYPES = ['Computer', 'Monitor', 'Printer', 'Phone', 'Peripheral', 'NetworkEquipment'];

function extractRefTicket(content) {
  if (!content) return null;
  const match = String(content).match(/Ref_Ticket:\s*(\S+)/);
  return match ? match[1] : null;
}

export default function ListTickets() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { chargerDonnees(); }, []);

  async function chargerDonnees() {
    setLoading(true);
    setError('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();

      const [tickets, ticketCosts, itemsTickets, resume, ...assetLists] = await Promise.all([
        listItems(sessionToken, 'Ticket', 0, 999),
        listItems(sessionToken, 'TicketCost', 0, 999),
        listItems(sessionToken, 'Item_Ticket', 0, 999),
        obtenirResumeCouts(),           // vue SQL : super_prix + cout_reouv par ticket
        ...ASSET_TYPES.map(type => listItems(sessionToken, type, 0, 999)),
      ]);

      // ── Maps de lookup ────────────────────────────────────────────────────────

      const toNum = v => (v ? Number(String(v).replace(',', '.')) : 0);

      // Coût normal GLPI par ticket
      const mapNormal = {};
      for (const c of ticketCosts) {
        const tid = c.tickets_id || (c.itemtype === 'Ticket' ? c.items_id : null);
        if (!tid) continue;
        if (!mapNormal[tid]) mapNormal[tid] = 0;
        mapNormal[tid] += (toNum(c.actiontime) / 3600) * toNum(c.cost_time)
                        + toNum(c.cost_fixed)
                        + toNum(c.cost_material);
      }

      // Résumé SQLite (vue) : super_prix_total et cout_reouv_total par ref_ticket
      const mapResume = {};
      for (const r of resume) {
        mapResume[r.refTicket] = r;
      }

      // Assets par (itemtype, items_id)
      const mapAssets = {};
      for (let i = 0; i < ASSET_TYPES.length; i++) {
        mapAssets[ASSET_TYPES[i]] = new Map(assetLists[i].map(a => [a.id, a]));
      }

      // Info ticket par id
      const mapTickets = {};
      for (const t of tickets) mapTickets[t.id] = t;

      // Nombre d'items par ticket (pour la division)
      const nbItemsParTicket = {};
      for (const it of itemsTickets) {
        nbItemsParTicket[it.tickets_id] = (nbItemsParTicket[it.tickets_id] || 0) + 1;
      }

      // ── Agrégation par ASSET (itemtype × items_id) ────────────────────────────
      // Chaque asset accumulé la contribution de TOUS les tickets qui le contiennent.
      //   coutNormal  += normalTicket   / nbItems_du_ticket
      //   superPrix   += superPrixTotal / nbItems_du_ticket   (depuis vue SQL)
      //   coutReouv   += coutReouv_total / nbItems_du_ticket  (depuis vue SQL)

      const mapParAsset = {}; // key: "Computer:5"

      for (const it of itemsTickets) {
        const key = `${it.itemtype}:${it.items_id}`;
        if (!mapParAsset[key]) {
          mapParAsset[key] = {
            itemtype:   it.itemtype,
            items_id:   it.items_id,
            coutNormal: 0,
            superPrix:  0,
            coutReouv:  0,
            refTicket:  null,
            ticketName: null,
            ticketDate: null,
            refNormal:  -1,
          };
        }

        const entry  = mapParAsset[key];
        const tid    = it.tickets_id;
        const nbItems = nbItemsParTicket[tid] || 1;
        const ticket = mapTickets[tid];
        const refTicket = ticket ? extractRefTicket(ticket.content) : null;

        const normal    = (mapNormal[tid]  || 0) / nbItems;
        const sup       = (mapResume[refTicket]?.superPrixTotal       || 0) / nbItems;
        const reouv     = (mapResume[refTicket]?.coutReouvertureTotal || 0) / nbItems;

        entry.coutNormal += normal;
        entry.superPrix  += sup;
        entry.coutReouv  += reouv;

        // Ticket de référence = celui avec le coût normal le plus élevé par item
        if (normal > entry.refNormal) {
          entry.refNormal = normal;
          entry.refTicket = refTicket;
          entry.ticketName = ticket?.name || null;
          entry.ticketDate = ticket?.date_creation || null;
        }
      }

      // ── Construction des lignes ───────────────────────────────────────────────
      const rows = [];
      for (const entry of Object.values(mapParAsset)) {
        if (entry.coutNormal === 0 && entry.superPrix === 0 && entry.coutReouv === 0) continue;

        const asset = mapAssets[entry.itemtype]?.get(entry.items_id);
        rows.push({
          refTicket:  entry.refTicket        || '-',
          ticketName: entry.ticketName       || '-',
          ticketDate: entry.ticketDate       || '-',
          assetName:  asset?.name             || '-',
          assetType:  entry.itemtype,
          coutNormal: entry.coutNormal,
          superPrix:  entry.superPrix,
          coutReouv:  entry.coutReouv,
        });
      }

      // Trier par refTicket (string compare)
      rows.sort((a, b) => String(b.refTicket).localeCompare(String(a.refTicket)));
      setData(rows);

    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      if (sessionToken) await killSession(sessionToken);
      setLoading(false);
    }
  }

  if (loading) return <div className="reinit-card"><p>Chargement...</p></div>;

  return (
    <div className="reinit-card">
      <h2>Coûts agrégés par asset</h2>
      {error && <div className="status-banner error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {data.length === 0 ? (
        <p>Aucune donnée</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left',  borderRight: '1px solid #ddd' }}>Ticket réf.</th>
                <th style={{ padding: '0.5rem', textAlign: 'left',  borderRight: '1px solid #ddd' }}>Date</th>
                <th style={{ padding: '0.5rem', textAlign: 'left',  borderRight: '1px solid #ddd' }}>Asset</th>
                <th style={{ padding: '0.5rem', textAlign: 'left',  borderRight: '1px solid #ddd' }}>Type</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #ddd' }}>Coût normal</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #ddd' }}>Super prix</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #ddd' }}>Coût réouv.</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid #eee' }}
                >
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #eee' }}>
                    {row.refTicket && row.refTicket !== '-'
                      ? <><strong>#{row.refTicket}</strong>{row.ticketName ? ' ' + String(row.ticketName).substring(0, 25) : ''}</>
                      : '-'}
                  </td>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #eee', fontSize: '0.82rem' }}>
                    {row.ticketDate}
                  </td>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #eee' }}>
                    {row.assetName}
                  </td>
                  <td style={{ padding: '0.5rem', borderRight: '1px solid #eee', fontSize: '0.82rem', color: '#666' }}>
                    {row.assetType}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #eee', fontWeight: 'bold' }}>
                    {row.coutNormal.toFixed(3)}€
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #eee', color: '#2ecc71', fontWeight: 'bold' }}>
                    {row.superPrix.toFixed(3)}€
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #eee', color: '#e67e22', fontWeight: 'bold' }}>
                    {row.coutReouv.toFixed(3)}€
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#3498db' }}>
                    {(row.coutNormal + row.superPrix + row.coutReouv).toFixed(3)}€
                  </td>
                </tr>
              ))}
              {data.length > 0 && (
                <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold' }}>
                  <td colSpan="4" style={{ padding: '0.5rem', borderRight: '1px solid #333', textAlign: 'right' }}>
                    TOTAL GÉNÉRAL
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #333' }}>
                    {data.reduce((sum, row) => sum + row.coutNormal, 0).toFixed(3)}€
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #333', color: '#2ecc71' }}>
                    {data.reduce((sum, row) => sum + row.superPrix, 0).toFixed(3)}€
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #333', color: '#e67e22' }}>
                    {data.reduce((sum, row) => sum + row.coutReouv, 0).toFixed(3)}€
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#3498db' }}>
                    {data.reduce((sum, row) => sum + row.coutNormal + row.superPrix + row.coutReouv, 0).toFixed(3)}€
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
