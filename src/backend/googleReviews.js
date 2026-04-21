/**
 * src/backend/googleReviews.js
 *
 * Places API client + CMS sync for Divine Energy Solutions Google Reviews.
 *
 * Secrets required in Wix Secrets Manager:
 *   googleMapsApiKey  â€” already exists; restricted to Places API (New)
 *   DES_PLACE_ID      â€” ChIJ... string for the DES listing
 *
 * CMS Collections required:
 *   GoogleReviews    â€” stores individual reviews
 *   ReviewsSummary   â€” stores aggregate rating + count (single doc: _id = "des-summary")
 */

import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

const COLLECTION_REVIEWS = 'GoogleReviews';
const COLLECTION_SUMMARY = 'ReviewsSummary';
const SUMMARY_DOC_ID = 'des-summary';
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1';
const FIELD_MASK = 'id,rating,userRatingCount,reviews';
const MIN_RATING = 4;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isValidRating(n) {
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

function normalizeReview(raw) {
    const id = raw.name ? raw.name.split('/').pop() : null;
    const rating = raw.rating;
    const text = (raw.text && raw.text.text)
        ? raw.text.text
        : (raw.originalText && raw.originalText.text)
            ? raw.originalText.text
            : '';
    const authorName = raw.authorAttribution && raw.authorAttribution.displayName;
    const publishedAt = raw.publishTime;

    if (!id || !isValidRating(rating) || !authorName || !publishedAt) {
        return null;
    }

    return {
        _id: id,
        authorName,
        authorPhoto: (raw.authorAttribution && raw.authorAttribution.photoUri) || null,
        authorUri: (raw.authorAttribution && raw.authorAttribution.uri) || null,
        rating,
        text,
        publishedAt,
        relativeTime: raw.relativePublishTimeDescription || '',
        source: 'places_api',
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
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Places API ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = await res.json();

    const reviews = (data.reviews || [])
        .map(normalizeReview)
        .filter((r) => r !== null);

    return {
        rating: data.rating || 0,
        userRatingCount: data.userRatingCount || 0,
        reviews,
    };
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Syncs >= 4-star reviews from the Places API to the GoogleReviews CMS collection.
 * Also persists the aggregate rating + count to ReviewsSummary.
 * Called daily by jobs.config. Can be triggered manually from the backend panel.
 */
export async function syncReviewsToDatabase() {
    try {
        console.log('[reviews] Starting sync from Places API...');

        const apiKey = await getSecret('googleMapsApiKey');
        const placeId = await getSecret('DES_PLACE_ID');

        const summary = await fetchFromPlacesApi(placeId, apiKey);

        await wixData.save(
            COLLECTION_SUMMARY,
            {
                _id: SUMMARY_DOC_ID,
                rating: String(summary.rating || 0),
                userRatingCount: summary.userRatingCount,
                lastSyncedAt: new Date().toISOString(),
            },
            { suppressAuth: true }
        ).catch((err) => {
            console.warn('[reviews] Could not save summary doc:', err.message);
        });

        const filtered = summary.reviews.filter((r) => r.rating >= MIN_RATING);

        if (filtered.length === 0) {
            console.warn('[reviews] Places API returned 0 reviews >=4 stars â€” skipping CMS update');
            return { synced: 0 };
        }

        filtered.sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        const result = await wixData.bulkSave(COLLECTION_REVIEWS, filtered, { suppressAuth: true });

        console.log(
            `[reviews] Sync complete. inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`
        );
        return { synced: filtered.length };

    } catch (err) {
        console.error('[reviews] syncReviewsToDatabase failed:', err);
        throw err;
    }
}

/**
 * Returns reviews + aggregate from CMS for use by the page frontend.
 * No API key needed at page-load time â€” reads local Wix CMS only.
 */
export async function getReviewsFromCMS(limit) {
    var maxItems = limit || 10;
    try {
        var reviewsResult = await wixData.query(COLLECTION_REVIEWS)
            .ge('rating', MIN_RATING)
            .descending('publishedAt')
            .limit(maxItems)
            .find({ suppressAuth: true });

        var summaryDoc = await wixData.get(COLLECTION_SUMMARY, SUMMARY_DOC_ID, { suppressAuth: true })
            .catch(function() { return null; });

        return {
            rating: summaryDoc ? summaryDoc.rating : 0,
            userRatingCount: summaryDoc ? summaryDoc.userRatingCount : 0,
            reviews: reviewsResult.items,
        };
    } catch (err) {
        console.error('[reviews] getReviewsFromCMS failed:', err);
        return { rating: 0, userRatingCount: 0, reviews: [] };
    }
}
