'use strict';

/**
 * Convert arbitrary text into a URL-safe slug.
 * "Our Approach & Values" -> "our-approach-values"
 */
function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

module.exports = { slugify };
