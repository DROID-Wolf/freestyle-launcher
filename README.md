# Freestyle Launcher

An ambient homescreen for the **Samsung Freestyle (2nd Gen)** projector. It shows a large clock, the date, the weather and a dock of up to 6 favorite apps, over a background theme you choose: the Aurora colours, or a cosy scene with moving video (a window onto rain, snow or the beach, a fireplace, a rainy café, an aquarium or a snowy cabin). Everything is controlled with the remote's arrow keys, Enter and Back.

It has two parts:

- **`app/`** is the UI: plain HTML, CSS and ES modules with no build step. GitHub Pages hosts it at <https://droid-wolf.github.io/freestyle-launcher/>, and every push to `main` updates it. In a normal browser it uses a mock list of apps.
- **`shell/`** is a tiny Tizen web app (`.wgt`) that you install on the projector once. It loads the UI from GitHub Pages in a full-screen iframe, or a bundled offline copy when there's no internet. It also passes app-launch requests from the UI to Tizen.

Because the UI lives on GitHub Pages, updates reach the projector the next time the launcher opens, with no reinstall.

## Install it on your Freestyle

You install the small `shell/` app on your projector once. It always loads the latest UI from this repo's GitHub Pages site, so you don't need a GitHub account or your own copy of the site.

The steps below are for a **Windows** PC. The Tizen tools also run on macOS and Linux; the steps are the same, but the paths differ.

### What you need

- A **Samsung Freestyle (2nd Gen)**, connected to Wi-Fi.
- A **PC on the same Wi-Fi network** as the projector.
- A **Samsung account**. Samsung signs the app for your projector.
- **VS Code** 1.100 or newer: <https://code.visualstudio.com>
- **Node.js** 18 or newer: <https://nodejs.org>
- A way to **type numbers** on the projector. The remote has no number keys, so use the remote in the **SmartThings** phone app (it has a 123 pad), or pair a Bluetooth keyboard.
- This repo on your PC: **Code → Download ZIP** on GitHub, then extract it, or `git clone` it.

### 1. Turn on Developer Mode on the projector

1. Find your **PC's** IP address: run `ipconfig` and copy the **IPv4 Address** of your Wi-Fi adapter.
2. On the projector, open **Apps**, then type `1 2 3 4 5` with the SmartThings number pad or the keyboard.
3. In the Developer Mode box, switch it **On**, enter your PC's IP as the **Host PC IP**, and press OK.
4. **Fully restart the projector:** hold the power button until it restarts; standby isn't enough. Afterwards, **Apps** shows "Developer Mode" at the top.
5. Note the **projector's** own IP: **Settings → General → Network → Network Status → IP Settings**.

### 2. Install the Tizen extension for VS Code

1. In VS Code, open **Extensions**, search for **Tizen**, and install **Tizen Extension**.
2. Click the new **Tizen** icon in the left bar. When it asks for the SDK location, choose **Use default path** (`C:\Users\<you>\.tizen-extension-platform`). Wait for the download to finish; progress shows in the **Output** panel.

You don't need the older Tizen Studio IDE.

### 3. Connect to the projector

1. In the Tizen panel, open **Baseline Tools → Device Manager → Connect a Remote Device → Add Devices**.
2. Enter any name (for example `Freestyle`), the **projector's** IP from step 1.5, and port `26101`, then connect.
3. The projector appears in Device Manager's list, with a name like `SP-LFF3CLAXXZA`.

If it won't connect, check that both devices are on the same network, and that the Host PC IP you entered in Developer Mode is still your PC's IP. Your PC's IP can change after a restart.

### 4. Create a Samsung certificate

Tizen only installs apps signed for your specific projector.

1. Get the projector's device ID (DUID). In PowerShell, replace the IP with your projector's:

   ```powershell
   & "$env:USERPROFILE\.tizen-extension-platform\server\sdktools\data\tools\sdb.exe" -s 192.168.1.50:26101 shell 0 getduid
   ```

2. In VS Code press **Ctrl+Shift+P**, run **Tizen: Launch Tizen Certificate Manager**, and choose **Create a new Certificate**.
3. Name the profile `freestyle`, and pick the **Samsung** type (not Tizen). Pick **TV** if it asks for a device type.
4. Author certificate: enter your name and a password, then sign in with your Samsung account when the browser opens. **Write the password down.**
5. Distributor certificate: keep **Public** privilege. Choose **Add individual DUIDs** and enter the DUID from step 1 exactly. Then click **Create**.
6. Make sure `freestyle` is the **active** profile.

The certificate lasts about a year. See [Troubleshooting](#troubleshooting) for what to do when it runs out.

### 5. Build and install the launcher

Open PowerShell in the repo folder. Set the first two lines to your projector's IP and your certificate profile's name, then run the whole block. It copies the shell to `C:\tizen\flshell`, because Tizen's tools can fail in folders whose names contain spaces or apostrophes, which OneDrive paths often do. It then builds, signs and installs it.

```powershell
$device = '192.168.1.50:26101'   # your projector's IP, port 26101
$certProfile = 'freestyle'       # your Samsung certificate profile

node scripts/build-fallback.mjs
$stage = 'C:\tizen\flshell'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item shell\config.xml, shell\index.html, shell\handler.js, shell\shell.js, shell\icon.png $stage
Copy-Item -Recurse shell\fallback "$stage\fallback"
@"
project_type: web_app
profile: tv-samsung
api_version: "6.0"
build_type: Release
output_name: FreestyleLauncher
output_path: "Release"
opt: false
signing_profile: "$certProfile"
trust_anchor: []
files: []
excludes: []
deps: []
"@ | Set-Content -Encoding ascii "$stage\tizen_web_project.yaml"

$tz = "$env:USERPROFILE\.tizen-extension-platform\server\sdktools\data\tools\tizen-core\tz.exe"
& $tz build -w $stage -s $certProfile
& $tz pack -w $stage
$wgt = Get-ChildItem $stage -Recurse -Filter *.wgt | Select-Object -First 1 -ExpandProperty FullName
& $tz install -p $wgt -e $device
```

The last line should report that the install completed. Then open **Apps** on the projector and start **Freestyle Launcher**.

### 6. Make it the homescreen

On the projector, open **Settings → General → Start Screen Options**. Turn **Autorun Last App** on and **Autorun Smart Hub** off. Leave the launcher open when you power off, and it comes back on the next boot.

### 7. Set it up

Press ↑ to reach the ✎ button at the top and press Enter to open **Customize**:

- **Themes:** pick a background. Some themes have options, such as the Window's room style and view, or the fireplace stone. Scene themes also have a **Dim room** slider, which darkens the room and leaves the video bright.
- **Apps:** pick up to 6 apps for the dock, in order. Select one in **Your dock** to move or remove it.
- **Preferences:** set your name and your city (press **Find**, or use the pin to detect it), 24-hour time and Reduce motion.

Your choices are saved on the projector and survive power cycles.

## Using it

| Remote button | What it does |
|---|---|
| ← → | Move along the dock or the top-bar buttons |
| ↑ / ↓ | Move between the dock and the top bar (✎ Customize, Wi-Fi, Settings) |
| Enter | Launch the app, or open the selected button |
| Back | Close an overlay. On the main screen it does nothing, so the launcher never exits. |

## Make your own version

To change the design, fork this repo and host your own copy:

1. **Turn on GitHub Pages.** The repo must be public, because Pages is free only for public repos. Go to **Settings → Pages** and set **Source: GitHub Actions**. The `Deploy to GitHub Pages` workflow runs the tests and publishes `app/` on every push to `main`.
2. **Point the shell at your site.** In `shell/shell.js`, change `PAGES` and the GitHub entry in `allowedOrigins` to your Pages address. In `shell/config.xml`, change the widget `id` to match.
3. Reinstall the shell (step 5).

### Run it locally

```bash
python3 -m http.server -d app 8080
```

On Windows, use `python` instead of `python3`. Then open <http://localhost:8080> and use the keyboard like the remote: arrow keys, Enter, and Esc for Back.

### Tests

```bash
npm test
```

The tests use Node's built-in test runner (Node 18 or newer) and need no dependencies.

The design is described in [`docs/superpowers/specs/2026-10-17-freestyle-launcher-design.md`](docs/superpowers/specs/2026-10-17-freestyle-launcher-design.md) and, for themes, [`docs/superpowers/specs/2026-10-18-themes-design.md`](docs/superpowers/specs/2026-10-18-themes-design.md). Media credits are in [`app/media/CREDITS.md`](app/media/CREDITS.md).

## Troubleshooting

- **Developer Mode won't open.** Typing `12345` needs number keys. Use the SmartThings app's number pad or a Bluetooth keyboard.
- **Device Manager can't connect.** The PC and projector must be on the same network, and Developer Mode's Host PC IP must be your PC's current IP. If your PC's IP changed, enter the new one in Developer Mode and restart the projector.
- **The install fails with a signature or certificate error.** The certificate must be the **Samsung** type, include this projector's DUID, and be the active profile.
- **The launcher stopped opening, after about a year or after a firmware update.** The certificate has expired. Create a new one (step 4) and reinstall (step 5). Reinstalling removes the app first, so you'll need to set your dock, theme and city again.
- **An app doesn't launch.** Some apps can't be opened by ID. The launcher shows a "Couldn't open …" message. Apps that Tizen marks as hidden never appear in the picker.
- **No weather.** Set a city in ✎ → Preferences and press **Find**. Without internet, the last forecast is shown with its age ("updated 2h ago"). If nothing has been cached yet, the card is hidden.
- **A scene theme shows the Aurora colours instead.** Its pictures or videos couldn't load, usually because there's no internet. It comes back when they load, and your chosen theme is kept.
- **The animation stutters.** Turn on **Reduce motion** in Preferences, which also pauses scene videos on a still frame.
- **Offline mode shows a blank screen.** The offline copy loads ES modules from the widget's local files, and some Tizen versions block that. Online mode is unaffected. Please report it if this happens.
