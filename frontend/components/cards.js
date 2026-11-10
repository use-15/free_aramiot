/* global window, document */
/**
 * Content preview cards.
 * Each function receives one API document and returns accessible card markup.
 * Cards open the full record in the shared preview dialog (no separate detail
 * pages in Phase 1), so no link ever points at a page that does not exist.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var layout = ARAMIOT.layout;
  var escapeHtml = layout.escapeHtml;
  var formatDate = layout.formatDate;
  var truncate = layout.truncate;
  var icon = layout.icon;

  function media(item, iconName, variant, fallbackAlt) {
    var image = item.featuredImage || item.coverImage || item.profileImage;
    if (image && image.url) {
      return (
        '<div class="tile-media tile-media--' + variant + '">' +
          '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt || fallbackAlt || '') + '" loading="lazy">' +
        '</div>'
      );
    }
    return '<div class="tile-media tile-media--' + variant + '" aria-hidden="true">' + icon(iconName) + '</div>';
  }

  function chip(label, variant) {
    if (!label) return '';
    return '<span class="chip' + (variant ? ' chip--' + variant : '') + '">' + escapeHtml(label) + '</span>';
  }

  function detailButton(type, slug, label) {
    return (
      '<button class="text-link" type="button" data-detail="' + type + ':' + escapeHtml(slug) + '">' +
      escapeHtml(label || 'Read more') + icon('arrow-right', 'icon icon--xs') +
      '</button>'
    );
  }

  function article(item) {
    return (
      '<article class="tile">' +
        media(item, 'newspaper', 'article', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.category ? item.category.name : 'News') +
            (item.publishedAt ? '<time datetime="' + escapeHtml(item.publishedAt) + '">' + formatDate(item.publishedAt) + '</time>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.excerpt, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('articles', item.slug, 'Read article') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function project(item) {
    var period = [formatDate(item.startDate), item.endDate ? formatDate(item.endDate) : 'Ongoing']
      .filter(Boolean)
      .join(' \u2013 ');

    return (
      '<article class="tile">' +
        media(item, 'folder-open', 'project', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.category ? item.category.name : 'Project') +
            (period ? '<span>' + escapeHtml(period) + '</span>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.summary || item.description, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('projects', item.slug, 'View project') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function program(item) {
    return (
      '<article class="tile">' +
        media(item, 'hand-heart', 'program', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.category ? item.category.name : 'Programme') +
            (item.location ? '<span>' + escapeHtml(item.location) + '</span>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.description, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('programs', item.slug, 'View programme') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function publication(item) {
    return (
      '<article class="tile">' +
        media(item, 'file-text', 'publication', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.publicationType ? item.publicationType.replace(/-/g, ' ') : 'Publication', 'accent') +
            (item.publicationDate ? '<time datetime="' + escapeHtml(item.publicationDate) + '">' + formatDate(item.publicationDate) + '</time>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.abstract, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('publications', item.slug, 'View publication') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function resource(item) {
    return (
      '<article class="tile">' +
        media(item, 'book-open', 'resource', item.title) +
        '<div class="tile-body">' +
          '<p class="tile-meta">' +
            chip(item.resourceType ? item.resourceType.replace(/-/g, ' ') : 'Resource', 'accent') +
            (item.category ? '<span>' + escapeHtml(item.category.name) + '</span>' : '') +
          '</p>' +
          '<h3 class="tile-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(item.description, 150)) + '</p>' +
          '<div class="tile-foot">' + detailButton('resources', item.slug, 'View resource') + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function teamMember(item) {
    return (
      '<article class="tile tile--person">' +
        media(item, 'user-round', 'person', item.name) +
        '<div class="tile-body">' +
          '<h3 class="tile-title">' + escapeHtml(item.name) + '</h3>' +
          '<p class="tile-role">' + escapeHtml(item.position) + '</p>' +
          (item.department ? '<p class="tile-text">' + escapeHtml(item.department) + '</p>' : '') +
          (item.biography ? '<p class="tile-text">' + escapeHtml(truncate(item.biography, 140)) + '</p>' : '') +
        '</div>' +
      '</article>'
    );
  }

  function statistic(item) {
    var value = Number(item.value || 0);
    var formatted = value >= 1000 ? new Intl.NumberFormat('en-GB').format(value) : String(value);

    return (
      '<div class="stat">' +
        '<span class="stat-value">' + escapeHtml(formatted) + (item.unit ? escapeHtml(item.unit) : '') + '</span>' +
        '<p class="stat-label">' + escapeHtml(item.title) + '</p>' +
      '</div>'
    );
  }

  function pageSummary(page, href) {
    return (
      '<article class="tile">' +
        '<div class="tile-body">' +
          '<h3 class="tile-title"><a href="' + escapeHtml(href) + '">' + escapeHtml(page.title) + '</a></h3>' +
          '<p class="tile-text">' + escapeHtml(truncate(page.excerpt, 140)) + '</p>' +
          '<div class="tile-foot">' +
            '<a class="text-link" href="' + escapeHtml(href) + '">Learn more' + icon('arrow-right', 'icon icon--xs') + '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  ARAMIOT.cards = {
    article: article,
    project: project,
    program: program,
    publication: publication,
    resource: resource,
    teamMember: teamMember,
    statistic: statistic,
    pageSummary: pageSummary,
    chip: chip,
    media: media,
  };
})(window.ARAMIOT);
