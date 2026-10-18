# Freestyle Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ambient homescreen for the Samsung Freestyle 2nd Gen. It has a tiny Tizen shell that is installed once, and a UI hosted on GitHub Pages that updates itself.

**Architecture:** `app/` is a plain HTML/CSS/ES-module UI that runs in any browser, using a mock bridge when it isn't on the projector. `shell/` is a Tizen `.wgt` that loads `app/` from GitHub Pages in an iframe, or a bundled fallback copy when offline. It passes Tizen API calls to the UI over `postMessage`. The pure logic lives in small modules that are tested with `node --test`.

**Tech Stack:** Vanilla JS (ES2020 modules, no build step), Node 18+ `node:test` for unit tests, Tizen Web API (`tizen.application`, `tizen.tvinputdevice`), Open-Meteo forecast and geocoding APIs, GitHub Actions to deploy Pages.

**Spec:** `docs/superpowers/specs/2026-10-17-freestyle-launcher-design.md`. The visual reference is `docs/mockup.html`.

## Global Constraints
- No npm dependencies and no bundler. Tests run with `node --test app/tests/ shell/tests/`.
- The code must run on Tizen 7's Chromium (about version 94). That means no `structuredClone`, no top-level `await` and no CSS `:has()`.
- Animations use only `transform` and `opacity`.
- The design is 1920×1080. The UI scales to the viewport with a single `transform: scale()` on `.screen`.
- Dock maximum: **6** apps. Default dock: none until installed apps are known. The mock defaults to `netflix, youtube, disney, spotify, prime`.
- localStorage keys: `fl.dock` (JSON array of app IDs), `fl.prefs` (JSON `{name, city, lat, lon, hour24, reduceMotion}`), `fl.weather` (JSON `{fetchedAt, data}`).
- Weather refreshes every **15 min**. Bridge timeout is **2000 ms**. The shell's online check times out after **4000 ms**.
- Pages URL: `https://droid-wolf.github.io/freestyle-launcher/`. This is the only remote origin the shell trusts.
- Remote Back key on Tizen is keyCode `10009`. The shell forwards it as `Escape`.
- **Commits:** at each "Checkpoint" step, the user commits and pushes in GitHub Desktop with the message given.

## Review Focus
1. **A saved dock app was uninstalled.** It should be silently dropped from the dock, not shown as a broken tile. Test: `pruneDock` in Task 2.
2. **Back is pressed on the main screen.** The launcher must not exit, since exiting would break Autorun Last App. Back only closes overlays. Tests in Task 3 (`navigate` returns `{action:'none'}`) and Task 7 (shell calls `preventDefault` on 10009).
3. **No internet or a stale cache.** Show the cached weather with its age, or hide the card if there's no cache. Never show `NaN°`. Test: `weatherView` in Task 4.
4. **The clock around midnight and noon.** It must show "12:05 AM" and "12:30 PM", not "0:05". The greeting must be right at the boundary hours. Test: `formatTime` and `greeting` in Task 1.
5. **A postMessage from an unknown origin.** It must be ignored with no response. Test: `handleMessage` in Task 7.

---

### Task 1: Time and theme logic

**Files:**
- Create: `app/js/time.js`, `app/js/theme.js`, `app/tests/time.test.js`, `app/tests/theme.test.js`, `package.json` (`{"type":"module","scripts":{"test":"node --test app/tests/ shell/tests/"}}`)

**Interfaces:**
- Produces: `formatTime(date: Date, hour24: boolean) -> {h: string, m: string, ampm: string|''}`, `formatDate(date) -> string` (for example "Saturday, October 17"), `greeting(hour: number) -> string`, `dayProgress(nowMin, riseMin, setMin) -> {pct: number, label: string}`, `themeFor(nowMin, riseMin, setMin) -> 'morning'|'day'|'evening'|'night'`.

- [ ] **Step 1: Write the failing tests**
  - `formatTime(new Date(2026,9,17,0,5), false)` → `{h:'12', m:'05', ampm:'AM'}`. At 12:30 → `{h:'12', m:'30', ampm:'PM'}`. At 21:41 with `hour24` set → `{h:'21', m:'41', ampm:''}`.
  - `greeting`: 4 → 'Good night', 5 → 'Good morning', 11 → 'Good morning', 12 → 'Good afternoon', 17 → 'Good evening', 21 → 'Good night'.
  - `dayProgress(600, 444, 1111)` → pct 23 and label 'Day 23% done'. Before sunrise → `{pct:0, label:'Before sunrise'}`. After sunset → `{pct:100, label:'Sun has set'}`.
  - `themeFor` with rise 444 and set 1111: 450 → 'morning' (before rise+120), 700 → 'day', 1050 → 'evening' (from set−90 to set+90), 1300 → 'night', 200 → 'night'.
- [ ] **Step 2: Run `npm test` and confirm it fails** (module not found).
- [ ] **Step 3: Implement the functions in `time.js` and `theme.js`.** `formatDate` uses `toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})`.
- [ ] **Step 4: Run `npm test` and confirm all tests pass.**
- [ ] **Step 5: Checkpoint.** Commit: "feat: time and theme logic"

### Task 2: Dock state

**Files:**
- Create: `app/js/dock.js`, `app/tests/dock.test.js`

**Interfaces:**
- Produces: `MAX_DOCK = 6`, `toggleApp(dock: string[], id: string) -> {dock: string[], full: boolean}` (removes the app if present, appends it if there's room, and sets `full:true` without changing anything if there isn't), `pruneDock(dock, installedIds: string[]) -> string[]`, `loadDock(storage) -> string[]|null`, `saveDock(storage, dock)`. `storage` is any object with `getItem` and `setItem`.

- [ ] **Step 1: Write the failing tests:**
  - Toggling adds an app and removes it again.
  - The order of selection is kept.
  - A 7th app returns `full:true` and leaves the dock unchanged.
  - `pruneDock(['a','x','b'], ['a','b'])` → `['a','b']`.
  - `loadDock` with corrupt JSON → `null`.
  - `loadDock` keeps only string IDs and caps the list at 6.
- [ ] **Step 2: Run `npm test` and confirm the new tests fail.**
- [ ] **Step 3: Implement `dock.js`.** Functions return new arrays and never mutate their input. Wrap storage reads and writes in try/catch.
- [ ] **Step 4: Run `npm test` and confirm everything passes.**
- [ ] **Step 5: Checkpoint.** Commit: "feat: dock state"

### Task 3: Remote focus navigation

**Files:**
- Create: `app/js/focus.js`, `app/tests/focus.test.js`

**Interfaces:**
- Produces: `navigate(state, key, layout) -> {state, action}`.
  - `state` is `{zone: 'dock'|'top'|'picker', index: number}`.
  - `key` is one of 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'.
  - `layout` is `{dockCount: number, pickerCount: number, pickerCols: number}`. The picker's last index (`pickerCount`) is the Done button.
  - `action` is one of 'none', 'activate', 'close'.

- [ ] **Step 1: Write the failing tests:**
  - In the dock zone, Right stops at `dockCount-1` (the All-apps tile is included in `dockCount`), and Left stops at 0.
  - Up from the dock goes to `{zone:'top', index:0}`, and Down from top goes back to `{zone:'dock', index:0}`.
  - Enter returns `action:'activate'`.
  - **Escape in the dock or top zone returns `action:'none'` and leaves the state unchanged.**
  - In the picker zone, with 12 apps and 6 columns:
    - Down from 2 → 8. Down from 8 → 12 (Done). Up from 12 → 11. Up from 3 → 3.
    - Escape → `action:'close'`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement `navigate` as a pure function.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Checkpoint.** Commit: "feat: remote focus navigation"

### Task 4: Weather and ticker

**Files:**
- Create: `app/js/weather.js`, `app/js/ticker.js`, `app/tests/weather.test.js`, `app/tests/fixtures/open-meteo.json` (a real response saved once from the forecast URL below)

**Interfaces:**
- Produces:
  - `forecastUrl(lat, lon) -> string`, built as `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&timezone=auto&forecast_days=2`.
  - `geocodeUrl(city) -> string`, built as `https://geocoding-api.open-meteo.com/v1/search?name=<encoded>&count=1`.
  - `parseForecast(json, now: Date) -> {temp, code, cond, icon, hi, lo, riseMin, setMin, hours: [{label, temp, icon}] /*4 entries, every 2 h from the next hour*/}`.
  - `parseGeocode(json) -> {lat, lon, name}|null`.
  - `describeCode(code) -> {cond, icon}` (the WMO code groups: 0 is clear, 1–3 are cloudy, 45/48 fog, 51–67 rain, 71–77 snow, 80–82 showers, 95–99 storm).
  - `weatherView(cache: {fetchedAt, data}|null, now) -> {show: boolean, stale: string|''}`. The stale text reads like "updated 2h ago" once the data is older than 30 minutes.
  - `tickerText(view, now) -> string`.

- [ ] **Step 1: Write the failing tests:**
  - `parseForecast` on the fixture returns numbers for temp, hi and lo, exactly 4 hours, and `riseMin < setMin`.
  - `parseGeocode({})` → `null`.
  - `weatherView(null)` → `{show:false}`.
  - A cache from 3 hours ago → `{show:true, stale:'updated 3h ago'}`.
  - A cache from 5 minutes ago → `stale:''`.
  - `tickerText` before sunset → "Sunset at 6:31 PM". After sunset with clear skies → contains "Clear skies". If any upcoming hour has rain → "Rain likely around <label>".
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement both modules.** Keep `fetch` out of these files, because `main.js` does the fetching.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Checkpoint.** Commit: "feat: weather parsing and ticker"

### Task 5: Bridge client and mock

**Files:**
- Create: `app/js/bridge.js`, `app/js/mock-apps.js`, `app/tests/bridge.test.js`

**Interfaces:**
- Produces: `createBridge({target, source, timeoutMs=2000}) -> {getApps(): Promise<App[]>, launch(id): Promise<void>, openSettings(): Promise<void>, openInputs(): Promise<void>}`.
  - `App` is `{id, name, icon: string|null}`.
  - Messages look like `{fl: 1, id: <n>, method, params}`, and replies look like `{fl: 1, id, ok, result|error}`.
  - `mockBridge() -> same interface`. It returns `MOCK_APPS` (the 12 apps from the mockup) and logs launches to the console.
  - `pickBridge(win) -> bridge` uses the real bridge when `win.parent !== win`, and the mock otherwise.

- [ ] **Step 1: Write the failing tests** using a fake `target`/`source` pair built from a tiny EventTarget:
  - A request gets a reply and resolves.
  - A reply with `ok:false` rejects with the error.
  - No reply within 50 ms (passed as the test's timeout) rejects with 'timeout'.
  - Replies whose `id` doesn't match are ignored.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement `bridge.js` and `mock-apps.js`.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Checkpoint.** Commit: "feat: bridge client and mock"

### Task 6: UI (screen, dock, picker, preferences)

**Files:**
- Create: `app/index.html`, `app/css/styles.css`, `app/js/main.js`, `app/js/picker.js`, `app/js/icons.js`, `app/version.json` (`{"version":"0.1.0"}`)

**Interfaces:**
- Consumes everything from Tasks 1–5.
- Produces: `icons.js` exports `tileHtml(app: App, extraClass='') -> string`. When `app.icon` is set it uses an `<img>`. Otherwise it shows a letter tile whose color class comes from a stable hash of `app.id` (classes `c1`–`c12` from the mockup). `picker.js` exports `openPicker({apps, dock, prefs, onChange, onClose})`, which has two tabs, **Apps** and **Preferences** (Name text input, City text input with a "Find" button, a 24-hour toggle and a Reduce motion toggle).

- [ ] **Step 1: Port the visuals from `docs/mockup.html`** into `index.html` and `styles.css`: the aurora background, top bar with the small ✎ button and the Inputs/Wi-Fi/Settings pills, clock with the daylight bar, weather card, dock, ticker, and the picker overlay. Wi-Fi shows the label "Wi-Fi" because Tizen gives no reliable SSID. Inputs calls `bridge.openInputs()`, and Settings calls `bridge.openSettings()`.
- [ ] **Step 2: In `main.js`, wire everything together:**
  - Load prefs and the dock.
  - Get apps from `pickBridge(window)`. If no dock is saved, use the first 5 installed apps. Run `pruneDock`.
  - Re-render the clock every second and the theme every minute.
  - On startup and every 15 minutes, fetch the weather when `prefs.lat` is set, cache it to `fl.weather`, and render using `weatherView`.
  - Send `keydown` events through `navigate`. On 'activate' in the dock, launch the app (or open the full app grid when the All-apps tile is selected). On 'activate' in top, open the picker.
  - Show a toast for 3 seconds when a launch fails.
  - Set `body.reduce-motion` when the preference is on, which turns off the blob animations.
- [ ] **Step 3: Browser smoke test.** Serve the folder with `python3 -m http.server -d app 8080` and open it in a desktop browser. Check that:
  - Right and Left move along the dock.
  - Up and Enter open the picker.
  - Toggling an app and pressing Done updates the dock.
  - Typing the city "State College", pressing Find and saving shows weather.
  - Reloading keeps the dock and the city.
  - Escape on the main screen does nothing.
  - There are no console errors.
- [ ] **Step 4: Run `npm test` and confirm everything still passes.**
- [ ] **Step 5: Checkpoint.** Commit: "feat: launcher UI"

### Task 7: Tizen shell

**Files:**
- Create: `shell/config.xml`, `shell/index.html`, `shell/shell.js`, `shell/handler.js`, `shell/tests/handler.test.js`, `scripts/build-fallback.mjs`, `shell/icon.png` (512×512)

**Interfaces:**
- Consumes: the message format from Task 5.
- Produces: `handleMessage(event, {tizen, allowedOrigins, reply}) -> Promise<void>` in `handler.js`. It has no DOM access, so it can be tested in Node.

- [ ] **Step 1: Write the failing tests** with a fake `tizen`:
  - An event from `https://evil.example` → `reply` is never called.
  - `getApps` from the allowed origin → replies `ok:true` with the installed apps mapped to `{id, name, icon}`. Hidden apps (`show === false`) and the shell's own ID are excluded.
  - `launch` calls `tizen.application.launch(id, ok, err)`. If the error callback fires, the reply is `ok:false`.
  - An unknown method → `ok:false` with the error 'unknown method'.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement `handler.js`.** `getApps` calls `tizen.application.getAppsInfo`. `openSettings` launches `com.samsung.tv.menu`, and `openInputs` launches `org.tizen.tv-source`. Both are best effort, and failures are passed back to the UI.
- [ ] **Step 4: Implement `shell.js`:**
  - Register the remote keys with `tizen.tvinputdevice.registerKey`.
  - On keydown with keyCode `10009`, call `preventDefault()` and post `{fl:1, key:'Escape'}` to the iframe. The UI turns that into a synthetic Escape.
  - Fetch `<PAGES>/version.json` with an AbortController that times out after 4000 ms. If it succeeds, set `iframe.src = PAGES`. Otherwise, set it to `fallback/index.html`.
  - Listen for `message` events and pass them to `handleMessage`, with `allowedOrigins = ['https://droid-wolf.github.io', location.origin]`.
- [ ] **Step 5: Write `config.xml`:**
  - Widget ID `http://droid-wolf.github.io/freestyle-launcher`, package `FlLaunch01`, required_version `6.0`.
  - Privileges: `application.launch`, `application.info`, `tv.inputdevice`, `internet`.
  - `<access origin="*" subdomains="true"/>`.
  - `<tizen:setting screen-orientation="landscape" background-support="disable"/>`.
- [ ] **Step 6: Write `scripts/build-fallback.mjs`.** It copies `app/` into `shell/fallback/`. Run it with `node scripts/build-fallback.mjs`. Add `shell/fallback/` to `.gitignore`.
- [ ] **Step 7: Run `npm test` and confirm everything passes.**
- [ ] **Step 8: Checkpoint.** Commit: "feat: tizen shell"

### Task 8: Deploy and docs

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`

- [ ] **Step 1: Write `pages.yml`.** On push to `main` it runs `npm test`, then uploads `app/` with `actions/upload-pages-artifact@v3` and deploys with `actions/deploy-pages@v4`. It needs the permissions `pages: write` and `id-token: write`.
- [ ] **Step 2: Write `README.md`.** Include what the project is, how to run it locally (`python3 -m http.server -d app 8080`), how to run the tests, and the one-time setup checklist copied from spec §7. Add a troubleshooting section covering: Developer Mode not opening (use a Bluetooth keyboard or the SmartThings number pad), the certificate expiring (reinstall), and an app not launching (it's hidden from the picker).
- [ ] **Step 3: Checkpoint.** Commit: "ci: deploy to GitHub Pages; docs". The user then makes the repo public and sets Pages → Source: GitHub Actions.
- [ ] **Step 4: Verify** that `https://droid-wolf.github.io/freestyle-launcher/` loads in a browser with the mock apps and that `/version.json` returns `0.1.0`.
