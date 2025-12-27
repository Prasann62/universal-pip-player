/**
 * content.js
 * Video Detection, Subtitle Injection, and Overlay Renderer
 */

class SubtitleInjector {
    constructor() {
        this.video = null;
        this.overlay = null;
        this.cues = [];
        this.isListening = false;
        this.syncOffset = 0; // Manual sync adjustment

        // Bind logic
        this.onTimeUpdate = this.onTimeUpdateLogic.bind(this);
    }

    findVideo() {
        // Try to find video in main document, shadow DOMs, or accessible iframes
        this.video = this.searchForVideo(document);
        if (this.video) {
            // Attempt to enable CORS access for captureStream (works on some hosts, fails on DRM)
            try {
                if (!this.video.crossOrigin) this.video.crossOrigin = "anonymous";
            } catch (e) {
                console.log("Cannot set crossOrigin on video");
            }
            if (!this.overlay) this.createOverlay();
        }
        return this.video;
    }

    searchForVideo(root) {
        let video = root.querySelector('video');
        if (video) return video;

        // Search Shadow DOMs
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                video = this.searchForVideo(el.shadowRoot);
                if (video) return video;
            }
        }

        // Search Frames (limited by Same-Origin Policy)
        const iframes = root.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument) {
                    video = this.searchForVideo(iframe.contentDocument);
                    if (video) return video;
                }
            } catch (e) {
                // Security restrictions prevent accessing some iframes
            }
        }
        return null;
    }

    createOverlay() {
        if (document.getElementById('ai-subtitle-overlay')) return;

        this.overlay = document.createElement('div');
        this.overlay.id = 'ai-subtitle-overlay';
        // Base styles moved to CSS, but specific positioning logic stays here

        const textSpan = document.createElement('span');
        textSpan.id = 'ai-subtitle-text';
        this.overlay.appendChild(textSpan);
        document.body.appendChild(this.overlay);

        // Keep overlay on top and positioned
        setInterval(() => this.repositionOverlay(), 500);
    }

    repositionOverlay() {
        if (!this.video) this.findVideo();
        if (!this.video) return;

        const overlayEl = document.getElementById('ai-subtitle-overlay');
        if (!overlayEl) return;

        const rect = this.video.getBoundingClientRect();

        // If video is hidden or 0x0, hide overlay
        if (rect.width === 0 || rect.height === 0) {
            overlayEl.style.display = 'none';
            return;
        }

        overlayEl.style.display = 'flex'; // Reset display

        // Position relative to the viewport
        // bottom 10% of the video player area
        const bottomOffset = window.innerHeight - rect.bottom + (rect.height * 0.1);

        overlayEl.style.bottom = `${Math.max(20, bottomOffset)}px`;
        overlayEl.style.left = `${rect.left + (rect.width / 2)}px`;
        overlayEl.style.transform = 'translateX(-50%)';
        overlayEl.style.width = `${rect.width * 0.8}px`;
    }

    showTempMessage(text, isPersistent = false) {
        const textEl = document.getElementById('ai-subtitle-text');
        if (textEl) {
            // Clear previous content
            textEl.innerHTML = '';

            if (isPersistent && text.includes('AI Mode')) {
                const indicator = document.createElement('span');
                indicator.className = 'status-indicator';
                textEl.appendChild(indicator);
            }

            const messageText = document.createTextNode(text);
            textEl.appendChild(messageText);

            textEl.style.display = 'inline-block';
            textEl.style.opacity = '1';

            if (!isPersistent) {
                // Auto hide message after 5 seconds if not a subtitle
                setTimeout(() => {
                    if (textEl.innerText === text) {
                        textEl.style.opacity = '0';
                        setTimeout(() => {
                            if (textEl.style.opacity === '0') textEl.style.display = 'none';
                        }, 300);
                    }
                }, 5000);
            }
        }
    }

    onTimeUpdateLogic() {
        if (!this.video) return;
        const time = this.video.currentTime;
        // Find cue that fits current time
        const currentCue = this.cues.find(c => time >= c.start && time <= c.end);

        const textEl = document.getElementById('ai-subtitle-text');
        if (!textEl) return;

        if (currentCue) {
            textEl.innerText = currentCue.text;
            textEl.style.display = 'inline-block';
        } else {
            // Only hide if we aren't showing a status message
            textEl.style.display = 'none';
        }
    }

    injectSubtitle(content, offset = 0) {
        if (!this.video) this.findVideo();
        if (!this.video) return;

        console.log(`[Subtitle] Injecting ${content.length} chars at offset ${offset}`);
        const newCues = this.parseSubtitles(content, offset);

        if (offset > 0) {
            // Append new cues to existing ones, remove overlaps
            this.cues = [...this.cues.filter(c => c.end < offset), ...newCues];
        } else {
            this.cues = newCues;
        }

        const textEl = document.getElementById('ai-subtitle-text');
        if (textEl) textEl.style.opacity = '1';

        this.video.removeEventListener('timeupdate', this.onTimeUpdate);
        this.video.addEventListener('timeupdate', this.onTimeUpdate);
    }

    parseSubtitles(content, offset = 0) {
        // Simple VTT/SRT Parser
        const cues = [];
        // Normalize newlines
        const cleanContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const blocks = cleanContent.split(/\n\n+/);

        const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}) --> ((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/;

        for (const block of blocks) {
            const lines = block.split('\n');
            let timeMatch = null;
            let textLines = [];

            for (const line of lines) {
                // Skip WEBVTT header or index numbers
                if (line.includes('WEBVTT') || line.match(/^\d+$/)) continue;

                const match = line.match(timeRegex);
                if (match) {
                    timeMatch = match;
                } else if (line.trim()) {
                    textLines.push(line.trim());
                }
            }

            if (timeMatch && textLines.length > 0) {
                cues.push({
                    start: this.parseTime(timeMatch[1]) + offset + this.syncOffset,
                    end: this.parseTime(timeMatch[2]) + offset + this.syncOffset,
                    text: textLines.join('\n')
                });
            }
        }
        return cues;
    }

    parseTime(timeStr) {
        // Handles MM:SS.mmm or HH:MM:SS.mmm
        const parts = timeStr.replace(',', '.').split(':').reverse();
        let seconds = parseFloat(parts[0]) || 0;
        let minutes = parseInt(parts[1]) || 0;
        let hours = parseInt(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }

    getVideoMetadata() {
        const video = this.findVideo();
        if (!video) return null;
        return {
            title: this.cleanTitle(document.title),
            url: window.location.href,
            duration: video.duration,
            currentTime: video.currentTime
        };
    }

    cleanTitle(title) {
        // Prioritize JAV ID format: ABC-123
        const javRegex = /([a-zA-Z]{2,6}-?\d{3,4})/;
        const match = title.match(javRegex);
        if (match) return match[1].toUpperCase();

        // Fallback cleanup
        return title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
    }

    // --- AI AUDIO CAPTURE REMOVED (Moved to Offscreen) ---

    setSync(seconds) {
        this.syncOffset += seconds;
        console.log(`[Subtitle] Sync Adjusted: ${this.syncOffset}s`);
        this.showTempMessage(`Sync: ${this.syncOffset > 0 ? '+' : ''}${this.syncOffset}s`);
    }

    stopCapture() {
        this.isListening = false;
        const textEl = document.getElementById('ai-subtitle-text');
        if (textEl) textEl.style.display = 'none';
        console.log('[AI] Display stopped.');
    }
}

// Singleton
const injector = new SubtitleInjector();
window._aiSubtitleInjector = injector; // Expose for popup probing

// Auto-check for video on load and mutations to support iframes detection
function aggressiveVideoCheck() {
    const v = injector.findVideo();
    if (v) console.log('[Content] Video found in frame:', window.location.href);
}

// Check on load
aggressiveVideoCheck();

// Check on DOM mutations (for dynamic frameworks)
const observer = new MutationObserver((mutations) => {
    if (!injector.video) aggressiveVideoCheck();
});
observer.observe(document.body, { childList: true, subtree: true });


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'GET_VIDEO_METADATA') {
            // If we don't have a video, return null so popup ignores this frame
            if (!injector.findVideo()) {
                sendResponse(null);
                return;
            }
            sendResponse(injector.getVideoMetadata());
        } else if (message.action === 'INJECT_SUBTITLE') {
            injector.injectSubtitle(message.content);
            sendResponse({ success: true });
        } else if (message.action === 'START_RECORDING' || message.action === 'AI_MODE_STARTED') {
            if (injector.video) {
                injector.isListening = true;
                injector.showTempMessage('🎙️ AI Mode: Listening...', true);
            }
            sendResponse({ success: true });
        } else if (message.action === 'STOP_RECORDING') {
            injector.stopCapture();
            sendResponse({ success: true });
        } else if (message.action === 'UPDATE_AI_SUBTITLES') {
            if (injector.video) {
                injector.injectSubtitle(message.content, message.offset);
            }
            sendResponse({ success: true });
        }
    } catch (e) {
        console.error("Content Script Error:", e);
        sendResponse({ success: false, error: e.message });
    }
    // Return true only if async response is needed (not needed here mostly)
});
