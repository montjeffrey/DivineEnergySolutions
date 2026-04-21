/**
 * src/backend/gbpReviews.js
 *
 * Google Business Profile API client — stub for future upgrade.
 * Implement after OAuth access approval from:
 * https://developers.google.com/my-business/content/prereqs
 *
 * Returns the same shape as getReviewsFromCMS() so swapping sources
 * in the page code is a one-line import change.
 *
 * When implementing:
 *  - Add secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
 *    GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_NAME
 *  - Endpoint: https://mybusiness.googleapis.com/v4/{locationName}/reviews
 *  - GBP returns star ratings as "FIVE"/"FOUR"/etc — map to 5/4/3/2/1
 *  - Paginate via nextPageToken, cap at ~20 most recent after filtering
 *  - No aggregate in response — compute mean from reviews array
 */
export async function fetchGbpReviews() {
    throw new Error(
        '[reviews] GBP client not yet implemented — awaiting API access approval. ' +
        'Use getReviewsFromCMS() from googleReviews.js in the meantime.'
    );
}
