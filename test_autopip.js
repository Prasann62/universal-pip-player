// ==========================================
// TEST SCRIPT FOR AUTO-PIP VISIBILITY CHANGE
// Paste this into the YouTube console to simulate the extension logic
// ==========================================

// 1. Simulate extension configuration
window.Stitch = window.Stitch || {};
window.Stitch.autoPipEnabled = true;

// 2. Define the exact logic we added to main.js
document.addEventListener("visibilitychange", async () => {
    try {
        console.log("[TEST PiP] Visibility changed to:", document.visibilityState);

        const isAutoPipEnabled = window.Stitch.autoPipEnabled;
        console.log("[TEST PiP] Live autoPipEnabled setting:", isAutoPipEnabled);

        if (!isAutoPipEnabled) return;

        // Simplified video finder for the test
        const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
        console.log("[TEST PiP] Primary video found:", !!video);
        if (!video) return;

        if (document.visibilityState === "hidden") {
            const isNativePip = !!document.pictureInPictureElement;
            const isDocPip = window.Stitch && window.Stitch.activePipWindow && !window.Stitch.activePipWindow.closed;

            console.log("[TEST PiP] Hidden state logic begin. Paused:", video.paused, "Muted:", video.muted, "NativePiP:", isNativePip, "DocPiP:", isDocPip);

            if (!video.paused && !video.muted && !isNativePip && !isDocPip) {
                const dur = video.duration;
                const isLongEnough = !isFinite(dur) || dur > 10;
                const hasPlayedLongEnough = video.currentTime > 3;

                console.log("[TEST PiP] Video Duration:", dur, "Played:", video.currentTime, "Long enough?", isLongEnough, "Played enough?", hasPlayedLongEnough);

                if (isLongEnough && hasPlayedLongEnough) {
                    console.log("[TEST PiP] Triggering Auto-PiP! (Simulation)");
                    video.dataset.autoPipped = "true";

                    // Call the actual request method to see if the browser blocks it
                    try {
                        await video.requestPictureInPicture();
                        console.log("[TEST PiP] PiP opened successfully!");
                    } catch (e) {
                        console.error("[TEST PiP] Failed to open PiP programmatically:", e);
                    }
                }
            }
        } else if (document.visibilityState === "visible") {
            console.log("[TEST PiP] Visible state logic check autoPipped flag:", video.dataset.autoPipped);
            if (video.dataset.autoPipped === "true") {
                delete video.dataset.autoPipped;
                console.log("[TEST PiP] Restoring from Auto-PiP");

                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().catch(() => { });
                }
            }
        }
    } catch (e) {
        console.warn("[TEST PiP] Visibility Auto-PiP error:", e);
    }
});

console.log("[TEST PiP] Test script injected! Play a video, switch tabs, and watch this console.");
