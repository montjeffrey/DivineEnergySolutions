// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world

$w.onReady(function () {
    // WIX VELO CODE
    import wixWindow from 'wix-window';

    $w.onReady(function () {
        // Configuration for your sliders
        // Update these URLs with the actual image links from your Wix Media Manager
        const insulationProject1 = {
            before: "https://static.wixstatic.com/media/YOUR_BEFORE_IMAGE_1.jpg",
            after: "https://static.wixstatic.com/media/YOUR_AFTER_IMAGE_1.jpg"
        };

        const insulationProject2 = {
            before: "https://static.wixstatic.com/media/YOUR_BEFORE_IMAGE_2.jpg",
            after: "https://static.wixstatic.com/media/YOUR_AFTER_IMAGE_2.jpg"
        };

        // --- INITIALIZATION ---

        // Only run this when the component is ready to ensure no "missing component" errors
        $w("#htmlSlider1").onMessage((event) => {
            // This callback is optional but good for debugging confirmation
            console.log("Slider 1 is ready");
        });

        // Send data to the HTML Embeds
        // Note: 'htmlSlider1' must match the ID you gave the element in the editor
        initSlider("#htmlSlider1", insulationProject1);

        // If you have a second slider on the page:
        if ($w("#htmlSlider2").hidden === false) {
            initSlider("#htmlSlider2", insulationProject2);
        }
    });

    /**
     * Sends image data to the HTML Component
     * @param {string} componentId - The ID of the HTML element (e.g., #htmlSlider1)
     * @param {object} data - Object containing {before, after} URLs
     */
    function initSlider(componentId, data) {
        const $component = $w(componentId);

        // We wrap in a small timeout or check loading state to ensure the iframe exists
        $component.postMessage({
            beforeSrc: data.before,
            afterSrc: data.after
        });
    }
});
