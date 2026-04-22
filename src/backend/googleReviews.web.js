/**
 * src/backend/googleReviews.web.js
 *
 * Web module exposing read-only access to the cached reviews CMS collections.
 * Called from page code via:
 *     import { getReviewsFromCMS } from 'backend/googleReviews.web';
 *
 * Never touches the Places API or secrets — pure CMS read.
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const COLLECTION_REVIEWS = 'GoogleReviews';
const COLLECTION_SUMMARY = 'ReviewsSummary';
const SUMMARY_DOC_ID = 'des-summary';
const MIN_RATING = 4;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Returns reviews + aggregate rating/count for frontend display.
 * Safe to call on every page load — hits Wix CMS only, no external API.
 */
export const getReviewsFromCMS = webMethod(
  Permissions.Anyone,
  async (limit) => {
    const maxItems = Math.min(
      Math.max(Number.isInteger(limit) ? limit : DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    try {
      const reviewsQuery = wixData
        .query(COLLECTION_REVIEWS)
        .ge('rating', MIN_RATING)
        .descending('publishedAt')
        .limit(maxItems)
        .find({ suppressAuth: true });

      const summaryQuery = wixData
        .get(COLLECTION_SUMMARY, SUMMARY_DOC_ID, { suppressAuth: true })
        .catch(() => null);

      const [reviewsResult, summaryDoc] = await Promise.all([
        reviewsQuery,
        summaryQuery,
      ]);

      return {
        rating: summaryDoc?.rating ?? 0,
        userRatingCount: summaryDoc?.userRatingCount ?? 0,
        reviews: reviewsResult.items,
      };
    } catch (err) {
      console.error('[reviews] getReviewsFromCMS failed:', err);
      return { rating: 0, userRatingCount: 0, reviews: [] };
    }
  }
);
