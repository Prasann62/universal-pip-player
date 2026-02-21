// ==========================================
// UTILITIES & SHARED STATE
// ==========================================

// Global state for video navigation
window.Stitch = window.Stitch || {};
window.Stitch.toastTimeout = null;
window.Stitch.activePipWindow = null;

// ==========================================
// PERFORMANCE UTILITIES
// ==========================================

/**
 * Debounce function - delays execution until after wait time has elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function - limits execution to once per wait period
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, wait = 300) {
    let waiting = false;
    return function executedFunction(...args) {
        if (!waiting) {
            func.apply(this, args);
            waiting = true;
            setTimeout(() => {
                waiting = false;
            }, wait);
        }
    };
}

// ==========================================
// STORAGE UTILITIES
// ==========================================

/**
 * Get value from chrome storage with default fallback
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found
 * @returns {Promise<*>} Stored value or default
 */
async function getStorageValue(key, defaultValue = null) {
    try {
        const result = await chrome.storage.local.get([key]);
        return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
        console.warn(`Storage get error for ${key}:`, error);
        return defaultValue;
    }
}

/**
 * Set value in chrome storage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {Promise<boolean>} Success status
 */
async function setStorageValue(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
        return true;
    } catch (error) {
        console.warn(`Storage set error for ${key}:`, error);
        return false;
    }
}

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================

/**
 * Enhanced toast notification with type-based styling
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Display duration in milliseconds
 */
function showToast(message, type = 'info', duration = 2000) {
    let toast = document.getElementById("pip-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "pip-toast";
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 10, 12, 0.9);
            color: #f8fafc;
            padding: 10px 24px;
            border-radius: 30px;
            z-index: 2147483647;
            font-family: 'Outfit', sans-serif;
            font-size: 14px;
            font-weight: 600;
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
        `;

        // Stitch effect
        const stitch = document.createElement("div");
        stitch.className = "pip-toast-stitch";
        stitch.style.cssText = `
            position: absolute;
            top: 4px; left: 4px; right: 4px; bottom: 4px;
            border: 1px dashed rgba(255, 255, 255, 0.1);
            border-radius: 26px;
            pointer-events: none;
        `;
        toast.appendChild(stitch);

        // Dedicated text node so stitch element is never destroyed by textContent
        const textSpan = document.createElement("span");
        textSpan.className = "pip-toast-text";
        toast.appendChild(textSpan);

        document.body.appendChild(toast);
    }

    // Update stitch element reference
    const stitch = toast.querySelector('.pip-toast-stitch');

    // Type-based styling
    const typeColors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#6366f1'
    };

    const color = typeColors[type] || typeColors.info;
    toast.style.borderColor = color + '40';
    if (stitch) {
        stitch.style.borderColor = color + '40';
    }

    // FIX BUG 3: Use dedicated text span to avoid destroying stitch child element
    let textSpan = toast.querySelector('.pip-toast-text');
    if (!textSpan) {
        textSpan = document.createElement('span');
        textSpan.className = 'pip-toast-text';
        toast.appendChild(textSpan);
    }
    textSpan.textContent = message;
    toast.style.opacity = "1";

    if (window.Stitch.toastTimeout) clearTimeout(window.Stitch.toastTimeout);
    window.Stitch.toastTimeout = setTimeout(() => {
        toast.style.opacity = "0";
    }, duration);
}

// ==========================================
// VIDEO DETECTION UTILITIES
// ==========================================

/**
 * Recursively find all video elements, including those in Shadow DOMs
 * @param {Node} root - Root node to start search from
 * @param {Array} videos - Accumulator array
 * @returns {Array} Array of video elements
 */
function findAllVideosInShadow(root = document, videos = []) {
    // 1. Add videos from current root
    const currentVideos = Array.from(root.querySelectorAll('video'));
    videos.push(...currentVideos);

    // 2. Find all elements with shadowRoots
    const shadowHosts = Array.from(root.querySelectorAll('*')).filter(el => el.shadowRoot);

    // 3. Recurse into each shadowRoot
    shadowHosts.forEach(host => {
        findAllVideosInShadow(host.shadowRoot, videos);
    });

    return videos;
}

/**
 * Check if a video element is visible and significant (not a thumbnail)
 * @param {HTMLVideoElement} video - Video element to check
 * @returns {boolean} True if video is significant
 */
function isSignificantVideo(video) {
    if (!video) return false;

    const MIN_WIDTH = typeof CONFIG !== 'undefined' ? CONFIG.MIN_VIDEO_WIDTH : 150;
    const MIN_HEIGHT = typeof CONFIG !== 'undefined' ? CONFIG.MIN_VIDEO_HEIGHT : 150;

    const rect = video.getBoundingClientRect();

    // 1. Basic Dimension Check
    if (rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT) return false;

    // 2. Visibility Check (Computed Style)
    // Only check computed style if dimensions differ significantly or for edge cases?
    // Doing getComputedStyle is expensive, so rely on dimensions + simple check first.
    if (rect.width === 0 || rect.height === 0) return false;

    // 3. Content Check
    // ReadyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
    if (video.readyState === 0 && !video.src && !video.querySelector('source')) return false;

    // 4. Exclusion for Background Videos (often muted, loop, autoplay) - Optional heuristic
    // if (video.muted && video.loop && video.autoplay) return false; 

    // 5. Opacity/Visibility Check (Expensive but needed for "hidden" active videos)
    const style = window.getComputedStyle(video);
    if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') return false;

    return true;
}

/**
 * Find the most relevant video on the page, searching deep into Shadow DOMs
 * @returns {HTMLVideoElement|null} Most relevant video element
 */
function findPrimaryVideo() {
    // Use the deep search helper
    const allVideos = findAllVideosInShadow(document);

    // Filter for significant videos
    const videos = allVideos.filter(isSignificantVideo);

    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    // Priority System:
    // 1. Playing & Audible (User is watching this)
    // 2. Playing & Muted (User might be watching)
    // 3. Largest visible (Likely the main content)

    // 1. Active Playing
    const playingVideo = videos.find(v => !v.paused && !v.muted && v.currentTime > 0);
    if (playingVideo) return playingVideo;

    // 2. Playing (Muted)
    const playingMuted = videos.find(v => !v.paused && v.currentTime > 0);
    if (playingMuted) return playingMuted;

    // 3. Largest Area
    return videos.reduce((largest, current) => {
        const largestRect = largest.getBoundingClientRect();
        const currentRect = current.getBoundingClientRect();
        const largestArea = largestRect.width * largestRect.height;
        const currentArea = currentRect.width * currentRect.height;
        return currentArea > largestArea ? current : largest;
    });
}
