/* global window, fetch */
/**
 * REST API client.
 * Every page talks to the backend only through this module: no HTML file
 * contains database credentials or hardcoded content.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var config = window.ARAMIOT_CONFIG || {};
  var BASE_URL = String(config.API_BASE_URL || '/api').replace(/\/+$/, '');
  var TIMEOUT = Number(config.REQUEST_TIMEOUT_MS || 15000);

  /** Serialise a query object, skipping empty values. */
  function buildQuery(params) {
    if (!params) return '';
    var search = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      search.append(key, value);
    });
    var text = search.toString();
    return text ? '?' + text : '';
  }

  function toApiError(response, payload) {
    var error = new Error(
      (payload && payload.error && payload.error.message) ||
        'The request failed with status ' + response.status + '.'
    );
    error.status = response.status;
    error.code = (payload && payload.error && payload.error.code) || 'HTTP_ERROR';
    error.details = (payload && payload.error && payload.error.details) || null;
    return error;
  }

  /** Low-level request with timeout, JSON parsing and consistent errors. */
  function request(path, options) {
    var settings = options || {};
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeoutId = controller ? window.setTimeout(function () { controller.abort(); }, TIMEOUT) : null;

    var headers = Object.assign({ Accept: 'application/json' }, settings.headers || {});
    if (settings.body) headers['Content-Type'] = 'application/json';

    var init = {
      method: settings.method || 'GET',
      headers: headers,
      signal: controller ? controller.signal : undefined,
    };
    if (settings.body) init.body = settings.body;

    return fetch(BASE_URL + path, init)
      .then(function (response) {
        return response
          .json()
          .catch(function () { return null; })
          .then(function (payload) {
            if (!response.ok || !payload || payload.success === false) {
              throw toApiError(response, payload);
            }
            return payload;
          });
      })
      .catch(function (error) {
        if (!error.status) {
          error.code = error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
          error.message =
            error.code === 'TIMEOUT'
              ? 'The ARAMIOT API took too long to respond. Please try again.'
              : 'Could not reach the ARAMIOT API. Check your connection and try again.';
        }
        throw error;
      })
      .finally(function () {
        if (timeoutId) window.clearTimeout(timeoutId);
      });
  }

  function list(path, params) {
    return request(path + buildQuery(params));
  }

  function post(path, payload) {
    return request(path, { method: 'POST', body: JSON.stringify(payload) });
  }

  ARAMIOT.api = {
    baseUrl: BASE_URL,

    /* Reads */
    getOrganization: function () { return request('/organization'); },
    getPages: function (params) { return list('/pages', params); },
    getPage: function (slug) { return request('/pages/' + encodeURIComponent(slug)); },
    getArticles: function (params) { return list('/articles', params); },
    getArticle: function (slug) { return request('/articles/' + encodeURIComponent(slug)); },
    getCategories: function (params) { return list('/categories', params); },
    getProjects: function (params) { return list('/projects', params); },
    getProject: function (slug) { return request('/projects/' + encodeURIComponent(slug)); },
    getPrograms: function (params) { return list('/programs', params); },
    getProgram: function (slug) { return request('/programs/' + encodeURIComponent(slug)); },
    getTeam: function (params) { return list('/team', params); },
    getPublications: function (params) { return list('/publications', params); },
    getPublication: function (slug) { return request('/publications/' + encodeURIComponent(slug)); },
    getResources: function (params) { return list('/resources', params); },
    getResource: function (slug) { return request('/resources/' + encodeURIComponent(slug)); },
    getImpact: function (params) { return list('/impact', params); },

    /* Writes */
    submitContact: function (payload) { return post('/contact', payload); },
    submitVolunteer: function (payload) { return post('/volunteers', payload); },
    submitPartnership: function (payload) { return post('/partnerships', payload); },
  };
})(window.ARAMIOT);
