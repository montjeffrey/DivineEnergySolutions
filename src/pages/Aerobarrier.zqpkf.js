import wixWindow from 'wix-window';
import { session } from 'wix-storage';

$w.onReady(function () {
    const backButton = $w('#back-button');
    const fromDuctCleaning = session.getItem("fromDuctCleaning");
    const referrer = wixWindow.referrer;

    // Debugging log
    console.log("Debug: fromDuctCleaning session flag:", fromDuctCleaning);

    // Check STRICTLY if the session flag is set
    // We removed the referrer check to ensure the button ONLY appears when coming from the specific button click
    const isFromDuctCleaning = (fromDuctCleaning === "true");

    if (isFromDuctCleaning) {
        console.log("Valid session flag detected. Showing back button.");
        backButton.show();
        // Clear session to prevent sticky behavior (so refreshing the page hides the button again if desired)
        session.removeItem("fromDuctCleaning");
    } else {
        console.log("No valid session flag. Hiding back button.");
        backButton.hide();
    }
});