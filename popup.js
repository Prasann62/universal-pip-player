/**
 * popup.js - Premium UI Version
 * Futuristic Glass Design Integration
 */

const elements = {
    // Buttons
    findBtn: document.getElementById('find-btn'),
    stopAiBtn: document.getElementById('stop-ai-btn'),
    miniplayBtn: document.getElementById('miniplay-btn'),
    settingsToggle: document.getElementById('settings-toggle'),

    // Status & Feedback
    statusCapsule: document.getElementById('status'),
    statusIcon: document.getElementById('toast-icon'),
    statusMessage: document.getElementById('toast-message'),
    mediaStatusText: document.getElementById('media-status-text'),

    // Inputs & Forms
    manualSearchInput: document.getElementById('manual-search-input'),
    languageSelect: document.getElementById('language-select'),

    // Mode Switching
    modeSearch: document.getElementById('mode-search'),
    modeAi: document.getElementById('mode-ai'),
    viewSearch: document.getElementById('view-search'),
    viewAi: document.getElementById('view-ai'),
    glider: document.querySelector('.tab-glider'),

    // Sync
    syncMinus: document.getElementById('sync-minus'),
    syncPlus: document.getElementById('sync-plus'),
    syncValue: document.getElementById('sync-value'),

    // Visuals
    aiBars: document.querySelectorAll('.bar')
};

let currentMeta = null;
let currentMode = 'search';
let currentFrameId = 0;
let syncOffset = 0;

// ========== INITIALIZATION ==========
async function init() {
    await loadSettings();
    updateStatus('System Ready', 'ready');

    // Start scanning animation
    elements.mediaStatusText.textContent = 'Scanning active tab...';

    let attempts = 0;
    const maxAttempts = 5;

    const interval = setInterval(async () => {
        attempts++;
        const found = await checkVideo();
        if (found) {
            clearInterval(interval);
            elements.mediaStatusText.textContent = currentMeta.title || 'Video Detected';
            elements.mediaStatusText.style.color = 'var(--primary)';
            updateStatus('Video Source Locked', 'success');
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            elements.mediaStatusText.textContent = 'No playable media found';
            elements.mediaStatusText.style.color = 'var(--text-muted)';
        }
    }, 800);
}

async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['selectedLanguage', 'syncOffset']);
        if (result.selectedLanguage) {
            elements.languageSelect.value = result.selectedLanguage;
        }
        if (result.syncOffset) {
            syncOffset = result.syncOffset;
            updateSyncDisplay();
        }
    } catch (e) {
        console.log('Settings load error:', e);
    }
}

async function saveSettings() {
    try {
        await chrome.storage.local.set({
            selectedLanguage: elements.languageSelect.value,
            syncOffset: syncOffset
        });
    } catch (e) {
        console.log('Settings save error:', e);
    }
}

// ========== VIDEO DETECTION ==========
async function checkVideo() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0] || !tabs[0].id) return resolve(false);
            const tabId = tabs[0].id;

            try {
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
                    currentFrameId = match.frameId;

                    if (!elements.manualSearchInput.value) {
                        elements.manualSearchInput.value = match.result.title || '';
                    }
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (e) {
                resolve(false);
            }
        });
    });
}

// ========== STATUS CAPSULE ==========
let toastTimeout;

function updateStatus(text, type = 'ready') {
    // Clear previous timeout to keep it visible if updates happen fast
    if (toastTimeout) clearTimeout(toastTimeout);

    elements.statusCapsule.classList.remove('hidden');
    elements.statusMessage.textContent = text;

    const icons = {
        ready: '✨',
        loading: '⏳',
        success: '✅',
        error: '❌'
    };
    elements.statusIcon.textContent = icons[type] || '✨';

    // Auto hide after 3 seconds for non-loading states
    if (type !== 'loading') {
        toastTimeout = setTimeout(() => {
            elements.statusCapsule.classList.add('hidden');
        }, 3000);
    }
}

function setLoading(isLoading) {
    const btnContent = elements.findBtn.querySelector('.btn-content');
    if (isLoading) {
        elements.findBtn.disabled = true;
        btnContent.innerHTML = '<span class="icon">⏳</span><span>Searching...</span>';
        elements.findBtn.style.opacity = '0.7';
    } else {
        elements.findBtn.disabled = false;
        btnContent.innerHTML = '<span class="icon">⚡</span><span>Find Subtitles</span>';
        elements.findBtn.style.opacity = '1';
    }
}

// ========== SYNC ==========
function updateSyncDisplay() {
    const sign = syncOffset >= 0 ? '+' : '';
    elements.syncValue.textContent = `${sign}${syncOffset.toFixed(1)}s`;
}

function adjustSync(delta) {
    syncOffset = Math.round((syncOffset + delta) * 10) / 10;
    syncOffset = Math.max(-30, Math.min(30, syncOffset));
    updateSyncDisplay();
    saveSettings();

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'SET_SYNC_OFFSET',
                offset: syncOffset
            }, { frameId: currentFrameId });
        }
    });
}

// ========== MODE SWITCHING ==========
function switchMode(mode) {
    currentMode = mode;

    if (mode === 'search') {
        elements.modeSearch.classList.add('active');
        elements.modeAi.classList.remove('active');
        elements.viewSearch.classList.add('active');
        elements.viewAi.classList.remove('active');

        elements.glider.style.transform = 'translateX(0)';

        elements.findBtn.classList.remove('hidden');
        elements.stopAiBtn.classList.add('hidden');
    } else {
        elements.modeAi.classList.add('active');
        elements.modeSearch.classList.remove('active');
        elements.viewAi.classList.add('active');
        elements.viewSearch.classList.remove('active');

        elements.glider.style.transform = 'translateX(100%)';

        elements.findBtn.classList.add('hidden');
        elements.stopAiBtn.classList.remove('hidden');
    }
}

elements.modeSearch.addEventListener('click', () => switchMode('search'));
elements.modeAi.addEventListener('click', () => switchMode('ai'));

// ========== ACTIONS ==========
elements.findBtn.addEventListener('click', async () => {
    const searchQuery = elements.manualSearchInput.value.trim();
    if (!currentMeta && !searchQuery) {
        updateStatus('Enter a title first', 'error');
        return;
    }

    setLoading(true);
    updateStatus('Searching database...', 'loading');

    const query = searchQuery || currentMeta?.title;

    chrome.runtime.sendMessage({
        action: 'SMART_PROCESS',
        params: {
            title: query,
            language: elements.languageSelect.value
        }
    }, (response) => {
        setLoading(false);

        if (chrome.runtime.lastError) {
            updateStatus('Connection failed', 'error');
            return;
        }

        if (!response || !response.success) {
            updateStatus('No subtitles found', 'error');
            return;
        }

        updateStatus('Subtitles Loaded', 'success');

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'INJECT_SUBTITLE',
                content: response.content,
                syncOffset: syncOffset
            }, { frameId: currentFrameId });
        });
    });
});

elements.stopAiBtn.addEventListener('click', () => {
    switchMode('search'); // Switch back to search UI on stop
    updateStatus('AI Stopped', 'ready');
    chrome.runtime.sendMessage({ action: 'STOP_AI_MODE' });
});

elements.miniplayBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PIP' }, { frameId: currentFrameId });
        }
    });
});

elements.syncMinus.addEventListener('click', () => adjustSync(-0.5));
elements.syncPlus.addEventListener('click', () => adjustSync(0.5));

elements.languageSelect.addEventListener('change', saveSettings);

elements.manualSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elements.findBtn.click();
});

// Initialize
init();
