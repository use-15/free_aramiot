/* global window, document */
/**
 * Generic page renderer.
 *
 * Every inner page is a static shell. This module fills:
 *   [data-page-hero]     with the Page document from the API (title, excerpt)
 *   [data-page-content]  with the Page document's editable HTML
 *   [data-list="..."]    with a paginated, optionally searchable listing
 *
 * Page structure lives in HTML; page copy and listings come from MongoDB.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var cards = ARAMIOT.cards;

  var LISTS = {
    articles: { load: api.getArticles, render: cards.article, label: 'articles', wrap: 'tile-grid' },
    projects: { load: api.getProjects, render: cards.project, label: 'projects', wrap: 'tile-grid' },
    programs: { load: api.getPrograms, render: cards.program, label: 'programmes', wrap: 'tile-grid' },
    publications: { load: api.getPublications, render: cards.publication, label: 'publications', wrap: 'tile-grid' },
    resources: { load: api.getResources, render: cards.resource, label: 'resources', wrap: 'tile-grid' },
    team: { load: api.getTeam, render: cards.teamMember, label: 'team members', wrap: 'tile-grid' },
    impact: { load: api.getImpact, render: cards.statistic, label: 'impact statistics', wrap: 'stat-grid' },
  };

  var SECTION_LABELS = {
    home: 'Home',
    overview: 'Overview',
    about: 'About',
    health: 'Health',
    education: 'Education',
    advocacy: 'Advocacy',
    'our-work': 'Our work',
    resources: 'Resources',
    'get-involved': 'Get involved',
    contact: 'Contact',
  };

  function crumbsFor(title) {
    return [
      { label: 'Home', href: 'index.html' },
      { label: title },
    ];
  }

  /* ---------------- page hero + content ---------------- */

  function renderHeroSkeleton(hero) {
    hero.innerHTML =
      '<section class="page-hero"><div class="container">' +
        '<div class="skeleton skeleton-line skeleton-line--short" style="max-width:220px"></div>' +
        '<div class="skeleton skeleton-line" style="height:34px;max-width:520px"></div>' +
        '<div class="skeleton skeleton-line skeleton-line--short" style="max-width:360px;margin-top:14px"></div>' +
      '</div></section>';
  }

  function mountPage(main) {
    var hero = main.querySelector('[data-page-hero]');
    var content = main.querySelector('[data-page-content]');
    var slug = main.getAttribute('data-page-slug');
    var fallbackTitle = (hero && hero.getAttribute('data-fallback-title')) || 'ARAMIOT';
    var fallbackLead = (hero && hero.getAttribute('data-fallback-lead')) || '';

    function renderFallback(message) {
      if (hero) {
        layout.renderPageHero(hero, {
          title: fallbackTitle,
          lead: fallbackLead,
          breadcrumb: crumbsFor(fallbackTitle),
        });
      }
      if (content && message) {
        content.innerHTML = layout.errorState({ message: message });
        var retry = content.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', function () { mountPage(main); });
        layout.refreshIcons();
      }
    }

    if (!slug) return;
    if (hero) renderHeroSkeleton(hero);

    api
      .getPage(slug)
      .then(function (response) {
        var page = response.data;

        layout.renderPageHero(hero, {
          title: page.title || fallbackTitle,
          lead: page.excerpt || fallbackLead,
          section: SECTION_LABELS[page.section] || '',
          breadcrumb: crumbsFor(page.title || fallbackTitle),
        });

        if (content) {
          content.innerHTML = page.content
            ? '<div class="prose">' + page.content + '</div>'
            : layout.emptyState({
                title: 'Content coming soon',
                message: 'This page has not been published yet.',
              });
        }
        layout.refreshIcons();
      })
      .catch(function (error) {
        renderFallback(error.message);
      });
  }

  /* ---------------- listings ---------------- */

  function pagerMarkup(state) {
    return (
      '<div class="pager">' +
        '<button class="button button--outline button--sm" type="button" data-page-prev' +
        (state.page <= 1 ? ' disabled' : '') + '>Previous</button>' +
        '<span class="pager-status">Page ' + state.page + ' of ' + state.pages + '</span>' +
        '<button class="button button--outline button--sm" type="button" data-page-next' +
        (state.page >= state.pages ? ' disabled' : '') + '>Next</button>' +
      '</div>'
    );
  }

  function mountList(container) {
    var type = container.getAttribute('data-list');
    var config = LISTS[type];
    if (!config) return;

    var limit = parseInt(container.getAttribute('data-limit'), 10) || 6;
    var category = container.getAttribute('data-category') || '';
    var searchable = container.getAttribute('data-search') === 'true';
    var state = { page: 1, search: '', pages: 1, total: 0 };

    container.innerHTML =
      (searchable
        ? '<form class="list-search" role="search" data-list-search>' +
            '<label class="visually-hidden" for="search-' + type + '">Search ' + config.label + '</label>' +
            '<input id="search-' + type + '" type="search" name="search" placeholder="Search ' + config.label + '&hellip;" autocomplete="off">' +
            '<button class="button button--primary button--sm" type="submit">Search</button>' +
          '</form>'
        : '') +
      '<div class="list-body" aria-live="polite"></div>' +
      '<div class="list-footer"></div>';

    var body = container.querySelector('.list-body');
    var footer = container.querySelector('.list-footer');
    var searchForm = container.querySelector('[data-list-search]');

    function renderFooter() {
      if (state.total === 0) {
        footer.innerHTML = '';
        return;
      }
      footer.innerHTML =
        (state.pages > 1 ? pagerMarkup(state) : '') +
        '<p class="list-count">' + state.total + ' ' + config.label + ' published</p>';

      var prev = footer.querySelector('[data-page-prev]');
      var next = footer.querySelector('[data-page-next]');

      if (prev) {
        prev.addEventListener('click', function () {
          if (state.page > 1) {
            state.page -= 1;
            load();
          }
        });
      }
      if (next) {
        next.addEventListener('click', function () {
          if (state.page < state.pages) {
            state.page += 1;
            load();
          }
        });
      }
    }

    function load() {
      body.innerHTML = layout.tilesSkeleton(Math.min(limit, 3));
      footer.innerHTML = '';

      var params = { page: state.page, limit: limit };
      if (state.search) params.search = state.search;
      if (category) params.category = category;

      config
        .load(params)
        .then(function (response) {
          var items = response.data || [];
          state.pages = (response.meta && response.meta.pages) || 1;
          state.total = (response.meta && response.meta.total) || items.length;

          if (items.length === 0) {
            body.innerHTML = layout.emptyState({
              title: state.search ? 'No results found' : 'Nothing published yet',
              message: state.search
                ? 'No ' + config.label + ' matched "' + state.search + '". Try a different word.'
                : 'Published ' + config.label + ' will appear here.',
            });
            renderFooter();
            layout.refreshIcons();
            return;
          }

          body.innerHTML =
            '<div class="' + config.wrap + '">' + items.map(config.render).join('') + '</div>';
          renderFooter();
          layout.refreshIcons();
        })
        .catch(function (error) {
          body.innerHTML = layout.errorState({ message: error.message });
          var retry = body.querySelector('[data-retry]');
          if (retry) retry.addEventListener('click', load);
          layout.refreshIcons();
        });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', function (event) {
        event.preventDefault();
        state.search = searchForm.querySelector('input').value.trim();
        state.page = 1;
        load();
      });
    }

    load();
  }

  /* ---------------- init ---------------- */

  function init() {
    var main = document.getElementById('main');
    if (!main) return;

    mountPage(main);
    main.querySelectorAll('[data-list]').forEach(mountList);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.ARAMIOT);
