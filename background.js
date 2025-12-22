/**
 * background.js
 * Optimized for personal use: Stable OpenSubtitles API & OpenAI Whisper
 */

const CONFIG = {
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    // OpenSubtitles requires a specific User-Agent format: AppName vVersion
    USER_AGENT: 'AISubtitleSearch v2.0.0'
};

class OpenSubtitlesClient {
    static async search(title) {
        const storage = await chrome.storage.local.get(['apiKey']);
        const apiKey = storage.apiKey; // OpenSubtitles API Key

        if (!apiKey) throw new Error('OpenSubtitles API Key missing in background.js or settings');

        console.log(`[OpenSubtitles] Searching for: ${title}`);

        const res = await fetch(
            `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(title)}&languages=en,ja`,
            {
                headers: {
                    'Api-Key': apiKey,
                    'User-Agent': CONFIG.USER_AGENT,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error ${res.status}: ${errText}`);
        }

        const json = await res.json();
        if (!json.data || !json.data.length) return null;

        return json.data[0].attributes.files[0].file_id;
    }

    static async download(fileId) {
        const storage = await chrome.storage.local.get(['apiKey']);
        const apiKey = storage.apiKey;

        const res = await fetch(
            `https://api.opensubtitles.com/api/v1/download`,
            {
                method: 'POST',
                headers: {
                    'Api-Key': apiKey,
                    'User-Agent': CONFIG.USER_AGENT,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ file_id: fileId })
            }
        );

        const json = await res.json();
        if (!json.link) throw new Error('Failed to get download link from API');

        const sub = await fetch(json.link);
        return await sub.text();
    }
}

class OpenAIClient {
    static async transcribe(blob, apiKey) {
        console.log(`[OpenAI] Transcribing ${blob.size} bytes...`);

        const formData = new FormData();
        // Determine file extension based on blob type if possible, default to webm
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        formData.append('file', blob, `audio.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'vtt');
        formData.append('prompt', 'Transcribe the audio accurately as subtitles. Do not omit any words. Maintain correct punctuation and capitalization.');

        const response = await fetch(`${CONFIG.OPENAI_BASE_URL}/audio/transcriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
                // Do NOT set Content-Type header manually for FormData; fetch does it automatically with boundaries
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(err.error?.message || 'OpenAI API Error');
        }

        return await response.text();
    }
}

// Global state
let isCapturing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. Smart Process (OpenSubtitles)
    if (message.action === 'SMART_PROCESS') {
        (async () => {
            try {
                const { title } = message.params;
                const fileId = await OpenSubtitlesClient.search(title);

                if (!fileId) {
                    sendResponse({ success: false, error: 'No subtitles found (Search Mode)' });
                    return;
                }

                const content = await OpenSubtitlesClient.download(fileId);
                sendResponse({ success: true, content, type: 'OS_API' });
            } catch (err) {
                console.error(err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true; // Keep channel open
    }

    // 2. Start AI Mode
    if (message.action === 'START_AI_MODE') {
        (async () => {
            try {
                const storage = await chrome.storage.local.get(['openaiKey']);
                if (!storage.openaiKey) {
                    sendResponse({ success: false, error: 'Set OpenAI Key first' });
                    return;
                }

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;

                // 1. Get Video Time for sync
                const videoMeta = await new Promise(r =>
                    chrome.tabs.sendMessage(tab.id, { action: 'GET_VIDEO_METADATA' }, r)
                );

                // 2. Ensure Offscreen Document
                await setupOffscreenDocument('offscreen.html');

                // 3. Get Tab Stream ID
                chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
                    chrome.runtime.sendMessage({
                        target: 'offscreen',
                        action: 'START_CAPTURE',
                        streamId: streamId,
                        videoTime: videoMeta?.currentTime || 0
                    });
                });

                // 4. Notify content script to show status
                chrome.tabs.sendMessage(tab.id, { action: 'AI_MODE_STARTED' });

                isCapturing = true;
                sendResponse({ success: true });
            } catch (err) {
                console.error(err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // 3. Process Audio Chunk (From Offscreen)
    if (message.action === 'OFFSCREEN_CHUNK') {
        (async () => {
            try {
                const storage = await chrome.storage.local.get(['openaiKey']);
                const { data, offset } = message;

                // Convert DataURL back to Blob
                const res = await fetch(data);
                const blob = await res.blob();

                const vttContent = await OpenAIClient.transcribe(blob, storage.openaiKey);

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'UPDATE_AI_SUBTITLES',
                        content: vttContent,
                        offset: offset
                    });
                }
            } catch (err) {
                console.error('[Background] Transcription failed', err);
            }
        })();
        return true;
    }

    // 4. Stop AI Mode
    if (message.action === 'STOP_AI_MODE') {
        isCapturing = false;
        (async () => {
            chrome.runtime.sendMessage({ target: 'offscreen', action: 'STOP_CAPTURE' });
            await closeOffscreenDocument();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { action: 'STOP_RECORDING' });
            }
            sendResponse({ success: true });
        })();
        return true;
    }
});

// --- Offscreen Management ---

async function setupOffscreenDocument(path) {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: path,
        reasons: ['USER_MEDIA'],
        justification: 'Capture tab audio for real-time transcription.'
    });
}

async function closeOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        await chrome.offscreen.closeDocument();
    }
}
