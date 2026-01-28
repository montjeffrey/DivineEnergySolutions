import wixWindow from 'wix-window';
$w.onReady(function () {
    // Listen for messages from the HTML Component
    $w("#html1").onMessage((event) => {
        // Check if the message is the correct command
        if (event.data === "openAerosealModal") {
            // Open the Lightbox named "AerosealDeepDive"
            wixWindow.openLightbox("AerosealDeepDive");
        }
    });
});
