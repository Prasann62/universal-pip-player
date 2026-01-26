document.getElementById("pipBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
            const video = document.querySelector("video");
            if (!video) {
                alert("No video found on this page");
                return;
            }

            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await video.requestPictureInPicture();
                }
            } catch (e) {
                console.error("PiP failed:", e);
            }
        }
    });
});
