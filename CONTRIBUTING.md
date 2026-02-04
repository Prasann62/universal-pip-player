# Contributing to Stitch PiP

We welcome contributions! Please follow these guidelines to help keep the project clean and consistent.

## Getting Started

1.  **Fork** the repository.
2.  **Clone** your fork.
3.  **Install dependencies** (if applicable, e.g., `npm install`).
4.  Load the extension in Chrome:
    - Go to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked" and select the extension folder.

## Code Structure

-   `manifest.json`: Extension configuration.
-   `content/`: Modular content scripts.
    -   `utils.js`: Helper functions.
    -   `pip.js`: Core Picture-in-Picture logic & fallbacks.
    -   `ui.js`: DOM buttons and tooltips.
    -   `controls.js`: Keyboard & Media Session handlers.
    -   `main.js`: Setup and observers.
-   `popup.{html,js,css}`: Extension popup UI.
-   `background.js`: Service worker for commands and context menus.

## Code Style

-   Use **JavaScript (ES6+)**.
-   Use **4 spaces** for indentation.
-   Keep functions small and modular.
-   Use `window.Stitch` namespace for shared global state.

## Pull Requests

1.  Create a branch for your feature: `git checkout -b feature/cool-new-thing`.
2.  Commit your changes.
3.  Push to your fork.
4.  Open a Pull Request with a clear description.

## Roadmap

Check the [README.md](README.md) for planned features.
