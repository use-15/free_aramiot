/* global window, document */
/**
 * Home page composition.
 * Each section loads independently, so a slow or failing request degrades one
 * section instead of blanking the whole page.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var cards = ARAMIOT.cards;
  var esc = layout.escapeHtml;

  var AREAS = [
    { section: 'health', icon: 'heart-pulse', label: 'Health' },
    { section: 'education', icon: 'graduation-cap', label: 'Education' },
    { section: 'advocacy', icon: 'scale', label: 'Advocacy' },
  ];

  function target(name) {
    return document.querySelector('[data-home="' + name + '"]');
  }

  function tileGrid(markup) {
    return '<div class="tile-grid">' + markup + '</div>';
  }

  function loadSection(name, request, render, options) {
    var element = target(name);
    if (!element) return;

    var settings = options || {};
    element.innerHTML = layout.tilesSkeleton(settings.count || 3);

    request()
      .then(function (response) {
        var items = response.data || [];
        if (!items || items.length === 0) {
          element.innerHTML = layout.emptyState({
            title: settings.emptyTitle || 'Nothing published yet',
            message: settings.emptyMessage || 'Published content will appear here.',
          });
          layout.refreshIcons();
          return;
        }
        element.innerHTML = render(items);
        layout.refreshIcons();
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      })
      .catch(function (error) {
        element.innerHTML = layout.errorState({ message: error.message });
        var retry = element.querySelector('[data-retry]');
        if (retry) {
          retry.addEventListener('click', function () {
            loadSection(name, request, render, options);
          });
        }
        layout.refreshIcons();
      });
  }

  /* ---------------- organisation-driven sections ---------------- */

  function renderIntroduction(organization) {
    var element = target('intro');
    if (!element) return;

    if (!organization) {
      element.innerHTML = layout.emptyState({
        title: 'Organizational profile unavailable',
        message: 'The ARAMIOT profile could not be loaded. Please try again shortly.',
      });
      return;
    }

    element.innerHTML =
      '<p class="split-lead">' + esc(organization.description || organization.tagline || '') + '</p>' +
      (organization.story ? '<p>' + esc(layout.truncate(organization.story, 240)) + '</p>' : '') +
      '<ul class="value-list">' +
      (organization.values || [])
        .slice(0, 4)
        .map(function (value) { return '<li>' + esc(value) + '</li>'; })
        .join('') +
      '</ul>';
    layout.refreshIcons();
  }

  function renderMission(organization) {
    var element = target('mission');
    if (!element) return;

    var mission = (organization && organization.mission) || '';
    var vision = (organization && organization.vision) || '';

    if (!mission && !vision) {
      element.innerHTML = layout.emptyState({
        title: 'Mission and vision coming soon',
        message: 'The organization has not published its mission and vision yet.',
      });
      return;
    }

    element.innerHTML = tileGrid(
      '<article class="tile"><div class="tile-body">' +
        '<h3 class="tile-title">Our mission</h3>' +
        '<p class="tile-text">' + esc(mission) + '</p>' +
      '</div></article>' +
      '<article class="tile"><div class="tile-body">' +
        '<h3 class="tile-title">Our vision</h3>' +
        '<p class="tile-text">' + esc(vision) + '</p>' +
      '</div></article>'
    );
  }

  function renderAreas(pages) {
    var bySection = {};
    pages.forEach(function (page) {
      if (AREAS.some(function (area) { return area.section === page.section; })) {
        if (!bySection[page.section]) bySection[page.section] = page;
      }
    });

    var markup = AREAS.map(function (area) {
      var page = bySection[area.section];
      if (!page) return '';
      return (
        '<article class="tile">' +
          cards.media({}, area.icon, 'project') +
          '<div class="tile-body">' +
            '<h3 class="tile-title">' + esc(page.title) + '</h3>' +
            '<p class="tile-text">' + esc(layout.truncate(page.excerpt, 150)) + '</p>' +
            '<div class="tile-foot">' +
              '<a class="text-link" href="pages/' + area.section + '.html">Explore ' + esc(page.title) +
              layout.icon('arrow-right', 'icon icon--xs') + '</a>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    return markup ? tileGrid(markup) : '';
  }

  function init() {
    var organizationPromise = ARAMIOT.organizationReady || Promise.resolve(null);

    organizationPromise.then(function (organization) {
      renderIntroduction(organization);
      renderMission(organization);
    });

    loadSection(
      'areas',
      function () { return api.getPages({ limit: 100 }); },
      renderAreas,
      {
        count: 3,
        emptyTitle: 'Programme pages coming soon',
        emptyMessage: 'The Health, Education and Advocacy pages have not been published yet.',
      }
    );

    loadSection(
      'projects',
      function () { return api.getProjects({ limit: 3 }); },
      function (items) { return tileGrid(items.map(cards.project).join('')); },
      { emptyTitle: 'No projects published yet', emptyMessage: 'Projects will appear here once published.' }
    );

    loadSection(
      'articles',
      function () { return api.getArticles({ limit: 3 }); },
      function (items) { return tileGrid(items.map(cards.article).join('')); },
      { emptyTitle: 'No articles published yet', emptyMessage: 'News and articles will appear here once published.' }
    );

    loadSection(
      'publications',
      function () { return api.getPublications({ limit: 3 }); },
      function (items) { return tileGrid(items.map(cards.publication).join('')); },
      { emptyTitle: 'No publications yet', emptyMessage: 'Reports and papers will appear here once published.' }
    );

    loadSection(
      'impact',
      function () { return api.getImpact(); },
      function (items) {
        return '<div class="stat-grid">' + items.map(cards.statistic).join('') + '</div>';
      },
      { count: 4, emptyTitle: 'Impact figures pending', emptyMessage: 'Verified impact statistics will appear here.' }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.ARAMIOT);
