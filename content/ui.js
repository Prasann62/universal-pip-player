// ==========================================
// UI INJECTION (Buttons, Tooltips)
// ==========================================

// 🚀 Robust YouTube Button Injection
// Styles are now loaded from content/styles.css

function handleYouTubeInjection() {
    if (!location.href.includes("youtube.com")) return;

    // Find all potential control bars (YouTube sometimes has multiple or swaps them)
    const controlBars = document.querySelectorAll(".ytp-right-controls");
    const video = document.querySelector("video");

    if (video && controlBars.length > 0) {
        controlBars.forEach(bar => {
            if (!bar.querySelector(".pip-yt-button")) {
                injectYouTubeButton(video, bar);
            }
        });
    }
}

function injectYouTubeButton(video, controls) {
    if (!controls) return;

    const button = document.createElement("button");
    button.className = "ytp-button pip-yt-button";
    button.setAttribute("aria-label", "Picture-in-Picture");
    button.title = "Picture-in-Picture (Alt+P)";

    // Styles are loaded via content/styles.css

    button.innerHTML = `
        <img src="${chrome.runtime.getURL("pip.webp")}" style="width: 100%; height: 100%; object-fit: contain; padding: 8px;">
    `;

    button.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (typeof togglePiP === 'function') {
            togglePiP();
        } else {
            // Fallback
            const activeVideo = document.querySelector("video.html5-main-video") || document.querySelector("video");
            if (activeVideo && typeof activeVideo.requestPictureInPicture === 'function') {
                activeVideo.requestPictureInPicture().catch(e => {
                    console.warn("PiP failed:", e);
                });
            }
        }
    };

    // Insert safely next to the settings button
    // Insert safely next to the settings button
    const settingsBtn = controls.querySelector(".ytp-settings-button");
    if (settingsBtn) {
        settingsBtn.insertAdjacentElement('beforebegin', button);
    } else {
        controls.prepend(button);
    }
}

// 🚀 JioCinema Button Injection
function handleJioCinemaInjection() {
    if (!location.href.includes("jiocinema.com")) return;

    // Use the deep search to find the video first
    const video = typeof findPrimaryVideo === 'function' ? findPrimaryVideo() : document.querySelector("video");
    if (!video) return;

    // JioCinema controls often don't have stable classes. 
    // We look for the parent container of the video, then find the controls layer.
    // Usually controls are siblings or overlay children.

    // Strategy: Look for a container that likely holds buttons (svgs/images) near the bottom
    // This is heuristics-based since classes change.

    const root = video.getRootNode(); // Could be ShadowRoot

    // Attempt 1: Look for common control wrappers in Shadow DOM or near video
    // This selector targets typical player control bars (often flex/grid with buttons)
    let controls = null;

    if (root instanceof ShadowRoot || root === document) {
        // Try to find a bottom bar. Typically has "controls" or "bottom" in class, 
        // or contains the volume/fullscreen buttons.
        const candidates = Array.from(root.querySelectorAll('div'));

        // Find a container that is positioned absolute/fixed at bottom and has buttons
        controls = candidates.find(el => {
            const style = window.getComputedStyle(el);
            const isBottom = style.bottom === '0px' || (parseInt(style.bottom) < 50 && style.position === 'absolute');
            const hasButtons = el.querySelectorAll('button, [role="button"]').length > 3;
            return isBottom && hasButtons && el.clientHeight < 100;
        });
    }

    if (controls && !controls.querySelector(".pip-jio-button")) {
        injectJioCinemaButton(video, controls);
    }
}

function injectJioCinemaButton(video, controls) {
    const button = document.createElement("button");
    button.className = "pip-jio-button";
    button.title = "Picture-in-Picture (Alt+P)";
    button.style.cssText = `
        background: transparent;
        border: none;
        cursor: pointer;
        width: 40px; 
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
    `;

    button.innerHTML = `
        <img src="${chrome.runtime.getURL("pip.webp")}" style="width: 24px; height: 24px; object-fit: contain; filter: invert(1);">
    `;

    button.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof togglePiP === 'function') {
            togglePiP();
        }
    };

    // Try to insert before the fullscreen button (usually the last button)
    // We guess the fullscreen button is the last one or close to right
    const buttons = controls.querySelectorAll('button, [role="button"]');
    if (buttons.length > 0) {
        // Insert before the last button (usually fullscreen)
        const lastBtn = buttons[buttons.length - 1];
        lastBtn.insertAdjacentElement('beforebegin', button);
    } else {
        controls.appendChild(button);
    }
}

// Help Tooltip UI
function toggleHelpTooltip() {
    let help = document.getElementById("pip-help-tooltip");
    if (help) {
        help.remove();
        return;
    }

    help = document.createElement("div");
    help.id = "pip-help-tooltip";

    // Stitch effect for help
    const stitchHelp = document.createElement("div");
    stitchHelp.className = "stitch-help-border";
    help.appendChild(stitchHelp);

    help.innerHTML += `
        <div class="help-header">
            <span>⌨️</span> Keyboard Shortcuts
        </div>
        <div class="help-grid">
            <span>Toggle PiP</span> <span class="help-key">Alt + P</span>
            <span>Close PiP</span> <span class="help-key">Alt + X</span>
            <span>Play/Pause</span> <span class="help-key">Space</span>
            <span>Mute/Unmute</span> <span class="help-key">M</span>
            <span>Seek 5s</span> <span class="help-key">← / →</span>
            <span>Volume ±</span> <span class="help-key-alt">Alt + ↑/↓</span>
            <span>Speed ±</span> <span class="help-key-alt">Shift + &lt;/&gt;</span>
            <span>Resize PiP</span> <span class="help-key">Alt + ±</span>
            <span>Move PiP</span> <span class="help-key">Alt + Arrows</span>
            <span>Help</span> <span class="help-key">H</span>
        </div>
        <div class="help-footer">
            <div class="help-section-title">✨ New Features</div>
            <div class="help-list">
                • Volume control with Alt+↑/↓<br>
                • Playback speed with Shift+&lt;/&gt;<br>
                • Optimized performance<br>
                • Enhanced video detection
            </div>
        </div>
        <div class="help-dismiss">Press 'H' to dismiss</div>
    `;
    document.body.appendChild(help);
}
