import wixWindow from 'wix-window';
import { session } from 'wix-storage';

$w.onReady(function () {
    const backButton = $w('#back-button');
    const fromDuctCleaning = session.getItem("fromDuctCleaning");
    const referrer = wixWindow.referrer;

    // Debugging log
    console.log("Debug: fromDuctCleaning session flag:", fromDuctCleaning);
    console.log("Debug: wixWindow.referrer:", referrer);

    // Check if the session flag is set OR if the referrer matches
    // This provides a fallback if session storage fails or isn't set
    const isFromDuctCleaning = (fromDuctCleaning === "true");
    const isFromReferrer = referrer && (referrer.includes("duct-cleaning-and-sealing") || referrer.includes("aeroseal"));

    if (isFromDuctCleaning || isFromReferrer) {
        console.log("Valid source detected (Session: " + isFromDuctCleaning + ", Referrer: " + isFromReferrer + "). Showing back button.");
        backButton.show();
        // Clear session to prevent sticky behavior (optional, but good for testing)
        // session.removeItem("fromDuctCleaning"); 
    } else {
        console.log("No valid source detected. Hiding back button.");
        backButton.hide();
    }
});