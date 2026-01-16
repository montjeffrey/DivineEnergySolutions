// --- 1. IMPORTS ---
import wixAnimations from 'wix-animations';
import wixWindow from 'wix-window';

// --- 2. PAGE CODE ---
$w.onReady(function () {
    console.log("Page Ready - Immersive Mode");

    if (wixWindow.formFactor === "Desktop") {
        
        // 1. SELECT ELEMENTS
        const privateSection = $w('#boxPrivate');
        const comfortSection = $w('#boxComfort');

        // Check if elements exist
        if (!privateSection.id || !comfortSection.id) {
            console.error("IDs mismatch! Check Properties Panel.");
            return;
        }

        // 2. ANIMATION SETTINGS
        // 'easeOutCirc' feels smoother and more premium than linear
        const easeMethod = 'easeOutCirc'; 
        const duration = 400; // 400ms is a sweet spot for UI transitions

        // 3. HELPER FUNCTIONS
        
        /**
         * Focuses on one element while hiding the other
         * @param {Element} activeEl - The element getting hovered (grows)
         * @param {Element} hiddenEl - The element fading away (shrinks)
         */
        function runFocusEffect(activeEl, hiddenEl) {
            const timeline = wixAnimations.timeline();

            timeline
                .add(activeEl, {
                    "scale": 1.05,  // Slight zoom IN for immersion
                    "opacity": 1,
                    "duration": duration,
                    "easing": easeMethod
                })
                .add(hiddenEl, {
                    "scale": 0.95,  // Slight zoom OUT to push it back
                    "opacity": 0,   // 0.0 means completely invisible
                    "duration": duration,
                    "easing": easeMethod
                }, 0); // The '0' offset forces both to run at the exact same time

            timeline.play();
        }

        /**
         * Resets both elements to their original state
         */
        function resetView() {
            const timeline = wixAnimations.timeline();

            timeline
                .add([privateSection, comfortSection], {
                    "scale": 1,
                    "opacity": 1,
                    "duration": duration,
                    "easing": easeMethod
                });
            
            timeline.play();
        }

        // --- 4. INTERACTION LOGIC ---

        // Private Hover
        privateSection.onMouseIn(() => {
            runFocusEffect(privateSection, comfortSection);
        });

        privateSection.onMouseOut(() => {
            resetView();
        });

        // Comfort Hover
        comfortSection.onMouseIn(() => {
            runFocusEffect(comfortSection, privateSection);
        });

        comfortSection.onMouseOut(() => {
            resetView();
        });

    } else {
        console.log("Mobile Mode - Hover effects disabled.");
    }

	//ANIMATION 2 START HERE. SECTION IS FOR DIAGNOSTIC PIPELINE

	// --- PART 1: THE PIPELINE ANIMATION (The New Section) ---
    // This uses an Intersection Observer (onViewportEnter) to fill the line
    
    const liquidLine = $w('#liquidFillLine');
    const pipelineSection = $w('#sectionTrustPipeline'); // Name your new section this
    
    // Only run if the new elements exist
    if (liquidLine.id && pipelineSection.id) {
        
        // Define the timeline
        const timeline = wixAnimations.timeline();
        
        // 1. Fill the line
        timeline.add(liquidLine, {
            "scaleY": 1, // Grows from 0% to 100%
            "duration": 1500,
            "easing": "easeOutCubic"
        });

        // 2. Slide in the panels (Optional - remove if you want them static)
        ['#glassPanel1', '#glassPanel2', '#glassPanel3'].forEach((id, index) => {
            const el = $w(id);
            if(el.id) {
                // Stagger the animation
                timeline.add(el, { "opacity": 1, "y": 0, "duration": 500 }, `-=${1200 - (index * 200)}`);
            }
        });

        // Trigger
        pipelineSection.onViewportEnter(() => {
            timeline.play();
        });
    }
});