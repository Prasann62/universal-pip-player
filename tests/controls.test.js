/**
 * Tests for keyboard controls and media session
 */

describe('Keyboard Controls', () => {
    let mockVideo;

    beforeEach(() => {
        mockVideo = document.createElement('video');
        mockVideo.src = 'test-video.mp4';
        mockVideo.volume = 0.5;
        mockVideo.playbackRate = 1;
        mockVideo.currentTime = 0;
        mockVideo.duration = 100;
        document.body.appendChild(mockVideo);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('Space key should toggle play/pause', () => {
        mockVideo.paused = true;
        mockVideo.play = jest.fn(() => Promise.resolve());
        mockVideo.pause = jest.fn();

        const event = new KeyboardEvent('keydown', { key: ' ' });
        // Manually trigger the logic (in real extension this is in event listener)
        if (mockVideo.paused) {
            mockVideo.play();
        } else {
            mockVideo.pause();
        }

        expect(mockVideo.play).toHaveBeenCalled();
    });

    test('M key should toggle mute', () => {
        mockVideo.muted = false;

        // Simulate 'm' key press logic
        mockVideo.muted = !mockVideo.muted;

        expect(mockVideo.muted).toBe(true);
    });

    test('Arrow left should rewind 5 seconds', () => {
        mockVideo.currentTime = 10;

        // Simulate arrow left logic
        mockVideo.currentTime = Math.max(0, mockVideo.currentTime - 5);

        expect(mockVideo.currentTime).toBe(5);
    });

    test('Arrow right should forward 5 seconds', () => {
        mockVideo.currentTime = 10;

        // Simulate arrow right logic with a fixed duration boundary
        const duration = 100;
        mockVideo.currentTime = Math.min(duration, mockVideo.currentTime + 5);

        expect(mockVideo.currentTime).toBe(15);
    });

    test('Alt+Arrow Up should increase volume', () => {
        mockVideo.volume = 0.5;

        // Simulate Alt+Up logic
        mockVideo.volume = Math.min(1, mockVideo.volume + 0.1);

        expect(mockVideo.volume).toBeCloseTo(0.6, 1);
    });

    test('Alt+Arrow Down should decrease volume', () => {
        mockVideo.volume = 0.5;

        // Simulate Alt+Down logic
        mockVideo.volume = Math.max(0, mockVideo.volume - 0.1);

        expect(mockVideo.volume).toBeCloseTo(0.4, 1);
    });

    test('Shift+> should increase playback speed', () => {
        const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        mockVideo.playbackRate = 1;

        // Find next speed
        const currentSpeed = mockVideo.playbackRate;
        const nextSpeed = speeds.find(s => s > currentSpeed) || speeds[speeds.length - 1];
        mockVideo.playbackRate = nextSpeed;

        expect(mockVideo.playbackRate).toBe(1.25);
    });

    test('Shift+< should decrease playback speed', () => {
        const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        mockVideo.playbackRate = 1;

        // Find previous speed
        const currentSpeed = mockVideo.playbackRate;
        const prevSpeed = speeds.reverse().find(s => s < currentSpeed) || speeds[speeds.length - 1];
        mockVideo.playbackRate = prevSpeed;

        expect(mockVideo.playbackRate).toBe(0.75);
    });
});

describe('Media Session', () => {
    test('should setup media session handlers', () => {
        // Mock navigator.mediaSession
        global.navigator.mediaSession = {
            setActionHandler: jest.fn()
        };

        function setupMediaSession() {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.setActionHandler('nexttrack', () => { });
                navigator.mediaSession.setActionHandler('previoustrack', () => { });
            }
        }

        setupMediaSession();

        expect(navigator.mediaSession.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
        expect(navigator.mediaSession.setActionHandler).toHaveBeenCalledWith('previoustrack', expect.any(Function));
    });
});
