/* global window, document */
/**
 * ARAMIOT admin rich-text editor bridge.
 *
 * Wires a Quill editor (loaded from CDN by the content page) onto any textarea
 * that carries `data-richtext="1"`. On save, the editor HTML is written back
 * into the underlying textarea so the existing form serialization keeps working.
 *
 * Field sanitisation note (matches the backend backlog):
 *   - The content fields on content models are HTML authored by the Super Admin.
 *   - The admin HTML paths are reachable only behind requireAdmin + CSRF, and the
 *     update path is allow-listed in contentHelpers.js / modelsToFields.js, so the
 *     only thing we must guard here is what reaches the backend: we strip
 *     script / on* handlers / javascript: URIs from the editor HTML before it is
 *     written to the hidden field, and the backend's sanitizeText is not appropriate
 *     for HTML (it strips tags). A future phase can add a server-side HTML
 *     allowlist sanitizer (e.g. a small allowlist DOM builder or DOMPurify) — this
 *     client step is a first line, not the only line.
 */

(function (global) {
  'use strict';

  var win = global.window;
  var doc = win.document;
  var ARAMIOT = global.ARAMIOT_ADMIN || {};
  var editors = Object.create(null);

  function $(id) {
    return doc.getElementById(id);
  }

  function q(selector, root) {
    return (root || doc).querySelector(selector);
  }

  function qs(selector, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(selector));
  }

  /** Minimal server-side-style HTML sanitizer for admin-authored content HTML. */
  function sanitizeHtml(html) {
    if (typeof html !== 'string') return '';

    // Collapse to a string we can parse.
    var cleaned = String(html)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim();

    // DOM-based allowlist: we keep a reasonable subset of formatting elements and
    // inline styles, and drop anything that can execute code or exfiltrate.
    var allowlistTag =
      /^(p|br|strong|b|em|i|u|sub|sup|s|del|mark|span|blockquote|pre|code|ul|ol|li|h1|h2|h3|h4|h5|h6|a|img|figure|figcaption|div|hr|table|thead|tbody|tr|th|td)$/i;

    var allowedAttrs =
      /^(href|src|alt|title|class|style|target|rel|width|height|data-(?!editor)|aria-[\w-]*)$/i;

    var allowHrefProtocol = /^https?:\/\//i;
    var allowSrcProtocol = /^(https?:\/\/|data:image\/(?:png|jpeg|gif|webp);)/i;

    var container = doc.createElement('div');
    container.innerHTML = cleaned;

    // First pass: prune disallowed nodes and dangerous attributes in one tree walk.
    var toRemove = [];
    var nodes = container.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var tag = node.nodeName.toLowerCase();

      if (!allowlistTag.test(tag)) {
        // Unwrap: replace the node with its children so we do not lose inner
        // formatting that was legitimately authored inside it.
        var parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        toRemove.push(node);
        continue;
      }

      // Drop dangerous attributes on every kept element.
      var attrs = Array.prototype.slice.call(node.attributes || []);
      for (var a = attrs.length - 1; a >= 0; a--) {
        var name = attrs[a].name;
        var value = attrs[a].value;
        if (!allowedAttrs.test(name)) {
          node.removeAttribute(name);
          continue;
        }
        if (name === 'href') {
          if (!allowHrefProtocol.test(value) && value !== '#') {
            node.removeAttribute(name);
          } else if (/^mailto:/i.test(value)) {
            // keep mailto
          } else {
            // keep http/https
          }
          continue;
        }
        if (name === 'src') {
          if (!allowSrcProtocol.test(value)) {
            node.removeAttribute(name);
          }
          continue;
        }
        if (name === 'style') {
          // Keep the attribute but strip anything that can execute (expression,
          // url(javascript:), behavior, etc.).
          node.setAttribute('style', sanitizeCss(value || ''));
          continue;
        }
        if (/^on/i.test(name)) {
          node.removeAttribute(name);
          continue;
        }
      }
    }

    // Remove any <script> or <style> that somehow survived (defense in depth).
    var scripts = container.querySelectorAll('script, style, iframe, object, embed, form, input, button, textarea, select, link, meta');
    for (var s = 0; s < scripts.length; s++) {
      scripts[s].parentNode.removeChild(scripts[s]);
    }

    // Serialize back to string.
    var out = container.innerHTML;

    // Re-encode a few entities that some serializers drop, then trim.
    out = out.replace(/&amp;amp;/g, '&amp;');
    out = out.replace(/\s+/g, ' ').trim();

    return out;
  }

  /** Strip executable / exfiltrating constructs from inline CSS. */
  function sanitizeCss(css) {
    if (typeof css !== 'string') return '';
    return String(css)
      .replace(/\b(expression|behavior|url\s*\(\s*["']?javascript|vbscript|(?:=|\bexec)\b)/gi, '')
      .replace(/["'\\s]*javascript\s*:/gi, '')
      .replace(/["'\\s]*data\s*:\s*text\/html/i, '')
      .trim();
  }

  /**
   * Attach a Quill editor to a textarea if Quill is present and the field is
   * marked as a richtext field.
   */
  function attachRichtextFields() {
    // Content fields are the long-form HTML fields on the content models.
    // This list mirrors the admin-content.js field keys plus the biography field
    // on team members. Short fields (title, slug, excerpt, summary, abstract,
    // author, tags, name, position, …) stay plain text.
    var richtextKeys = new Set([
      'content',
      'excerpt',
      'story',
      'mission',
      'vision',
      'description',
      'biography',
      'objectives',
      'activities',
      'abstract',
      'address.story',
    ]);

    // Richtext fields per section, so we do not accidentally turn a short field
    // into an editor just because it happens to match a key name on another model.
    var sectionRichtextFields = {
      pages: ['content'],
      articles: ['content', 'excerpt'],
      categories: ['description'],
      projects: ['description', 'objectives', 'activities'],
      programs: ['description', 'objectives', 'activities', 'targetAudience'],
      team: ['biography'],
      publications: ['abstract'],
      resources: ['description'],
    };

    var sections = Object.keys(sectionRichtextFields);

    sections.forEach(function (section) {
      var form = q('form.admin-form');
      if (!form) return;

      var config = ARAMIOT.content && ARAMIOT.content.SECTIONS && ARAMIOT.content.SECTIONS[section];
      var fieldList = config ? config.fields : null;

      qs('textarea[data-richtext]', form).forEach(function (ta) {
        // Determine whether this textarea is a richtext field for the current section.
        var name = ta.name || ta.getAttribute('name') || '';
        var isRichtext = false;

        // Prefer the explicit per-section allow-list.
        var allowed = sectionRichtextFields[section] || [];
        if (allowed.indexOf(name) !== -1) {
          isRichtext = true;
        }

        // Fallback: if the form does not expose section metadata, only turn a
        // textarea into an editor when it is explicitly marked data-richtext="1"
        // AND its name is one of the known long-form content keys. This avoids
        // turning every textarea into an editor on unrelated forms.
        if (!isRichtext && ta.getAttribute('data-richtext') === '1') {
          if (richtextKeys.has(name)) {
            isRichtext = true;
          }
        }

        if (!isRichtext) {
          ta.removeAttribute('data-richtext');
          return;
        }

        var id = ta.id || ('f-' + name);
        if (!ta.id) ta.id = id;

        // Idempotent: if this textarea already has an editor, leave it alone.
        // Re-scanning used to destroy the live editor and then skip rebuilding it,
        // which left only the first rich-text field with a working editor.
        if (editors[id]) return;

        // Sync the textarea's current value (for edit) into the editor once it
        // is created, then save back on every change and on modal save.
        var pendingValue = ta.value || '';

        if (typeof win.Quill !== 'function') {
          // Quill not loaded yet (e.g. slow CDN). Leave the textarea as-is and
          // let the page retry after Quill arrives.
          ta.setAttribute('data-richtext-pending', '1');
          return;
        }

        try {
          var toolbarOptions = [
            { header: [false, 1, 2, 3, 4] },
            'bold', 'italic', 'underline', 'strike', 'blockquote',
            { list: 'ordered' }, { list: 'bullet' },
            { indent: '-1' }, { indent: '+1' },
            'link', 'image', 'video',
            'clean',
          ];

          var editor = new win.Quill('#' + id, {
            theme: 'snow',
            placeholder: ta.getAttribute('placeholder') || 'Rich content…',
            modules: {
              toolbar: toolbarOptions,
              toolbarContainer: q('.ql-toolbar[for="' + CSS.escape(id) + '"]') || null,
            },
            formats: [
              'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
              'list', 'bullet', 'indent', 'link', 'image', 'video', 'code',
            ],
            scrollingContainer: q('.modal-body') || null,
          });

          // Initialize with existing value (edit forms).
          if (pendingValue) {
            editor.root.innerHTML = sanitizeHtml(pendingValue);
          }

          var handler = function () {
            var html = editor.root.innerHTML;
            ta.value = sanitizeHtml(html);
          };

          editor.on('text-change', handler);

          editors[id] = {
            editor: editor,
            textarea: ta,
            section: section,
            name: name,
            destroy: function () {
              try { editor.off('text-change', handler); } catch (e) {}
              try { editor.destroy(); } catch (e) {}
              try { ta.style.display = ''; ta.removeAttribute('aria-hidden'); } catch (e) {}
              delete editors[id];
            },
          };

          // Ensure the textarea reflects the editor content now (used by
          // collectFormData / prefillForm).
          handler();

          // The editor replaces the textarea visually; without this the raw
          // textarea stayed visible next to (and below) the Quill editor.
          ta.style.display = 'none';
          ta.setAttribute('aria-hidden', 'true');
        } catch (err) {
          // If Quill throws (e.g. re-init or selector issue), leave the
          // textarea alone and let the form work as plain text.
          ta.removeAttribute('data-richtext');
        }
      });
    });
  }

  /** Remove a stale editor when the form is re-rendered (e.g. modal field rebuild). */
  function prumeExistingEditors(root) {
    var container = root || doc.body;
    qs('[id^="f-"]', container).forEach(function (el) {
      if (el.tagName !== 'TEXTAREA') return;
      if (!editors[el.id]) return;
      editors[el.id].destroy();
    });
  }

  /** Sync all live editors back into their textareas (call before any save). */
  function syncAll() {
    Object.keys(editors).forEach(function (id) {
      var e = editors[id];
      if (!e) return;
      try {
        e.textarea.value = sanitizeHtml(e.editor.root.innerHTML);
      } catch (err) {
        // Editor may have been removed by the DOM during a modal rebuild.
        e.destroy();
      }
    });
  }

  /**
   * Fill rich-text textareas from field descriptors before the editors attach.
   *
   * admin-settings.js calls this after rendering a settings form, passing the
   * field list (each descriptor carries its own `value`). This function used to be
   * exported without ever being defined, which threw a ReferenceError while this
   * module was loading — the whole module then failed, ARAMIOT_ADMIN.richtext was
   * never published and no Quill editor attached anywhere.
   */
  function prefillRichtextFields(form, fields) {
    if (!form || !fields) return;
    fields.forEach(function (field) {
      if (!field || !field.key) return;
      var el = form.elements ? form.elements['f-' + field.key] : null;
      if (!el || el.tagName !== 'TEXTAREA') return;
      if (!el.hasAttribute('data-richtext')) return;
      if (field.value === undefined || field.value === null) return;
      el.value = String(field.value);
    });
  }

  /**
   * Public API used by admin-content.js and admin-settings.js.
   */
  ARAMIOT.richtext = {
    sanitizeHtml: sanitizeHtml,
    prefillRichtextFields: prefillRichtextFields,
    attach: attachRichtextFields,
    destroyFor: prumeExistingEditors,
    syncAll: syncAll,
    editors: editors,
  };

  // Boot: attach once Quill is available.
  function tryAttach() {
    if (typeof win.Quill === 'function') {
      attachRichtextFields();
    }
  }

  if (typeof doc !== 'undefined' && doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', tryAttach);
  } else {
    tryAttach();
  }

  // Retry after Quill loads (CDN script may finish after DOMContentLoaded).
  if (win.addEventListener) {
    win.addEventListener('QuilljsLoaded', tryAttach);
  }

  // Also hook into modal field rebuilds so editors do not leak across opens.
  // admin-content.js opens/closes the modal; after each open we re-scan.
  function observeModalRebuilds() {
    var modal = q('#admin-modal .modal-body');
    if (!modal) return;
    var observer = new win.MutationObserver(function () {
      // Fields were rebuilt by openModal/prefillForm; reattach editors to the
      // new textareas and drop any that no longer exist.
      prumeExistingEditors(modal);
      attachRichtextFields();
    });
    observer.observe(modal, { childList: true, subtree: true, attributes: false });
  }

  if (typeof doc !== 'undefined' && doc.readyState !== 'loading') {
    observeModalRebuilds();
  } else if (typeof doc !== 'undefined') {
    doc.addEventListener('DOMContentLoaded', observeModalRebuilds);
  }
})(typeof window !== 'undefined' ? window : this);
