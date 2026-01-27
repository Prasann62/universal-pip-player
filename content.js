// Toast UI Helper
function showToast(message) {
    let toast = document.getElementById("pip-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "pip-toast";
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            z-index: 999999;
            font-family: sans-serif;
            font-size: 14px;
            pointer-events: none;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.style.opacity = "0";
    }, 2000);
}

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

    // PiP Event Hooks
    video.addEventListener("enterpictureinpicture", () => {
        showToast("PiP Mode Enabled 📺");
    });

    video.addEventListener("leavepictureinpicture", () => {
        showToast("PiP Mode Closed");
    });

    // Document PiP Support (Advanced)
    video.dataset.docPipSupported = 'documentPictureInPicture' in window;
}

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

        return true;
    } catch (e) {
        console.error("Document PiP failed:", e);
        return false;
    }
}


// Global Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
    // Only trigger if a video exists on the page
    const video = document.querySelector("video");
    if (!video) return;

    // Ignore if typing in an input/textarea
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
        return;
    }

    switch (e.key.toLowerCase()) {
        case "m":
            video.muted = !video.muted;
            showToast(video.muted ? "Muted 🔇" : "Unmuted 🔊");
            break;
        case " ":
            e.preventDefault(); // Prevent scroll
            if (video.paused) {
                video.play();
                showToast("Playing ▶️");
            } else {
                video.pause();
                showToast("Paused ⏸️");
            }
            break;
        case "arrowleft":
            video.currentTime = Math.max(0, video.currentTime - 5);
            showToast("Rewind 5s ⏪");
            break;
        case "arrowright":
            video.currentTime = Math.min(video.duration, video.currentTime + 5);
            showToast("Forward 5s ⏩");
            break;
    }
});

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
