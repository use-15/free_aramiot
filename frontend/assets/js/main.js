/* global window, document, gsap, ScrollTrigger */
/**
 * Global behaviour, loaded on every page:
 *  - renders the shared header and footer
 *  - mobile navigation and accessible dropdown menus
 *  - site-wide search dialog (articles, publications, resources)
 *  - content preview dialog
 *  - restrained GSAP transitions (hero + static section headings)
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var esc = layout.escapeHtml;

  /* ---------------- navigation ---------------- */

  function closeAllSubmenus() {
    document.querySelectorAll('.nav-item--has-menu.is-open').forEach(function (item) {
      item.classList.remove('is-open');
      var toggle = item.querySelector('[data-submenu-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function initNavigation() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('primary-navigation');
    var header = document.querySelector('.site-header');

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    document.querySelectorAll('[data-submenu-toggle]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var item = button.closest('.nav-item--has-menu');
        if (!item) return;
        var willOpen = !item.classList.contains('is-open');
        closeAllSubmenus();
        if (willOpen) {
          item.classList.add('is-open');
          button.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!header || header.contains(event.target)) return;
      closeAllSubmenus();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      closeAllSubmenus();
      if (nav && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        }
      }
    });
  }

  /* ---------------- dialogs ---------------- */

  function closeDialog(dialog) {
    if (dialog && typeof dialog.close === 'function' && dialog.open) dialog.close();
  }

  function initDialogBasics() {
    document.querySelectorAll('dialog').forEach(function (dialog) {
      var closeButton = dialog.querySelector('[data-close-dialog]');
      if (closeButton) {
        closeButton.addEventListener('click', function () { closeDialog(dialog); });
      }
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
  }

  /* ---------------- search ---------------- */

  function initSearch() {
    var dialog = document.getElementById('search-dialog');
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!dialog || !input || !results) return;

    var timer = null;

    function open() {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', 'open');
      input.focus();
      input.select();
    }

    document.querySelectorAll('[data-open-search]').forEach(function (button) {
      button.addEventListener('click', open);
    });

    document.addEventListener('keydown', function (event) {
      var isShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K');
      if (isShortcut) {
        event.preventDefault();
        open();
      }
    });

    function runSearch(term) {
      results.innerHTML = layout.tilesSkeleton(2);

      Promise.all([
        api.getArticles({ search: term, limit: 4 }).catch(function () { return { data: [] }; }),
        api.getPublications({ search: term, limit: 3 }).catch(function () { return { data: [] }; }),
        api.getResources({ search: term, limit: 3 }).catch(function () { return { data: [] }; }),
      ])
        .then(function (responses) {
          var groups = [
            { label: 'Article', type: 'articles', items: responses[0].data },
            { label: 'Publication', type: 'publications', items: responses[1].data },
            { label: 'Resource', type: 'resources', items: responses[2].data },
          ];

          var markup = '';
          var total = 0;

          groups.forEach(function (group) {
            group.items.forEach(function (item) {
              total += 1;
              markup +=
                '<button class="search-result" type="button" data-detail="' + group.type + ':' + esc(item.slug) + '" data-close-search>' +
                  layout.icon('file-text') +
                  '<span><strong>' + esc(item.title) + '</strong>' +
                  '<span>' + esc(group.label) + (item.category ? ' &middot; ' + esc(item.category.name) : '') + '</span></span>' +
                '</button>';
            });
          });

          results.innerHTML = total
            ? markup
            : layout.emptyState({
                icon: 'search-x',
                title: 'No matches found',
                message: 'Try a different word, or browse the resources and publications pages.',
              });
          layout.refreshIcons();
        })
        .catch(function (error) {
          results.innerHTML = layout.errorState({ message: error.message, retry: false });
          layout.refreshIcons();
        });
    }

    input.addEventListener('input', function () {
      var term = input.value.trim();
      window.clearTimeout(timer);
      if (term.length < 2) {
        results.innerHTML = '<p class="search-hint">Type at least two characters to search.</p>';
        return;
      }
      timer = window.setTimeout(function () { runSearch(term); }, 280);
    });
  }

  /* ---------------- content preview ---------------- */

  var DETAIL_SOURCES = {
    articles: { load: api.getArticle, kind: 'Article' },
    projects: { load: api.getProject, kind: 'Project' },
    programs: { load: api.getProgram, kind: 'Programme' },
    publications: { load: api.getPublication, kind: 'Publication' },
    resources: { load: api.getResource, kind: 'Resource' },
  };

  function detailList(heading, items) {
    if (!items || items.length === 0) return '';
    return (
      '<h3>' + esc(heading) + '</h3><ul>' +
      items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') +
      '</ul>'
    );
  }

  function fileButton(url, label) {
    if (!url) return '';
    return (
      '<p><a class="button button--outline button--sm" href="' + esc(url) + '" target="_blank" ' +
      'rel="noopener noreferrer">' + esc(label) + layout.icon('external-link', 'icon icon--xs') + '</a></p>'
    );
  }

  function renderDetail(type, doc) {
    var meta = [];
    if (doc.category && doc.category.name) meta.push(doc.category.name);
    if (doc.publicationType) meta.push(doc.publicationType.replace(/-/g, ' '));
    if (doc.resourceType) meta.push(doc.resourceType.replace(/-/g, ' '));
    var date = doc.publishedAt || doc.publicationDate || doc.startDate;
    if (date) meta.push(layout.formatDate(date));
    if (doc.location) meta.push(doc.location);
    if (doc.author) meta.push(doc.author);

    var body = '';

    if (type === 'articles') {
      body = '<div class="prose">' + (doc.content || '<p>' + esc(doc.excerpt || '') + '</p>') + '</div>';
    } else if (type === 'projects') {
      body =
        (doc.summary ? '<p>' + esc(doc.summary) + '</p>' : '') +
        (doc.description ? '<p>' + esc(doc.description) + '</p>' : '') +
        detailList('Objectives', doc.objectives) +
        detailList('Activities', doc.activities);
    } else if (type === 'programs') {
      body =
        (doc.description ? '<p>' + esc(doc.description) + '</p>' : '') +
        detailList('Objectives', doc.objectives) +
        detailList('Activities', doc.activities) +
        (doc.targetAudience ? '<p><strong>Who it is for:</strong> ' + esc(doc.targetAudience) + '</p>' : '');
    } else if (type === 'publications') {
      body =
        (doc.abstract ? '<p>' + esc(doc.abstract) + '</p>' : '') +
        (doc.authors && doc.authors.length
          ? '<p><strong>Authors:</strong> ' + esc(doc.authors.join(', ')) + '</p>'
          : '') +
        fileButton(doc.fileUrl, 'Open document');
    } else {
      body =
        (doc.description ? '<p>' + esc(doc.description) + '</p>' : '') +
        fileButton(doc.fileUrl, 'Open file') +
        fileButton(doc.externalUrl, 'Open external link');
    }

    return (
      '<h2 class="detail-title" id="detail-dialog-title">' + esc(doc.title) + '</h2>' +
      (meta.length
        ? '<p class="detail-meta">' + meta.map(esc).join(' <span aria-hidden="true">&middot;</span> ') + '</p>'
        : '') +
      body
    );
  }

  function openDetail(type, slug) {
    var dialog = document.getElementById('detail-dialog');
    var body = document.getElementById('detail-body');
    var source = DETAIL_SOURCES[type];
    if (!dialog || !body || !source) return;

    body.innerHTML = layout.tilesSkeleton(1);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    body.scrollTop = 0;

    source
      .load(slug)
      .then(function (response) {
        body.innerHTML = renderDetail(type, response.data);
        layout.refreshIcons();
      })
      .catch(function (error) {
        body.innerHTML = layout.errorState({ message: error.message, retry: false });
        layout.refreshIcons();
      });
  }

  function initDetailLinks() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-detail]');
      if (!trigger) return;

      if (trigger.hasAttribute('data-close-search')) {
        closeDialog(document.getElementById('search-dialog'));
      }

      var parts = trigger.getAttribute('data-detail').split(':');
      openDetail(parts[0], parts[1]);
    });
  }

  /* ---------------- animation ---------------- */

  function initAnimations() {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !window.gsap) return;

    if (document.querySelector('.hero h1')) {
      gsap.from('.hero .eyebrow, .hero h1, .hero-lead, .hero-actions, .hero-meta', {
        y: 22,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power2.out',
      });
    }

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      gsap.utils.toArray('.section-head, .split-media, .split-body, .form-card').forEach(function (element) {
        gsap.from(element, {
          y: 20,
          opacity: 0,
          duration: 0.55,
          ease: 'power1.out',
          scrollTrigger: { trigger: element, start: 'top 90%', once: true },
        });
      });
    }
  }

  /* ---------------- boot ---------------- */

  function boot() {
    // Render the header immediately with a blank organization so the navigation is
    // visible right away. It is re-rendered with the real organization data (and the
    // logo image, when one is configured) as soon as the organization API responds.
    layout.renderHeader(null);
    layout.renderDialogs();
    initNavigation();
    layout.refreshIcons();
    initDialogBasics();
    initSearch();
    initDetailLinks();

    ARAMIOT.organizationReady = api
      .getOrganization()
      .then(function (response) {
        ARAMIOT.organization = response.data;
        layout.renderHeader(response.data);
        layout.renderFooter(response.data);
        return response.data;
      })
      .catch(function () {
        ARAMIOT.organization = null;
        layout.renderHeader(null);
        layout.renderFooter(null);
        return null;
      })
      .then(function (organization) {
        layout.refreshIcons();
        initAnimations();
        return organization;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.ARAMIOT);
