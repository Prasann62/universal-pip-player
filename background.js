chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "toggle-pip-menu",
        title: "Toggle Picture-in-Picture",
        contexts: ["video", "page"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "toggle-pip-menu") {
        triggerPiP(tab.id);
    }
});

chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) return;

        if (command === "toggle-pip") {
            triggerPiP(tab.id);
        } else if (command === "close-pip") {
            closePiP(tab.id);
        }
    });
});

function closePiP(tabId) {
    chrome.tabs.sendMessage(tabId, { type: "CLOSE_PIP" }).catch(() => {
        // If content script not ready or error
    });
}

function triggerPiP(tabId) {
    chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PIP" }).catch((err) => {
        // Fallback or ignore if script not ready
        console.log("Could not send message to tab (styles/scripts might not be loaded):", err);
        // Optionally inject scripts if missing (advanced) but simplified for now
    });
}

