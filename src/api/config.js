import axios from 'axios';

const BASE_URL = import.meta.env.VITE_GLPI_BASE_URL || '/apirest';
const APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN || '';
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN || '';

if (!APP_TOKEN || !USER_TOKEN) {
  console.warn(
    '[GLPI] Tokens manquants. Définis VITE_GLPI_APP_TOKEN et VITE_GLPI_USER_TOKEN dans .env'
  );
}

const apiClient = axios.create({
  baseURL: BASE_URL,
  validateStatus: function () {
    return true;
  },
});

export function buildHeaders(sessionToken) {
  var h = {
    'Content-Type': 'application/json',
    'App-Token': APP_TOKEN,
  };
  if (sessionToken) {
    h['Session-Token'] = sessionToken;
  } else {
    h['Authorization'] = 'user_token ' + USER_TOKEN;
  }
  return h;
}

export { BASE_URL, apiClient };
