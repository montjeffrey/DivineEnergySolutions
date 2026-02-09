import wixWindow from 'wix-window';
import { session } from 'wix-storage';
import wixLocation from 'wix-location';

$w.onReady(function () {
    const backButton = $w('#back-button');

    // Check session storage
    const fromDuctCleaningSession = session.getItem("fromDuctCleaning");

    // Check query parameters
    const query = wixLocation.query;
    const fromDuctCleaningQuery = query.source === "duct";

    // Debugging logs
    console.log("Debug: Session 'fromDuctCleaning':", fromDuctCleaningSession);
    console.log("Debug: Query 'source':", query.source);

    // IMMEDIATELY clear the flag so it cannot persist on refresh or subsequent visits
    session.removeItem("fromDuctCleaning");

    // Check if ANY valid condition is met
    if (fromDuctCleaningSession === "true" || fromDuctCleaningQuery) {
        console.log("Valid navigation detected. Showing back button.");
        backButton.expand();
        backButton.show();
    } else {
        console.log("No valid navigation detected. Hiding back button.");
        backButton.hide();
        backButton.collapse();
    }
});
