const BASE = '/backend';

export async function getKanbanSettings() {
  const res = await fetch(`${BASE}/api/kanban-settings`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveKanbanSettings(settings) {
  const res = await fetch(`${BASE}/api/kanban-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function ajouterCoutTicket(refTicket, montant) {
  const res = await fetch(`${BASE}/api/ticket-costs/${refTicket}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cost_fixed: montant }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function supprimerCoutsTicket(refTicket) {
  const res = await fetch(`${BASE}/api/ticket-costs/${refTicket}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function supprimerDernierCoutTicket(refTicket) {
  const res = await fetch(`${BASE}/api/ticket-costs/${refTicket}/dernier`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function ajouterMouvement(refTicket, type, valeur, mode = 'mode1') {
  const res = await fetch(`${BASE}/api/mouvements/ajouter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refTicket, type, valeur, mode }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function supprimerDerniereReouverture(refTicket) {
  const res = await fetch(`${BASE}/api/mouvements/reouvertures/${refTicket}/dernier`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Retourne [{refTicket, superPrixTotal, coutReouvertureTotal}] depuis la vue SQL
export async function obtenirResumeCouts() {
  const res = await fetch(`${BASE}/api/ticket-costs-summary`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function importer(fichier) {
  const fd = new FormData();
  fd.append('fichier', fichier);
  const res = await fetch(`${BASE}/api/mouvements/importer`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function cleanupDatabase() {
  const res = await fetch(`${BASE}/api/system/cleanup-db`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
