import wixWindow from 'wix-window';
import { session } from 'wix-storage';

$w.onReady(function () {
    const backButton = $w('#back-button');
    const fromDuctCleaning = session.getItem("fromDuctCleaning");

    // Debugging log
    console.log("Debug: fromDuctCleaning session flag is:", fromDuctCleaning);

    // Check if the session flag is set
    if (fromDuctCleaning === "true") {
        console.log("Session flag found. Showing back button.");
        backButton.show();
        // Optional: specific logic to handle back navigation if needed, 
        // but the button itself likely has a link or check
    } else {
        console.log("Session flag NOT found. Hiding back button.");
        backButton.hide();
    }
});