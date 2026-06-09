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
