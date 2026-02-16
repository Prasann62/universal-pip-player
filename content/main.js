// ==========================================
// MAIN ENTRY POINT
// ==========================================

const isIframe = window !== window.top;
console.log(`Stitch PiP: Extension Loaded 🚀 ${isIframe ? '(Iframe)' : '(Main Frame)'}`);

// Debounced handler for video detection
const handleVideoDetection = debounce(() => {
    const videos = document.querySelectorAll("video");
    videos.forEach(video => {
        // Only enable PiP on significant videos (not thumbnails)
        if (typeof isSignificantVideo === 'function' && !isSignificantVideo(video)) {
            return;
        }
        enablePiP(video);
    });
    handleYouTubeInjection();
}, typeof CONFIG !== 'undefined' ? CONFIG.MUTATION_OBSERVER_DELAY : 300);

// Detect existing videos on page load
document.querySelectorAll("video").forEach(video => {
    if (typeof isSignificantVideo !== 'function' || isSignificantVideo(video)) {
        enablePiP(video);
    }
});

// Observe DOM changes for dynamically added videos (SPA sites)
const observer = new MutationObserver(handleVideoDetection);

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial check for YouTube
handleYouTubeInjection();

// Fallback interval check for YouTube's dynamic UI
setInterval(handleYouTubeInjection, 2000);

