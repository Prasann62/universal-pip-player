# 🪟 Stitch PiP Extension

A powerful **Brave / Chromium browser extension** that enables **Mini Player** and **Picture-in-Picture (PiP)** for videos on **any website**.

Built to be **fast, privacy-friendly, and highly configurable**.

---

## ✨ Features

- 🎥 **Picture-in-Picture (PiP)**
  - Native Chromium PiP API
  - **New:** Document PiP Support (Custom controls overlay)
  - Works on most HTML5 video websites

- 🪟 **Robust Mini Player (Fallback)**
  - Floating video mode for sites that block native PiP
  - Resizable (Small, Medium, Large)
  - Stays visible while scrolling

- ⌨️ **Keyboard Shortcuts**
  - `Alt + P`: Toggle PiP
  - `Alt + X`: Close PiP
  - `Space`: Play/Pause
  - `M`: Mute/Unmute
  - `Arrow Keys`: Seek / Volume (in Document PiP)

- 🎨 **Customization**
  - **Dark/Light Theme** support
  - Configurable Mini-Player size
  - Settings persist across sessions

- 🦁 **Brave Optimized**
  - No tracking / analytics
  - 100% local execution

---

## 🚀 How It Works

1. Detects `<video>` elements on the page.
2. Injects a smart "PiP" button on YouTube player controls.
3. Allows toggling via Extension Popup or Keyboard Shortcuts.
4. Intelligently falls back to a "Floating Mode" if native PiP is unavailable.

### 📂 Project Structure

```
stitch-pip-extension/
│
├── manifest.json        # Manifest V3 (Brave / Chrome)
├── content/             # Modular Content Scripts
│   ├── utils.js         # Helpers
│   ├── pip.js           # Core PiP Logic
│   ├── ui.js            # UI Injection (Buttons, Tooltips)
│   ├── controls.js      # Keyboard & Event Listeners
│   └── main.js          # Entry Point
├── popup.html           # Extension Popup UI
├── popup.js             # Popup Logic
├── background.js        # Background Service Worker
├── README.md            # Documentation
└── CONTRIBUTING.md      # Contribution Guidelines
```

## 🛠 Installation

1. Open **Brave** or **Chrome**.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the project folder.

## 🧪 Testing

This project uses Jest for unit testing.
```bash
npm install
npm test
```

## 📌 Roadmap

- [x] Keyboard shortcuts (`Alt+P`, `Alt+X`)
- [x] UI Theme Toggle (Dark/Light)
- [x] Advanced Fallback (Floating Window)
- [x] Configurable Player Size
- [ ] Brave Store release
- [ ] Multi-language support

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📜 License

MIT License.

---
