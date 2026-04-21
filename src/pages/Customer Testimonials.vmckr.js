/**
 * Customer Testimonials page — Google Reviews carousel
 *
 * Required elements in the Wix Editor (IDs are case-sensitive):
 *
 *  Section:
 *    #reviewsSection      outer strip — collapsed by code if no reviews load
 *
 *  Aggregate header:
 *    #aggregateRating     Text: "4.9"
 *    #aggregateStars      Text: "★★★★★"
 *    #reviewCount         Text: "based on 87 Google reviews"
 *
 *  Carousel navigation:
 *    #prevBtn             Button: previous
 *    #nextBtn             Button: next
 *    #pageIndicator       Text: "1 / 3"  (optional — hide in editor if unwanted)
 *
 *  Repeater (#reviewsRepeater) — each card item must contain:
 *    #reviewerNameText    Text: author name
 *    #starRatingText      Text: star characters
 *    #reviewDateText      Text: relative date ("2 months ago")
 *    #commentText         Text: review body
 *    #readMoreBtn         Button styled as link — HIDE BY DEFAULT in editor
 *
 *  Footer attribution:
 *    #viewAllLink         Button or Link element
 *                         Set link in editor to:
 *                         https://www.google.com/maps/place/?q=place_id:YOUR_PLACE_ID
 */

import { getReviewsFromCMS } from 'backend/googleReviews';

// Replace YOUR_PLACE_ID_HERE with the actual ChIJ... value
const GOOGLE_MAPS_URL =
    'https://www.google.com/maps/place/?q=place_id:YOUR_PLACE_ID_HERE';

// Cards shown per carousel page — match your repeater column layout:
//   1 column  → 1
//   2 columns → 2
//   3 columns → 3
const CARDS_PER_PAGE = 3;

// Auto-advance delay in ms. Set to 0 to disable.
const AUTOPLAY_MS = 6000;

// Characters before "Read more" truncation
const TRUNCATE_AT = 220;

// ─── State ────────────────────────────────────────────────────────────────────
var allReviews = [];
var currentPage = 0;
var totalPages = 0;
var autoplayTimer = null;
var expandedIds = {};   // { [reviewId]: true }

// ─── Entry point ──────────────────────────────────────────────────────────────

$w.onReady(async function () {
    await loadReviews();
    setupNavigation();
    startAutoplay();
});

// ─── Data ─────────────────────────────────────────────────────────────────────

async function loadReviews() {
    try {
        var summary = await getReviewsFromCMS(20);
        allReviews = summary.reviews || [];
        totalPages = Math.max(1, Math.ceil(allReviews.length / CARDS_PER_PAGE));

        if (summary.rating > 0) {
            $w('#aggregateRating').text = summary.rating.toFixed(1);
            $w('#aggregateStars').text = formatStars(Math.round(summary.rating));
            $w('#reviewCount').text =
                'based on ' + summary.userRatingCount.toLocaleString() + ' Google reviews';
        }

        try {
            $w('#viewAllLink').link = GOOGLE_MAPS_URL;
            $w('#viewAllLink').target = '_blank';
        } catch (_) {
            // If #viewAllLink is a Button, set the link manually in the Wix Editor
        }

        if (allReviews.length === 0) {
            $w('#reviewsSection').collapse();
            return;
        }

        renderPage(0);

    } catch (err) {
        console.error('[reviews] loadReviews failed:', err);
        $w('#reviewsSection').collapse();
    }
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

function renderPage(pageIndex) {
    currentPage = pageIndex;
    var start = pageIndex * CARDS_PER_PAGE;
    var slice = allReviews.slice(start, start + CARDS_PER_PAGE);

    $w('#reviewsRepeater').data = slice;
    $w('#reviewsRepeater').onItemReady(function ($item, itemData) {
        renderCard($item, itemData);
    });

    updatePageIndicator();
}

function renderCard($item, review) {
    $item('#reviewerNameText').text = review.authorName || '';
    $item('#starRatingText').text = formatStars(review.rating);
    $item('#reviewDateText').text = review.relativeTime || '';

    var fullText = review.text || '';
    var needsTruncation = fullText.length > TRUNCATE_AT;
    var isExpanded = !!expandedIds[review._id];

    $item('#commentText').text = buildDisplayText(fullText, isExpanded, needsTruncation);

    if (needsTruncation) {
        $item('#readMoreBtn').show();
        $item('#readMoreBtn').label = isExpanded ? 'Show less' : 'Read more';
        $item('#readMoreBtn').onClick(function () {
            stopAutoplay();
            expandedIds[review._id] = !expandedIds[review._id];
            var nowExpanded = !!expandedIds[review._id];
            $item('#commentText').text = buildDisplayText(fullText, nowExpanded, needsTruncation);
            $item('#readMoreBtn').label = nowExpanded ? 'Show less' : 'Read more';
        });
    } else {
        $item('#readMoreBtn').hide();
    }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function setupNavigation() {
    $w('#prevBtn').onClick(function () {
        stopAutoplay();
        renderPage((currentPage - 1 + totalPages) % totalPages);
        startAutoplay();
    });

    $w('#nextBtn').onClick(function () {
        stopAutoplay();
        renderPage((currentPage + 1) % totalPages);
        startAutoplay();
    });
}

function startAutoplay() {
    stopAutoplay();
    if (AUTOPLAY_MS <= 0 || totalPages <= 1) return;
    autoplayTimer = setInterval(function () {
        renderPage((currentPage + 1) % totalPages);
    }, AUTOPLAY_MS);
}

function stopAutoplay() {
    if (autoplayTimer !== null) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
}

function updatePageIndicator() {
    try {
        $w('#pageIndicator').text = (currentPage + 1) + ' / ' + totalPages;
    } catch (_) {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatStars(rating) {
    var n = Math.max(1, Math.min(5, Math.round(rating)));
    return '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);
}

function buildDisplayText(fullText, isExpanded, needsTruncation) {
    if (!needsTruncation || isExpanded) return fullText;
    return fullText.slice(0, TRUNCATE_AT).trimEnd() + '\u2026';
}
