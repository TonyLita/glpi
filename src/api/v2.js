import axios from 'axios';

const v2Client = axios.create({
  baseURL: '/apiv2',
  validateStatus: function () {
    return true;
  },
});

const tokenClient = axios.create({
  baseURL: '/apitoken',
  validateStatus: function () {
    return true;
  },
});

/**
 * Obtient un access_token JWT via OAuth 2.0 password grant.
 * @param {string} clientId  - Client ID affiché sur la fiche OAuth GLPI
 * @param {string} clientSecret - Client Secret de la fiche OAuth GLPI
 * @param {string} username  - Login GLPI
 * @param {string} password  - Mot de passe GLPI
 * @returns {Promise<string>} access_token JWT
 */
export async function getTokenV2(clientId, clientSecret, username, password) {
  var params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);
  params.append('scope', 'api');

  var credentials = btoa(clientId + ':' + clientSecret);

  var res = await tokenClient.post('', params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + credentials,
    },
  });

  if (res.status === 200 && res.data && res.data.access_token) {
    return res.data.access_token;
  }

  var detail = (res.data && (res.data.error_description || res.data.error)) || ('HTTP ' + res.status);
  throw new Error('Impossible d\'obtenir le token: ' + detail);
}

function v2Headers(oauthToken) {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + oauthToken,
  };
}

export async function listItemsV2(oauthToken, itemtype) {
  var res = await v2Client.get('/Tools/' + itemtype, {
    headers: v2Headers(oauthToken),
  });

  if (res.status === 200 || res.status === 206) {
    var data = res.data;
    return Array.isArray(data) ? data : [];
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) return [];

  throw new Error('listItemsV2(' + itemtype + ') failed: ' + res.status + ' ' + JSON.stringify(res.data || {}));
}

export async function deleteItemV2(oauthToken, itemtype, id) {
  var res = await v2Client.delete('/Tools/' + itemtype + '/' + id, {
    headers: v2Headers(oauthToken),
  });

  if (res.status >= 200 && res.status < 300) return true;
  if (res.status === 404) return false;

  throw new Error('deleteItemV2(' + itemtype + ',' + id + ') failed: ' + res.status + ' ' + JSON.stringify(res.data || {}));
}
