$w.onReady(function () {
    // Listen for messages from the HTML Embed
    // Listen for messages from the HTML Embed
    const htmlEmbed = $w("#htmlEmbed1");

    if (htmlEmbed) {
        // Debugging: Check if the element works as expected
        console.log("HTML Embed Type:", htmlEmbed.type);

        if (htmlEmbed.onMessage) {
            htmlEmbed.onMessage((event) => {
                let category = event.data;
                console.log("Received category:", category);
                // Switch the state with a smooth fade transition
                changeState(category);
            });
        } else {
            console.error("Error: Element #htmlEmbed1 is found but does not have an 'onMessage' method. It might be the wrong element type (e.g., a Box instead of an HTML Embed).");
        }
    } else {
        console.error("Error: Element #htmlEmbed1 not found on the page.");
    }
});

function changeState(targetState) {
    const stateBox = $w("#projectStateBox");

    // Check if the state exists before switching
    if (stateBox.states.some(state => state.id === targetState)) {
        stateBox.changeState(targetState)
            .then(() => {
                console.log(`Switched to ${targetState}`);
            })
            .catch((err) => {
                console.error("Error switching states:", err);
            });
    }
}