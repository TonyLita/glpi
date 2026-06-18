import { apiClient, buildHeaders } from './config';
import { listItems } from './items';
import { SYSTEM_USER_IDS } from '../constants/systemUsers';

/**
 * Liste tous les users GLPI.
 */
export async function listUsers(sessionToken) {
  return listItems(sessionToken, 'User', 0);
}

/**
 * Récupère tous les IDs des users NON-système.
 * Protège les 6 users système : ID 1-6
 */
export async function getUserIdsExcludingSystem(sessionToken) {
  const rows = await listUsers(sessionToken);
  return rows
    .map((r) => Number(r.id))
    .filter((id) => Number.isFinite(id) && id > 0 && !SYSTEM_USER_IDS.includes(id));
}

/**
 * Supprime les users NON-système par lots.
 * Retourne nombre d'utilisateurs supprimés.
 */
export async function deleteUsersExcludingSystem(sessionToken, batchSize = 50) {
  const userIds = await getUserIdsExcludingSystem(sessionToken);

  if (userIds.length === 0) {
    return 0;
  }

  let deleted = 0;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const slice = userIds.slice(i, i + batchSize).map((id) => ({ id }));
    const res = await apiClient.delete('/User', {
      headers: buildHeaders(sessionToken),
      data: { input: slice, force_purge: true },
    });
    if (res.status >= 200 && res.status < 300) {
      deleted += slice.length;
    }
  }
  return deleted;
}
