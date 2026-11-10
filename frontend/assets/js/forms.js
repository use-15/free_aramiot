/* global window, document, FormData */
/**
 * Public forms: contact, volunteer application, partnership inquiry.
 * Client-side validation is a convenience; the API validates and sanitises
 * everything again, and its field-level errors are shown to the user.
 */

window.ARAMIOT = window.ARAMIOT || {};

(function (ARAMIOT) {
  'use strict';

  var api = ARAMIOT.api;
  var layout = ARAMIOT.layout;
  var esc = layout.escapeHtml;

  var SUBMITTERS = {
    contact: api.submitContact,
    volunteer: api.submitVolunteer,
    partnership: api.submitPartnership,
  };

  function readValues(form) {
    var values = {};
    new FormData(form).forEach(function (value, key) {
      values[key] = typeof value === 'string' ? value.trim() : value;
    });
    return values;
  }

  function clearAlert(form) {
    var alert = form.querySelector('[data-form-alert]');
    if (!alert) return;
    alert.className = 'form-alert';
    alert.innerHTML = '';
  }

  function showAlert(form, variant, message, details) {
    var alert = form.querySelector('[data-form-alert]');
    if (!alert) return;

    var detailList =
      details && details.length
        ? '<ul>' + details.map(function (detail) { return '<li>' + esc(detail.message) + '</li>'; }).join('') + '</ul>'
        : '';

    alert.className = 'form-alert form-alert--' + variant + ' is-visible';
    alert.innerHTML = '<strong>' + esc(message) + '</strong>' + detailList;
    alert.focus();
  }

  function bind(form) {
    var kind = form.getAttribute('data-form');
    var submit = form.querySelector('[type="submit"]');
    var submitter = SUBMITTERS[kind];

    if (!submitter || !submit) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearAlert(form);

      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var originalLabel = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Sending\u2026';

      submitter(readValues(form))
        .then(function (response) {
          form.reset();
          showAlert(form, 'success', response.message || 'Thank you — your submission has been received.');
        })
        .catch(function (error) {
          showAlert(form, 'error', error.message || 'Your submission could not be sent. Please try again.', error.details);
        })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = originalLabel;
        });
    });
  }

  /* ---------------- contact details (from the organization profile) ---------------- */

  function contactItem(iconName, label, value, href) {
    var valueMarkup = href
      ? '<a href="' + esc(href) + '">' + esc(value) + '</a>'
      : esc(value);
    return (
      '<div class="contact-item">' +
        layout.icon(iconName) +
        '<div><dt>' + esc(label) + '</dt><dd>' + valueMarkup + '</dd></div>' +
      '</div>'
    );
  }

  function renderContactDetails() {
    var target = document.querySelector('[data-contact-details]');
    if (!target) return;

    (ARAMIOT.organizationReady || Promise.resolve(null)).then(function (organization) {
      if (!organization) {
        target.innerHTML = '<p class="hint">Contact details are currently unavailable. Please use the form.</p>';
        return;
      }

      var address = organization.address || {};
      var addressText = [address.street, address.city, address.region, address.country]
        .filter(Boolean)
        .join(', ');

      target.innerHTML =
        '<dl>' +
        (organization.contactEmail
          ? contactItem('mail', 'Email', organization.contactEmail, 'mailto:' + organization.contactEmail)
          : '') +
        (organization.contactPhone ? contactItem('phone', 'Phone', organization.contactPhone) : '') +
        (addressText ? contactItem('map-pin', 'Address', addressText) : '') +
        '</dl>' +
        '<p class="hint">Partnership enquiries can be sent through the form, or use the partnership form on the Get involved page.</p>';
      layout.refreshIcons();
    });
  }

  function init() {
    document.querySelectorAll('form[data-form]').forEach(bind);
    renderContactDetails();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.ARAMIOT);
