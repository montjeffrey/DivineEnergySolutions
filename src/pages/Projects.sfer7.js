$w.onReady(function () {
    // Listen for messages from the HTML Embed
    // ID Check: Ensure this is actually an HTML Component in the Editor
    const htmlEmbed = $w("#htmlEmbed1");

    if (htmlEmbed) {
        // Debugging: Check if the element works as expected
        console.log("HTML Embed Type:", htmlEmbed.type);

        if (htmlEmbed.onMessage) {
            htmlEmbed.onMessage((event) => {
                let category = event.data;
                console.log("Received category:", category);
                // Switch the visibility based on category
                updateSectionVisibility(category);
            });
        } else {
            console.error("Error: Element #htmlEmbed1 is found but does not have an 'onMessage' method. It might be the wrong element type (e.g., a Box instead of an HTML Embed).");
        }
    } else {
        console.error("Error: Element #htmlEmbed1 not found on the page.");
    }
});

function updateSectionVisibility(category) {
    // Dictionary mapping categories to Section IDs
    // [!] IMPORTANT: Replace these IDs with your actual Element IDs from Wix Editor
    const sections = {
        'sprayfoam': '#sectionSprayFoam',
        'cellulose': '#sectionCellulose',
        'hvac': '#sectionHVAC'
    };

    const allSectionIds = Object.values(sections);
    const normalizedCategory = category.toLowerCase();

    console.log(`Updating visibility for: ${normalizedCategory}`);

    // 1. Determine which sections should be visible vs hidden
    let targetIds = [];
    if (normalizedCategory === 'all') {
        targetIds = allSectionIds;
    } else {
        const id = sections[normalizedCategory];
        if (id) targetIds = [id];
        else console.warn(`Category '${category}' not found.`);
    }

    const idsToHide = allSectionIds.filter(id => !targetIds.includes(id));
    const idsToShow = targetIds;

    const animationOptions = {
        "duration": 400,
        "delay": 0
    };

    // 2. Perform Animations
    // Step A: Hide unwanted sections (Fade Out -> Collapse)
    const hidePromises = idsToHide.map(id => {
        const el = $w(id);
        // If element is not collapsed, fade it out then collapse
        if (!el.collapsed) {
            return el.hide("fade", animationOptions)
                .then(() => el.collapse())
                .catch(err => {
                    console.error(`Error hiding ${id}`, err);
                    // Fallback to force collapse if animation fails
                    return el.collapse();
                });
        }
        // If already collapsed, just ensure it stays that way (fast resolution)
        return Promise.resolve();
    });

    // Step B: Wait for hides to finish (or mostly finish) then Show needed sections
    Promise.all(hidePromises).then(() => {
        idsToShow.forEach(id => {
            const el = $w(id);
            // If it needs to show
            if (el.collapsed || el.hidden) {
                el.expand()
                    .then(() => el.show("fade", animationOptions))
                    .catch(err => console.error(`Error showing ${id}`, err));
            }
            // If already visible and expanded, do nothing to avoid flicker
        });
    });
}