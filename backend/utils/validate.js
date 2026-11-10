'use strict';

/**
 * A very small, dependency-free validation engine for public POST payloads.
 *
 * Design goals:
 *  - whitelist: only declared fields are ever copied into the model;
 *  - sanitise: strip control characters and HTML tags from plain-text input;
 *  - report: return every problem at once as [{ field, message }].
 */

// Printable control characters and tag-like sequences are removed from plain text.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAG_LIKE = /<\/?[a-zA-Z][^>]*>/g;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{5,24}$/;

/**
 * Trim, drop control characters and strip tag-like sequences while keeping
 * ordinary text such as "5 < 10" intact.
 */
function sanitizeText(value) {
  return String(value)
    .replace(CONTROL_CHARACTERS, '')
    .replace(TAG_LIKE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function validateString(raw, rule, label, field, errors, value) {
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${label} must be text` });
    return;
  }

  const text = sanitizeText(raw);
  const min = rule.min ?? 0;
  const max = rule.max ?? 5000;

  if (text.length < min) {
    errors.push({ field, message: `${label} must be at least ${min} characters` });
    return;
  }
  if (text.length > max) {
    errors.push({ field, message: `${label} must be ${max} characters or fewer` });
    return;
  }
  value[field] = text;
}

/**
 * Validate a payload against a rule map.
 *
 * @param {object} input Raw request body.
 * @param {object} rules Field name -> rule ({ type, required, min, max, label, values, default }).
 * @returns {{ value: object, errors: Array<{ field: string, message: string }> }}
 */
function validatePayload(input, rules) {
  const value = {};
  const errors = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { value, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    const raw = input[field];

    if (isBlank(raw)) {
      if (rule.required) errors.push({ field, message: `${label} is required` });
      else if (rule.default !== undefined) value[field] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'email': {
        if (typeof raw !== 'string') {
          errors.push({ field, message: `${label} must be a valid email address` });
          break;
        }
        const email = sanitizeText(raw).toLowerCase();
        if (!EMAIL_PATTERN.test(email) || email.length > (rule.max ?? 200)) {
          errors.push({ field, message: `${label} must be a valid email address` });
        } else {
          value[field] = email;
        }
        break;
      }

      case 'phone': {
        if (typeof raw !== 'string') {
          errors.push({ field, message: `${label} must be a phone number` });
          break;
        }
        const phone = sanitizeText(raw);
        if (!PHONE_PATTERN.test(phone)) {
          errors.push({ field, message: `${label} must be a valid phone number` });
        } else {
          value[field] = phone;
        }
        break;
      }

      case 'url': {
        if (typeof raw !== 'string' || !URL_PATTERN.test(raw.trim())) {
          errors.push({ field, message: `${label} must be a valid http(s) URL` });
          break;
        }
        value[field] = raw.trim();
        break;
      }

      case 'enum': {
        const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
        if (!Array.isArray(rule.values) || !rule.values.includes(candidate)) {
          errors.push({ field, message: `${label} must be one of: ${(rule.values || []).join(', ')}` });
        } else {
          value[field] = candidate;
        }
        break;
      }

      case 'string':
      default:
        validateString(raw, rule, label, field, errors, value);
        break;
    }
  }

  return { value, errors };
}

module.exports = { validatePayload, sanitizeText, isBlank };
