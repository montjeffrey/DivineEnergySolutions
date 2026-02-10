// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world

$w.onReady(function () {
    // Select the HTML component. 
    // IMPORTANT: Verify the ID '#html1' matches your actual HTML component ID in the Wix Editor.
    const htmlComponent = $w('#html1');

    // Trigger animation when the component enters the viewport
    htmlComponent.onViewportEnter(() => {
        htmlComponent.postMessage("StartAnimation");
    });
});
