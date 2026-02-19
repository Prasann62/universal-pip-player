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

// 🚀 Optimized Video Detection & UI Injection
// Replacing aggressive MutationObserver/Intervals with targeted checks

let injectionTimeout;

const debouncedInjection = () => {
    clearTimeout(injectionTimeout);
    injectionTimeout = setTimeout(() => {
        handleYouTubeInjection();
        if (typeof handleJioCinemaInjection === 'function') handleJioCinemaInjection();
    }, 1000); // Check 1s after DOM settles
};

// 1. Efficient Observer: Detects added nodes but throttles processing
// We only care if <video> or potential containers are added.
const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            shouldCheck = true;
            break;
        }
    }

    if (shouldCheck) {
        debouncedInjection();
        // Lazily re-scan for videos if new nodes added
        handleVideoDetection(); // This is already debounced in previous lines (line 9)
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 2. Initial Run
// Use requestIdleCallback if available to not block main thread on load
if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
        handleYouTubeInjection();
        if (typeof handleJioCinemaInjection === 'function') handleJioCinemaInjection();
    });
} else {
    setTimeout(() => {
        handleYouTubeInjection();
        if (typeof handleJioCinemaInjection === 'function') handleJioCinemaInjection();
    }, 500);
}

// 3. Cleanup on Unload
window.addEventListener('unload', () => {
    observer.disconnect();
    clearTimeout(injectionTimeout);
});

