$w.onReady(function () {
    // Listen for messages from the HTML Embed
    $w("#htmlEmbed1").onMessage((event) => {
        let category = event.data;

        // Switch the state with a smooth fade transition
        changeState(category);
    });
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