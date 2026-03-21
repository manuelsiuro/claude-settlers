# Build Guide

This document explains how to build Feudal Realm Manager for every supported platform.

## Prerequisites (All Platforms)

- **Node.js** >= 18
- **npm** >= 9

Install dependencies once:

```bash
npm install
```

## Quick Reference

| Platform | Dev Command | Build Command | Output |
|----------|-------------|---------------|--------|
| Web | `npm run dev` | `npm run build` | `dist/` |
| Android | `npm run cap:run:android` | See [Release APK](#release-apk-google-play) | `.apk` / `.aab` |
| iOS | `npm run cap:ios` | Xcode Archive | `.ipa` |
| macOS | `npm run tauri:dev` | `npm run tauri:build` | `.dmg` |
| Windows | `npm run tauri:dev` | `npm run tauri:build` | `.msi` |
| Linux | `npm run tauri:dev` | `npm run tauri:build` | `.deb` / `.AppImage` |

---

## Web (PWA)

The default target. Produces a static site with offline support via Workbox service worker.

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`. Hot-reloads on file changes. A QR code on the setup screen links to your local network IP for testing on mobile devices.

### Production Build

```bash
npm run build
```

Output goes to `dist/`. The build includes:

- TypeScript compilation (`tsc`)
- Vite bundling with Tailwind CSS
- Workbox service worker generation (precaches all JS, CSS, HTML, PNG, SVG, GLB, and JSON assets)

### Preview Production Build Locally

```bash
npm run preview
```

Serves the `dist/` folder at `http://localhost:4173`. Use Chrome DevTools > Application > Service Workers to verify offline caching works.

### Deploying

Upload the contents of `dist/` to any static hosting (Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.). No server-side code is required.

---

## Android

Uses [Capacitor v8](https://capacitorjs.com/) to wrap the web app in a native Android WebView.

### Prerequisites

- **Android Studio** (latest stable)
- **Android SDK** (API 24+ for minimum, API 34+ recommended)
- **Java 17** (bundled with Android Studio)
- A physical device or Android Emulator

### First-Time Setup

The `android/` directory is already generated. After a fresh clone, sync it:

```bash
npm run cap:sync
```

### Development (Emulator or USB Device)

```bash
npm run cap:run:android
```

This builds the web app, syncs it into the Android project, and launches it on a connected device or running emulator. Use `chrome://inspect` in desktop Chrome to attach remote DevTools to the WebView for debugging.

### Building from Android Studio

You can do all compilation, running, and signing directly from Android Studio. The only CLI step is syncing the web assets first:

```bash
npm run cap:sync
```

Then open the project (one-time — or use `npx cap open android`):

```bash
npm run cap:android
```

From Android Studio:

- **Run on device/emulator** — click the green **Run** button (Shift+F10), select your target
- **Debug APK** — Build > Build Bundle(s) / APK(s) > Build APK(s)
- **Release AAB/APK** — Build > Generate Signed Bundle / APK, then follow the wizard to pick your keystore, build type (release), and output format (AAB for Google Play, APK for sideloading)
- **Profile** — use the built-in Profiler (CPU, memory, GPU) to check performance on-device
- **Logcat** — filter by the app package to see WebView console output and crash logs

> **Important:** Android Studio only compiles the native wrapper. If you change any game code (TypeScript, CSS, assets), you must re-run `npm run cap:sync` to copy the new `dist/` into the Android project before building again.

### Release APK (Google Play)

1. **Generate a signing keystore** (one-time):

   ```bash
   keytool -genkey -v -keystore feudal-release.keystore -alias feudal \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   Store the keystore file and passwords securely. Never commit them to git.

2. **Configure signing** in `android/app/build.gradle`. Add inside the `android` block:

   ```groovy
   signingConfigs {
       release {
           storeFile file('../../feudal-release.keystore')
           storePassword System.getenv('KEYSTORE_PASSWORD')
           keyAlias 'feudal'
           keyPassword System.getenv('KEY_PASSWORD')
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           minifyEnabled false
           proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
   }
   ```

3. **Disable debug WebView** for release. In `capacitor.config.ts`, make sure `webContentsDebuggingEnabled` is **not** set (defaults to false in release builds).

4. **Build the release AAB** (Android App Bundle, required by Google Play):

   ```bash
   npm run build
   npx cap sync android
   cd android
   ./gradlew bundleRelease
   ```

   The AAB file will be at `android/app/build/outputs/bundle/release/app-release.aab`.

5. **Or build a release APK** (for sideloading or alternative stores):

   ```bash
   cd android
   ./gradlew assembleRelease
   ```

   The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

### App Icons and Splash Screen

To regenerate icons from a source image:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#1a1a2e' --splashBackgroundColor '#1a1a2e'
```

Place your source files in an `assets/` directory:
- `assets/icon-only.png` — 1024x1024 transparent icon
- `assets/icon-foreground.png` — 1024x1024 adaptive icon foreground
- `assets/icon-background.png` — 1024x1024 adaptive icon background
- `assets/splash.png` — 2732x2732 splash image

### Testing Checklist

After building, verify on a real device:

- [ ] Three.js renderer initializes (no black screen)
- [ ] GLTF models load (terrain, buildings visible)
- [ ] Touch input works (pan, zoom, tap to select)
- [ ] localStorage save/load works
- [ ] Post-processing renders correctly
- [ ] Acceptable FPS (30+ on mid-range devices)
- [ ] Back button closes panels instead of exiting
- [ ] App resumes correctly after backgrounding (WebGL context restore)

---

## iOS

Uses Capacitor v8, same as Android. Requires a Mac with Xcode.

### Prerequisites

- **macOS** (latest or one version back)
- **Xcode** (latest stable from the Mac App Store)
- **CocoaPods** (`sudo gem install cocoapods`) — Capacitor uses it for iOS plugin dependencies
- An Apple Developer account (free for device testing, paid for App Store distribution)

### First-Time Setup

After a fresh clone:

```bash
npm run cap:sync
cd ios/App
pod install
```

### Development

```bash
npm run cap:ios
```

Builds the web app, syncs it, and opens the Xcode project. From Xcode:

1. Select your target device or simulator
2. Click Run (Cmd+R)

### Release Build (App Store)

1. In Xcode, select the **App** target > **Signing & Capabilities**
2. Set your Team and Bundle Identifier (`com.feudalrealm.manager`)
3. Select **Product > Archive**
4. In the Organizer window, click **Distribute App** and follow the App Store Connect flow

### Notes

- iOS safe area insets are already handled in `src/ui/styles.css`
- Apple PWA meta tags are already in `index.html`
- WKWebView (used by Capacitor on iOS) fully supports WebGL 2.0

---

## Desktop (macOS, Windows, Linux)

Uses [Tauri v2](https://v2.tauri.app/) to create native desktop apps with the OS webview. Produces small binaries (~12-15 MB) with no bundled browser engine.

### Prerequisites

All platforms need the **Rust toolchain**:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then restart your terminal and verify:

```bash
rustc --version
cargo --version
```

#### macOS Additional Requirements

```bash
xcode-select --install
```

#### Windows Additional Requirements

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" workload
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10 21H2+ and Windows 11)

#### Linux Additional Requirements (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Development

```bash
npm run tauri:dev
```

Opens a native window with hot-reloading. The Vite dev server runs in the background and the Tauri window loads from `http://localhost:5173`.

### Production Build

```bash
npm run tauri:build
```

This runs `npm run build` first (configured in `tauri.conf.json`), then compiles the Rust wrapper. Output varies by platform:

| Platform | Output Location | Format |
|----------|----------------|--------|
| macOS | `src-tauri/target/release/bundle/dmg/` | `.dmg` |
| macOS | `src-tauri/target/release/bundle/macos/` | `.app` |
| Windows | `src-tauri/target/release/bundle/msi/` | `.msi` |
| Windows | `src-tauri/target/release/bundle/nsis/` | `.exe` installer |
| Linux | `src-tauri/target/release/bundle/deb/` | `.deb` |
| Linux | `src-tauri/target/release/bundle/appimage/` | `.AppImage` |

### Desktop Icons

To generate platform-specific icons from the existing 512x512 PNG:

```bash
npx tauri icon public/icons/icon-512.png
```

This creates all required sizes in `src-tauri/icons/` (ICO, ICNS, and multiple PNG sizes).

### Cross-Platform CI (GitHub Actions)

Add `.github/workflows/release.yml` to automate builds for all platforms:

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    permissions:
      contents: write
    strategy:
      matrix:
        include:
          - platform: macos-latest
            args: ''
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - run: npm install
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'Feudal Realm Manager v__VERSION__'
          releaseBody: 'See the assets below to download for your platform.'
          releaseDraft: true
```

Tag a release to trigger:

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Verification (All Platforms)

After any build, run the standard checks:

```bash
npm run build   # TypeScript + Vite
npm run lint    # ESLint
npm run test    # Vitest (745 tests)
```

For visual verification on the web target, use Chrome DevTools MCP `take_screenshot`.

---

## Project Structure

```
├── capacitor.config.ts      # Capacitor config (Android/iOS)
├── src-tauri/
│   ├── tauri.conf.json       # Tauri config (Desktop)
│   ├── Cargo.toml            # Rust dependencies
│   ├── build.rs              # Tauri build script
│   ├── icons/                # Desktop app icons (generated)
│   └── src/
│       ├── main.rs           # Desktop entry point
│       └── lib.rs            # Tauri app builder
├── android/                  # Android Studio project (generated, gitignored)
├── ios/                      # Xcode project (generated, gitignored)
├── dist/                     # Web build output (gitignored)
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Legacy SW stub (overridden by Workbox in build)
│   └── icons/                # PWA icons
└── vite.config.ts            # Vite + Tailwind + PWA plugin config
```

---

## Troubleshooting

### Android: Black screen on launch

The WebGL context may fail to initialize. Check `chrome://inspect` for errors. Common fixes:
- Ensure the device supports WebGL 2.0 (most devices from 2018+)
- Lower graphics settings: disable post-processing and shadows in the Settings menu

### Android: App crashes when resuming from background

The WebGL context is lost when Android reclaims GPU memory. The app handles this automatically — `webglcontextlost` pauses rendering and `webglcontextrestored` reinitializes the environment. If crashes persist, check logcat for the specific error.

### Tauri: "rustc not found"

Install the Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### Tauri: CSP errors in console

The `tauri.conf.json` CSP includes `'unsafe-inline'` for the theme initialization script in `index.html`. If you add external scripts or fonts, update the CSP in `app.security.csp`.

### PWA: Assets not cached offline

Check that the file type is included in `vite.config.ts` `globPatterns`. Files over 10 MB are skipped — increase `maximumFileSizeToCacheInBytes` if needed.

### iOS: CocoaPods errors

Run `cd ios/App && pod install --repo-update` to refresh the pod spec repos.

### Capacitor: "Could not find the android/ios platform"

Run `npx cap add android` or `npx cap add ios` to regenerate the native project. Then `npx cap sync`.
