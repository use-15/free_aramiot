/* global window, document */
/**
 * ARAMIOT admin settings/profile form helper.
 *
 * Used by the organization, website-settings and account pages to render and save
 * a single document edit form. Keeps the pages thin and consistent.
 */

(function (global) {
  'use strict';

  var win = global.window;
  var doc = win.document;
  var ARAMIOT = global.ARAMIOT_ADMIN || {};
  var api = ARAMIOT.api;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showAlert(message, kind) {
    var alertEl = doc.getElementById('page-alert');
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = 'admin-alert admin-alert--' + (kind || 'error') + ' admin-hide';
    alertEl.classList.remove('admin-hide');
    setTimeout(function () {
      alertEl.classList.add('admin-hide');
    }, 6000);
  }

  /**
   * Build a form field for a scalar document field.
   * f = { key, label, type: 'text'|'email'|'textarea'|'number'|'date'|'select'|'checkbox', required, placeholder, options, help }
   */
  function fieldHtml(f) {
    var wrap = doc.createElement('div');
    wrap.className = 'field';

    var label = doc.createElement('label');
    label.setAttribute('for', 'f-' + f.key);
    label.textContent = f.label;
    if (f.required) {
      var r = doc.createElement('span');
      r.className = 'text-danger';
      r.textContent = ' *';
      label.appendChild(r);
    }
    wrap.appendChild(label);

    var help = f.help ? (function () {
      var h = doc.createElement('small');
      h.className = 'field-hint';
      h.textContent = f.help;
      return h;
    })() : null;

    var type = f.type;
    if (type === 'textarea') {
      var ta = doc.createElement('textarea');
      ta.id = 'f-' + f.key;
      ta.name = f.key;
      ta.rows = 4;
      if (f.value !== undefined && f.value !== null) ta.value = String(f.value);
      if (f.placeholder) ta.placeholder = f.placeholder;
      if (f.required) ta.required = true;
      wrap.appendChild(ta);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'select') {
      var sel = doc.createElement('select');
      sel.id = 'f-' + f.key;
      sel.name = f.key;
      if (f.required) sel.required = true;
      (f.options || []).forEach(function (opt) {
        var o = doc.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (f.value !== undefined && opt === f.value) o.selected = true;
        sel.appendChild(o);
      });
      if (f.placeholder) {
        var ghost = doc.createElement('option');
        ghost.value = '';
        ghost.textContent = f.placeholder;
        ghost.disabled = true;
        ghost.selected = !(f.value !== undefined);
        sel.insertBefore(ghost, sel.firstChild);
      }
      wrap.appendChild(sel);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'checkbox') {
      var cbWrap = doc.createElement('div');
      cbWrap.className = 'checkbox-field';
      var cb = doc.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'f-' + f.key;
      cb.name = f.key;
      // Without this the box always rendered unchecked, so saving the account
      // form silently disabled the account.
      cb.checked = !!f.value;
      cbWrap.appendChild(cb);
      var cbLabel = doc.createElement('label');
      cbLabel.setAttribute('for', 'f-' + f.key);
      cbLabel.textContent = f.label + (f.required ? ' *' : '');
      cbWrap.appendChild(cbLabel);
      if (help) cbWrap.appendChild(help);
      return cbWrap;
    }

    if (type === 'date') {
      var input = doc.createElement('input');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.type = 'date';
      if (f.value) input.value = String(f.value).slice(0, 10);
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'number') {
      var input = doc.createElement('input');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.type = 'number';
      if (f.value !== undefined && f.value !== null && f.value !== '') input.value = String(f.value);
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      if (f.min !== undefined) input.min = f.min;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    if (type === 'email') {
      var input = doc.createElement('input');
      input.id = 'f-' + f.key;
      input.name = f.key;
      input.type = 'email';
      if (f.value !== undefined && f.value !== null) input.value = String(f.value);
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      wrap.appendChild(input);
      if (help) wrap.appendChild(help);
      return wrap;
    }

    // text
    var input = doc.createElement('input');
    input.id = 'f-' + f.key;
    input.name = f.key;
    input.type = 'text';
    // Field values were never copied into the inputs, so every settings form
    // rendered empty and saving it would have wiped the stored document.
    if (f.value !== undefined && f.value !== null) input.value = String(f.value);
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.required) input.required = true;
    wrap.appendChild(input);
    if (help) wrap.appendChild(help);
    return wrap;
  }

  /**
   * Field descriptors for the organization / website-settings document.
   */
  function organizationFields(doc) {
    var vals = doc || {};
    return [
      { key: 'name', label: 'Organization name', type: 'text', required: true, placeholder: 'ARAMIOT', value: vals.name },
      { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'A short tagline', value: vals.tagline },
      { key: 'description', label: 'Description', type: 'textarea', richtext: true, placeholder: 'Who ARAMIOT is (HTML)', value: vals.description },
      { key: 'story', label: 'Our story', type: 'textarea', richtext: true, placeholder: 'The story behind ARAMIOT (HTML)', value: vals.story },
      { key: 'mission', label: 'Mission', type: 'textarea', richtext: true, placeholder: 'Our mission (HTML)', value: vals.mission },
      { key: 'vision', label: 'Vision', type: 'textarea', richtext: true, placeholder: 'Our vision (HTML)', value: vals.vision },
      { key: 'values', label: 'Values', type: 'textarea', placeholder: 'One value per line', help: 'Stored as a list; write one value per line.', value: Array.isArray(vals.values) ? vals.values.join('\n') : (vals.values || '') },
      { key: 'contactEmail', label: 'Contact email', type: 'email', placeholder: 'hello@aramiot.org', value: vals.contactEmail },
      { key: 'contactPhone', label: 'Contact phone', type: 'text', placeholder: '+1 234 567 8900', value: vals.contactPhone },
      { key: 'addressStreet', label: 'Street', type: 'text', placeholder: 'Street address', value: (vals.address && vals.address.street) || '' },
      { key: 'addressCity', label: 'City', type: 'text', placeholder: 'City', value: (vals.address && vals.address.city) || '' },
      { key: 'addressRegion', label: 'Region', type: 'text', placeholder: 'State / region', value: (vals.address && vals.address.region) || '' },
      { key: 'addressPostalCode', label: 'Postal code', type: 'text', placeholder: 'Postal code', value: (vals.address && vals.address.postalCode) || '' },
      { key: 'addressCountry', label: 'Country', type: 'text', placeholder: 'Country', value: (vals.address && vals.address.country) || '' },
      { key: 'logoUrl', label: 'Logo URL', type: 'text', placeholder: 'https://…', value: (vals.logo && vals.logo.url) || '' },
      { key: 'logoAlt', label: 'Logo alt text', type: 'text', placeholder: 'Alt text for the logo', value: (vals.logo && vals.logo.alt) || '' },
      { key: 'facebook', label: 'Facebook', type: 'text', placeholder: 'https://facebook.com/…', value: (vals.socialLinks && vals.socialLinks.facebook) || '' },
      { key: 'x', label: 'X (Twitter)', type: 'text', placeholder: 'https://x.com/…', value: (vals.socialLinks && vals.socialLinks.x) || '' },
      { key: 'instagram', label: 'Instagram', type: 'text', placeholder: 'https://instagram.com/…', value: (vals.socialLinks && vals.socialLinks.instagram) || '' },
      { key: 'linkedin', label: 'LinkedIn', type: 'text', placeholder: 'https://linkedin.com/…', value: (vals.socialLinks && vals.socialLinks.linkedin) || '' },
      { key: 'youtube', label: 'YouTube', type: 'text', placeholder: 'https://youtube.com/…', value: (vals.socialLinks && vals.socialLinks.youtube) || '' },
    ];
  }

  function valuesFromForm(form, fields) {
    var out = {};
    fields.forEach(function (f) {
      var el = form.elements['f-' + f.key];
      if (!el) return;
      if (f.type === 'checkbox') {
        out[f.key] = el.checked;
        return;
      }
      if (f.key === 'values') {
        out.values = el.value.split(/\n+/).map(function (t) { return t.trim(); }).filter(Boolean);
        return;
      }
      if (f.key === 'addressStreet' || f.key === 'addressCity' || f.key === 'addressRegion' || f.key === 'addressPostalCode' || f.key === 'addressCountry') {
        if (!out.address) out.address = {};
        out.address[f.key.replace('address', '').toLowerCase()] = el.value.trim();
        return;
      }
      if (f.key === 'logoUrl' || f.key === 'logoAlt') {
        if (!out.logo) out.logo = {};
        var sub = f.key === 'logoUrl' ? 'url' : 'alt';
        out.logo[sub] = el.value.trim();
        return;
      }
      if (f.key === 'facebook' || f.key === 'x' || f.key === 'instagram' || f.key === 'linkedin' || f.key === 'youtube') {
        if (!out.socialLinks) out.socialLinks = {};
        out.socialLinks[f.key] = el.value.trim();
        return;
      }
      out[f.key] = el.value.trim();
    });
    return out;
  }

  /**
   * Render the settings form into a container.
   * fields: array of field descriptors (with value pre-filled)
   * onSave: (payload) => Promise
   * afterSave: () => void
   */
  function renderForm(container, fields, onSave, afterSave) {
    container.innerHTML = '';
    var form = doc.createElement('form');
    form.className = 'admin-form';
    form.novalidate = true;

    fields.forEach(function (f) {
      form.appendChild(fieldHtml(f));
    });

    // Prefill richtext textareas so the editor (attached after this function
    // returns) picks up the existing document HTML.
    if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
      global.ARAMIOT_ADMIN.richtext.prefillRichtextFields(form, fields);
    }

    var footer = doc.createElement('div');
    footer.className = 'admin-card-footer';
    var cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-admin btn-admin--secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () {
      if (afterSave) afterSave();
    });
    var save = doc.createElement('button');
    save.type = 'submit';
    save.className = 'btn-admin btn-admin--primary';
    save.textContent = 'Save changes';
    save.disabled = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (save.disabled) return;

      // Sync richtext editors back into their textareas before serializing this
      // form (the editor root HTML is the source of truth).
      if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
        global.ARAMIOT_ADMIN.richtext.syncAll();
      }

      save.disabled = true;
      save.textContent = 'Saving…';
      var payload = valuesFromForm(form, fields);
      onSave(payload)
        .then(function () {
          save.disabled = false;
          save.textContent = 'Save changes';
          showAlert('Saved.', 'success');
          if (afterSave) afterSave();
          // Re-render re-creates the form DOM; reattach richtext editors so the
          // next edit still has an editor where one is expected.
          if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
            global.ARAMIOT_ADMIN.richtext.destroyFor(form);
            global.ARAMIOT_ADMIN.richtext.attach();
          }
        })
        .catch(function (err) {
          save.disabled = false;
          save.textContent = 'Save changes';
          showAlert((err && err.message) || 'Save failed.', 'error');
        });
    });

    footer.appendChild(cancel);
    footer.appendChild(save);
    container.appendChild(form);
    return form;
  }

  /**
   * Email + password + status form for the account page.
   */
  function renderAccountForm(container, admin) {
    container.innerHTML = '';
    var form = doc.createElement('form');
    form.className = 'admin-form';

    var emailField = { key: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'admin@aramiot.org', value: admin.email };
    form.appendChild(fieldHtml(emailField));

    var activeField = { key: 'isActive', label: 'Account active', type: 'checkbox', value: admin.isActive };
    form.appendChild(fieldHtml(activeField));

    var note = doc.createElement('p');
    note.className = 'text-muted small';
    note.textContent = 'Changing your email or active status updates your account. The password change is separate below.';
    form.appendChild(note);

    var footer = doc.createElement('div');
    footer.className = 'admin-card-footer';
    var cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-admin btn-admin--secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () { window.ARAMIOT_ADMIN.account && window.ARAMIOT_ADMIN.account.loadProfile(); });
    var save = doc.createElement('button');
    save.type = 'submit';
    save.className = 'btn-admin btn-admin--primary';
    save.textContent = 'Save account';
    save.disabled = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (save.disabled) return;
      var el = form.elements['f-email'];
      var email = el ? el.value.trim() : '';
      var activeEl = form.elements['f-isActive'];
      var active = activeEl ? activeEl.checked : admin.isActive;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert('A valid email address is required.', 'error');
        return;
      }
      save.disabled = true;
      save.textContent = 'Saving…';
      api.updateAccount({ email: email, isActive: active })
        .then(function () {
          save.disabled = false;
          save.textContent = 'Save account';
          showAlert('Account updated.', 'success');
          // re-fetch to reflect saved values
          if (window.ARAMIOT_ADMIN.account) window.ARAMIOT_ADMIN.account.loadProfile();
          // Account form has no richtext fields, but reattach defensively in case
          // a future field is marked richtext.
          if (global.ARAMIOT_ADMIN && global.ARAMIOT_ADMIN.richtext) {
            global.ARAMIOT_ADMIN.richtext.destroyFor(form);
            global.ARAMIOT_ADMIN.richtext.attach();
          }
        })
        .catch(function (err) {
          save.disabled = false;
          save.textContent = 'Save account';
          showAlert((err && err.message) || 'Account update failed.', 'error');
        });
    });
    footer.appendChild(cancel);
    footer.appendChild(save);
    form.appendChild(footer);

    // password change subsection
    var pwdWrap = doc.createElement('div');
    pwdWrap.className = 'admin-card mt-4';
    var pwdHeader = doc.createElement('div');
    pwdHeader.className = 'admin-card-header';
    var pwdTitle = doc.createElement('h2');
    pwdTitle.className = 'admin-card-title';
    pwdTitle.textContent = 'Change password';
    pwdHeader.appendChild(pwdTitle);
    pwdWrap.appendChild(pwdHeader);

    var pwdBody = doc.createElement('div');
    pwdBody.className = 'admin-card-body';

    var curLabel = doc.createElement('label');
    curLabel.setAttribute('for', 'pwd-current');
    curLabel.textContent = 'Current password';
    var curInput = doc.createElement('input');
    curInput.type = 'password';
    curInput.id = 'pwd-current';
    curInput.name = 'currentPassword';
    curInput.required = true;
    curInput.placeholder = '••••••••';
    var curWrap = doc.createElement('div');
    curWrap.className = 'field';
    curWrap.appendChild(curLabel);
    curWrap.appendChild(curInput);
    pwdBody.appendChild(curWrap);

    var newLabel = doc.createElement('label');
    newLabel.setAttribute('for', 'pwd-new');
    newLabel.textContent = 'New password';
    var newInput = doc.createElement('input');
    newInput.type = 'password';
    newInput.id = 'pwd-new';
    newInput.name = 'newPassword';
    newInput.required = true;
    newInput.placeholder = 'At least 12 characters';
    var newWrap = doc.createElement('div');
    newWrap.className = 'field';
    newWrap.appendChild(newLabel);
    newWrap.appendChild(newInput);
    pwdBody.appendChild(newWrap);

    var newConfLabel = doc.createElement('label');
    newConfLabel.setAttribute('for', 'pwd-confirm');
    newConfLabel.textContent = 'Confirm new password';
    var newConfInput = doc.createElement('input');
    newConfInput.type = 'password';
    newConfInput.id = 'pwd-confirm';
    newConfInput.name = 'newPasswordConfirm';
    newConfInput.required = true;
    newConfInput.placeholder = 'Repeat new password';
    var newConfWrap = doc.createElement('div');
    newConfWrap.className = 'field';
    newConfWrap.appendChild(newConfLabel);
    newConfWrap.appendChild(newConfInput);
    pwdBody.appendChild(newConfWrap);

    var pwdNote = doc.createElement('p');
    pwdNote.className = 'text-muted small';
    pwdNote.textContent = 'Use a strong, unique password. This will sign you out of other sessions once the change takes effect.';
    pwdBody.appendChild(pwdNote);

    var pwdFooter = doc.createElement('div');
    pwdFooter.className = 'admin-card-footer';
    var pwdCancel = doc.createElement('button');
    pwdCancel.type = 'button';
    pwdCancel.className = 'btn-admin btn-admin--secondary';
    pwdCancel.textContent = 'Cancel';
    var pwdSave = doc.createElement('button');
    pwdSave.type = 'submit';
    pwdSave.className = 'btn-admin btn-admin--primary';
    pwdSave.textContent = 'Change password';
    pwdSave.disabled = false;
    var pwdForm = doc.createElement('form');
    pwdForm.className = 'admin-form';
    pwdForm.novalidate = true;
    pwdForm.appendChild(pwdBody);
    pwdForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pwdSave.disabled) return;
      var cur = pwdForm.elements['currentPassword'].value;
      var n = pwdForm.elements['newPassword'].value;
      var conf = pwdForm.elements['newPasswordConfirm'].value;
      if (!cur || !n || !conf) {
        showAlert('Please fill in all password fields.', 'error');
        return;
      }
      if (n !== conf) {
        showAlert('The new password does not match the confirmation.', 'error');
        return;
      }
      if (n.length < 12) {
        showAlert('The new password must be at least 12 characters.', 'error');
        return;
      }
      pwdSave.disabled = true;
      pwdSave.textContent = 'Changing…';
      api.changePassword(cur, n)
        .then(function () {
          pwdSave.disabled = false;
          pwdSave.textContent = 'Change password';
          showAlert('Password changed. You may want to sign in again on other devices.', 'success');
          pwdForm.elements['currentPassword'].value = '';
          pwdForm.elements['newPassword'].value = '';
          pwdForm.elements['newPasswordConfirm'].value = '';
        })
        .catch(function (err) {
          pwdSave.disabled = false;
          pwdSave.textContent = 'Change password';
          showAlert((err && err.message) || 'Password change failed.', 'error');
        });
    });
    pwdCancel.addEventListener('click', function () {
      pwdForm.reset();
    });
    pwdFooter.appendChild(pwdCancel);
    pwdFooter.appendChild(pwdSave);
    pwdForm.appendChild(pwdFooter);
    pwdWrap.appendChild(pwdForm);
    // The profile form (email + active) was built but never attached, so the
    // account page showed only the password card and the email could not be
    // changed at all.
    container.appendChild(form);
    container.appendChild(pwdWrap);

    return form;
  }

  ARAMIOT.settings = {
    organizationFields: organizationFields,
    valuesFromForm: valuesFromForm,
    renderForm: renderForm,
    renderAccountForm: renderAccountForm,
    showAlert: showAlert,
  };
})(typeof window !== 'undefined' ? window : this);
