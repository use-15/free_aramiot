/* global window */
/**
 * Frontend configuration.
 *
 * By default the API is assumed to live on the same origin under /api, which is
 * how `npm start` serves the site. If the frontend is hosted separately (for
 * example a static server on port 3000 while the API runs on 5000), set
 * API_BASE_URL to the absolute API URL and add that origin to CORS_ORIGINS in
 * the backend .env file.
 */

window.ARAMIOT_CONFIG = {
  API_BASE_URL:
    window.location.protocol === 'file:'
      ? 'http://localhost:3000/api'
      : window.location.origin + '/api',
  SITE_NAME: 'ARAMIOT',
  REQUEST_TIMEOUT_MS: 15000,
};
