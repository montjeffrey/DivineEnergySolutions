/**
 * src/backend/googleReviewsSync.js
 *
 * Backend-only module for syncing Google Places reviews into the Wix CMS.
 * NOT a web module — cannot be called from frontend code. Called only by:
 *   - jobs.config (daily schedule)
 *   - Manual trigger from another backend module (e.g., a dashboard page)
 *
 * Secrets required in Wix Secrets Manager:
 *   GOOGLE_PLACES_API_KEY — dedicated key, restricted to Places API (New)
 *   DES_PLACE_ID          — ChIJ... string for the DES listing
 *
 * CMS Collections required:
 *   GoogleReviews    — individual reviews (Admin perms)
 *   ReviewsSummary   — aggregate rating + count, single doc _id = "des-summary"
 */

import { secrets } from 'wix-secrets-backend.v2';
import { elevate } from 'wix-auth';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

// wix-secrets-backend.v2 requires elevated permissions — wrap once at module level.
const elevatedGetSecretValue = elevate(secrets.getSecretValue);

// --- Config ------------------------------------------------------------------

const COLLECTION_REVIEWS = 'GoogleReviews';
const COLLECTION_SUMMARY = 'ReviewsSummary';
const SUMMARY_DOC_ID = 'des-summary';

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1';

// Request every field we use. Explicit sub-field paths are more reliable than
// just 'reviews' — some API versions return an empty reviews array when the
// parent field is requested without sub-fields specified.
const FIELD_MASK = [
  'id',
  'rating',
  'userRatingCount',
  'reviews.name',
  'reviews.rating',
  'reviews.text',
  'reviews.originalText',
  'reviews.authorAttribution',
  'reviews.publishTime',
  'reviews.relativePublishTimeDescription',
].join(',');

const MIN_RATING = 4;

// TOS safety net: purge any review whose last-seen timestamp is older than this.
// Google allows up to 30 days; 29 gives us headroom.
const MAX_REVIEW_AGE_DAYS = 29;

// --- Helpers -----------------------------------------------------------------

function isValidRating(n) {
  // Accept integer OR float whole-number ratings (e.g. 5.0) — both are valid
  // from the Places API. Number.isInteger(5.0) is true in JS but be explicit.
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 5;
}

function daysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function normalizeReview(raw, nowIso) {
  // ID is the last segment of the Places API `name` path.
  const id = raw?.name ? raw.name.split('/').pop() : null;
  const rating = raw?.rating;

  // Without a stable ID we cannot upsert — skip the entry.
  if (!id) return null;

  // Without a valid rating the card is meaningless — skip.
  if (!isValidRating(rating)) {
    console.warn('[reviews] Skipping review — invalid rating:', rating, 'id:', id);
    return null;
  }

  const text = raw?.text?.text ?? raw?.originalText?.text ?? '';

  // Graceful fallbacks: don't discard otherwise-good reviews for cosmetic fields.
  const authorName = raw?.authorAttribution?.displayName || 'A Google User';

  // publishTime can be absent on older reviews — fall back to current time so
  // the review still sorts reasonably. It will age out of the eviction window
  // at the same 29-day cadence as any other review.
  const publishedAt = raw?.publishTime
    ? new Date(raw.publishTime)
    : new Date(nowIso);

  return {
    _id: id,
    authorName,
    authorPhoto: raw?.authorAttribution?.photoUri ?? null,
    authorUri: raw?.authorAttribution?.uri ?? null,
    rating,
    text,
    publishedAt,
    relativeTime: raw?.relativePublishTimeDescription ?? '',
    source: 'places_api',
    lastSeenAt: new Date(nowIso),
  };
}

async function fetchFromPlacesApi(placeId, apiKey) {
  const url = `${PLACES_ENDPOINT}/places/${encodeURIComponent(placeId)}`;

  console.log('[reviews] Fetching URL:', url);
  console.log('[reviews] Field mask:', FIELD_MASK);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
  });

  if (!res.ok) {
    let errBody = '';
    try { errBody = await res.text(); } catch (_) {}
    throw new Error(`Places API HTTP ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const nowIso = new Date().toISOString();

  // DIAGNOSTIC: log the full top-level keys and raw response so we can see
  // exactly what Google is returning. Remove this block once reviews are flowing.
  console.log('[reviews] Response top-level keys:', Object.keys(data).join(', '));
  console.log('[reviews] Full response (TEMP DIAGNOSTIC):', JSON.stringify(data).slice(0, 2000));

  const rawReviews = data.reviews || [];
  console.log(`[reviews] Places API: rating=${data.rating} count=${data.userRatingCount} rawReviews=${rawReviews.length}`);

  const reviews = rawReviews
    .map((r) => normalizeReview(r, nowIso))
    .filter((r) => r !== null);

  console.log(`[reviews] After normalization: ${reviews.length} valid reviews`);

  return {
    rating: data.rating || 0,
    userRatingCount: data.userRatingCount || 0,
    reviews,
  };
}

/**
 * TOS compliance: evict reviews whose lastSeenAt is older than MAX_REVIEW_AGE_DAYS.
 *
 * We intentionally do NOT evict based on whether a review appeared in the current
 * API response. The Places API (New) returns at most ~5 reviews per call and
 * rotates which ones are shown — most cached reviews will never re-appear in a
 * given sync window. Evicting on absence would drain the cache to ~5 entries max.
 *
 * Instead, lastSeenAt is refreshed whenever a review IS returned by the API
 * (via bulkSave). Reviews that stop appearing will age out naturally at 29 days
 * from their last sighting — which satisfies the Google TOS 30-day cache limit.
 */
async function evictStaleReviews() {
  const cutoff = daysAgo(MAX_REVIEW_AGE_DAYS);
  let evicted = 0;

  let skip = 0;
  const PAGE_SIZE = 100;
  while (true) {
    const page = await wixData
      .query(COLLECTION_REVIEWS)
      .limit(PAGE_SIZE)
      .skip(skip)
      .find({ suppressAuth: true });

    if (page.items.length === 0) break;

    const toDelete = page.items
      .filter((item) => {
        // Evict only on age — no lastSeenAt means it was stored without the
        // field (pre-migration), treat as potentially stale and evict.
        const tooOld = !item.lastSeenAt || new Date(item.lastSeenAt) < cutoff;
        return tooOld;
      })
      .map((item) => item._id);

    if (toDelete.length > 0) {
      const result = await wixData.bulkRemove(COLLECTION_REVIEWS, toDelete, {
        suppressAuth: true,
      });
      evicted += result.removed ?? toDelete.length;
    }

    if (page.items.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return evicted;
}

// --- Public API --------------------------------------------------------------

/**
 * Syncs reviews from Places API into the GoogleReviews CMS collection
 * and updates ReviewsSummary with the aggregate rating + count.
 *
 * Returns { synced, evicted, summarySaved, bulkErrors }.
 * Throws on fatal errors (missing secrets, API failure, unrecoverable DB errors).
 */
export async function syncReviewsToDatabase() {
  console.log('[reviews] Starting sync from Places API...');

  // Fetch both secrets in parallel — elevate() required by wix-secrets-backend.v2.
  // NOTE: v2 getSecretValue returns { value: string }, NOT a raw string (unlike v1 getSecret).
  // Unwrapping is mandatory — passing the object as a fetch header value silently produces
  // an empty X-Goog-Api-Key, which Google rejects as 403 PERMISSION_DENIED
  // "Method doesn't allow unregistered callers".
  const [apiKeyResponse, placeIdResponse] = await Promise.all([
    elevatedGetSecretValue('GOOGLE_PLACES_API_KEY'),
    elevatedGetSecretValue('DES_PLACE_ID'),
  ]);

  const apiKey = apiKeyResponse?.value;
  const placeId = placeIdResponse?.value;

  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new Error('Missing or invalid GOOGLE_PLACES_API_KEY secret');
  }
  if (typeof placeId !== 'string' || placeId.length === 0) {
    throw new Error('Missing or invalid DES_PLACE_ID secret');
  }

  // DIAGNOSTIC: confirm the place ID looks right (first/last 4 chars only — don't log full key)
  console.log(`[reviews] PlaceID starts with: ${placeId.slice(0, 6)}... length=${placeId.length}`);

  const summary = await fetchFromPlacesApi(placeId, apiKey);

  // --- 1. Upsert summary doc (fail loud if this breaks) ---
  let summarySaved = false;
  try {
    await wixData.save(
      COLLECTION_SUMMARY,
      {
        _id: SUMMARY_DOC_ID,
        rating: summary.rating,
        userRatingCount: summary.userRatingCount,
        lastSyncedAt: new Date(),
      },
      { suppressAuth: true }
    );
    summarySaved = true;
  } catch (err) {
    // Don't swallow — summary failing means the displayed aggregate goes
    // stale forever. Log and surface it, but continue so reviews still update.
    console.error('[reviews] Summary save FAILED:', err.message);
  }

  // --- 2. Filter + persist individual reviews ---
  console.log(`[reviews] Raw reviews from API: ${summary.reviews.length}`);
  const filtered = summary.reviews.filter((r) => r.rating >= MIN_RATING);
  console.log(`[reviews] After MIN_RATING(${MIN_RATING}) filter: ${filtered.length}`);

  let synced = 0;
  let bulkErrors = [];

  if (filtered.length > 0) {
    // bulkSave is NOT atomic — inspect the result honestly.
    const result = await wixData.bulkSave(COLLECTION_REVIEWS, filtered, {
      suppressAuth: true,
    });

    synced = (result.inserted ?? 0) + (result.updated ?? 0);
    bulkErrors = Array.isArray(result.errors) ? result.errors : [];

    console.log(
      `[reviews] bulkSave: inserted=${result.inserted ?? 0} ` +
        `updated=${result.updated ?? 0} skipped=${result.skipped ?? 0} ` +
        `errors=${bulkErrors.length}`
    );

    if (bulkErrors.length > 0) {
      console.error('[reviews] bulkSave errors:', bulkErrors);
    }
  } else {
    console.warn('[reviews] Places API returned 0 reviews >= 4 stars');
  }

  // --- 3. Evict stale reviews (TOS: 30-day cache cap) ---
  let evicted = 0;
  try {
    evicted = await evictStaleReviews();
    if (evicted > 0) {
      console.log(`[reviews] Evicted ${evicted} stale review(s)`);
    }
  } catch (err) {
    // Eviction failure is non-fatal for this sync but must not be silent —
    // repeated failures would cause TOS drift.
    console.error('[reviews] Eviction FAILED:', err.message);
  }

  const report = {
    synced,
    evicted,
    summarySaved,
    bulkErrors: bulkErrors.length,
    currentReviewCount: filtered.length,
  };

  console.log('[reviews] Sync complete.', report);
  return report;
}
