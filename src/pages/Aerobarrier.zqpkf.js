import wixWindow from 'wix-window';
import { session } from 'wix-storage';

$w.onReady(function () {
    const backButton = $w('#back-button');
    const fromDuctCleaning = session.getItem("fromDuctCleaning");

    // IMMEDIATELY clear the flag so it cannot persist on refresh or subsequent visits
    session.removeItem("fromDuctCleaning");

    // Debugging log
    console.log("Debug: fromDuctCleaning session flag was:", fromDuctCleaning);

    // Check STRICTLY if the session flag WAS set
    if (fromDuctCleaning === "true") {
        console.log("Valid session flag detected. Showing and Expanding back button.");
        backButton.expand();
        backButton.show();
    } else {
        console.log("No valid session flag. Hiding back button.");
        backButton.hide();
        backButton.collapse();
    }
});