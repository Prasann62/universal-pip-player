const pipBtn = document.getElementById("pipBtn");
const videoListContainer = document.getElementById("videoListContainer");
const videoList = document.getElementById("videoList");
const statusMsg = document.getElementById("statusMsg");
const themeToggle = document.getElementById("themeToggle");
const sizeChips = document.querySelectorAll(".stitch-chip");

// ==========================================
// SETTINGS
// ==========================================
function loadSettings() {
    chrome.storage.local.get(['theme', 'playerSize'], (result) => {
        // Theme
        if (result.theme === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('light-theme');
            themeToggle.checked = false;
        }

        // Size
        const size = result.playerSize || 'medium';
        sizeChips.forEach(chip => {
            if (chip.dataset.size === size) chip.classList.add('active');
            else chip.classList.remove('active');
        });
    });
}

// Theme Listener
themeToggle.addEventListener('change', (e) => {
    const isLight = e.target.checked;
    if (isLight) document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');

    chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
});

// Size Listener
sizeChips.forEach(chip => {
    chip.addEventListener('click', () => {
        sizeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        chrome.storage.local.set({ playerSize: chip.dataset.size });

        // Send message to update live player
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "UPDATE_SIZE",
                    size: chip.dataset.size
                }).catch(() => {
                    // Ignore errors if content script isn't ready
                });
            }
        });
    });
});


// ==========================================
// PIP LOGIC
// ==========================================
function showStatus(msg, isError = true) {
    statusMsg.textContent = msg;
    statusMsg.style.display = "block";
    statusMsg.style.background = isError ? "rgba(239, 68, 68, 0.1)" : "rgba(99, 102, 241, 0.1)";
    statusMsg.style.color = isError ? "#f87171" : "#6366f1";
    statusMsg.style.borderColor = isError ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.2)";
}

async function init() {
    loadSettings();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Detect videos via script injection just to get list
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const videos = Array.from(document.querySelectorAll("video"));
            const iframes = document.querySelectorAll("iframe").length;
            const canvas = document.querySelectorAll("canvas").length;

            return {
                videos: videos.map((v, i) => ({
                    id: i,
                    currentSrc: v.currentSrc || "Unnamed Video",
                    playing: !v.paused
                })),
                hasIframes: iframes > 0,
                hasCanvas: canvas > 0
            };
        }
    }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0].result) return;
        const { videos, hasIframes, hasCanvas } = results[0].result;

        if (videos.length === 0) {
            let msg = "No HTML5 video detected.";
            if (hasIframes) msg += " (Inside iframe)";
            else if (hasCanvas) msg += " (Canvas based)";
            showStatus(msg);
            pipBtn.style.opacity = "0.5";
            pipBtn.disabled = true;
        } else if (videos.length > 1) {
            videoListContainer.style.display = "block";
            videoList.innerHTML = "";
            videos.forEach(v => {
                const btn = document.createElement("button");
                btn.className = "stitch-btn stitch-btn-outline";
                btn.style.cssText = "width:100%; padding:8px; font-size:11px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-style: dashed;";
                btn.textContent = `Video ${v.id + 1}: ${v.currentSrc.split('/').pop() || 'Blob/Stream'}`;
                btn.onclick = () => sendToggleMessage(tab.id, v.id);
                videoList.appendChild(btn);
            });
        }
    });
}

function sendToggleMessage(tabId, index = null) {
    chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PIP", targetIndex: index }).catch(err => {
        showStatus("Could not communicate with page. Refresh?", true);
    });
}

pipBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    sendToggleMessage(tab.id, null); // Null means auto-select
});

init();

