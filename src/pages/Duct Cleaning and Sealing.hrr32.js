import wixWindow from 'wix-window';
import wixLocation from 'wix-location';
import { session } from 'wix-storage';

$w.onReady(function () {
    // State management for preventing spam clicks
    let isProcessing = false;
    let lastClickTime = 0;
    const DEBOUNCE_DELAY = 500; // 500ms debounce delay

    // Listen for messages from the HTML Component
    $w("#html1").onMessage((event) => {
        console.log("Duct Cleaning: Received message from HTML Component:", event.data);

        // Validate message data exists and is a string
        if (!event || typeof event.data !== 'string') {
            console.warn('Invalid message received:', event);
            return;
        }

        const currentTime = Date.now();
        console.log("Duct Cleaning: Message content check:", event.data);

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

        // Check the message content
        if (event.data === "openAerosealModal") {
            handleAction(() => wixWindow.openLightbox("AerosealDeepDive"));
        } else if (event.data === "navigateAeroseal") {
            handleAction(() => {
                session.setItem("fromDuctCleaning", "true");
                wixLocation.to("/aeroseal");
            });
        } else if (event.data === "navigateAerobarrier") {
            handleAction(() => {
                session.setItem("fromDuctCleaning", "true");
                wixLocation.to("/aerobarrier");
            });
        }
    });

    /**
     * Helper to handle actions with processing state
     * @param {Function} actionFn function that returns a promise or void
     */
    function handleAction(actionFn) {
        isProcessing = true;
        lastClickTime = Date.now();

        try {
            const result = actionFn();
            if (result instanceof Promise) {
                result.finally(() => {
                    isProcessing = false;
                });
            } else {
                isProcessing = false;
            }
        } catch (error) {
            console.error('Error executing action:', error);
            isProcessing = false;
        }
    }
});

/**
* Exported function to be called by the "Aerobarrier" button on the Wix page.
* You must connect this function to the button's onClick event in the Properties panel.
*/
export function navigateToAerobarrier(event) {
    console.log("Duct Cleaning: Navigate to Aerobarrier button clicked.");
    // NO session storage. Just a direct link with a "source" tag.
    // This is much more reliable for "one-time" detection.
    wixLocation.to("/aerobarrier?source=duct");
}

/**
* Exported function to be called by the "Aeroseal" button on the Wix page.
*/
export function navigateToAeroseal(event) {
    console.log("Duct Cleaning: Navigate to Aeroseal button clicked.");
    wixLocation.to("/aeroseal?source=duct");
}
