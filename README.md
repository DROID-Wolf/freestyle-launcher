# Freestyle Launcher

An ambient homescreen for the **Samsung Freestyle (2nd Gen)** projector. It shows a large clock, the date, the weather and a dock of up to 6 favorite apps. Everything is controlled with the remote's arrow keys, Enter and Back.

It has two parts:

- **`app/`** is the UI: plain HTML, CSS and ES modules with no build step. GitHub Pages hosts it at <https://droid-wolf.github.io/freestyle-launcher/>, and every push to `main` updates it. In a normal browser it uses a mock list of apps.
- **`shell/`** is a tiny Tizen web app (`.wgt`) that you install on the projector once. It loads the UI from GitHub Pages in a full-screen iframe, or a bundled offline copy when there's no internet. It also passes app-launch requests from the UI to Tizen.

Design changes only touch `app/`, so they reach the projector the next time the launcher opens, with no reinstall. The design is described in [`docs/superpowers/specs/2026-10-17-freestyle-launcher-design.md`](docs/superpowers/specs/2026-10-17-freestyle-launcher-design.md), and the visual reference is [`docs/mockup.html`](docs/mockup.html).

## Run it locally

```bash
python3 -m http.server -d app 8080
```

On Windows, use `python` instead of `python3`. Then open <http://localhost:8080> and use the keyboard like the remote:

| Key | What it does |
|---|---|
| ← → | Move along the dock or the top-bar buttons |
| ↑ / ↓ | Move between the dock and the top bar (✎ Customize, Inputs, Settings) |
| Enter | Launch the app, or open the selected button |
| Esc (Back on the remote) | Close an overlay. On the main screen it does nothing, so the launcher never exits. |

Open ✎ → **Preferences** to set your name and city (press **Find**), and to turn on 24-hour time or Reduce motion.

## Tests

```bash
npm test
```

The tests use Node's built-in test runner (Node 18 or newer) and need no dependencies.

## One-time setup

1. **Turn on GitHub Pages.** Make the repo public, because Pages is free only for public repos (the repo contains no secrets). Then go to Settings → Pages and set **Source: GitHub Actions**. The `Deploy to GitHub Pages` workflow runs the tests and publishes `app/` on every push to `main`.
2. **Install Tizen Studio** with the TV extensions (Package Manager → Extension SDK → *TV Extensions*), and create a **Samsung** certificate with your Samsung account in Certificate Manager.
3. **Turn on Developer Mode on the Freestyle.** Open **Apps** and type `12345`. The remote has no number keys, so use a Bluetooth keyboard or the SmartThings app's number pad. Switch Developer Mode on, enter your laptop's IP address, then restart the projector.
4. **Install the shell.** First build the offline copy of the UI:

   ```bash
   node scripts/build-fallback.mjs
   ```

   Then connect to the projector in Device Manager, import `shell/` into Tizen Studio as a Tizen Web project, and choose **Run As → Tizen Web Application**.
5. **Make it the homescreen.** In Settings → General → Start Screen Options, turn **Autorun Last App** on and **Autorun Smart Hub** off. Leave the launcher open when you power off, and it will come back on the next boot.

### On-device checklist

- [ ] The projector boots into the launcher.
- [ ] Every dock app launches.
- [ ] Changing the city shows that city's weather.
- [ ] Settings survive a power cycle.
- [ ] With Wi-Fi off, the launcher still opens with the clock and dock (the offline fallback).

## Troubleshooting

- **Developer Mode won't open.** Typing `12345` needs number keys. Pair a Bluetooth keyboard, or use the number pad in the SmartThings app's remote.
- **The launcher stopped opening after a while, or after a firmware update.** The Samsung certificate on sideloaded apps expires. Reinstall the shell from Tizen Studio (step 4). Your settings are kept, because they live in the projector's storage for the Pages site.
- **An app doesn't launch.** Some apps can't be opened by ID. The launcher shows a "Couldn't open …" message. Apps that Tizen marks as hidden never appear in the picker.
- **No weather.** Set a city in ✎ → Preferences and press **Find**. Without internet, the last forecast is shown with its age ("updated 2h ago"). If nothing has been cached yet, the card is hidden.
- **The animation stutters.** Turn on **Reduce motion** in Preferences.
- **Offline mode shows a blank screen.** The offline copy loads ES modules from the widget's local files, and some Tizen versions block that. Online mode is unaffected. Please report it if this happens.
