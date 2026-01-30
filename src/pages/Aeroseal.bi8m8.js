// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world
import wixWindow from 'wix-window';

$w.onReady(function () {
    const referrer = wixWindow.referrer;
    const backButton = $w('#back-button');

    // Check if the user came from the "duct-cleaning-and-sealing" page
    // We check for the slug or part of the URL
    if (referrer && referrer.includes("duct-cleaning-and-sealing")) {
        console.log("User came from Duct Cleaning page. Showing back button.");
        backButton.show();
    } else {
        console.log("User did not come from Duct Cleaning page. Hiding back button.");
        backButton.hide();
    }
});
