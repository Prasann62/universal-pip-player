// ==========================================
// PICTURE-IN-PICTURE CORE LOGIC
// ==========================================

async function requestDocumentPiP(video) {
    if (!('documentPictureInPicture' in window)) return false;

    try {
        // Save original styles and state
        const originalStyle = video.getAttribute("style") || "";
        const originalParent = video.parentElement;
        const originalNextSibling = video.nextSibling;

        const pipWindow = await window.documentPictureInPicture.requestWindow({
            width: video.videoWidth || 640,
            height: video.videoHeight || 360,
        });

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

        // Custom Overlay for Controls (Simplified)
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:none;gap:15px;background:rgba(0,0,0,0.6);padding:10px 20px;border-radius:30px;transition:opacity 0.2s;backdrop-filter:blur(5px);z-index:1000;";
        overlay.innerHTML = `
            <button id="rewind" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">⏪</button>
            <button id="playPause" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">${video.paused ? '▶️' : '⏸️'}</button>
            <button id="forward" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">⏩</button>
        `;
        container.appendChild(overlay);

        container.onmouseenter = () => overlay.style.display = "flex";
        container.onmouseleave = () => overlay.style.display = "none";

        // Logic for custom buttons
        overlay.querySelector("#playPause").onclick = () => {
            if (video.paused) video.play(); else video.pause();
            overlay.querySelector("#playPause").textContent = video.paused ? '▶️' : '⏸️';
        };
        overlay.querySelector("#rewind").onclick = () => video.currentTime -= 5;
        overlay.querySelector("#forward").onclick = () => video.currentTime += 5;

        // Restore video on close
        pipWindow.addEventListener("pagehide", () => {
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
    let video;
    if (index !== null) {
        const videos = document.querySelectorAll("video");
        video = videos[index];
    } else {
        video = document.querySelector("video.html5-main-video") || document.querySelector("video");
    }

    if (!video) {
        showToast("No video found 🚫");
        return;
    }

    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
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
        let width = "400px";
        let height = "225px";

        if (sizeMode === "small") { width = "300px"; height = "169px"; }
        else if (sizeMode === "large") { width = "500px"; height = "281px"; }

        // Apply floating styles
        Object.assign(video.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: width,
            height: height,
            zIndex: "2147483647",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            borderRadius: "12px",
            border: "2px solid rgba(255,255,255,0.1)",
            objectFit: "cover",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        });

        // Create Close Button (Adjust position based on size)
        if (!floatCloseBtn) {
            floatCloseBtn = document.createElement("button");
            floatCloseBtn.innerHTML = "×";
            Object.assign(floatCloseBtn.style, {
                position: "fixed",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.8)",
                color: "white",
                border: "none",
                width: "24px",
                height: "24px",
                cursor: "pointer",
                zIndex: "2147483648",
                fontSize: "16px",
                lineHeight: "1",
                display: "none"
            });
            floatCloseBtn.onclick = () => disableFloatingMode(video);
            document.body.appendChild(floatCloseBtn);
        }

        // Adjust button position dynamically
        floatCloseBtn.style.display = "block";
        floatCloseBtn.style.right = "25px";
        // Bottom = Video Bottom (20) + Video Height (height in px) - 12 (half button)
        const hVal = parseInt(height.replace("px", ""));
        floatCloseBtn.style.bottom = (20 + hVal - 12) + "px";
    });

    showToast("Floating Mode (Fallback) 🎈");
}

function disableFloatingMode(video) {
    if (video.dataset.isFloating !== "true") return;

    // Restore
    video.setAttribute("style", floatOriginalStyle);
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
        window.postMessage({ type: "UPDATE_SIZE", size: request.size }, "*");
    }
});

function updateFloatingSize(sizeMode) {
    // 1. Handle Floating Mode (Fallback)
    const activeVideo = document.querySelector("video[data-is-floating='true']");
    if (activeVideo) {
        let width = "400px";
        let height = "225px";

        if (sizeMode === "small") { width = "300px"; height = "169px"; }
        else if (sizeMode === "large") { width = "500px"; height = "281px"; }

        activeVideo.style.width = width;
        activeVideo.style.height = height;

        // Update close button position
        if (floatCloseBtn) {
            const hVal = parseInt(height.replace("px", ""));
            floatCloseBtn.style.bottom = (20 + hVal - 12) + "px";
        }
    }
}


