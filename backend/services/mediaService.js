'use strict';

/**
 * Media service — Drive-ready contract (Phase 2).
 *
 * This module defines the media interface the admin dashboard will use to attach
 * images and documents to content. It is intentionally *not* a working Google Drive
 * integration in this phase: it documents the contract, validates what it can, and
 * leaves a clearly marked placeholder where the real Drive SDK call goes.
 *
 * Phase 3 fills in the placeholder with the actual Google Drive API / OAuth flow
 * (decided then: service account vs user-linked Drive, which Google API client,
 * where the Drive credentials live, resumable uploads, thumbnails, etc.).
 *
 * What already exists and is reusable here:
 *  - MEDIA_PROVIDERS / DEFAULT_MEDIA_PROVIDER in config/constants.js  -> ['local','google-drive']
 *  - mediaSchema (url, alt, fileId, provider, width, height) in models/sharedFields.js
 *  - fileId / fileUrl / fileProvider fields on Publication, Resource
 *  - featuredImage / coverImage / gallery (mediaSchema arrays) on the content models
 *
 * Responsibilities of this service (now and when Drive is wired in):
 *  - Normalise what the admin UI sends (a media object or a file reference) into a
 *    mediaSchema-shaped document or a fileId/fileUrl/fileProvider triple.
 *  - For "local" provider: validate the URL is present (the file is assumed to already
 *    exist at that URL, e.g. uploaded to the server's uploads/ or a CDN). This phase
 *    does NOT implement server-side file upload either; that is also Phase 3 / ops.
 *  - For "google-drive" provider: validate that fileId and a resolvable fileUrl are
 *    both present, and return a shaped media object. The real Drive verification
 *    (that the file id exists, is accessible, has the right mime type, etc.) is the
 *    Phase 3 placeholder.
 *  - Provide a small, allow-listed helper so admin routes can attach media to a document
 *    update without the frontend inventing arbitrary keys.
 *
 * Security note: this runs behind requireAdmin + CSRF wherever it is mounted, and it
 * never trusts the caller to choose arbitrary document keys (see contentHelpers.js
 * ALLOWED_UPDATE_KEYS / modelsToFields.js MODEL_FIELDS). The media service only ever
 * produces values that already belong to the model schemas.
 */

const { MEDIA_PROVIDERS, DEFAULT_MEDIA_PROVIDER } = require('../config/constants');
const ApiError = require('../utils/ApiError');

// ---- allowed media-bearing shapes -----------------------------------------

/** Media fields that every content model can carry (from mediaSchema). */
const MEDIA_FIELDS = ['url', 'alt', 'fileId', 'provider', 'width', 'height'];

/**
 * Build a single mediaSchema-shaped object from an untrusted admin payload.
 *
 * Accepts either:
 *  - a full media object { url, alt?, fileId?, provider?, width?, height? }, or
 *  - a file-reference object { fileId, fileUrl, fileProvider? } (used by Publication/Resource)
 *
 * Returns a media object that is safe to store on a mediaSchema field or to spread
 * into the fileId/fileUrl/fileProvider triple.
 *
 * Throws ApiError.badRequest when the payload is unusable.
 */
function normalizeMedia(payload) {
  if (!payload || typeof payload !== 'object') {
    throw ApiError.badRequest('A media object is required');
  }

  const out = {};

  // ---- full media object path ----
  const hasUrl = typeof payload.url === 'string' && payload.url.trim();
  const hasFileId = typeof payload.fileId === 'string' && payload.fileId.trim();
  const provider =
    typeof payload.provider === 'string' && MEDIA_PROVIDERS.includes(payload.provider)
      ? payload.provider.trim().toLowerCase()
      : null;

  if (hasUrl) {
    out.url = payload.url.trim();
    out.alt = typeof payload.alt === 'string' ? payload.alt.trim().slice(0, 200) : '';
    if (hasFileId) out.fileId = payload.fileId.trim();
    if (provider) out.provider = provider;
    if (typeof payload.width === 'number' && Number.isFinite(payload.width) && payload.width >= 0) {
      out.width = payload.width;
    }
    if (typeof payload.height === 'number' && Number.isFinite(payload.height) && payload.height >= 0) {
      out.height = payload.height;
    }
    return out;
  }

  // ---- file-reference path (Publication.fileId/fileUrl/fileProvider, Resource.externalUrl) ----
  if (hasFileId && typeof payload.fileUrl === 'string' && payload.fileUrl.trim()) {
    out.fileId = payload.fileId.trim();
    out.fileUrl = payload.fileUrl.trim();
    out.provider = provider || DEFAULT_MEDIA_PROVIDER;
    return out;
  }

  if (provider && provider !== 'local' && hasFileId) {
    // Drive-ready: a Drive file id plus at least a placeholder URL the frontend can
    // render until Phase 3 resolves a real preview/sign-url. The real Drive URL is
    // produced by the Phase 3 implementation.
    out.fileId = payload.fileId.trim();
    out.fileUrl = typeof payload.fileUrl === 'string' && payload.fileUrl.trim()
      ? payload.fileUrl.trim()
      : `https://drive.google.com/thumbnail?id=${payload.fileId.trim()}&sz=w${hasFileId ? 640 : 640}`;
    out.provider = 'google-drive';
    return out;
  }

  throw ApiError.badRequest(
    'A media object must include a url, or a fileId with a fileUrl for a non-local provider'
  );
}

/**
 * Coerce an array of media payloads into an array of normalised media objects.
 * Used by gallery-bearing models (Project.gallery).
 */
function normalizeMediaList(payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) return [];
  return payloads.map(normalizeMedia);
}

// ---- Drive-ready placeholder ----------------------------------------------

/**
 * Upload a file to the configured media provider.
 *
 * Phase 2 status: placeholder.
 *
 * Signatures are chosen now so the admin frontend and the Phase 3 implementation
 * agree on the contract:
 *  - `provider`            : 'local' | 'google-drive'
 *  - `file`               : an HTML File-like object (browser) — present only for an
 *                            in-browser upload flow; in Phase 3 this is what the Drive
 *                            upload uses. Phase 2 does not accept raw file bytes server-side.
 *  - `fileName`, `mimeType`: optional metadata the caller knows.
 *  - `onProgress?`        : callback for upload progress (Phase 3 Drive resumable upload).
 *
 * Returns a Promise that resolves to a media object (url / fileId / provider / alt / dimensions).
 *
 * In Phase 2 this always rejects with a clear message telling the caller that media
 * upload is not implemented in this phase and describing what Phase 3 will add.
 */
async function uploadToProvider(options = {}) {
  const provider = options.provider || DEFAULT_MEDIA_PROVIDER;

  if (provider !== 'google-drive') {
    // Local upload is also Phase 3 (server-side file storage / uploads dir / CDN).
    throw ApiError.notFound(
      'Media upload is not implemented in this phase. ' +
        'Set fileProvider to a supported provider and supply a fileUrl (and fileId for google-drive) directly on the document for now.'
    );
  }

  // ---- Google Drive placeholder ----
  // Phase 3 implementation sketch (not implemented here):
  //  1. Authenticate to Google Drive (service account OR user OAuth token, decided in Phase 3).
  //  2. Validate the File object (mime type, size cap, allowed types per model).
  //  3. Upload to Drive (resumable upload for large files; public-link or domain-restricted sharing).
  //  4. Return { url, fileId, provider: 'google-drive', alt?, width?, height? }.
  //  5. For documents (Publication/Resource): store fileId + a resolvable fileUrl; for images:
  //     store the thumbnail/cdn url into featuredImage / coverImage / gallery.
  //
  // Environment the Phase 3 implementation will need (not added as required env now):
  //  - a Google Cloud project with the Drive API enabled,
  //  - either a service-account key (JSON) with Drive scope, or an OAuth client + refresh
  //    token per admin user, and
  //  - a decision on sharing model (public link vs internal-only vs signed URL).
  //
  // No Google API client is installed in this phase; no OAuth flow is wired; no Drive HTTP
  // calls are made. The admin UI exposes the Drive upload UI as "coming in Phase 3" and lets
  // the admin paste a Drive file id / url where the model already supports it.

  throw ApiError.notFound(
    'Google Drive media upload is not implemented in this phase. ' +
      'Phase 3 will add the Drive API integration. For now, attach a Drive file by setting ' +
      'fileProvider to "google-drive" and supplying fileId + fileUrl on the document directly.'
  );
}

/**
 * Delete a media asset from the configured provider.
 *
 * Phase 2 status: placeholder.
 *
 * In Phase 3 this would, for example, remove the Drive file (or mark it archived) when
 * the admin removes a file from a document. For "local" provider, deletion is an ops
 * question (orphaned files in uploads/), also Phase 3.
 *
 * This function is called by the admin delete-media flow; in Phase 2 it is a no-op that
 * records the intent but does not contact any provider.
 */
async function deleteFromProvider(fileId, provider = DEFAULT_MEDIA_PROVIDER) {
  if (provider !== 'google-drive') {
    // Local files: leaving them in place is acceptable for Phase 2 (the document no longer
    // references them). Cleanup is Phase 3 ops.
    return { deleted: false, reason: 'Local media deletion is deferred to Phase 3 (orphan cleanup).' };
  }

  // ---- Google Drive placeholder ----
  // Phase 3: delete/archive the Drive file identified by fileId (with the same auth as upload).
  // Not implemented here.
  return {
    deleted: false,
    reason: 'Google Drive media deletion is not implemented in this phase (Phase 3).',
  };
}

/**
 * Build a (possibly temporary) URL to view/download a media asset.
 *
 * For "local" provider this is the stored url as-is. For "google-drive" provider this is
 * the stored fileUrl (which, in Phase 3, may be a signed/preview URL rather than the raw
 * Drive link). Phase 2 returns whatever was stored; it does not mint new signed URLs.
 */
function resolveMediaUrl(media) {
  if (!media || typeof media !== 'object') return null;
  if (typeof media.fileUrl === 'string' && media.fileUrl.trim()) return media.fileUrl.trim();
  if (typeof media.url === 'string' && media.url.trim()) return media.url.trim();
  return null;
}

// ---- public surface --------------------------------------------------------

module.exports = {
  MEDIA_FIELDS,
  normalizeMedia,
  normalizeMediaList,
  uploadToProvider,
  deleteFromProvider,
  resolveMediaUrl,
  MEDIA_PROVIDERS,
  DEFAULT_MEDIA_PROVIDER,
  PHASE: '2', // set to '3' when the Drive implementation is filled in
};
