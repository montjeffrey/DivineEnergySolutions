import { getMapsApiKey } from 'backend/googleMaps';

$w.onReady(async function () {
    try {
        const apiKey = await getMapsApiKey();
        // Make sure your HTML component ID matches '#googleMapsEmbed' or whatever ID you used
        $w('#googleMapsEmbed').postMessage(apiKey);
    } catch (error) {
        console.error("Failed to load map key", error);
    }
});