# Freestyle Launcher: Design

**Date:** 2026-10-17
**Device:** Samsung The Freestyle 2nd Gen (SP-LFF3CLAX), Tizen OS
**Repo:** github.com/DROID-Wolf/freestyle-launcher
**Approved mockup:** `docs/mockup.html` (ambient screen with the small ✎ customize button at the top right)

## 1. Goal

A custom ambient homescreen for the Freestyle that the user sees instead of Samsung's Smart Hub. It shows a large clock, the date, the weather and a dock of favorite apps. It should look like the approved mockup, and design changes should reach the projector without reinstalling.

### Success criteria
- The projector boots straight into the launcher (via Samsung's *Autorun Last App* setting).
- Arrow keys and Enter on the Freestyle remote control everything, and Back closes overlays.
- Up to 6 quick apps, chosen from the apps actually installed, launch from the dock.
- Settings (dock apps, city, name, 12/24h) are changed on the projector and survive power-off.
- Pushing a change to GitHub updates the projector on its next launch, with no reinstall.
- It still shows the clock and dock when there is no internet.

### Platform limits (accepted)
- Tizen won't let an app replace the Home button or start itself at boot. We rely on *Autorun Last App*, so the launcher must be the last open app when the projector powers off.
- Opening some apps by ID may not work. Those apps are hidden from the picker.
- Apps sideloaded with Developer Mode may need reinstalling after firmware updates or when the certificate expires.

## 2. Architecture

The project has two parts.

```
┌──────────── Freestyle (Tizen) ─────────────┐
│  shell/  (packaged .wgt, installed once)   │
│   ├─ index.html: full-screen <iframe>      │
│   ├─ bridge.js: postMessage ⇄ tizen APIs   │
│   └─ fallback/: bundled copy of app/       │
│            │ loads                         │
│            ▼                               │
│  app/  (hosted on GitHub Pages)            │
│   the actual UI (clock, weather, dock...)  │
└────────────────────────────────────────────┘
```

- **`shell/`** is a tiny Tizen web app that is installed once with Tizen Studio. It does three things:
  1. It checks whether the online UI can be reached by fetching `version.json` from GitHub Pages, giving up after 4 seconds. If it can, the shell loads `https://droid-wolf.github.io/freestyle-launcher/` in a full-screen iframe. If not, it loads the bundled `fallback/` copy.
  2. It runs a **bridge**. Code loaded from the web can't call Tizen's APIs, so the UI sends requests (`getApps`, `launch`, `openSettings`, `openInputs`) to the shell with `postMessage`. The shell calls `tizen.application.*` and sends back the result. The shell only accepts messages from the GitHub Pages origin or from its own fallback.
  3. It forwards remote keys. It registers the remote's Back key and passes it into the iframe as an `Escape` key event.
- **`app/`** holds the UI as plain HTML, CSS and JavaScript ES modules, with no build step. A GitHub Actions workflow publishes it to GitHub Pages on every push to `main`. It also runs in a normal desktop browser, where the bridge is replaced by a **mock** with sample apps, so it can be developed and previewed without the projector.

**Why this design:** design changes only touch `app/`, and they go live once pushed. The shell only needs reinstalling if the bridge itself changes, which should be rare.

**Requirement:** GitHub Pages is free only for public repos, so the repo must be made public. It contains no secrets.

## 3. Components (in `app/`)

Each module has one job and can be tested on its own.

| Module | Responsibility |
|---|---|
| `clock.js` | Time, date, greeting and the 12/24h format. Ticks once a second. |
| `theme.js` | Picks the morning, day, evening or night theme from the current time and the sunrise and sunset times. These are pure functions. |
| `weather.js` | Gets the current conditions, the hourly forecast and sunrise/sunset from **Open-Meteo**, which needs no API key. Converts a city name to coordinates with the Open-Meteo geocoding API. Caches the last result in localStorage. Refreshes every 15 minutes. |
| `ticker.js` | Builds the short line at the bottom right from the weather data, for example "Sunset at 6:31" or "Rain likely after 3 PM". |
| `dock.js` | The dock data: the ordered list of app IDs, at most 6. Adds and removes apps, saves to localStorage and renders the tiles. |
| `picker.js` | The **Customize** overlay. It has two tabs: **Apps** (a grid of installed apps that toggles them in and out of the dock) and **Preferences** (name, city and 12/24h). |
| `focus.js` | Remote navigation. It works with zones (top button, dock, picker grid) and moves focus with the arrow keys. Enter activates and Escape/Back closes. |
| `bridge.js` | The client side of the postMessage bridge, with a timeout. It uses the mock automatically when not running inside the shell. |
| `icons.js` | App icons. It uses the icon from `getApps` when there is one, and otherwise falls back to the colored letter tile from the mockup. |
| `main.js` | Wires the modules together. |

## 4. Data flow
- **Startup:** the shell loads the app. The app reads its settings from localStorage, draws the clock right away, then shows cached weather and fetches fresh weather. It asks the bridge for installed apps and drops dock entries whose app is no longer installed.
- **Launch app:** Enter on a dock tile sends `bridge.launch(appId)` to `tizen.application.launch`. If that fails, a toast says "Couldn't open <app>".
- **Customize:** changes are saved to localStorage right away, and the dock re-renders when the overlay closes.
- **Settings storage:** localStorage belongs to the page's origin, so it lives on the projector and isn't affected by code updates.

## 5. Error handling
- **No internet:** the bundled fallback UI loads, the weather card shows the last cached data marked "updated 2h ago", or is hidden if nothing is cached.
- **Bridge timeout (2 s):** the dock still renders from saved settings, and launching shows a toast.
- **Unknown city:** the Preferences tab shows "City not found".
- **Performance:** animations only use `transform` and `opacity`. A "Reduce motion" preference turns off the moving background if the projector stutters.

## 6. Testing
- **Unit tests** (Node's built-in `node --test`, no dependencies) for the theme choice, daylight percentage, greeting, dock add/remove/limit/order, focus movement and the ticker text.
- **Browser smoke test:** open `app/` in a desktop browser with the mock bridge and walk through it with the keyboard.
- **On-device checklist:** install, boot with Autorun, launch each dock app, change the city, power-cycle and check settings persist, unplug Wi-Fi and check the fallback works.

## 7. Setup the user does once (documented in README)
1. Make the repo public and turn on GitHub Pages with the "GitHub Actions" source.
2. Install Tizen Studio with the TV extensions and create a Samsung certificate using a Samsung account.
3. Turn on Developer Mode on the Freestyle. The remote has no number keys, so use a Bluetooth keyboard or the SmartThings app's number pad to type `12345` in Apps. Enter the laptop's IP address, then restart the projector.
4. Connect with Device Manager and install `shell/` with Run As → Tizen Web Application.
5. In Settings → General → Start Screen Options, turn **Autorun Last App** on and **Autorun Smart Hub** off.

## 8. Out of scope (for now)
Photos or wallpapers from a cloud album, a calendar, music controls, and multiple user profiles.
