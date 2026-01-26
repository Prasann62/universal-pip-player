# 🪟 Brave PiP Player

A lightweight **Brave / Chromium browser extension** that enables  
**Mini Player** and **Picture-in-Picture (PiP)** for videos on **any website**.

Built to be **fast, privacy-friendly, and Brave-safe**.

---

## ✨ Features

- 🎥 **Picture-in-Picture (PiP)**
  - Native Chromium PiP API
  - Works on most HTML5 video websites
  - Floating window above all applications

- 🪟 **Mini Player Mode**
  - Floating video inside the webpage
  - Draggable and resizable
  - Stays visible while scrolling

- 🖱️ **Multiple Controls**
  - Double-click on video → Toggle PiP
  - Extension popup button → Toggle PiP
  - Auto-detects playing videos

- 🦁 **Brave Optimized**
  - No tracking
  - No analytics
  - No external requests
  - Respects Brave Shields & privacy rules

---

## 🚀 How It Works

1. Detects `<video>` elements on the page  
2. Listens for user interaction (Brave requirement)  
3. Uses native:
   ```js
   video.requestPictureInPicture()
Falls back safely if PiP is blocked

📂 Project Structure
brave-pip-player/
│
├── manifest.json        # Manifest V3 (Brave / Chrome)
├── content.js           # Video detection + auto PiP
├── popup.html           # Extension UI
├── popup.js             # Manual PiP trigger
├── README.md            # Documentation
└── LICENSE              # Open-source license

🛠 Installation (Brave Browser)

Open Brave

Go to brave://extensions

Enable Developer mode

Click Load unpacked

Select the project folder

Done ✅
🧪 How to Use
Option 1 — Auto PiP

Play any video

PiP will attempt automatically (if allowed)

Option 2 — Manual PiP

Click the extension icon

Press Toggle Picture-in-Picture

Option 3 — Double-Click

Double-click on any video to toggle PiP
🔒 Privacy

❌ No tracking

❌ No ads

❌ No analytics

❌ No data collection

✅ 100% local execution

🧠 Tech Stack

JavaScript (Vanilla)

Chromium PiP API

Manifest V3

MutationObserver

📌 Roadmap (Optional)

⌨️ Keyboard shortcuts

🎨 UI theme toggle

🪟 Advanced mini-player controls

🏪 Brave Store release

🤝 Contributing

Pull requests are welcome.
For major changes, please open an issue first.

📜 License

This project is licensed under the MIT License.
See the LICENSE file for details.

⭐ Support

If this project helped you:

⭐ Star the repo

🐛 Report issues

🚀 Share ideas
Built with ❤️ for Brave users.

---


