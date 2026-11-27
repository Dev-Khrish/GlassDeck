# GlassDeck

GlassDeck is a Windows dashboard editor and a landscape Android display. Windows holds the layout and publishes live updates. Each display scales the whole canvas to fit its screen and keeps the same widget geometry. A screen with a different aspect ratio can show bars outside the canvas.

## Open and pair

1. Open `Windows/GlassDeck.exe` from the GlassDeck package. Keep its companion files in that folder.
2. Install `GlassDeck Display.apk` on Android. The APK requires Android 7 or later and uses a local development signature.
3. With both devices on the same local network, select **Pair tablet** in Windows. Enter the address and six-digit code shown there into the Android app. If Windows presents a firewall prompt, allow access on your private network for the tablet to connect.
4. Swipe the Android canvas, or tap its page buttons. Android Back returns to pairing. Pair again after restarting the Windows host.

**Open display** opens a Windows display window on the secondary monitor when available, including a spacedesk extended display. Press F11 to toggle fullscreen.

For USB with Android debugging already enabled, run `adb reverse tcp:38141 tcp:38141`, then use `127.0.0.1:38141` in the Android app. If the pairing dialog lists a different port, use that port on both sides.

## Edit the dashboard

- Drag from a widget header. Resize from its bottom-right handle. Nearby widgets move into available space or shrink to make room for a resize.
- Hover over or select a widget to reveal its minimize and remove controls. A minimized card stays on the page with a restore control.
- **Auto arrange** refits the page. **New page** adds a page that the viewer can swipe to. The editor stores layouts, notes, and wallpapers under its Windows app data.
- The initial 1280 × 800 canvas uses an 18-unit gap. Set the gap or use the 1280 × 720 canvas from the sidebar. Physical spacing varies as the canvas scales.
- Windows CPU and RAM, the clock, the focus timer, and notes work. Weather, the mixer, media, and shortcuts are interactive previews for future integrations.

## Source

`windows/main.cjs` opens the Electron editor and local display. `server.cjs` owns the layout, pairing and telemetry. `layout.cjs` defines the allowed canvas shapes and widget catalog. `web/` renders the shared dashboard. `android/` packages the native pairing screen and fullscreen WebView.

To run from source, use the Windows x64 Electron 45.5.0 runtime and point it at this folder. `npm run check` checks the JavaScript entry points. To rebuild Android, run `android/build.ps1` in PowerShell 7 with `SdkPlatform` set to the Android SDK 35 platform directory, `BuildTools` to Android Build Tools 35.0.0, and `JavaBin` to a JDK bin directory. Pass a build directory and an output APK path. Retain the generated signing key and password in the build directory for future local APK upgrades.

The bundled `web/assets/alpine-dusk.png` is original wallpaper generated with the built-in image generation tool. The prompt was:

> Use case: photorealistic-natural. Create an original 16:10 wallpaper photograph for a Windows and tablet frosted-glass dashboard. Aerial view deep blue alpine lake and distant layered mountains at violet dusk, with a broad curving coast entering from the lower left, indigo shadows around the outside, a restrained sheet of cyan light reflected through the right-hand side, muted lilac in the high clouds and a small warm rosy glow near the horizon. Real atmospheric haze, photographic depth and natural texture. Large quiet color fields so white labels remain readable over translucent panels. Full bleed landscape, cinematic, cool-toned and atmospheric. Wallpaper only. No letters, UI, frames, logos, stars shaped like graphic icons, or watermark.
