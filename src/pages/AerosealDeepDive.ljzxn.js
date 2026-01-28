// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world

$w.onReady(function () {
    // ⚠️ CRITICAL: You MUST change '#html1' to the ID of your HTML element in Wix
    const htmlComponent = $w('#html1');
    // ⚠️ CRITICAL: You MUST change '#closeButton' to the ID of the 'X' button in Wix
    const closeButton = $w('#closeButton');

    console.log("Deep Dive Page Ready. Listening for zoom events...");

    if (!htmlComponent.onMessage) {
        console.error("❌ ERROR: Element '#html1' is NOT an HTML Component (it might be a Section or Container). Please check the ID.");
    } else {
        htmlComponent.onMessage((event) => {
            console.log("Received message from HTML Component:", event.data);

            if (event.data.type === 'zoom') {
                if (event.data.status === 'active') {
                    console.log("Zoom active - Hiding close button");
                    closeButton.hide();
                } else {
                    console.log("Zoom inactive - Showing close button");
                    closeButton.show();
                }
            }
        });
    }
});
