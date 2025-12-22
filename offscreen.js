/**
 * offscreen.js
 * Handles MediaStream from tabCapture and sends chunks to background.
 */

let mediaRecorder;
const CHUNK_INTERVAL = 5000; // 5 seconds for near real-time

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.action === 'START_CAPTURE') {
        startCapture(message.streamId, message.videoTime);
    } else if (message.action === 'STOP_CAPTURE') {
        stopCapture();
    }
});

async function startCapture(streamId, videoTime) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        // Continue playing audio in the tab while capturing
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(audioContext.destination);

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        let currentChunkTime = videoTime;

        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    chrome.runtime.sendMessage({
                        action: 'OFFSCREEN_CHUNK',
                        data: reader.result,
                        offset: currentChunkTime
                    });
                };
                reader.readAsDataURL(event.data);
            }
        };

        mediaRecorder.start();

        // Chunking interval
        const intervalId = setInterval(() => {
            if (mediaRecorder.state === 'recording') {
                currentChunkTime += CHUNK_INTERVAL / 1000;
                mediaRecorder.stop();
                mediaRecorder.start();
            } else {
                clearInterval(intervalId);
            }
        }, CHUNK_INTERVAL);

    } catch (err) {
        console.error('Offscreen capture failed:', err);
        chrome.runtime.sendMessage({ action: 'CAPTURE_ERROR', error: err.message });
    }
}

function stopCapture() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}
