// ==========================================
// UI INJECTION (Buttons, Tooltips)
// ==========================================

// 🚀 Robust YouTube Button Injection
function getStitchStyles() {
    return `
        :root {
            --void-bg: #050505;
            --glass-surface: rgba(20, 20, 20, 0.6);
            --glass-border: rgba(255, 255, 255, 0.08);
            --neon-cyan: #00f3ff;
            --neon-purple: #bc13fe;
            --text-primary: #ffffff;
            --text-muted: #888888;
            --danger: #ff2a6d;
            --success: #05ffa1;
            --glow-cyan: 0 0 10px rgba(0, 243, 255, 0.5);
            --glow-purple: 0 0 15px rgba(188, 19, 254, 0.4);
            --backdrop-blur: blur(12px);
        }
        .stitch-btn-icon {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.3s;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .stitch-btn-icon:hover {
            color: var(--neon-cyan);
            background: rgba(0, 243, 255, 0.1);
            box-shadow: var(--glow-cyan);
        }
    `;
}

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

    // Ensure styles are injected
    if (!document.getElementById("pip-yt-style")) {
        const style = document.createElement("style");
        style.id = "pip-yt-style";
        style.textContent = `
            .pip-yt-button {
                display: inline-block !important;
                position: relative !important;
                width: 48px !important;
                height: 100% !important;
                vertical-align: top !important;
                transition: background 0.2s, transform 0.2s !important;
                cursor: pointer !important;
                background: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                outline: none !important;
            }
            .pip-yt-button:hover {
                background: rgba(255, 255, 255, 0.1) !important;
                border-radius: 50% !important;
            }
            .pip-yt-button svg {
                width: 100% !important;
                height: 100% !important;
                pointer-events: none !important;
                transform: scale(0.65) !important; /* Scale path to fit YouTube button size */
            }
            .pip-yt-button:hover svg path {
                fill: #6366f1 !important; /* Stitch Indigo */
                filter: drop-shadow(0 0 5px rgba(99, 102, 241, 0.5));
            }
            .pip-yt-button:hover::after {
                content: '';
                position: absolute;
                top: 10px; left: 10px; right: 10px; bottom: 10px;
                border: 1px dashed rgba(255, 255, 255, 0.4);
                border-radius: 4px;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

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
    const settingsBtn = controls.querySelector(".ytp-settings-button");
    if (settingsBtn) {
        settingsBtn.insertAdjacentElement('beforebegin', button);
    } else {
        controls.prepend(button);
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
    help.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(10, 10, 12, 0.95);
        color: #f8fafc;
        padding: 20px;
        border-radius: 16px;
        z-index: 2147483647;
        font-family: 'Outfit', sans-serif;
        font-size: 13px;
        line-height: 1.6;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(12px);
        max-width: 400px;
    `;

    // Stitch effect for help
    const stitchHelp = document.createElement("div");
    stitchHelp.style.cssText = `
        position: absolute;
        top: 6px; left: 6px; right: 6px; bottom: 6px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        pointer-events: none;
    `;
    help.appendChild(stitchHelp);

    help.innerHTML += `
        <div style="font-weight: 700; font-size: 16px; color: #c5a059; margin-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <span>⌨️</span> Keyboard Shortcuts
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px;">
            <span>Toggle PiP</span> <span style="color: #6366f1; font-weight: 500;">Alt + P</span>
            <span>Close PiP</span> <span style="color: #6366f1; font-weight: 500;">Alt + X</span>
            <span>Play/Pause</span> <span style="color: #6366f1; font-weight: 500;">Space</span>
            <span>Mute/Unmute</span> <span style="color: #6366f1; font-weight: 500;">M</span>
            <span>Seek 5s</span> <span style="color: #6366f1; font-weight: 500;">← / →</span>
            <span>Volume ±</span> <span style="color: #10b981; font-weight: 500;">Alt + ↑/↓</span>
            <span>Speed ±</span> <span style="color: #10b981; font-weight: 500;">Shift + &lt;/&gt;</span>
            <span>Resize PiP</span> <span style="color: #6366f1; font-weight: 500;">Alt + ±</span>
            <span>Move PiP</span> <span style="color: #6366f1; font-weight: 500;">Alt + Arrows</span>
            <span>Help</span> <span style="color: #6366f1; font-weight: 500;">H</span>
        </div>
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1);">
            <div style="font-weight: 600; color: #c5a059; margin-bottom: 8px; font-size: 12px;">✨ New Features</div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                • Volume control with Alt+↑/↓<br>
                • Playback speed with Shift+&lt;/&gt;<br>
                • Optimized performance<br>
                • Enhanced video detection
            </div>
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">Press 'H' to dismiss</div>
    `;
    document.body.appendChild(help);
}
