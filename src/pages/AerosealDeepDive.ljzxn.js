// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world

$w.onReady(function () {
    // IMPORTANT: Replace '#html1' with the actual ID of your HTML element
    const htmlComponent = $w('#html1');
    // IMPORTANT: Replace '#closeButton' with the actual ID of your modal's close button/image
    const closeButton = $w('#closeButton');

    htmlComponent.onMessage((event) => {
        if (event.data.type === 'zoom') {
            if (event.data.status === 'active') {
                closeButton.hide();
            } else {
                closeButton.show();
            }
        }
    });
});
