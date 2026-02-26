// ==========================================
// S.T.I.T.C.H OPTIONS v3.0.0
// ==========================================

const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');
const siteInput = document.getElementById('siteInput');
const addSiteBtn = document.getElementById('addSiteBtn');
const siteList = document.getElementById('siteList');

let blocklist = [];

// ── LOAD SETTINGS ──
function loadSettings() {
    chrome.storage.local.get(['playerSize', 'autoPipEnabled', 'theme', 'blocklist'], (result) => {
        // Size
        const sizeEl = document.getElementById('defaultSize');
        if (sizeEl) sizeEl.value = result.playerSize || 'medium';

        // Auto-PiP
        const autoPipEl = document.getElementById('autoPip');
        if (autoPipEl) autoPipEl.checked = result.autoPipEnabled || false;

        // Theme
        const themeEl = document.getElementById('defaultTheme');
        if (themeEl) themeEl.value = result.theme || 'dark';

        // Blocklist
        blocklist = result.blocklist || [];
        renderBlocklist();
    });
}

// ── SITE BLOCKLIST ──
function renderBlocklist() {
    siteList.innerHTML = '';
    if (blocklist.length === 0) {
        siteList.innerHTML = '<div style="font-size:10px; color:var(--text-muted); padding:8px 0;">No sites blocked.</div>';
        return;
    }
    blocklist.forEach((site, i) => {
        const item = document.createElement('div');
        item.className = 'site-item';
        item.innerHTML = `
            <span>${site}</span>
            <button class="remove-btn" data-index="${i}" title="Remove">✕</button>
        `;
        siteList.appendChild(item);
    });

    // Bind remove buttons
    siteList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            blocklist.splice(parseInt(btn.dataset.index), 1);
            renderBlocklist();
        });
    });
}

function addSite() {
    const raw = siteInput.value.trim().toLowerCase();
    if (!raw) return;
    // Remove protocol if present
    const site = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!site || blocklist.includes(site)) {
        siteInput.style.borderColor = 'var(--danger)';
        setTimeout(() => { siteInput.style.borderColor = ''; }, 1500);
        return;
    }
    blocklist.push(site);
    siteInput.value = '';
    renderBlocklist();
}

addSiteBtn.addEventListener('click', addSite);
siteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSite(); });

// ── SAVE ──
saveBtn.addEventListener('click', () => {
    const size = document.getElementById('defaultSize')?.value || 'medium';
    const autoPip = document.getElementById('autoPip')?.checked || false;
    const theme = document.getElementById('defaultTheme')?.value || 'dark';

    chrome.storage.local.set({ playerSize: size, autoPipEnabled: autoPip, theme, blocklist }, () => {
        statusDiv.textContent = '✓ SETTINGS SAVED';
        statusDiv.style.color = 'var(--success)';
        setTimeout(() => { statusDiv.textContent = ''; }, 2500);
    });
});

// Init
loadSettings();
