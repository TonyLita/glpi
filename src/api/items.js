import { apiClient, buildHeaders } from './config';

const DEFAULT_PAGE_SIZE = 200;

/**
 * Liste paginée d'items GLPI.
 * - Si `end` est fourni, fait UN SEUL appel sur la plage [start..end].
 * - Sinon, pagine automatiquement jusqu'à récupérer tous les éléments.
 */
export async function listItems(sessionToken, itemtype, start = 0, end = null) {
  // Mode "page unique" (compat ascendante)
  if (end !== null) {
    const res = await apiClient.get(`/${itemtype}`, {
      headers: buildHeaders(sessionToken),
      params: { range: `${start}-${end}` },
    });
    if (res.status >= 400 && res.status !== 206) {
      throw new Error(
        `listItems ${itemtype} HTTP ${res.status}: ${JSON.stringify(res.data || {})}`
      );
    }
    return Array.isArray(res.data) ? res.data : [];
  }

  // Mode "tout récupérer" avec pagination automatique
  const all = [];
  let cursor = start;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = cursor + DEFAULT_PAGE_SIZE - 1;
    const res = await apiClient.get(`/${itemtype}`, {
      headers: buildHeaders(sessionToken),
      params: { range: `${cursor}-${to}` },
    });

    // 200 = page complète, 206 = partial content (dernière page), 416 = hors plage
    if (res.status === 416) break;
    if (res.status >= 400) {
      throw new Error(
        `listItems ${itemtype} HTTP ${res.status}: ${JSON.stringify(res.data || {})}`
      );
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    all.push(...rows);

    // Fin si page incomplète ou vide
    if (rows.length < DEFAULT_PAGE_SIZE) break;

    cursor += DEFAULT_PAGE_SIZE;

    // Garde-fou
    if (cursor > 1_000_000) {
      throw new Error(`listItems ${itemtype}: pagination > 1M, abandon.`);
    }
  }

  return all;
}

/**
 * Récupère le count d'un itemtype via Content-Range header (count-only, pas de pagination).
 */
export async function getItemCount(sessionToken, itemtype) {
  const res = await apiClient.get(`/${itemtype}`, {
    headers: buildHeaders(sessionToken),
    params: { range: '0-0' },
  });
  if (res.status >= 400) {
    throw new Error(`getItemCount ${itemtype} HTTP ${res.status}`);
  }
  const contentRange = res.headers['content-range'];
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)$/);
    if (match) return Number(match[1]);
  }
  return Array.isArray(res.data) ? res.data.length : 0;
}

/**
 * Récupère tous les IDs d'un itemtype (pagination auto).
 */
export async function getAllIds(sessionToken, itemtype) {
  const rows = await listItems(sessionToken, itemtype, 0);
  return rows
    .map((r) => Number(r.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/**
 * Récupère le nom d'un item par ID.
 */
export async function getItemNameById(sessionToken, itemtype, id) {
  const res = await apiClient.get(`/${itemtype}/${id}`, {
    headers: buildHeaders(sessionToken),
  });
  if (res.status >= 400) return null;
  return (res.data && (res.data.name || res.data.completename)) || null;
}

/**
 * Suppression par lots (purge=true pour supprimer définitivement).
 */
export async function deleteItemsBatch(sessionToken, itemtype, ids, batchSize = 50) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const slice = ids.slice(i, i + batchSize).map((id) => ({ id }));
    const res = await apiClient.delete(`/${itemtype}`, {
      headers: buildHeaders(sessionToken),
      data: { input: slice, force_purge: true },
    });
    if (res.status >= 200 && res.status < 300) {
      deleted += slice.length;
    }
  }
  return deleted;
}

/**
 * Création par lots (parallèle).
 */
export async function createItems(sessionToken, itemtype, inputs, batchSize = 50) {
  const slices = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    slices.push(inputs.slice(i, i + batchSize));
  }

  const batchResults = await Promise.all(
    slices.map(async (slice) => {
      const res = await apiClient.post(
        `/${itemtype}`,
        { input: slice },
        { headers: buildHeaders(sessionToken) }
      );
      if (res.status >= 200 && res.status < 300) {
        return Array.isArray(res.data) ? res.data : [res.data];
      }
      throw new Error(
        `createItems ${itemtype} HTTP ${res.status}: ${JSON.stringify(res.data || {})}`
      );
    })
  );

  return batchResults.flat();
}
