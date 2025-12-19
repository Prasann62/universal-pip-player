/**
 * popup.js
 * Handles UI interactions for Search and AI modes
 */

const elements = {
    findBtn: document.getElementById('find-btn'),
    stopAiBtn: document.getElementById('stop-ai-btn'),
    status: document.getElementById('status'),
    videoInfo: document.getElementById('video-info'),
    detectedTitle: document.getElementById('detected-title'),
    modeSearch: document.getElementById('mode-search'),
    modeAi: document.getElementById('mode-ai'),
    aiSettings: document.getElementById('ai-settings'),
    openaiInput: document.getElementById('openai-key-input'),
    saveOpenaiBtn: document.getElementById('save-openai-btn')
};

let currentMeta = null;
let currentMode = 'search';

async function init() {
    const data = await chrome.storage.local.get(['openaiKey']);
    if (data.openaiKey) elements.openaiInput.value = data.openaiKey;

    updateStatus('Scanning for video...');

    // Try to detect video multiple times
    let attempts = 0;
    const maxAttempts = 5;

    const interval = setInterval(async () => {
        attempts++;
        const found = await checkVideo();
        if (found) {
            clearInterval(interval);
            updateStatus('Ready');
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            updateStatus('No video detected. Refresh page?', true);
        }
    }, 1000);
}

async function checkVideo() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].id) return resolve(false);

            // Try/Catch for sendMessage in case content script isn't loaded
            try {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_VIDEO_METADATA' }, (response) => {
                    if (chrome.runtime.lastError || !response) {
                        return resolve(false);
                    }
                    currentMeta = response;
                    elements.videoInfo.classList.remove('hidden');
                    elements.detectedTitle.innerText = response.title || 'Unknown Video';
                    elements.findBtn.disabled = false;
                    resolve(true);
                });
            } catch (e) {
                resolve(false);
            }
        });
    });
}

function updateStatus(text, isError = false) {
    elements.status.innerText = text;
    elements.status.style.color = isError ? '#e74c3c' : '#aaa';
}

// Mode Switching
elements.modeSearch.addEventListener('click', () => {
    currentMode = 'search';
    elements.modeSearch.classList.add('active');
    elements.modeAi.classList.remove('active');
    elements.aiSettings.classList.add('hidden');
    elements.findBtn.innerText = 'Search Subtitles';
    elements.findBtn.classList.remove('hidden');
    elements.stopAiBtn.classList.add('hidden');
});

elements.modeAi.addEventListener('click', () => {
    currentMode = 'ai';
    elements.modeAi.classList.add('active');
    elements.modeSearch.classList.remove('active');
    elements.aiSettings.classList.remove('hidden');
    elements.findBtn.innerText = 'Start AI Mode';
});

// Save API Key
elements.saveOpenaiBtn.addEventListener('click', async () => {
    const key = elements.openaiInput.value.trim();
    if (key) {
        await chrome.storage.local.set({ openaiKey: key });
        updateStatus('OpenAI Key Saved! 🔒');
        setTimeout(() => updateStatus('Ready'), 2000);
    }
});

// Start Button Logic
elements.findBtn.addEventListener('click', async () => {
    if (!currentMeta) return;

    if (currentMode === 'search') {
        elements.findBtn.disabled = true;
        updateStatus('Searching free databases...');
        chrome.runtime.sendMessage({ action: 'SMART_PROCESS', params: { title: currentMeta.title } }, (response) => {
            elements.findBtn.disabled = false;
            if (!response || !response.success) {
                return updateStatus(response?.error || 'Unknown error', true);
            }

            updateStatus('Subtitles found and injected! ✅');
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                chrome.tabs.sendMessage(tab.id, { action: 'INJECT_SUBTITLE', content: response.content });
            });
        });
    } else {
        // AI Mode
        const data = await chrome.storage.local.get(['openaiKey']);
        if (!data.openaiKey) return updateStatus('Set OpenAI Key first', true);

        elements.findBtn.classList.add('hidden');
        elements.stopAiBtn.classList.remove('hidden');
        updateStatus('AI Transcription Active... 🎙️');

        chrome.runtime.sendMessage({ action: 'START_AI_MODE' });
    }
});

elements.stopAiBtn.addEventListener('click', () => {
    elements.stopAiBtn.classList.add('hidden');
    elements.findBtn.classList.remove('hidden');
    updateStatus('AI Mode Stopped');
    chrome.runtime.sendMessage({ action: 'STOP_AI_MODE' });
});

init();
