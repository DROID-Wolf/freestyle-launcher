# Themes for the Freestyle Launcher: Design

**Date:** 2026-10-18
**Status:** Draft for review
**Builds on:** `2026-10-17-freestyle-launcher-design.md` (the launcher as built and deployed)
**Visual drafts:** `.superpowers/brainstorm/themes-1792316207/content/` (concepts, window styles, other themes, Themes tab)

## 1. Goal

The user can switch the launcher between several visual themes in the Customize menu. Some themes use realistic, animated scenes, for example a window looking out on rain, or a crackling fireplace. Switching themes never changes the user's dock apps, name, city, weather or other preferences.

### Success criteria
- Customize has a **Themes** tab. Pressing Enter on a theme card applies that theme immediately, and the user can see it behind the menu.
- The launcher has six themes: **Aurora** (today's look, the default), **Window**, **Fireplace**, **Rainy café**, **Aquarium** and **Snowy cabin**.
- The Window theme has 7 styles and 4 views, including a **Live** view that follows the real weather and time of day.
- Scenes look realistic. They use real stock video, seen through realistic room pictures.
- The dock, the clock and weather, and remote navigation work the same way in every theme.
- If a video cannot load, or the launcher is offline, the theme degrades gracefully. The launcher never shows a blank or broken screen.

### What the user decided
| Topic | Decision |
|---|---|
| Theme depth | Layouts differ per theme, not only colours |
| Imagery | Free stock video loops (Pexels/Pixabay); room pictures generated with AI image generation; the user approves every asset before it is downloaded |
| Window styles | Desk, Loft, Train, Attic skylight, High-rise office, Sunroom, Covered porch. Pressing Enter on the selected style turns it off, which gives a full-screen view with the widgets on top |
| Window views | Live, Rainy city, Snowy forest, Beach |
| Fireplace | Stone or brick hearth, clock on the mantel |
| Rainy café | Window counter; the clock is shown on a chalkboard |
| Aquarium | Wall tank; the dock sits on the cabinet |
| Snowy cabin | Log walls; a snowy window on one side and a fireplace on the other |
| Architecture | Approach A: theme packs built on shared widgets |

## 2. Architecture (Approach A: theme packs on shared widgets)

The current widgets stay single elements with their current logic: the top bar, clock and date, daylight bar, weather card, ticker, dock, toast and overlays. A theme only adds two things:

1. **A scene.** The scene goes in a new `#scene` layer behind the widgets. It holds the room picture and the video layers.
2. **A theme style sheet.** This is scoped by a class on `.screen` (`.screen.theme-window`, and so on). It positions and restyles the shared widgets: the clock on the mantel, on the desk screen, or on the chalkboard.

Because the widgets are the same elements in every theme, the following need no per-theme code: `focus.js` navigation, `picker.js`, the dock, the bridge and weather fetching.

### 2.1 Theme registry (`app/js/themes.js`)

This module has no DOM access, so it can be unit-tested. It exports `THEMES`, a list of these records:

```
{
  id: 'window',                       // stable id, saved in prefs
  name: 'Window',
  thumb: 'media/thumbs/window.webp',  // card image in the Themes tab
  options: [                          // rows shown under the cards; [] = none
    { key: 'style', label: 'Style', allowNone: true, default: 'desk',
      values: [{ id: 'desk', label: 'Desk' }, { id: 'loft', label: 'Loft' }, ...] },
    { key: 'view', label: 'View', allowNone: false, default: 'live',
      values: [{ id: 'live', label: 'Live' }, { id: 'city-rain', label: 'Rainy city' }, ...] },
  ],
  scene(opts, ctx) -> { room: 'media/rooms/desk.webp' | null,
                        videos: [{ slot: 'view', clip: 'city-rain' }],
                        layout: 'desk' }       // becomes a CSS class for widget placement
}
```

`ctx` gives the theme the current weather and the time of day. Only the Window theme's Live view uses it.

The six themes and their options:

| Theme | Options | Scene |
|---|---|---|
| aurora | none | No room picture and no video. Keeps today's blobs (the current CSS moves into `themes/aurora.css`) |
| window | style: desk, loft, train, attic, highrise, sunroom, porch, or none · view: live, city-rain, snowy-forest, beach | The room picture for the chosen style, with the view video behind its window cut-out. With style = none, the view video is full-screen and the widgets use today's layout over a soft dark fade |
| fireplace | hearth: stone, brick | The hearth room picture, with the fire video in the firebox |
| cafe | none | The café-counter picture, with the city-rain video in the window |
| aquarium | none | The aquarium-cabinet picture, with the aquarium video in the tank |
| cabin | none | The log-cabin picture, with snowy-forest in the window and the fire in the hearth (two videos) |

### 2.2 Scene renderer (`app/js/scene.js`)

`applyTheme(themeId, opts, ctx)` resolves the theme and calls `scene()`. It then does the following:
- Preloads the room picture.
- Builds the `#scene` content. A room picture is an `<img>`. Each video is a `<video muted loop playsinline autoplay preload="auto">` in a slot positioned by the theme CSS. Each video has a `poster` set to the clip's still frame.
- Swaps the `theme-*` and `layout-*` classes on `.screen`.
- Is idempotent. Applying the same scene again does nothing, so a Live view does not restart its video.

Only `transform` and `opacity` are animated, which keeps the original spec's rule. Videos and pictures are not animated by CSS.

### 2.3 Live view (`liveView(weather, nowMin, riseMin, setMin)`, in `themes.js`)

This is a pure function that is unit-tested:

| Condition (from `weather.js` icon groups) | Clip |
|---|---|
| rain, storm (also drizzle and showers) | city-rain |
| snow | snowy-forest |
| night (before sunrise or after sunset), any other condition | city-night |
| day: clear, partly cloudy, cloudy, fog | beach |
| no weather data | city-night at night, beach by day |

`main.js` calls `liveView` again after every weather refresh (every 15 minutes) and at sunrise and sunset. It re-applies the scene only if the clip changes.

### 2.4 Preferences

`fl.prefs` gains two fields. `store.js` validates them:
- `theme`: a string. It must be an id in `THEMES`; otherwise the launcher uses `aurora`.
- `themeOptions`: an object keyed by theme id, for example `{ window: { style: 'desk', view: 'live' }, fireplace: { hearth: 'stone' } }`. Unknown keys and values are dropped and missing ones get their defaults. For an option with `allowNone`, `null` is valid.

The dock (`fl.dock`), name, city, latitude and longitude, `hour24`, `reduceMotion` and the weather cache are not touched by anything in this feature.

## 3. Customize → Themes tab

- The tabs are **Apps · Themes · Preferences**.
- **Cards row:** six theme cards, each a 16:9 still with the theme name. A ✓ marks the theme in use. Left and right arrows move between cards. **Enter applies the theme immediately.**
- **Option rows** under the cards, for the focused card's theme. Each row is a set of pills. Down moves into the rows, left and right move within a row, and Enter selects. When an option allows none, pressing Enter on the pill that is already selected clears it. Up moves back toward the cards and the tabs. The Done button closes the menu, as in the other tabs.
- While the Themes tab is open, the overlay background is see-through (about 60% opacity) instead of 95%, so the applied theme shows behind the menu.
- Every change saves immediately through the same `onChange` path the dock and preferences use. Back or Done closes the menu.
- The Window options are: Style (7 styles, which can be cleared) and View (4 views, one always selected, Live by default).

## 4. Media

### 4.1 Assets
**Videos.** These are stock clips from Pexels or Pixabay, free to use with no attribution required. Each is 1080p H.264 MP4, loops, and is about 10–25 MB. Each clip also gets a poster frame, a WebP still of about 100 KB.

| Clip id | Content | Used by |
|---|---|---|
| city-rain | Rain on glass, blurred city lights at night | Window (Rainy city, Live when raining), Café |
| city-night | Clear city at night | Window (Live, clear nights) |
| snowy-forest | Snow falling on pines | Window (Snowy forest, Live when snowing), Cabin |
| beach | Waves on a beach | Window (Beach, Live on clear days) |
| fire | A crackling fireplace | Fireplace, Cabin |
| aquarium | Fish in a planted tank | Aquarium |

**Room pictures (12).** These are AI-generated photographic stills at 1920×1080, saved as WebP with alpha. The window, hearth or tank area is cut out (transparent) so the video shows through. Each is about 200–400 KB. The rooms are: desk, loft, train, attic, highrise, sunroom, porch, hearth-stone, hearth-brick, cafe, aquarium, cabin. Every room also has a small layout box in its theme CSS. The box gives the cut-out rectangle (where the video slot goes) and where the clock, weather and dock go.

**Thumbnails (6).** These are small WebP stills for the Themes cards.

### 4.2 Sourcing workflow
1. Claude searches Pexels or Pixabay and shows 2–4 candidate clips per slot in the visual companion. The user picks one.
2. Before anything is downloaded, Claude lists the file name, source URL and size, and waits for the user's yes.
3. Room pictures are generated the same way: candidates first, the user picks, and then the window area is cut out with a small script.
4. The licence for each asset (Pexels License, Pixabay Content License, or AI-generated) is recorded in `app/media/CREDITS.md`.

### 4.3 Hosting
- Files live in `app/media/` in the repo. Each file must stay under GitHub's 100 MB limit, and the total is about 100–150 MB.
- `pages.yml` publishes `media/` once at the site root. It is excluded from the versioned `v/<build>/` copy, so each deploy does not copy all the media again.
- A tested `mediaUrl(path, location)` resolves media paths. On a versioned path (`…/v/<build>/`) it points two levels up to the shared `media/`. Elsewhere, for example in local development, it uses `media/` relative to the page.
- `scripts/build-fallback.mjs` excludes `media/`. The offline copy stays small.

## 5. Error handling and performance

| Situation | Behaviour |
|---|---|
| A video fails or is slow | The poster still shows (from the `poster` attribute). The launcher retries on the next theme apply. |
| The room picture or poster fails, or the scene is not ready within 8 s | The scene layer falls back to Aurora's background. The saved theme does not change. |
| Offline (the shell loaded the bundled fallback copy) | `media/` is not present, so the theme degrades to Aurora by the rule above. The saved choice is kept and comes back on the next online launch. |
| Reduce motion is on | Videos are paused on the poster frame, the same way the aurora blobs stop today. |
| Two videos at once (cabin) stutter on the device | The cabin's window slot shows the snowy-forest poster still instead of video. This is decided by the on-device test in step 1. |
| Saved theme or options are invalid | `store.js` validation falls back to Aurora and the default options. |
| Readability | Each theme's CSS gives the clock and weather enough contrast for its scene, using a shadow or a soft panel. |

## 6. Testing
- **Unit tests (`node --test`):**
  - The `THEMES` registry: ids are unique, every option has a valid default, and every video and room path used by `scene()` is in the asset list.
  - `liveView` covers every row of the table in §2.3.
  - Prefs validation for `theme` and `themeOptions`: unknown ids, bad values, `null` with and without `allowNone`.
  - `mediaUrl` on both a versioned path and a plain path.
- **Browser check:** every theme, every window style, every view, cleared style, the Themes tab with the keyboard, reduce motion, and a missing video.
- **On device, first (step 1):** play one real 1080p clip inside the launcher iframe, then two clips at once. Check that playback is smooth, the loop is seamless and the projector stays responsive. This step decides whether the cabin keeps two videos.

## 7. Out of scope (for now)
- Sound (fire crackle, rain).
- User-uploaded backgrounds.
- More themes or styles beyond those listed. The registry makes these easy to add later.
- Scheduling themes by time of day, other than the Window theme's Live view.

## 8. Risks
- **Video playback in the Tizen iframe** is unproven. It is checked first (§6).
- **AI-generated rooms** may need a few rounds to look photographic and to line up with a clean window area. The user picks from candidates.
- **Repo size** grows by about 150 MB because of the media. This is acceptable for GitHub and Pages. Git LFS is not used, because GitHub Pages doesn't serve LFS files.
