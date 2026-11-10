/* global window, document, Intl */
/**
 * Layout components: header, footer, dialogs, page banners and the shared
 * loading / empty / error states used by every page.
 *
 * Components render into markup rather than living inside each HTML file, so the
 * navigation and footer exist in exactly one place.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var NAV_ITEMS = [
    {
      label: 'About',
      href: 'pages/about.html',
      children: [
        { label: 'Overview', href: 'pages/overview.html' },
        { label: 'About us', href: 'pages/about.html' },
        { label: 'Our team', href: 'pages/about.html#team' },
        { label: 'Contact', href: 'pages/contact.html' },
      ],
    },
    {
      label: 'Programmes',
      href: 'pages/health.html',
      children: [
        { label: 'Health', href: 'pages/health.html' },
        { label: 'Education', href: 'pages/education.html' },
        { label: 'Advocacy', href: 'pages/advocacy.html' },
      ],
    },
    { label: 'Our work', href: 'pages/our-work.html' },
    {
      label: 'Resources',
      href: 'pages/resources.html',
      children: [
        { label: 'All resources', href: 'pages/resources.html' },
        { label: 'Publications', href: 'pages/publications.html' },
      ],
    },
  ];

  var FOOTER_LINKS = {
    explore: [
      { label: 'Overview', href: 'pages/overview.html' },
      { label: 'About us', href: 'pages/about.html' },
      { label: 'Our work', href: 'pages/our-work.html' },
      { label: 'Get involved', href: 'pages/get-involved.html' },
      { label: 'Contact', href: 'pages/contact.html' },
    ],
    programmes: [
      { label: 'Health', href: 'pages/health.html' },
      { label: 'Education', href: 'pages/education.html' },
      { label: 'Advocacy', href: 'pages/advocacy.html' },
      { label: 'Publications', href: 'pages/publications.html' },
      { label: 'Resources', href: 'pages/resources.html' },
    ],
  };

  /* ---------------- helpers ---------------- */

  function base() {
    var value = document.body && document.body.getAttribute('data-base');
    return value || '';
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  function truncate(text, max) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= max) return value;
    return value.slice(0, max - 1).replace(/[\s,.;:]$/, '') + '\u2026';
  }

  function icon(name, className) {
    return '<i data-lucide="' + name + '" class="' + (className || 'icon') + '" aria-hidden="true"></i>';
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function currentFile() {
    var parts = window.location.pathname.split('/');
    var file = parts[parts.length - 1];
    return file || 'index.html';
  }

  function fileOf(href) {
    return href.split('#')[0].split('/').pop();
  }

  function isActive(item) {
    var current = currentFile();
    if (fileOf(item.href) === current) return true;
    return (item.children || []).some(function (child) {
      return fileOf(child.href) === current;
    });
  }

  /* ---------------- header ---------------- */

  function navItemMarkup(item) {
    var prefix = base();
    var href = prefix + item.href;
    var active = isActive(item);
    var activeClass = active ? ' is-active' : '';
    var activeAttr = active ? ' aria-current="page"' : '';

    if (!item.children || item.children.length === 0) {
      return (
        '<li><a class="nav-link' + activeClass + '" href="' + href + '"' + activeAttr + '>' +
        escapeHtml(item.label) +
        '</a></li>'
      );
    }

    var submenuId = 'submenu-' + item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var children = item.children
      .map(function (child) {
        return (
          '<li><a class="nav-sublink" href="' + prefix + child.href + '">' +
          escapeHtml(child.label) +
          '</a></li>'
        );
      })
      .join('');

    return (
      '<li class="nav-item--has-menu">' +
      '<button class="nav-link nav-link--button' + activeClass + '" type="button" ' +
      'aria-expanded="false" aria-controls="' + submenuId + '" data-submenu-toggle>' +
      escapeHtml(item.label) + icon('chevron-down', 'icon icon--xs') +
      '</button>' +
      '<ul class="nav-submenu" id="' + submenuId + '">' + children + '</ul>' +
      '</li>'
    );
  }

  function renderHeader(organization) {
    var target = document.getElementById('site-header');
    if (!target) return;

    var prefix = base();
    var name = (organization && organization.name) || 'ARAMIOT';
    var navMarkup = NAV_ITEMS.map(navItemMarkup).join('');

    target.innerHTML =
      '<header class="site-header">' +
        '<div class="container header-inner">' +
          '<a class="brand" href="' + prefix + 'index.html" aria-label="' + escapeHtml(name) + ' home">' +
            '<span class="brand-mark" aria-hidden="true">A</span>' +
            '<span class="brand-text">' +
              '<span class="brand-name">' + escapeHtml(name) + '</span>' +
              '<span class="brand-kicker">Health &middot; Education &middot; Advocacy</span>' +
            '</span>' +
          '</a>' +
          '<button class="nav-toggle" type="button" aria-expanded="false" ' +
            'aria-controls="primary-navigation" data-nav-toggle>' +
            icon('menu') + '<span class="visually-hidden">Menu</span>' +
          '</button>' +
          '<nav class="primary-nav" id="primary-navigation" aria-label="Primary">' +
            '<ul class="nav-list">' + navMarkup + '</ul>' +
            '<div class="nav-actions">' +
              '<button class="icon-button" type="button" data-open-search aria-label="Search the website">' +
                icon('search') +
              '</button>' +
              '<a class="button button--accent button--sm" href="' + prefix + 'pages/get-involved.html">Get involved</a>' +
            '</div>' +
          '</nav>' +
        '</div>' +
      '</header>';
  }

  /* ---------------- footer ---------------- */

  function footerList(title, links) {
    var prefix = base();
    return (
      '<div><h3>' + escapeHtml(title) + '</h3><ul>' +
      links
        .map(function (link) {
          return '<li><a href="' + prefix + link.href + '">' + escapeHtml(link.label) + '</a></li>';
        })
        .join('') +
      '</ul></div>'
    );
  }

  function renderFooter(organization) {
    var target = document.getElementById('site-footer');
    if (!target) return;

    var prefix = base();
    var year = new Date().getFullYear();
    var name = (organization && organization.name) || 'ARAMIOT';
    var description =
      (organization && organization.tagline) ||
      'A community-based organization working across health, education and advocacy.';
    var email = organization && organization.contactEmail;
    var phone = organization && organization.contactPhone;
    var address = organization && organization.address;

    var addressLines = address
      ? [address.street, address.city, address.region, address.country].filter(Boolean)
      : [];

    var social = organization && organization.socialLinks ? organization.socialLinks : {};
    var socialMarkup = Object.keys(social)
      .filter(function (key) { return Boolean(social[key]); })
      .map(function (key) {
        return (
          '<li><a href="' + escapeHtml(social[key]) + '" rel="noopener noreferrer" target="_blank">' +
          escapeHtml(key.charAt(0).toUpperCase() + key.slice(1)) + '</a></li>'
        );
      })
      .join('');

    target.innerHTML =
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<div class="footer-grid">' +
            '<div>' +
              '<span class="footer-brand"><span class="brand-mark" aria-hidden="true">A</span>' +
              escapeHtml(name) + '</span>' +
              '<p>' + escapeHtml(description) + '</p>' +
              (socialMarkup ? '<h3>Follow</h3><ul>' + socialMarkup + '</ul>' : '') +
            '</div>' +
            footerList('Explore', FOOTER_LINKS.explore) +
            footerList('Programmes', FOOTER_LINKS.programmes) +
            '<div>' +
              '<h3>Contact</h3>' +
              '<ul>' +
                (email
                  ? '<li><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></li>'
                  : '') +
                (phone ? '<li>' + escapeHtml(phone) + '</li>' : '') +
                (addressLines.length
                  ? '<li>' + addressLines.map(escapeHtml).join(', ') + '</li>'
                  : '') +
                '<li><a href="' + prefix + 'pages/contact.html">Contact form</a></li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
          '<div class="footer-bottom">' +
            '<span>&copy; ' + year + ' ' + escapeHtml(name) + '. All rights reserved.</span>' +
            '<span>Content managed through the ARAMIOT content system.</span>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* ---------------- dialogs ---------------- */

  function renderDialogs() {
    var wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<dialog class="search-dialog" id="search-dialog" aria-labelledby="search-dialog-title">' +
        '<div class="dialog-head">' +
          '<h2 id="search-dialog-title" class="visually-hidden">Search the website</h2>' +
          icon('search') +
          '<input id="search-input" type="search" placeholder="Search articles, publications and resources" ' +
            'autocomplete="off" aria-label="Search articles, publications and resources">' +
          '<button class="dialog-close" type="button" data-close-dialog aria-label="Close search">' +
            icon('x') +
          '</button>' +
        '</div>' +
        '<div class="dialog-body" id="search-results">' +
          '<p class="search-hint">Type at least two characters to search.</p>' +
        '</div>' +
      '</dialog>' +
      '<dialog class="detail-dialog" id="detail-dialog" aria-labelledby="detail-dialog-title">' +
        '<div class="dialog-head">' +
          '<h2 id="detail-dialog-title" class="visually-hidden">Content preview</h2>' +
          '<button class="dialog-close" type="button" data-close-dialog aria-label="Close preview" style="margin-left:auto">' +
            icon('x') +
          '</button>' +
        '</div>' +
        '<div class="dialog-body" id="detail-body"></div>' +
      '</dialog>';

    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
  }

  /* ---------------- page banner ---------------- */

  function renderPageHero(target, options) {
    if (!target) return;
    var prefix = base();
    var title = options.title || '';
    var lead = options.lead || '';
    var section = options.section || '';
    var crumbs = options.breadcrumb || [];

    var crumbMarkup = crumbs
      .map(function (crumb, index) {
        if (index === crumbs.length - 1) {
          return '<li aria-current="page">' + escapeHtml(crumb.label) + '</li>';
        }
        return '<li><a href="' + prefix + crumb.href + '">' + escapeHtml(crumb.label) + '</a></li>';
      })
      .join('');

    target.innerHTML =
      '<section class="page-hero">' +
        '<div class="container">' +
          (crumbMarkup ? '<nav aria-label="Breadcrumb"><ol class="breadcrumb-list">' + crumbMarkup + '</ol></nav>' : '') +
          (section ? '<p class="eyebrow">' + escapeHtml(section) + '</p>' : '') +
          '<h1>' + escapeHtml(title) + '</h1>' +
          (lead ? '<p class="page-lead">' + escapeHtml(lead) + '</p>' : '') +
        '</div>' +
      '</section>';
  }

  /* ---------------- shared states ---------------- */

  function tilesSkeleton(count) {
    var items = '';
    for (var i = 0; i < (count || 3); i += 1) {
      items +=
        '<div class="tile tile--skeleton" aria-hidden="true">' +
          '<div class="skeleton skeleton-media"></div>' +
          '<div class="tile-body">' +
            '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
            '<div class="skeleton skeleton-line"></div>' +
            '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
          '</div>' +
        '</div>';
    }
    return '<div class="tile-grid">' + items + '</div>' +
      '<p class="visually-hidden" role="status">Loading content&hellip;</p>';
  }

  function emptyState(options) {
    var settings = options || {};
    return (
      '<div class="state">' +
        icon(settings.icon || 'inbox') +
        '<h3>' + escapeHtml(settings.title || 'Nothing here yet') + '</h3>' +
        '<p>' + escapeHtml(settings.message || 'Published content will appear here.') + '</p>' +
      '</div>'
    );
  }

  function errorState(options) {
    var settings = options || {};
    return (
      '<div class="state state--error" role="alert">' +
        icon('alert-triangle') +
        '<h3>We could not load this content</h3>' +
        '<p>' + escapeHtml(settings.message || 'Please try again in a moment.') + '</p>' +
        (settings.retry === false
          ? ''
          : '<button class="button button--outline button--sm" type="button" data-retry>Try again</button>') +
      '</div>'
    );
  }

  ARAMIOT.layout = {
    base: base,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    truncate: truncate,
    icon: icon,
    refreshIcons: refreshIcons,
    renderHeader: renderHeader,
    renderFooter: renderFooter,
    renderDialogs: renderDialogs,
    renderPageHero: renderPageHero,
    tilesSkeleton: tilesSkeleton,
    emptyState: emptyState,
    errorState: errorState,
    NAV_ITEMS: NAV_ITEMS,
  };
})(window.ARAMIOT);
