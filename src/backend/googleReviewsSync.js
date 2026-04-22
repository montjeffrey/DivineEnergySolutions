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
const FIELD_MASK = 'id,rating,userRatingCount,reviews';

const MIN_RATING = 4;

// TOS safety net: purge any review whose last-seen timestamp is older than this.
// Google allows up to 30 days; 29 gives us headroom.
const MAX_REVIEW_AGE_DAYS = 29;

// --- Helpers -----------------------------------------------------------------

function isValidRating(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function daysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function normalizeReview(raw, nowIso) {
  const id = raw?.name ? raw.name.split('/').pop() : null;
  const rating = raw?.rating;
  const text = raw?.text?.text ?? raw?.originalText?.text ?? '';
  const authorName = raw?.authorAttribution?.displayName;
  const publishedAt = raw?.publishTime;

  if (!id || !isValidRating(rating) || !authorName || !publishedAt) {
    return null;
  }

  return {
    _id: id,
    authorName,
    authorPhoto: raw.authorAttribution?.photoUri ?? null,
    authorUri: raw.authorAttribution?.uri ?? null,
    rating,
    text,
    // Store as Date so CMS sorts correctly regardless of source format.
    publishedAt: new Date(publishedAt),
    relativeTime: raw.relativePublishTimeDescription ?? '',
    source: 'places_api',
    lastSeenAt: new Date(nowIso),
  };
}

async function fetchFromPlacesApi(placeId, apiKey) {
  const url = `${PLACES_ENDPOINT}/places/${encodeURIComponent(placeId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
  });

  if (!res.ok) {
    // Log status only — don't echo response body into logs (minor exfil guard).
    throw new Error(`Places API HTTP ${res.status}`);
  }

  const data = await res.json();
  const nowIso = new Date().toISOString();

  const reviews = (data.reviews || [])
    .map((r) => normalizeReview(r, nowIso))
    .filter((r) => r !== null);

  return {
    rating: data.rating || 0,
    userRatingCount: data.userRatingCount || 0,
    reviews,
  };
}

/**
 * TOS compliance: remove reviews that either
 *   (a) didn't come back in this sync's response, OR
 *   (b) haven't been seen in MAX_REVIEW_AGE_DAYS days
 * Either condition means the review was likely deleted or edited on Google.
 */
async function evictStaleReviews(currentReviewIds) {
  const cutoff = daysAgo(MAX_REVIEW_AGE_DAYS);
  let evicted = 0;

  // Page through the collection — Wix query limit is 1000; at ~5 reviews
  // per place we will never exceed this, but paginating defensively is cheap.
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
        const notInResponse = !currentReviewIds.has(item._id);
        const tooOld = !item.lastSeenAt || new Date(item.lastSeenAt) < cutoff;
        return notInResponse && tooOld;
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
  const [apiKey, placeId] = await Promise.all([
    elevatedGetSecretValue('GOOGLE_PLACES_API_KEY'),
    elevatedGetSecretValue('DES_PLACE_ID'),
  ]);

  if (!apiKey) throw new Error('Missing GOOGLE_PLACES_API_KEY secret');
  if (!placeId) throw new Error('Missing DES_PLACE_ID secret');

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
  const filtered = summary.reviews.filter((r) => r.rating >= MIN_RATING);
  const currentIds = new Set(filtered.map((r) => r._id));

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

  // --- 3. Evict stale reviews (TOS: 30-day cache cap + reflect deletions) ---
  let evicted = 0;
  try {
    evicted = await evictStaleReviews(currentIds);
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
