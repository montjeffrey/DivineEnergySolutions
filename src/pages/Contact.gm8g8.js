// 1. Import the backend function
import { getMapsApiKey } from 'backend/googleMaps.jsw';

$w.onReady(async function () {
    const mapComponent = $w('#googleMapsEmbed');
    let apiKey = null;

    try {
        // 2. Fetch the key immediately
        apiKey = await getMapsApiKey();
    } catch (error) {
        console.error("Failed to load map key from backend", error);
        return;
    }

    // 3. Define the sender function
    const sendKey = () => {
        if (apiKey) {
            console.log("Sending API key to map...");
            mapComponent.postMessage(apiKey);
        }
    };

    // 4. Listen for "MAP_COMPONENT_READY" from the HTML component
    // This ensures we don't send the key before the iframe is listening
    mapComponent.onMessage((event) => {
        if (event.data === "MAP_COMPONENT_READY") {
            console.log("Map component is ready. Sending key.");
            sendKey();
        }
    });

    // 5. Fallback: Send it anyway after a short delay in case we missed the ready event
    // (sometimes the iframe loads before Velo is ready to listen)
    setTimeout(() => {
        console.log("Fallback: Sending key (timeout).");
        sendKey();
    }, 2000);
});