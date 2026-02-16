// ==========================================
// PICTURE-IN-PICTURE CORE LOGIC
// ==========================================

let activePipWindow = null;

async function requestDocumentPiP(video) {
    if (!('documentPictureInPicture' in window)) return false;

    try {
        // Save original styles and state
        const originalStyle = video.getAttribute("style") || "";
        const originalParent = video.parentElement;
        const originalNextSibling = video.nextSibling;

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

        // Style the PiP window
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.background = "black";
        pipWindow.document.body.style.display = "flex";
        pipWindow.document.body.style.alignItems = "center";
        pipWindow.document.body.style.justifyContent = "center";
        pipWindow.document.body.style.overflow = "hidden";

        // Create a container for video and custom controls
        const container = document.createElement("div");
        container.style.position = "relative";
        container.style.width = "100vw";
        container.style.height = "100vh";
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";

        // Apply override styles to the video to force it to fit
        video.style.setProperty("width", "100%", "important");
        video.style.setProperty("height", "100%", "important");
        video.style.setProperty("position", "relative", "important");
        video.style.setProperty("left", "0", "important");
        video.style.setProperty("top", "0", "important");
        video.style.setProperty("object-fit", "contain", "important");

        // Move video to PiP
        container.appendChild(video);
        pipWindow.document.body.appendChild(container);

        // 🎨 Inject Stitch Styles (now pointing to content/styles.css)
        const link = pipWindow.document.createElement("link");
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("content/styles.css");
        pipWindow.document.head.appendChild(link);

        // Inject inline overrides for PiP window specifics (layout only)
        const style = pipWindow.document.createElement("style");
        style.textContent = `
            body { background: #050505 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; }
        `;
        pipWindow.document.head.appendChild(style);

        // Custom Overlay for Controls (Stitch UI)
        const overlay = document.createElement("div");
        overlay.className = "pip-overlay";
        overlay.innerHTML = `
            <button id="rewind" class="pip-btn" title="Rewind 5s">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
            </button>
            <button id="playPause" class="pip-btn" title="Play/Pause">
                ${video.paused ?
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' :
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
            }
            </button>
            <button id="forward" class="pip-btn" title="Forward 5s">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
            </button>
            <div class="separator"></div>
            <button id="snapshot" class="pip-btn" title="Take Snapshot">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </button>
        `;
        container.appendChild(overlay);

        // Add class to container for hover effect
        container.classList.add("container");

        // Logic for custom buttons
        const updatePlayIcon = () => {
            overlay.querySelector("#playPause").innerHTML = video.paused ?
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' :
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
        };
        overlay.querySelector("#playPause").onclick = () => {
            if (video.paused) video.play(); else video.pause();
            updatePlayIcon();
        };
        overlay.querySelector("#rewind").onclick = () => video.currentTime -= 5;
        overlay.querySelector("#forward").onclick = () => video.currentTime += 5;
        overlay.querySelector("#snapshot").onclick = () => takeSnapshot(video);

        // Restore video on close
        pipWindow.addEventListener("pagehide", () => {
            activePipWindow = null;
            window.Stitch.activePipWindow = null;

            // Restore original styles
            if (originalStyle) {
                video.setAttribute("style", originalStyle);
            } else {
                video.removeAttribute("style");
            }

            // Move back to original position
            if (originalNextSibling) {
                originalParent.insertBefore(video, originalNextSibling);
            } else {
                originalParent.appendChild(video);
            }
        }, { once: true });

        // Detect resize and move shortcuts for Document PiP
        pipWindow.addEventListener("keydown", (e) => {
            if (e.altKey) {
                switch (e.key) {
                    case "+":
                    case "=":
                        pipWindow.resizeBy(20, 20);
                        break;
                    case "-":
                        pipWindow.resizeBy(-20, -20);
                        break;
                    case "ArrowUp":
                        pipWindow.moveBy(0, -20);
                        break;
                    case "ArrowDown":
                        pipWindow.moveBy(0, 20);
                        break;
                    case "ArrowLeft":
                        pipWindow.moveBy(-20, 0);
                        break;
                    case "ArrowRight":
                        pipWindow.moveBy(20, 0);
                        break;
                    case "x":
                    case "X":
                        pipWindow.close();
                        break;
                }
            }
        });

        // Handle close from background
        window.addEventListener("message", (e) => {
            if (e.data.type === "CLOSE_PIP") {
                pipWindow.close();
            }
        });

        return true;
    } catch (e) {
        console.error("Document PiP failed:", e);
        return false;
    }
}

// Enable PiP functionality on a video element
function takeSnapshot(video) {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataURL = canvas.toDataURL("image/png");

        // Create link and download
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = `stitch-snapshot-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Feedback
        if (typeof showToast === 'function') {
            showToast("Snapshot Saved 📸");
        }
    } catch (e) {
        console.error("Snapshot failed:", e);
        if (typeof showToast === 'function') {
            showToast("Snapshot Failed 🚫", "error");
        }
    }
}

// Enable PiP functionality on a video element
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
            showToast("Video not found at index ${index} 🚫", "error");
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


