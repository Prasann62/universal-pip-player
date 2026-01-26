function enablePiP(video) {
    if (video.dataset.pipEnabled) return;
    video.dataset.pipEnabled = "true";

    // Double click = PiP
    video.addEventListener("dblclick", async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (e) {
            console.error("PiP error:", e);
        }
    });

    // AUTO PiP when video starts playing
    video.addEventListener("play", async () => {
        if (!document.pictureInPictureElement) {
            try {
                await video.requestPictureInPicture();
            } catch (e) {
                // Brave blocks if no user gesture — SAFE TO IGNORE
            }
        }
    });
}

// Detect existing videos
document.querySelectorAll("video").forEach(enablePiP);

// Detect new videos (SPA sites)
const observer = new MutationObserver(() => {
    document.querySelectorAll("video").forEach(enablePiP);
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
