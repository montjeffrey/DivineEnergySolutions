import wixWindow from 'wix-window';

$w.onReady(function () {
    // State management for preventing spam clicks
    let isProcessing = false;
    let lastClickTime = 0;
    const DEBOUNCE_DELAY = 500; // 500ms debounce delay

    // Listen for messages from the HTML Component
    $w("#html1").onMessage((event) => {
        // Validate message data exists and is a string
        if (!event || typeof event.data !== 'string') {
            console.warn('Invalid message received:', event);
            return;
        }

        // Check if the message is the correct command
        if (event.data === "openAerosealModal") {
            const currentTime = Date.now();

            // Debounce check: prevent multiple calls within the debounce delay
            if (currentTime - lastClickTime < DEBOUNCE_DELAY) {
                console.log('Action ignored: Too soon after previous action');
                return;
            }

            // Prevent multiple simultaneous operations
            if (isProcessing) {
                console.log('Action ignored: Already processing');
                return;
            }

            // Set processing state
            isProcessing = true;
            lastClickTime = currentTime;

            // Open the Lightbox named "AerosealDeepDive"
            wixWindow.openLightbox("AerosealDeepDive")
                .then(() => {
                    // Reset processing state after lightbox is opened
                    isProcessing = false;
                })
                .catch((error) => {
                    // Handle errors and reset state
                    console.error('Error opening lightbox:', error);
                    isProcessing = false;
                });
        }
    });
});
