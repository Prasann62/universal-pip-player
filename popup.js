// DOM element references with null checking
const pipBtn = document.getElementById("pipBtn");
const videoListContainer = document.getElementById("videoListContainer");
const videoList = document.getElementById("videoList");
const statusMsg = document.getElementById("statusMsg");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const sizeBtns = document.querySelectorAll(".segment-btn");

// Early exit if critical elements missing
if (!pipBtn) {
    console.error("PiP Extension: Critical popup elements missing");
}

// ==========================================
// SETTINGS
// ==========================================
function loadSettings() {
    chrome.storage.local.get(['theme', 'playerSize', 'autoPipEnabled'], (result) => {
        // Theme
        if (result.theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Size
        const size = result.playerSize || 'medium';
        sizeBtns.forEach(btn => {
            if (btn.dataset.size === size) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Auto-PiP
        const autoPipToggle = document.getElementById('autoPipToggle');
        if (autoPipToggle) {
            autoPipToggle.checked = result.autoPipEnabled || false;
        }
    });
}

// Theme Listener (Button Click)
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    });
}

// Size Listener
sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chrome.storage.local.set({ playerSize: btn.dataset.size });

        // Send message to update live player
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "UPDATE_SIZE",
                    size: btn.dataset.size
                }).catch(() => {
                    // Ignore errors if content script isn't ready
                });
            }
        });
    });
});

// Auto-PiP Toggle
const autoPipToggle = document.getElementById('autoPipToggle');
if (autoPipToggle) {
    autoPipToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ autoPipEnabled: isEnabled });

        // Show feedback
        showStatus(isEnabled
            ? "AUTO-PROTOCOL ENGAGED"
            : "AUTO-PROTOCOL DISENGAGED", false);
    });
}


// ==========================================
// PIP LOGIC
// ==========================================
function showStatus(msg, isError = true) {
    if (!statusMsg) return;
    statusMsg.textContent = `> ${msg}`;
    statusMsg.style.display = "block";
    statusMsg.style.color = isError ? "var(--danger)" : "var(--neon-cyan)";
    statusMsg.style.borderLeftColor = isError ? "var(--danger)" : "var(--neon-cyan)";

    // Auto hide after 3 seconds
    setTimeout(() => {
        statusMsg.style.display = "none";
    }, 3000);
}

// ==========================================
// NEURO-LINK VISUALIZER
// ==========================================
function initNeuroLink() {
    const canvas = document.getElementById('neuroLinkCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let animationId;

    // Config
    const particles = [];
    const particleCount = 20;
    const connectionDistance = 60;

    function resize() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = (Math.random() - 0.5) * 1.5;
            this.size = Math.random() * 2 + 1;
            this.life = Math.random();
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off edges
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            // Randomly pulse opacity
            this.life += 0.01;
        }

        draw() {
            const opacity = (Math.sin(this.life * 5) + 1) / 2 * 0.5 + 0.2;
            ctx.fillStyle = `rgba(0, 243, 255, ${opacity})`; // Neon Cyan
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Update and draw particles
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        // Draw connections
        ctx.strokeStyle = 'rgba(188, 19, 254, 0.15)'; // Neon Purple
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < connectionDistance) {
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                }
            }
        }
        ctx.stroke();

        // Draw simulated waveform
        drawWaveform();

        animationId = requestAnimationFrame(animate);
    }

    function drawWaveform() {
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        const time = Date.now() * 0.002;
        for (let x = 0; x < width; x += 5) {
            // Combine played frequencies
            const y = height / 2 +
                Math.sin(x * 0.05 + time) * 10 * Math.sin(time * 0.5) +
                Math.sin(x * 0.02 - time * 1.2) * 5;

            ctx.lineTo(x, y);
        }

        ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Start
    resize();
    window.addEventListener('resize', resize);
    initParticles();
    animate();
}

async function init() {
    loadSettings();
    initNeuroLink();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Detect videos via script injection just to get list
    // Detect videos via script injection just to get list
    chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
            const videos = Array.from(document.querySelectorAll("video"));
            const iframes = document.querySelectorAll("iframe").length;
            const canvas = document.querySelectorAll("canvas").length;
            const isIframe = window !== window.top;

            return {
                videos: videos.map((v, i) => ({
                    id: i,
                    currentSrc: v.currentSrc || (v.src ? v.src : (isIframe ? "Embedded Stream" : "Stream " + (i + 1))),
                    playing: !v.paused
                })),
                hasIframes: iframes > 0,
                hasCanvas: canvas > 0,
                isIframe: isIframe,
                location: window.location.href
            };
        }
    }, (results) => {
        if (chrome.runtime.lastError || !results) return;

        let allVideos = [];
        let totalIframes = 0;
        let totalCanvas = 0;

        results.forEach(frameResult => {
            if (!frameResult.result) return;
            const { videos, hasIframes, hasCanvas, isIframe, location } = frameResult.result;

            // Add frameId to each video for targeting
            const videosWithFrameId = videos.map(v => ({ ...v, frameId: frameResult.frameId, frameLocation: location }));
            allVideos = allVideos.concat(videosWithFrameId);

            if (hasIframes) totalIframes++;
            if (hasCanvas) totalCanvas++;
        });

        if (allVideos.length === 0) {
            let msg = "NO SIGNAL DETECTED";
            if (totalIframes > 0) msg += " (CHECKING FRAMES...)";
            else if (totalCanvas > 0) msg += " (CANVAS RENDER)";
            showStatus(msg, true);
            pipBtn.style.opacity = "0.5";
            pipBtn.disabled = true;
        } else {
            // Enable button if disabled
            pipBtn.style.opacity = "1";
            pipBtn.disabled = false;

            if (allVideos.length > 1) {
                videoListContainer.style.display = "block";
                videoList.innerHTML = "";
                allVideos.forEach(v => {
                    const btn = document.createElement("button");
                    btn.className = "stitch-btn-outline";
                    // Clean up title
                    let title = v.currentSrc;
                    if (title.length > 30) title = title.substring(0, 30) + "...";
                    if (v.frameId !== 0) title = `[FRAME ${v.frameId}] ${title}`;

                    btn.textContent = title;
                    btn.onclick = () => sendToggleMessage(tab.id, v.id, v.frameId);
                    videoList.appendChild(btn);
                });
            }
        }
    });
}

function sendToggleMessage(tabId, index = null, frameId = 0) {
    const options = frameId !== null ? { frameId: frameId } : {};
    chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PIP", targetIndex: index }, options).catch(err => {
        showStatus("CONNECTION FAILED w/ FRAME " + frameId, true);
        console.warn(err);
    });
}

pipBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Default to top frame (0) if general click, or we could try to find the "best" video from the list we just got.
    // For now, let's just send to top frame as per original behavior if no specific video selected, 
    // BUT since we now support iframes, maybe we should find the playing one?
    // Let's stick to simple: Main button acts on Main Frame (or we could broadcast).
    // Better strategy for "Pro": Broadcast to all frames? Or just top. 
    // Original behavior: sendToggleMessage(tab.id, null). 
    // Let's try sending to frame 0 by default.
    sendToggleMessage(tab.id, null, 0);
});

init();
