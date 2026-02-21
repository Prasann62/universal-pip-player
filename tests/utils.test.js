/**
 * Tests for utility functions
 */

// Mock chrome API for storage
global.chrome = {
    storage: {
        local: {
            // FIX: Return Promise that resolves with the result object directly,
            // matching the Promise API used by getStorageValue (not callback style)
            get: jest.fn((keys) => {
                const mockData = {
                    theme: 'dark',
                    playerSize: 'medium',
                    autoPipEnabled: false
                };
                const result = {};
                keys.forEach(key => {
                    if (mockData[key] !== undefined) {
                        result[key] = mockData[key];
                    }
                });
                return Promise.resolve(result);
            }),
            set: jest.fn((items) => {
                return Promise.resolve();
            })
        }
    }
};

describe('Performance Utilities', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('debounce should delay function execution', () => {
        // Mock function from utils.js
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

        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        // Call function multiple times rapidly
        debouncedFn();
        debouncedFn();
        debouncedFn();

        // Function should not have been called yet
        expect(mockFn).not.toHaveBeenCalled();

        // Fast forward time
        jest.advanceTimersByTime(100);

        // Function should have been called once
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('throttle should limit function calls', () => {
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

        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        // Call function multiple times
        throttledFn();
        throttledFn();
        throttledFn();

        // Function should only be called once
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});

describe('Storage Utilities', () => {
    test('getStorageValue should return stored value', async () => {
        async function getStorageValue(key, defaultValue = null) {
            try {
                const result = await chrome.storage.local.get([key]);
                return result[key] !== undefined ? result[key] : defaultValue;
            } catch (error) {
                return defaultValue;
            }
        }

        const value = await getStorageValue('theme', 'light');
        expect(value).toBe('dark');
    });

    test('getStorageValue should return default for missing key', async () => {
        async function getStorageValue(key, defaultValue = null) {
            try {
                const result = await chrome.storage.local.get([key]);
                return result[key] !== undefined ? result[key] : defaultValue;
            } catch (error) {
                return defaultValue;
            }
        }

        const value = await getStorageValue('nonexistent', 'default');
        expect(value).toBe('default');
    });

    test('setStorageValue should store value', async () => {
        async function setStorageValue(key, value) {
            try {
                await chrome.storage.local.set({ [key]: value });
                return true;
            } catch (error) {
                return false;
            }
        }

        const result = await setStorageValue('testKey', 'testValue');
        expect(result).toBe(true);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ testKey: 'testValue' });
    });
});

describe('Video Detection Utilities', () => {
    test('isSignificantVideo should filter out small videos', () => {
        function isSignificantVideo(video) {
            const MIN_WIDTH = 200;
            const MIN_HEIGHT = 150;

            const rect = video.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isLargeEnough = rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
            // FIX: Use !! to coerce truthy values (strings, objects) to proper booleans
            const hasSource = !!(video.src || video.currentSrc || video.querySelector('source'));

            return isVisible && isLargeEnough && hasSource;
        }

        // Mock small video (thumbnail)
        const smallVideo = {
            getBoundingClientRect: () => ({ width: 100, height: 100 }),
            src: 'video.mp4',
            currentSrc: 'video.mp4',
            querySelector: jest.fn()
        };

        expect(isSignificantVideo(smallVideo)).toBe(false);

        // Mock large video
        const largeVideo = {
            getBoundingClientRect: () => ({ width: 640, height: 360 }),
            src: 'video.mp4',
            currentSrc: 'video.mp4',
            querySelector: jest.fn()
        };

        expect(isSignificantVideo(largeVideo)).toBe(true);
    });

    test('isSignificantVideo should require a source', () => {
        function isSignificantVideo(video) {
            const MIN_WIDTH = 200;
            const MIN_HEIGHT = 150;

            const rect = video.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isLargeEnough = rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
            // FIX: Use !! to coerce truthy values (strings, objects) to proper booleans
            const hasSource = !!(video.src || video.currentSrc || video.querySelector('source'));

            return isVisible && isLargeEnough && hasSource;
        }

        const videoNoSource = {
            getBoundingClientRect: () => ({ width: 640, height: 360 }),
            src: '',
            currentSrc: '',
            querySelector: () => null
        };

        expect(isSignificantVideo(videoNoSource)).toBe(false);
    });
});

describe('Toast Notification System', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('showToast should create toast element', () => {
        // Mock showToast function
        function showToast(message, type = 'info') {
            let toast = document.getElementById("pip-toast");
            if (!toast) {
                toast = document.createElement("div");
                toast.id = "pip-toast";
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.dataset.type = type;
        }

        showToast('Test message', 'success');
        const toast = document.getElementById('pip-toast');

        expect(toast).toBeTruthy();
        expect(toast.textContent).toBe('Test message');
        expect(toast.dataset.type).toBe('success');
    });
});
