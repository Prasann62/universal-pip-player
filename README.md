# AI Subtitle Search (OpenSubtitles Edition)

This extension automatically finds and displays subtitles for videos using the OpenSubtitles.com REST API. It is specifically optimized for JAV matching and English/Japanese language priority.

## 1. How to get your OpenSubtitles API Key
1. Go to [OpenSubtitles.com Developers](https://www.opensubtitles.com/en/developers).
2. Create an account or log in.
3. Request a New API Key.
4. Once you have your **API Key**, open `background.js` and replace `YOUR_API_KEY_HERE` with your actual key:
   ```javascript
   const CONFIG = {
       API_KEY: 'your_actual_key_here',
       // ...
   };
   ```

## 2. How to Load the Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `online_subtitle_ex` folder.

## 3. How to Test with JAV Websites
1. Open any video-streaming website (e.g., JAV platforms).
2. Ensure the video starts playing.
3. Click the **AI Subtitle Search icon** in your Chrome toolbar.
4. The extension will grab the video code (like `ABP-623`) from the page title.
5. Click **Search Subtitles**.
6. If a match is found, it will automatically download and inject it into the player.

## 4. Troubleshooting
- **No Video Found**: Ensure the `<video>` tag is present on the page and not hidden inside a protected iframe.
- **Search Failed**: Verify your API Key is correct and you haven't hit rate limits.
- **Subtitles not showing**: Check if the video player has the "Subtitles/CC" option enabled. The extension adds a track named "AI Subtitles".
