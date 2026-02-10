// 1. Import the backend function
import { getMapsApiKey } from 'backend/googleMaps.jsw';

$w.onReady(async function () {
    const mapComponent = $w('#googleMapsEmbed');
    let apiKey = null;
    let keySent = false;

    try {
        // 2. Fetch the key immediately
        apiKey = await getMapsApiKey();
    } catch (error) {
        console.error('Failed to fetch Maps API key:', error);
        return; // Exit if we can't get the key
    }

    // 3. Define the sender function with tracking
    const sendKey = () => {
        if (apiKey && !keySent) {
            mapComponent.postMessage(apiKey);
            keySent = true;
        }
    };

    // 4. Listen for "MAP_COMPONENT_READY" from the HTML component
    mapComponent.onMessage((event) => {
        if (event.data === "MAP_COMPONENT_READY") {
            sendKey();
        }
    });

    // 5. Improved fallback with multiple retry attempts for slow mobile networks
    const retryIntervals = [500, 1500, 3000]; // Retry at 0.5s, 1.5s, and 3s
    retryIntervals.forEach(delay => {
        setTimeout(() => {
            if (!keySent) {
                sendKey();
            }
        }, delay);
    });
});