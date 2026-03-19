// ==========================================
// PICTURE-IN-PICTURE CORE LOGIC
// ==========================================

let activePipWindow = null;

async function requestDocumentPiP(video) {
    if (!('documentPictureInPicture' in window)) return false;

    // prevent multiple PiP windows
    if (window.Stitch && window.Stitch.activePipWindow) {
        window.Stitch.activePipWindow.close();
    }

    try {
        // Save original styles and state
        const originalStyle = video.getAttribute("style") || "";
        const originalParent = video.parentElement;
        const originalNextSibling = video.nextSibling;

        // Mark video as being in PiP to prevent re-capturing by observer
        video.dataset.isInPip = "true";

        // Get saved size preference
        const sizePreference = await chrome.storage.local.get(['playerSize']);
        const sizeMode = sizePreference.playerSize || 'medium';

        let width = 380;
        let height = 175;

        if (sizeMode === "small") { width = 300; height = 169; }
        else if (sizeMode === "large") { width = 500; height = 281; }

        const pipWindow = await window.documentPictureInPicture.requestWindow({
            width: width,
            height: height,
        });

        activePipWindow = pipWindow;
        window.Stitch.activePipWindow = pipWindow;

        // Reset Styles for PiP Window
        Object.assign(pipWindow.document.body.style, {
            margin: "0",
            background: "black",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
        });

        // Create a Container
        const container = document.createElement("div");
        Object.assign(container.style, {
            position: "relative",
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000"
        });

        // Force Video Styles
        video.style.setProperty("width", "100%", "important");
        video.style.setProperty("height", "100%", "important");
        video.style.setProperty("max-width", "none", "important");
        video.style.setProperty("max-height", "none", "important");
        video.style.setProperty("object-fit", "contain", "important");
        video.style.setProperty("margin", "0", "important");

        // Move video
        container.appendChild(video);
        pipWindow.document.body.appendChild(container);

        // 🎨 Inject Styles
        const link = pipWindow.document.createElement("link");
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("content/styles.css");
        pipWindow.document.head.appendChild(link);

        // Custom Overlay
        const { overlay, cleanup: overlayCleanup } = createPipOverlay(video, pipWindow);
        container.appendChild(overlay);
        container.classList.add("container");

        // Cleanup Function
        const onPipClose = () => {
            activePipWindow = null;
            window.Stitch.activePipWindow = null;
            delete video.dataset.isInPip;

            // Remove overlay listeners
            if (typeof overlayCleanup === 'function') overlayCleanup();

            // Restore Video
            if (originalStyle) {
                video.setAttribute("style", originalStyle);
            } else {
                video.removeAttribute("style");
            }

            if (originalParent && originalParent.isConnected) {
                originalParent.insertBefore(video, originalNextSibling);
            } else {
                // Fallback if parent is gone (SPA navigation)
                // This is tricky, but often we just let it be GC'd or append to body if really needed? 
                // For now, if parent logic fails, we can't do much.
            }

            // Remove listeners
            pipWindow.removeEventListener("pagehide", onPipClose);
            // Also remove any listeners added to the video element specifically for PiP if they are not meant to persist.
            // For example, the 'play' and 'pause' listeners added in createPipOverlay.
            // However, since the video element is moved back, these listeners might be desired to persist.
        };

        pipWindow.addEventListener("pagehide", onPipClose, { once: true });

        // Add Shortcuts
        setupPipShortcuts(pipWindow);

        // Handle close from background
        const messageListener = (e) => {
            if (e.data.type === "CLOSE_PIP") {
                pipWindow.close();
            }
        };
        window.addEventListener("message", messageListener);
        // Ensure this listener is also cleaned up
        const removeMessageListener = () => window.removeEventListener("message", messageListener);
        pipWindow.addEventListener("pagehide", removeMessageListener, { once: true });


        return true;
    } catch (e) {
        console.error("Document PiP failed:", e);
        // Fallback cleanup if partial failure?
        delete video.dataset.isInPip;
        return false;
    }
}

// Extracted UI Logic to keep requestDocumentPiP clean
function createPipOverlay(video, pipWindow) {
    const overlay = document.createElement("div");
    overlay.className = "pip-overlay";

    // Format time utility
    const formatTime = (seconds) => {
        if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    overlay.innerHTML = `
        <div class="pip-progress-container" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span id="pip-time-current" style="font-size: 10px; font-family: monospace; color: #fff;">${formatTime(video.currentTime)}</span>
            <input type="range" id="pip-progress" class="pip-slider" min="0" max="100" value="0" step="0.1" style="flex: 1; cursor: pointer;">
            <span id="pip-time-total" style="font-size: 10px; font-family: monospace; color: #fff;">${formatTime(video.duration)}</span>
        </div>
        <div class="pip-controls-row" style="display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%;">
            <button id="rewind" class="pip-btn" title="Rewind 5s">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
            </button>
            <button id="playPause" class="pip-btn" title="Play/Pause">
                 ${!video.paused ?
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>' :
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
        }
            </button>
            <button id="forward" class="pip-btn" title="Forward 5s">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
            </button>
            
            <div class="separator"></div>
            
            <div class="pip-volume-ctrl" style="display: flex; align-items: center; gap: 4px;">
                <button id="muteBtn" class="pip-btn" title="Mute/Unmute">
                    ${video.muted || video.volume === 0 ?
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
        }
                </button>
                <input type="range" id="pip-volume" class="pip-slider" min="0" max="1" step="0.05" value="${video.muted ? 0 : video.volume}" style="width: 40px; cursor: pointer;">
            </div>

            <div class="separator"></div>
            
            <button id="ccBtn" class="pip-btn" title="Subtitles/CC">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><path d="M7 11.5h2"></path><path d="M15 11.5h2"></path><path d="M7 16.5h2"></path><path d="M15 16.5h2"></path></svg>
            </button>
            
            <button id="loopBtn" class="pip-btn" title="Loop: Off">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            </button>
            <button id="speedBtn" class="pip-btn" title="Speed: 1x" style="font-size: 11px; font-weight: bold;">1x</button>
            <button id="snapshot" class="pip-btn" title="Take Snapshot">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </button>
        </div>
    `;

    // --- Media Controls Bindings ---
    const playBtn = overlay.querySelector("#playPause");
    const updatePlayIcon = () => {
        playBtn.innerHTML = video.paused ?
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' :
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    };
    playBtn.onclick = () => {
        if (video.paused) video.play(); else video.pause();
        updatePlayIcon();
    };

    overlay.querySelector("#rewind").onclick = () => video.currentTime -= 5;
    overlay.querySelector("#forward").onclick = () => video.currentTime += 5;
    overlay.querySelector("#snapshot").onclick = () => takeSnapshot(video);

    // --- Progress Bar ---
    const progressSlider = overlay.querySelector("#pip-progress");
    const timeCurrent = overlay.querySelector("#pip-time-current");
    const timeTotal = overlay.querySelector("#pip-time-total");

    let isDraggingProgress = false;

    progressSlider.addEventListener('input', (e) => {
        isDraggingProgress = true;
        if (isFinite(video.duration)) {
            timeCurrent.innerText = formatTime((e.target.value / 100) * video.duration);
        }
    });

    progressSlider.addEventListener('change', (e) => {
        if (isFinite(video.duration)) {
            video.currentTime = (e.target.value / 100) * video.duration;
        }
        isDraggingProgress = false;
    });

    const onTimeUpdate = () => {
        if (!isDraggingProgress && isFinite(video.duration) && video.duration > 0) {
            progressSlider.value = (video.currentTime / video.duration) * 100;
            timeCurrent.innerText = formatTime(video.currentTime);
            timeTotal.innerText = formatTime(video.duration);
            progressSlider.style.background = `linear-gradient(to right, var(--neon-cyan) ${progressSlider.value}%, rgba(255,255,255,0.2) ${progressSlider.value}%)`;
        }
    };

    // --- Volume Control ---
    const volumeSlider = overlay.querySelector("#pip-volume");
    const muteBtn = overlay.querySelector("#muteBtn");

    const updateVolumeIcon = () => {
        muteBtn.innerHTML = video.muted || video.volume === 0 ?
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
        const pct = (video.muted ? 0 : video.volume) * 100;
        volumeSlider.style.background = `linear-gradient(to right, var(--neon-cyan) ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
    };

    muteBtn.onclick = () => {
        video.muted = !video.muted;
        volumeSlider.value = video.muted ? 0 : video.volume;
        updateVolumeIcon();
    };

    volumeSlider.addEventListener('input', (e) => {
        video.muted = false;
        video.volume = e.target.value;
    });

    const onVolumeChange = () => {
        volumeSlider.value = video.muted ? 0 : video.volume;
        updateVolumeIcon();
    };

    // --- Subtitles / CC Toggle ---
    const ccBtn = overlay.querySelector("#ccBtn");
    const hasTextTracks = video.textTracks && video.textTracks.length > 0;

    const updateCcIconState = () => {
        let isShowing = false;
        if (hasTextTracks) {
            for (let i = 0; i < video.textTracks.length; i++) {
                if (video.textTracks[i].mode === 'showing') {
                    isShowing = true;
                    break;
                }
            }
        } else {
            const ytCcBtn = document.querySelector('.ytp-subtitles-button');
            if (ytCcBtn && ytCcBtn.getAttribute('aria-pressed') === 'true') {
                isShowing = true;
            }
        }
        ccBtn.style.color = isShowing ? "var(--neon-cyan, #00f3ff)" : "inherit";
    };

    ccBtn.onclick = () => {
        let toggled = false;
        if (hasTextTracks) {
            let activeFound = false;
            for (let i = 0; i < video.textTracks.length; i++) {
                if (video.textTracks[i].mode === 'showing') {
                    video.textTracks[i].mode = 'hidden';
                    activeFound = true;
                }
            }
            if (!activeFound) {
                const track = Array.from(video.textTracks).find(t => t.language.startsWith('en')) || video.textTracks[0];
                if (track) track.mode = 'showing';
            }
            toggled = true;
        } else {
            const ytCcBtn = document.querySelector('.ytp-subtitles-button');
            if (ytCcBtn) {
                ytCcBtn.click();
                toggled = true;
            }
        }

        if (toggled) {
            setTimeout(updateCcIconState, 100);
            if (typeof showToast === 'function') showToast("CC Toggled 💬");
        } else {
            if (typeof showToast === 'function') showToast("No Subtitles Found 🚫");
        }
    };

    // Init state
    updatePlayIcon();
    updateVolumeIcon();
    onTimeUpdate();
    setTimeout(updateCcIconState, 500);

    // Bind real-time event listeners
    const onPlayPauseEvent = () => updatePlayIcon();
    video.addEventListener('play', onPlayPauseEvent);
    video.addEventListener('pause', onPlayPauseEvent);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('volumechange', onVolumeChange);

    // Cleanup callback
    const cleanup = () => {
        video.removeEventListener('play', onPlayPauseEvent);
        video.removeEventListener('pause', onPlayPauseEvent);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('volumechange', onVolumeChange);
    };

    // --- Loop ---
    const loopBtn = overlay.querySelector("#loopBtn");
    loopBtn.style.color = video.loop ? "var(--neon-cyan, #00f3ff)" : "inherit";
    loopBtn.onclick = () => {
        video.loop = !video.loop;
        loopBtn.style.color = video.loop ? "var(--neon-cyan, #00f3ff)" : "inherit";
        loopBtn.title = `Loop: ${video.loop ? 'On' : 'Off'}`;
        if (typeof showToast === 'function') showToast(`Loop: ${video.loop ? 'ON' : 'OFF'}`);
    };

    // --- Speed ---
    const speeds = [1, 1.25, 1.5, 2, 0.5];
    const speedBtn = overlay.querySelector("#speedBtn");
    speedBtn.onclick = () => {
        let idx = speeds.indexOf(video.playbackRate);
        if (idx === -1) idx = 0;
        const newSpeed = speeds[(idx + 1) % speeds.length];
        video.playbackRate = newSpeed;
        speedBtn.innerText = `${newSpeed}x`;
        if (typeof showToast === 'function') showToast(`Speed: ${newSpeed}x ⏩`);
    };

    return { overlay, cleanup };
}


function setupPipShortcuts(pipWindow) {
    pipWindow.addEventListener("keydown", (e) => {
        if (e.altKey) {
            switch (e.key) {
                case "+": case "=": pipWindow.resizeBy(20, 20); break;
                case "-": pipWindow.resizeBy(-20, -20); break;
                case "ArrowUp": pipWindow.moveBy(0, -20); break;
                case "ArrowDown": pipWindow.moveBy(0, 20); break;
                case "ArrowLeft": pipWindow.moveBy(-20, 0); break;
                case "ArrowRight": pipWindow.moveBy(20, 0); break;
                case "x": case "X": pipWindow.close(); break;
            }
        }
    });
}

// Enable PiP functionality on a video element
function takeSnapshot(video) {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const dataURL = canvas.toDataURL("image/png");

            // Create link and download
            const link = document.createElement("a");
            link.href = dataURL;
            link.download = `stitch - snapshot - ${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Feedback
            if (typeof showToast === 'function') {
                showToast("Snapshot Saved 📸", "success");
            }
        } catch (securityError) {
            console.warn("Snapshot blocked by CORS:", securityError);
            if (typeof showToast === 'function') {
                showToast("Cannot capture protected video 🔒", "error");
            }
        }
    } catch (e) {
        console.error("Snapshot failed:", e);
        if (typeof showToast === 'function') {
            showToast("Snapshot Error 🚫", "error");
        }
    }
}

// Bypass disablePictureInPicture restrictions (Anti-Block PiP)
function bypassPipRestrictions(video) {
    try {
        if (video.hasAttribute('disablepictureinpicture')) {
            video.removeAttribute('disablepictureinpicture');
        }
        
        // Overwrite the property so scripts can't set it back to true
        Object.defineProperty(video, 'disablePictureInPicture', {
            get: () => false,
            set: () => {}, // Ignore attempts to set it
            configurable: true
        });
    } catch (e) {
        console.warn("Could not bypass PiP restrictions on this video", e);
    }
}

// Enable PiP functionality on a video element
function enablePiP(video) {
    bypassPipRestrictions(video);
    if (video.dataset.pipEnabled) return;
    video.dataset.pipEnabled = "true";

    // Double click = PiP
    video.addEventListener("dblclick", async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
                // We'll call setupMediaSession if available (global or passed)
                // For now, assume global function or verify existence
                if (typeof setupMediaSession === 'function') setupMediaSession();
            }
        } catch (e) {
            console.error("PiP error:", e);
        }
    });

    // PiP Event Hooks
    video.addEventListener("enterpictureinpicture", () => {
        showToast("PiP Mode Enabled 📺");
        if (typeof setupMediaSession === 'function') setupMediaSession();
    });

    video.addEventListener("leavepictureinpicture", () => {
        showToast("PiP Mode Closed");
    });

    // Document PiP Support (Advanced)
    video.dataset.docPipSupported = 'documentPictureInPicture' in window;
}

// Master Toggle Function
async function togglePiP(index = null) {
    // 0. Check if Document PiP is already open (priority close)
    if (window.Stitch && window.Stitch.activePipWindow) {
        window.Stitch.activePipWindow.close();
        // showToast("PiP Closed", "info"); // Optional: let the pagehide handler handle cleanup
        return;
    }

    let video;
    if (index !== null) {
        const videos = document.querySelectorAll("video");
        video = videos[index];
        if (!video) {
            showToast(`Video not found at index ${index} 🚫`, "error");
            return;
        }
    } else {
        // Use smart video detection if available, otherwise fallback to simple query
        if (typeof findPrimaryVideo === 'function') {
            video = findPrimaryVideo();
        }
        if (!video) {
            video = document.querySelector("video.html5-main-video") || document.querySelector("video");
        }
    }

    if (!video) {
        showToast("No video found on this page 🚫", "error");
        return;
    }

    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        showToast("PiP Closed", "info");
        return;
    }

    // 1. Try Document PiP (if supported and enabled preference - assuming true for now)
    if (await requestDocumentPiP(video)) {
        return;
    }

    // 2. Try Native PiP
    try {
        await video.requestPictureInPicture();
    } catch (e) {
        console.warn("Native PiP failed", e);

        // 3. Fallback: Fake PiP (Floating Window)
        toggleFloatingMode(video);
    }
}
window.togglePiP = togglePiP;

// ==========================================
// FLOATING MODE (FALLBACK)
// ==========================================
let isFloating = false;
let floatOriginalStyle = "";
let floatOriginalParent = null; // Unused for basic float, used if we move it
let floatCloseBtn = null;

function toggleFloatingMode(video) {
    if (video.dataset.isFloating === "true") {
        disableFloatingMode(video);
        return;
    }

    // Save original state
    floatOriginalStyle = video.getAttribute("style") || "";
    video.dataset.isFloating = "true";

    // Get size settings
    chrome.storage.local.get(['playerSize'], (result) => {
        const sizeMode = result.playerSize || 'medium';
        let width = "380px";
        let height = "175px";

        if (sizeMode === "small") { width = "300px"; height = "169px"; }
        else if (sizeMode === "large") { width = "500px"; height = "281px"; }

        // Apply floating styles via class and specific dimensions
        video.classList.add("stitch-floating-video");
        video.style.width = width;
        video.style.height = height;

        // Create Close Button (Adjust position based on size)
        if (!floatCloseBtn) {
            floatCloseBtn = document.createElement("button");
            floatCloseBtn.innerHTML = "×";
            floatCloseBtn.className = "stitch-floating-close-btn";

            floatCloseBtn.onclick = () => disableFloatingMode(video);
            document.body.appendChild(floatCloseBtn);
        }

        // Adjust button position dynamically
        floatCloseBtn.style.display = "flex";
        floatCloseBtn.style.right = "25px";
        // Bottom = Video Bottom (20) + Video Height (height in px) - 12 (half button)
        const hVal = parseInt(height.replace("px", ""));
        floatCloseBtn.style.bottom = (20 + hVal - 12) + "px";
    });

    showToast("Floating Mode (Fallback) 🎈", "info");
}

function disableFloatingMode(video) {
    if (video.dataset.isFloating !== "true") return;

    // Restore
    video.setAttribute("style", floatOriginalStyle);
    video.classList.remove("stitch-floating-video");
    delete video.dataset.isFloating;

    if (floatCloseBtn) {
        floatCloseBtn.style.display = "none";
    }
}

// ==========================================
// MESSAGE LISTENER
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "UPDATE_SIZE") {
        updateFloatingSize(request.size);
        updateDocumentPipSize(request.size);
        window.postMessage({ type: "UPDATE_SIZE", size: request.size }, "*");
    }
});

function updateDocumentPipSize(sizeMode) {
    if (!activePipWindow || activePipWindow.closed) return;

    let width = 380;
    let height = 175;

    if (sizeMode === "small") { width = 300; height = 169; }
    else if (sizeMode === "large") { width = 500; height = 281; }

    try {
        // Document PiP windows can be resized using resizeTo
        // Some browsers need the window to be explicitly focused first
        activePipWindow.focus();
        activePipWindow.resizeTo(width, height);

        // Show feedback toast
        if (typeof showToast === 'function') {
            const sizeLabel = sizeMode.charAt(0).toUpperCase() + sizeMode.slice(1);
            showToast(`PiP Size: ${sizeLabel} (${width}x${height})`);
        }
    } catch (e) {
        console.warn("Could not resize Document PiP window:", e);
        // Fallback: Save preference for next time
        if (typeof showToast === 'function') {
            showToast("Size will apply next PiP session");
        }
    }
}

function updateFloatingSize(sizeMode) {
    // 1. Handle Floating Mode (Fallback)
    const activeVideo = document.querySelector("video[data-is-floating='true']");
    if (activeVideo) {
        let width = "380px";
        let height = "175px";

        if (sizeMode === "small") { width = "300px"; height = "169px"; }
        else if (sizeMode === "large") { width = "500px"; height = "281px"; }

        activeVideo.style.width = width;
        activeVideo.style.height = height;

        // Update close button position
        if (floatCloseBtn) {
            const hVal = parseInt(height.replace("px", ""));
            floatCloseBtn.style.bottom = (20 + hVal - 12) + "px";
        }

        // Show feedback
        if (typeof showToast === 'function') {
            const sizeLabel = sizeMode.charAt(0).toUpperCase() + sizeMode.slice(1);
            showToast(`Floating Size: ${sizeLabel} (${width} × ${height})`);
        }
    }
}


