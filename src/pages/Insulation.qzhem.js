// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// "Hello, World!" Example: https://learn-code.wix.com/en/article/hello-world

import wixWindow from 'wix-window';

$w.onReady(function () {
    // --- INITIALIZATION ---
    // Sliders now use self-contained HTML with embedded images.
    // No message passing required for initialization.

    $w("#htmlSlider1").onMessage((event) => {
        // Optional: Listener for any events coming FROM the slider (not currently used)
    });
});
