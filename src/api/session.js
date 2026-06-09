import { apiClient, buildHeaders } from './config';

const SESSION_STORAGE_KEY = 'glpi_session_token';

export async function initSession() {
  var cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (cached) {
    return cached;
  }
  var res = await apiClient.get('/initSession', {
    headers: buildHeaders(),
  });
  if (res.status < 200 || res.status >= 300) throw new Error('initSession failed: ' + res.status);
  var data = res.data || {};
  var token = data.session_token;
  sessionStorage.setItem(SESSION_STORAGE_KEY, token);
  return token;
}

export async function killSession(sessionToken) {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  apiClient.get('/killSession', {
    headers: buildHeaders(sessionToken),
  }).catch(function () {});
}
