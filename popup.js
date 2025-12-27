const elements = {
    findBtn: document.getElementById('find-btn'),
    stopAiBtn: document.getElementById('stop-ai-btn'),
    status: document.getElementById('status'),
    videoInfo: document.getElementById('video-info'),
    manualSearchInput: document.getElementById('manual-search-input'),
    modeSearch: document.getElementById('mode-search'),
    modeAi: document.getElementById('mode-ai'),
    aiSettings: document.getElementById('ai-settings'),
    searchSettings: document.getElementById('search-settings'),
    openaiInput: document.getElementById('openai-key-input'),
    saveOpenaiBtn: document.getElementById('save-openai-btn'),
    osInput: document.getElementById('os-key-input'),
    saveOsBtn: document.getElementById('save-os-btn')
};

let currentMeta = null;
let currentMode = 'search';

async function init() {
    const data = await chrome.storage.sync.get(['openaiKey', 'osApiKey']);
    if (data.openaiKey) elements.openaiInput.value = data.openaiKey;
    if (data.osApiKey) elements.osInput.value = data.osApiKey;

    updateStatus('Scanning for video...');

    // Try to detect video multiple times
    let attempts = 0;
    const maxAttempts = 5;

    const interval = setInterval(async () => {
        attempts++;
        const found = await checkVideo();
        if (found) {
            clearInterval(interval);
            updateStatus('System Standby');
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            updateStatus('Critical Error: Video Link Not Found', true);
        }
    }, 1000);
}

let currentFrameId = 0;

async function checkVideo() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0] || !tabs[0].id) return resolve(false);
            const tabId = tabs[0].id;

            try {
                // Execute script in ALL frames to find which one has a video
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabId, allFrames: true },
                    func: () => {
                        const injector = window._aiSubtitleInjector;
                        return injector && injector.findVideo() ? injector.getVideoMetadata() : null;
                    }
                });

                const match = results.find(r => r.result !== null);

                if (match && match.result) {
                    currentMeta = match.result;
                    currentFrameId = match.frameId; // Store frame ID

                    elements.videoInfo.classList.remove('hidden');
                    // Pre-fill input but allow user edit
                    if (!elements.manualSearchInput.value) {
                        elements.manualSearchInput.value = match.result.title || 'Unknown Video';
                    }
                    elements.findBtn.disabled = false;
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (e) {
                console.error("Frame check failed", e);
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
    elements.searchSettings.classList.remove('hidden');
    elements.findBtn.innerText = 'Search Subtitles';
    elements.findBtn.classList.remove('hidden');
    elements.stopAiBtn.classList.add('hidden');
});

elements.modeAi.addEventListener('click', () => {
    currentMode = 'ai';
    elements.modeAi.classList.add('active');
    elements.modeSearch.classList.remove('active');
    elements.aiSettings.classList.remove('hidden');
    elements.searchSettings.classList.add('hidden');
    elements.findBtn.innerText = 'Initialize Whisper Engine';
});

// Save keys
elements.saveOpenaiBtn.addEventListener('click', async () => {
    const key = elements.openaiInput.value.trim();
    if (key) {
        await chrome.storage.sync.set({ openaiKey: key });
        updateStatus('OpenAI Key Saved! 🔒');
        setTimeout(() => updateStatus('Ready'), 2000);
    }
});

elements.saveOsBtn.addEventListener('click', async () => {
    const key = elements.osInput.value.trim();
    if (key) {
        await chrome.storage.sync.set({ osApiKey: key });
        updateStatus('OpenSubtitles Key Saved! 🔒');
        setTimeout(() => updateStatus('Ready'), 2000);
    }
});

// Start Button Logic
elements.findBtn.addEventListener('click', async () => {
    // Only block if no metadata AND empty search input
    const searchQuery = elements.manualSearchInput.value.trim();
    if (!currentMeta && !searchQuery) return;

    if (currentMode === 'search') {
        const data = await chrome.storage.sync.get(['osApiKey']);
        if (!data.osApiKey) return updateStatus('Set OpenSubtitles API Key first', true);

        elements.findBtn.disabled = true;
        updateStatus('Searching free databases...');

        // Use manual input if available, else detected title
        const query = searchQuery || currentMeta?.title;

        chrome.runtime.sendMessage({
            action: 'SMART_PROCESS',
            params: { title: query }
        }, (response) => {
            elements.findBtn.disabled = false;
            if (!response || !response.success) {
                return updateStatus(response?.error || 'Unknown error', true);
            }

            updateStatus('Subtitles Synchronized ✅');
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'INJECT_SUBTITLE',
                    content: response.content
                }, { frameId: currentFrameId }); // Target the specific frame
            });
        });
    } else {
        // AI Mode
        const data = await chrome.storage.sync.get(['openaiKey']);
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
