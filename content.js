/**
 * content.js
 * Video Detection, Subtitle Injection, and Overlay Renderer
 */

class SubtitleInjector {
    constructor() {
        this.video = null;
        this.overlay = null;
        this.cues = [];
        this.mediaRecorder = null;
        this.captureInterval = null;
        this.chunkStartTime = 0;
        this.isListening = false;

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

    showTempMessage(text) {
        const textEl = document.getElementById('ai-subtitle-text');
        if (textEl) {
            textEl.innerText = text;
            textEl.style.display = 'inline-block';
            textEl.style.opacity = '0.9';
            // Auto hide message after 5 seconds if not a subtitle
            setTimeout(() => {
                if (textEl.innerText === text) textEl.style.display = 'none';
            }, 5000);
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
                    start: this.parseTime(timeMatch[1]) + offset,
                    end: this.parseTime(timeMatch[2]) + offset,
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
            duration: video.duration
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

    // --- AI AUDIO CAPTURE ---

    async startCapture(openaiKey) {
        if (!this.video) this.findVideo();

        if (!this.video) {
            alert('No video found to record.');
            return;
        }

        // Feature detection
        if (typeof this.video.captureStream !== 'function') {
            alert('This browser does not support video.captureStream().');
            return;
        }

        this.isListening = true;
        this.showTempMessage('🎙️ AI Mode: Listening...');

        console.log('[AI] Starting audio capture...');
        try {
            // Attempt to capture stream
            // NOTE: This will fail on DRM content (Netflix, etc) or strict CORS
            const stream = this.video.captureStream();
            const audioTrack = stream.getAudioTracks()[0];

            if (!audioTrack) {
                this.showTempMessage('❌ Error: No audio track found. Is the video muted?');
                return;
            }

            // Determine supported mime type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.chunkStartTime = this.video.currentTime;

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0 && this.isListening) {
                    this.processChunk(e.data, this.chunkStartTime);
                }
            };

            this.mediaRecorder.start();

            // Restart recorder every 25 seconds to create chunks
            this.captureInterval = setInterval(() => {
                if (this.mediaRecorder.state === 'recording') {
                    this.chunkStartTime = this.video.currentTime; // Sync time for next chunk
                    this.mediaRecorder.stop(); // Triggers ondataavailable
                    this.mediaRecorder.start();
                }
            }, 25000);

        } catch (err) {
            console.error('[AI] Capture failed:', err);
            this.isListening = false;
            alert('AI Capture Failed. Security restrictions (DRM/CORS) likely prevent recording this video.');
        }
    }

    processChunk(blob, startTime) {
        const reader = new FileReader();
        reader.onloadend = () => {
            chrome.runtime.sendMessage({
                action: 'PROCESS_AUDIO_CHUNK',
                audioData: reader.result, // Send as DataURL (Base64)
                apiKey: null, // Key is in background storage, not needed here
                offset: startTime
            });
        };
        reader.readAsDataURL(blob);
    }

    stopCapture() {
        this.isListening = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.captureInterval) clearInterval(this.captureInterval);

        const textEl = document.getElementById('ai-subtitle-text');
        if (textEl) textEl.style.display = 'none';
        console.log('[AI] Capture stopped.');
    }
}

// Singleton
const injector = new SubtitleInjector();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'GET_VIDEO_METADATA') {
            sendResponse(injector.getVideoMetadata());
        } else if (message.action === 'INJECT_SUBTITLE') {
            injector.injectSubtitle(message.content);
            sendResponse({ success: true });
        } else if (message.action === 'START_RECORDING') {
            // Pass API key if you want to store it in memory, 
            // but the background handles the actual API call now.
            injector.startCapture(message.apiKey);
            sendResponse({ success: true });
        } else if (message.action === 'STOP_RECORDING') {
            injector.stopCapture();
            sendResponse({ success: true });
        } else if (message.action === 'UPDATE_AI_SUBTITLES') {
            injector.injectSubtitle(message.content, message.offset);
            sendResponse({ success: true });
        }
    } catch (e) {
        console.error("Content Script Error:", e);
        sendResponse({ success: false, error: e.message });
    }
    // Return true only if async response is needed (not needed here mostly)
});
