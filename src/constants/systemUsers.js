// IDs users système GLPI à protéger (ne jamais supprimer)
export const SYSTEM_USER_IDS = [1, 2, 3, 4, 5, 6];

export function isSystemUser(userId) {
  return SYSTEM_USER_IDS.includes(Number(userId));
}
