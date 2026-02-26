// ==========================================
// S.T.I.T.C.H POPUP v3.0.0 — Pro Edition
// ==========================================

// DOM References
const pipBtn = document.getElementById("pipBtn");
const videoListContainer = document.getElementById("videoListContainer");
const videoList = document.getElementById("videoList");
const statusMsg = document.getElementById("statusMsg");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const optionsBtn = document.getElementById("optionsBtn");
const sizeBtns = document.querySelectorAll(".segment-btn");
const autoPipToggle = document.getElementById("autoPipToggle");
const streamCountBadge = document.getElementById("streamCount");

// Inline controls
const inlinePlayPauseBtn = document.getElementById("inlinePlayPauseBtn");
const inlineRewindBtn = document.getElementById("inlineRewindBtn");
const inlineForwardBtn = document.getElementById("inlineForwardBtn");
const inlineMuteBtn = document.getElementById("inlineMuteBtn");
const inlineSpeedBtn = document.getElementById("inlineSpeedBtn");
const inlineLoopBtn = document.getElementById("inlineLoopBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");

// Preview & Progress
const videoPreviewCanvas = document.getElementById("videoPreviewCanvas");
const noSignalOverlay = document.getElementById("noSignalOverlay");
const previewStatusBadge = document.getElementById("previewStatusBadge");
const previewBadgeDot = document.getElementById("previewBadgeDot");
const previewBadgeText = document.getElementById("previewBadgeText");
const progressBarFill = document.getElementById("progressBarFill");
const progressBarTrack = document.getElementById("progressBarTrack");
const currentTimeDisplay = document.getElementById("currentTimeDisplay");
const durationDisplay = document.getElementById("durationDisplay");

// Early exit guard
if (!pipBtn) console.error("S.T.I.T.C.H: Critical popup elements missing");

// ==========================================
// STATE
// ==========================================
let primaryVideo = null;  // { id, frameId, playing, volume, muted, loop, currentTime, duration, speed }
let activeTabId = null;
let previewInterval = null;
let progressInterval = null;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeedIndex = 2; // default = 1x

// ==========================================
// SETTINGS
// ==========================================
function loadSettings() {
    chrome.storage.local.get(['theme', 'playerSize', 'autoPipEnabled'], (result) => {
        // Theme
        const theme = result.theme || 'dark';
        applyTheme(theme);

        // Size
        const size = result.playerSize || 'medium';
        sizeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === size);
        });

        // Auto-PiP
        if (autoPipToggle) autoPipToggle.checked = result.autoPipEnabled || false;
    });
}

function applyTheme(theme) {
    document.body.classList.remove('light-theme', 'theme-auto');
    if (theme === 'light') document.body.classList.add('light-theme');
    if (theme === 'auto') document.body.classList.add('theme-auto');
}

// Theme Cycle — Dark → Light → Auto → Dark
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-theme');
        const isAuto = document.body.classList.contains('theme-auto');
        let next;
        if (!isLight && !isAuto) next = 'light';
        else if (isLight) next = 'auto';
        else next = 'dark';
        applyTheme(next);
        chrome.storage.local.set({ theme: next });
    });
}

// Options Page Button
if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
}

// Size Listener
sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chrome.storage.local.set({ playerSize: btn.dataset.size });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_SIZE", size: btn.dataset.size }).catch(() => { });
            }
        });
    });
});

// Auto-PiP Toggle
if (autoPipToggle) {
    autoPipToggle.addEventListener('change', (e) => {
        chrome.storage.local.set({ autoPipEnabled: e.target.checked });
        showStatus(e.target.checked ? "SMART AUTO-PROTOCOL ENGAGED" : "AUTO-PROTOCOL OFF", false);
    });
}

// ==========================================
// STATUS
// ==========================================
function showStatus(msg, isError = true) {
    if (!statusMsg) return;
    statusMsg.textContent = `> ${msg}`;
    statusMsg.style.display = "block";
    statusMsg.style.color = isError ? "var(--danger)" : "var(--neon-cyan)";
    statusMsg.style.borderLeftColor = isError ? "var(--danger)" : "var(--neon-cyan)";
    clearTimeout(statusMsg._timer);
    statusMsg._timer = setTimeout(() => { statusMsg.style.display = "none"; }, 3000);
}

// ==========================================
// LIVE VIDEO PREVIEW CANVAS
// ==========================================
function startPreview(tabId, frameId) {
    stopPreview();
    const ctx = videoPreviewCanvas.getContext('2d');

    previewInterval = setInterval(() => {
        chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: () => {
                const video = document.querySelector('video[data-pip-primary="true"]') || document.querySelector('video');
                if (!video || video.readyState < 2) return null;
                const c = document.createElement('canvas');
                c.width = video.videoWidth || 640;
                c.height = video.videoHeight || 360;
                const cx = c.getContext('2d');
                cx.drawImage(video, 0, 0, c.width, c.height);
                return {
                    dataUrl: c.toDataURL('image/jpeg', 0.5),
                    paused: video.paused,
                    muted: video.muted,
                    volume: video.volume,
                    loop: video.loop,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    playbackRate: video.playbackRate
                };
            }
        }, (results) => {
            if (chrome.runtime.lastError || !results || !results[0]?.result) return;
            const res = results[0].result;

            // Draw frame to canvas
            const img = new Image();
            img.onload = () => {
                videoPreviewCanvas.width = img.width;
                videoPreviewCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                noSignalOverlay.style.display = 'none';
            };
            img.src = res.dataUrl;

            // Update status badge
            const isPlaying = !res.paused;
            previewStatusBadge.className = `preview-status-badge ${isPlaying ? 'is-playing' : ''}`;
            previewBadgeText.textContent = isPlaying ? 'LIVE' : 'PAUSED';

            // Sync play/pause icons
            document.getElementById('playIcon').style.display = isPlaying ? 'none' : 'block';
            document.getElementById('pauseIcon').style.display = isPlaying ? 'block' : 'none';

            // Sync mute icons
            document.getElementById('muteOffIcon').style.display = res.muted ? 'none' : 'block';
            document.getElementById('muteOnIcon').style.display = res.muted ? 'block' : 'none';

            // Sync volume slider
            volumeSlider.value = Math.round(res.volume * 100);
            volumeValue.textContent = `${Math.round(res.volume * 100)}%`;

            // Sync loop button
            inlineLoopBtn.style.color = res.loop ? 'var(--neon-cyan)' : '';
            inlineLoopBtn.title = `Loop: ${res.loop ? 'ON' : 'OFF'}`;

            // Sync speed
            const speedVal = res.playbackRate || 1;
            inlineSpeedBtn.textContent = `${speedVal}x`;
            currentSpeedIndex = SPEEDS.indexOf(speedVal);
            if (currentSpeedIndex === -1) currentSpeedIndex = 2;

            // Progress bar
            updateProgress(res.currentTime, res.duration);
        });
    }, 500);
}

function stopPreview() {
    if (previewInterval) clearInterval(previewInterval);
    previewInterval = null;
}

function updateProgress(current, duration) {
    const cur = isFinite(current) ? current : 0;
    const dur = isFinite(duration) && duration > 0 ? duration : 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;

    progressBarFill.style.width = `${pct}%`;
    currentTimeDisplay.textContent = formatTime(cur);
    durationDisplay.textContent = dur > 0 ? formatTime(dur) : '--:--';
}

function formatTime(secs) {
    const s = Math.floor(secs) || 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
}

// Seek via progress bar click
progressBarTrack.addEventListener('click', (e) => {
    if (!primaryVideo || !activeTabId) return;
    const rect = progressBarTrack.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    sendVideoCommand('seek', { pct });
});

// ==========================================
// NEURO-LINK VISUALIZER
// ==========================================
function initNeuroLink() {
    const canvas = document.getElementById('neuroLinkCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, animId;
    const particles = [];
    const count = 15;
    const dist = 55;

    function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }

    class P {
        constructor() {
            this.x = Math.random() * w; this.y = Math.random() * h;
            this.vx = (Math.random() - 0.5) * 1.2; this.vy = (Math.random() - 0.5) * 1.2;
            this.size = Math.random() * 1.5 + 0.5; this.life = Math.random();
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > w) this.vx *= -1;
            if (this.y < 0 || this.y > h) this.vy *= -1;
            this.life += 0.008;
        }
        draw() {
            const o = (Math.sin(this.life * 4) + 1) / 2 * 0.4 + 0.1;
            ctx.fillStyle = `rgba(0, 243, 255, ${o})`;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        }
    }

    for (let i = 0; i < count; i++) { resize(); particles.push(new P()); }

    function animate() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => { p.update(); p.draw(); });
        ctx.strokeStyle = 'rgba(188, 19, 254, 0.12)'; ctx.lineWidth = 0.5; ctx.beginPath();
        for (let i = 0; i < particles.length; i++)
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
                if (Math.sqrt(dx * dx + dy * dy) < dist) { ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); }
            }
        ctx.stroke();
        // Waveform
        const t = Date.now() * 0.002;
        ctx.beginPath(); ctx.moveTo(0, h / 2);
        for (let x = 0; x < w; x += 4) {
            ctx.lineTo(x, h / 2 + Math.sin(x * 0.06 + t) * 7 * Math.sin(t * 0.4) + Math.sin(x * 0.02 - t * 1.1) * 3);
        }
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
        animId = requestAnimationFrame(animate);
    }
    resize(); window.addEventListener('resize', resize); animate();
}

// ==========================================
// INLINE CONTROLS — Send Commands to Tab
// ==========================================
function sendVideoCommand(cmd, data = {}) {
    if (!activeTabId || !primaryVideo) return;
    chrome.tabs.sendMessage(activeTabId, {
        type: "VIDEO_COMMAND",
        command: cmd,
        frameId: primaryVideo.frameId,
        ...data
    }, { frameId: primaryVideo.frameId }).catch(() => { });
}

if (inlinePlayPauseBtn) {
    inlinePlayPauseBtn.addEventListener('click', () => sendVideoCommand('togglePlayPause'));
}
if (inlineRewindBtn) {
    inlineRewindBtn.addEventListener('click', () => sendVideoCommand('seek_relative', { delta: -10 }));
}
if (inlineForwardBtn) {
    inlineForwardBtn.addEventListener('click', () => sendVideoCommand('seek_relative', { delta: 10 }));
}
if (inlineMuteBtn) {
    inlineMuteBtn.addEventListener('click', () => sendVideoCommand('toggleMute'));
}
if (inlineSpeedBtn) {
    inlineSpeedBtn.addEventListener('click', () => {
        currentSpeedIndex = (currentSpeedIndex + 1) % SPEEDS.length;
        const newSpeed = SPEEDS[currentSpeedIndex];
        inlineSpeedBtn.textContent = `${newSpeed}x`;
        sendVideoCommand('set_speed', { speed: newSpeed });
    });
}
if (inlineLoopBtn) {
    inlineLoopBtn.addEventListener('click', () => sendVideoCommand('toggleLoop'));
}
if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
        const val = parseInt(volumeSlider.value) / 100;
        volumeValue.textContent = `${volumeSlider.value}%`;
        sendVideoCommand('set_volume', { volume: val });
    });
}

// ==========================================
// PIP LOGIC
// ==========================================
function showStatus2(msg, isError = true) { showStatus(msg, isError); }

function sendToggleMessage(tabId, index = null, frameId = 0) {
    const opts = frameId !== null ? { frameId } : {};
    chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PIP", targetIndex: index }, opts).catch(err => {
        showStatus("CONNECTION FAILED w/ FRAME " + frameId, true);
        console.warn(err);
    });
}

async function init() {
    loadSettings();
    initNeuroLink();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    activeTabId = tab.id;

    // Scan for videos across all frames
    chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
            const videos = Array.from(document.querySelectorAll("video"));
            const iframes = document.querySelectorAll("iframe").length;
            const isIframe = window !== window.top;
            return {
                videos: videos.map((v, i) => ({
                    id: i,
                    currentSrc: v.currentSrc || (v.src || (isIframe ? "Embedded Stream" : `Stream ${i + 1}`)),
                    playing: !v.paused,
                    volume: v.volume,
                    muted: v.muted
                })),
                hasIframes: iframes > 0,
                isIframe,
                location: window.location.href
            };
        }
    }, (results) => {
        if (chrome.runtime.lastError || !results) return;

        let allVideos = [];
        let totalIframes = 0;

        results.forEach(fr => {
            if (!fr.result) return;
            const { videos, hasIframes, isIframe, location } = fr.result;
            allVideos = allVideos.concat(videos.map(v => ({ ...v, frameId: fr.frameId, frameLocation: location })));
            if (hasIframes) totalIframes++;
        });

        // Update stream count
        streamCountBadge.textContent = `${allVideos.length} STREAM${allVideos.length !== 1 ? 'S' : ''}`;

        if (allVideos.length === 0) {
            let msg = "NO SIGNAL DETECTED";
            if (totalIframes > 0) msg += " (FRAMES PRESENT)";
            showStatus(msg, true);
            pipBtn.disabled = true;
            pipBtn.style.opacity = "0.4";
            previewBadgeText.textContent = "NO SIGNAL";
            primaryVideo = null;
        } else {
            // Pick the best video: prefer playing ones
            primaryVideo = allVideos.find(v => v.playing) || allVideos[0];
            pipBtn.disabled = false;
            pipBtn.style.opacity = "1";

            // Start live preview for primary video
            startPreview(tab.id, primaryVideo.frameId);

            // Show stream list if multiple
            if (allVideos.length > 1) {
                videoListContainer.style.display = "block";
                videoList.innerHTML = "";
                allVideos.forEach(v => {
                    const btn = document.createElement("button");
                    btn.className = "stitch-btn-outline";
                    let title = v.currentSrc;
                    if (title.length > 36) title = title.substring(0, 36) + "…";
                    if (v.frameId !== 0) title = `[FRAME ${v.frameId}] ${title}`;
                    btn.textContent = title;
                    btn.onclick = () => {
                        primaryVideo = v;
                        sendToggleMessage(tab.id, v.id, v.frameId);
                        stopPreview();
                        startPreview(tab.id, v.frameId);
                    };
                    videoList.appendChild(btn);
                });
            }
        }
    });
}

pipBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (primaryVideo) {
        sendToggleMessage(tab.id, primaryVideo.id, primaryVideo.frameId);
    } else {
        sendToggleMessage(tab.id, null, 0);
    }
});

// Cleanup preview when popup closes
window.addEventListener('unload', stopPreview);

init();
