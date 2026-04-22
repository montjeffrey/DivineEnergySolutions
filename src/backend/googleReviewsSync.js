/**
 * src/backend/googleReviewsSync.js
 *
 * Backend-only module for syncing Google Places reviews into the Wix CMS.
 * NOT a web module — cannot be called from frontend code. Called only by:
 *   - jobs.config (daily schedule)
 *   - Manual trigger from another backend module (e.g., a dashboard page)
 *
 * Secrets required in Wix Secrets Manager:
 *   GOOGLE_PLACES_API_KEY  — restricted to Places API (New)
 *   DES_PLACE_ID           — ChIJhwSB4IkKw4kRA5MKZdKQJfI
 *
 * CMS Collections required:
 *   GoogleReviews    — individual reviews (Admin perms)
 *   ReviewsSummary   — aggregate rating + count, single doc _id = "des-summary"
 */

import { secrets } from 'wix-secrets-backend.v2';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

const COLLECTION_REVIEWS = 'GoogleReviews';
const COLLECTION_SUMMARY = 'ReviewsSummary';
const SUMMARY_DOC_ID = 'des-summary';
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1';
const FIELD_MASK = 'id,rating,userRatingCount,reviews';
const MIN_RATING = 4;
const MAX_REVIEW_AGE_DAYS = 29;

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
  if (!id || !isValidRating(rating) || !authorName || !publishedAt) return null;
  return {
    _id: id,
    authorName,
    authorPhoto: raw.authorAttribution?.photoUri ?? null,
    authorUri: raw.authorAttribution?.uri ?? null,
    rating,
    text,
    publishedAt: new Date(publishedAt),
    relativeTime: raw.relativePublishTimeDescription ?? '',
    source: 'places_api',
    lastSeenAt: new Date(nowIso),
  };
}

async function fetchFromPlacesApi(placeId, apiKey) {
  const url = PLACES_ENDPOINT + '/places/' + encodeURIComponent(placeId);
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
  });
  if (!res.ok) throw new Error('Places API HTTP ' + res.status);
  const data = await res.json();
  const nowIso = new Date().toISOString();
  const reviews = (data.reviews || []).map((r) => normalizeReview(r, nowIso)).filter(Boolean);
  return { rating: data.rating || 0, userRatingCount: data.userRatingCount || 0, reviews };
}

async function evictStaleReviews(currentReviewIds) {
  const cutoff = daysAgo(MAX_REVIEW_AGE_DAYS);
  let evicted = 0;
  let skip = 0;
  const PAGE_SIZE = 100;
  while (true) {
    const page = await wixData.query(COLLECTION_REVIEWS).limit(PAGE_SIZE).skip(skip).find({ suppressAuth: true });
    if (page.items.length === 0) break;
    const toDelete = page.items
      .filter((item) => !currentReviewIds.has(item._id) && (!item.lastSeenAt || new Date(item.lastSeenAt) < cutoff))
      .map((item) => item._id);
    if (toDelete.length > 0) {
      const result = await wixData.bulkRemove(COLLECTION_REVIEWS, toDelete, { suppressAuth: true });
      evicted += result.removed ?? toDelete.length;
    }
    if (page.items.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return evicted;
}

export async function syncReviewsToDatabase() {
  console.log('[reviews] Starting sync from Places API...');
  const [apiKey, placeId] = await Promise.all([
    secrets.getSecretValue('GOOGLE_PLACES_API_KEY'),
    secrets.getSecretValue('DES_PLACE_ID'),
  ]);
  if (!apiKey) throw new Error('Missing GOOGLE_PLACES_API_KEY secret');
  if (!placeId) throw new Error('Missing DES_PLACE_ID secret');

  const summary = await fetchFromPlacesApi(placeId, apiKey);

  let summarySaved = false;
  try {
    await wixData.save(COLLECTION_SUMMARY, {
      _id: SUMMARY_DOC_ID,
      rating: summary.rating,
      userRatingCount: summary.userRatingCount,
      lastSyncedAt: new Date(),
    }, { suppressAuth: true });
    summarySaved = true;
  } catch (err) {
    console.error('[reviews] Summary save FAILED:', err.message);
  }

  const filtered = summary.reviews.filter((r) => r.rating >= MIN_RATING);
  const currentIds = new Set(filtered.map((r) => r._id));
  let synced = 0;
  let bulkErrors = [];

  if (filtered.length > 0) {
    const result = await wixData.bulkSave(COLLECTION_REVIEWS, filtered, { suppressAuth: true });
    synced = (result.inserted ?? 0) + (result.updated ?? 0);
    bulkErrors = Array.isArray(result.errors) ? result.errors : [];
    console.log('[reviews] bulkSave: inserted=' + (result.inserted ?? 0) + ' updated=' + (result.updated ?? 0) + ' errors=' + bulkErrors.length);
    if (bulkErrors.length > 0) console.error('[reviews] bulkSave errors:', bulkErrors);
  } else {
    console.warn('[reviews] Places API returned 0 reviews >= 4 stars');
  }

  let evicted = 0;
  try {
    evicted = await evictStaleReviews(currentIds);
    if (evicted > 0) console.log('[reviews] Evicted ' + evicted + ' stale review(s)');
  } catch (err) {
    console.error('[reviews] Eviction FAILED:', err.message);
  }

  const report = { synced, evicted, summarySaved, bulkErrors: bulkErrors.length, currentReviewCount: filtered.length };
  console.log('[reviews] Sync complete.', report);
  return report;
}
