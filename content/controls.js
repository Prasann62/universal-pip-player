// ==========================================
// CONTROLS (Keyboard, Media Session)
// ==========================================

// Navigation tracking
let currentVideos = [];
let currentIndex = -1;

function updateVideoIndex() {
    const isYouTubeShorts = location.href.includes("youtube.com/shorts");
    const isInstagramReels = location.href.includes("/reels/") || location.href.includes("/reel/");

    if (isYouTubeShorts || isInstagramReels) {
        currentVideos = Array.from(document.querySelectorAll("video")).filter(v => v.readyState >= 2);
        const activeVideo = document.querySelector('video[style*="object-fit: cover"]') || document.querySelector('video');
        currentIndex = currentVideos.indexOf(activeVideo);
    }
}

async function playNext() {
    updateVideoIndex();
    if (currentIndex < currentVideos.length - 1) {
        const nextVideo = currentVideos[currentIndex + 1];
        if (document.pictureInPictureElement) {
            try {
                await nextVideo.requestPictureInPicture();
            } catch (e) {
                console.warn("Autoplay PiP failed:", e);
            }
        }
        nextVideo.play();
        showToast("Next Short ⬇️", "success");
    }
}

async function playPrev() {
    updateVideoIndex();
    if (currentIndex > 0) {
        const prevVideo = currentVideos[currentIndex - 1];
        if (document.pictureInPictureElement) {
            try {
                await prevVideo.requestPictureInPicture();
            } catch (e) {
                console.warn("Autoplay Prev PiP failed:", e);
            }
        }
        prevVideo.play();
        showToast("Previous Short ⬆️", "success");
    }
}

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    }
}

// Global Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
    // Only trigger if a video exists on the page OR in PiP
    let video = document.querySelector("video");

    // Check if video is in Document PiP
    if (!video && window.Stitch && window.Stitch.activePipWindow && window.Stitch.activePipWindow.document) {
        video = window.Stitch.activePipWindow.document.querySelector("video");
    }

    if (!video) return;

    // Ignore if typing in an input/textarea
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
        return;
    }

    switch (e.key.toLowerCase()) {
        case "m":
            video.muted = !video.muted;
            showToast(video.muted ? "Muted 🔇" : "Unmuted 🔊", "info");
            break;
        case " ":
            // Only toggle if video is present and we are not in an input
            e.preventDefault();
            if (video.paused) {
                video.play().catch(() => { });
                showToast("Playing ▶️", "success");
            } else {
                video.pause();
                showToast("Paused ⏸️", "info");
            }
            break;
        case "arrowleft":
            if (!e.altKey) {
                video.currentTime = Math.max(0, video.currentTime - 5);
                showToast("Rewind 5s ⏪", "info");
            }
            break;
        case "arrowright":
            if (!e.altKey) {
                video.currentTime = Math.min(video.duration, video.currentTime + 5);
                showToast("Forward 5s ⏩", "info");
            }
            break;
        case "arrowup":
            if (e.altKey) {
                // Volume control
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                showToast(`Volume: ${Math.round(video.volume * 100)}% 🔊`, "success");
            } else if (location.href.includes("youtube.com/shorts") || location.href.includes("/reel/")) {
                playPrev();
            }
            break;
        case "arrowdown":
            if (e.altKey) {
                // Volume control
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                showToast(`Volume: ${Math.round(video.volume * 100)}% ${video.volume === 0 ? '🔇' : '🔉'}`, "warning");
            } else if (location.href.includes("youtube.com/shorts") || location.href.includes("/reel/")) {
                playNext();
            }
            break;
        case ">":
            if (e.shiftKey) {
                // Speed up
                e.preventDefault();
                const speeds = typeof CONFIG !== 'undefined' ? CONFIG.PLAYBACK_SPEEDS : [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const currentSpeed = video.playbackRate;
                const nextSpeed = speeds.find(s => s > currentSpeed) || speeds[speeds.length - 1];
                video.playbackRate = nextSpeed;
                showToast(`Speed: ${nextSpeed}x ⏩`, "success");
            }
            break;
        case "<":
            if (e.shiftKey) {
                // Slow down - FIX: Create copy before reversing to avoid mutating CONFIG array
                e.preventDefault();
                const speeds = typeof CONFIG !== 'undefined' ? CONFIG.PLAYBACK_SPEEDS : [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const currentSpeed = video.playbackRate;
                const prevSpeed = [...speeds].reverse().find(s => s < currentSpeed) || speeds[0];
                video.playbackRate = prevSpeed;
                showToast(`Speed: ${prevSpeed}x ⏪`, "success");
            }
            break;
        case "h":
            toggleHelpTooltip();
            break;
        case "x":
            if (e.altKey) {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture();
                } else if (window.Stitch && window.Stitch.activePipWindow) {
                    window.Stitch.activePipWindow.close();
                }
                window.postMessage({ type: "CLOSE_PIP" }, "*");
            }
            break;
        case "p":
            // Alt + P is usually handled by chrome.commands, but we can double handle here for responsiveness if wanted
            // but manifest command is safer.
            break;
    }
});

// Listener for background messages (Commands)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TOGGLE_PIP") {
        if (typeof togglePiP === 'function') togglePiP(request.targetIndex);
    } else if (request.type === "CLOSE_PIP") {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => { });
        }
        window.postMessage({ type: "CLOSE_PIP" }, "*");

    } else if (request.type === "VIDEO_COMMAND") {
        // Inline popup controls — v3 Pro
        const video = typeof findPrimaryVideo === 'function' ? findPrimaryVideo() : document.querySelector('video');
        if (!video) return;

        switch (request.command) {
            case 'togglePlayPause':
                if (video.paused) video.play().catch(() => { }); else video.pause();
                break;
            case 'seek_relative':
                video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + (request.delta || 0)));
                break;
            case 'seek':
                if (isFinite(video.duration)) video.currentTime = request.pct * video.duration;
                break;
            case 'toggleMute':
                video.muted = !video.muted;
                break;
            case 'set_volume':
                video.volume = Math.max(0, Math.min(1, request.volume));
                if (video.muted && request.volume > 0) video.muted = false;
                break;
            case 'set_speed':
                video.playbackRate = request.speed;
                break;
            case 'toggleLoop':
                video.loop = !video.loop;
                if (typeof showToast === 'function') showToast(`Loop: ${video.loop ? 'ON 🔁' : 'OFF'}`, 'info');
                break;
        }
    }
});

// Listener for internal window messages
window.addEventListener("message", (e) => {
    if (e.data.type === "CLOSE_PIP" && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => { });
    }
});
