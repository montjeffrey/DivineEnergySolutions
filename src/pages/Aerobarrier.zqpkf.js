// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world
import wixWindow from 'wix-window';

$w.onReady(function () {
    const referrer = wixWindow.referrer;
    const backButton = $w('#back-button');

    // Check if the user came from the "duct-cleaning-and-sealing" or "aeroseal" page
    // We check for the slug or part of the URL, ensuring query params don't break it
    if (referrer && (referrer.includes("duct-cleaning-and-sealing") || referrer.includes("aeroseal"))) {
        console.log("Referrer check: MATCH. User came from:", referrer);
        backButton.show();
    } else {
        console.log("Referrer check: NO MATCH. User came from:", referrer);
        backButton.hide();
    }
});