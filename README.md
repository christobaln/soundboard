# Waveform

A Spotify-inspired desktop soundboard for saved audio clips, microphone mixing, global shortcuts, and voice effects. Runs locally; no accounts or cloud uploads.

## Develop

Requires Node.js 22.12+ (validated here with Node 24) and npm.

```sh
npm ci
npm run build
npm start
```

`npm run dev` serves a browser preview. Browser shortcuts work only while focused; the Electron app registers operating-system shortcuts for background use. After changing renderer code, build again and restart the desktop app. `npm test` checks shortcut validation; `npm run test:ui` exercises library persistence, imports and playback in Chromium.

Windows runnable ZIP: `npm run package:win`. Extract the entire ZIP and launch `Waveform.exe`. Windows installer: `npm run package:installer` on Windows (or Linux with Wine). Other packages: `npm run package:mac` or `npm run package:linux`. Build on the matching OS; signing/notarization requires your own distribution credentials. Unsigned builds may trigger OS warnings. A Linux cloud build does not establish Windows/macOS audio or global-shortcut compatibility.

## Send sounds and voice into Discord

The default output plays through your system speakers/headphones. Sending that audio as a microphone requires a separately installed virtual audio cable; the app cannot automatically turn a speaker into a microphone or install a system audio driver.

### Windows

1. Install VB-CABLE from its official provider, https://vb-audio.com/Cable/ . Reboot if requested.
2. Keep headphones as your system default output.
3. In Waveform, refresh devices (grant microphone permission), choose your physical microphone, and choose **CABLE Input** as the mix output.
4. Enable **Send audio to selected output** and **Include microphone**.
5. In Discord Voice & Video, select **CABLE Output** as the input. Test with Discord’s microphone test. Noise suppression, input sensitivity and echo cancellation can suppress music/clips; adjust those Discord settings as needed.

macOS: use a supported virtual device such as BlackHole (https://existential.audio/blackhole/) and grant microphone permission. Linux: create a PipeWire/PulseAudio virtual sink and select its monitor source as Discord input. Exact names vary.

Discord bots can hear clips only if they join the voice channel and implement audio receiving. Waveform does not change bots or Discord permissions.

## Features

- Persistent desktop file library (IndexedDB in the browser preview); search, favorites and recent playback.
- Import audio files up to 50 MB / 10 minutes, validated with the audio decoder. Starter clips are generated locally.
- Per-clip volume, speed, looping, category, and modified global shortcuts.
- Global stop and mic-mute shortcuts. Shortcut registration failures are shown instead of silently ignored.
- Separate sound, microphone, monitor, and master gain; a routed-mix compressor limits peaks.
- Clean, radio, dark low-pass, and distorted voice filters; customizable echo, noise suppression.
- Accent color, compact cards, exclusive playback, and remembered device choices.

**Limits:** character presets are fan-inspired effects rather than cloned or official voices. Live microphone pitch shifting adds approximately 40–100 ms of processing delay. Clip speed also changes clip pitch. Microphone capture starts only after you enable it. The desktop app restores your enabled audio session on later launches; turn off “Restore audio session on launch” to require manual activation. Selected audio devices may disappear after unplugging or a driver change; the app disables routing when a saved device is missing. Global hotkeys depend on OS support and may conflict with games or elevated applications; Wayland may restrict them. Keep the app running during games. Hearing local clips and routing to the same physical output will duplicate them; select a virtual cable for routing. Audio files live in the app's local profile and are not synced; deleting that profile removes the library.

## Validation

Automated Chromium checks cover local library behavior and sound playback. Physical microphone capture, virtual cable routing, fullscreen-game shortcuts, and bot reception must be verified on the target computer. No driver, system-default change, signed installer, or end-to-end Discord test is implied by the cloud checks.

## Cloud development and desktop checks

The cloud machine is Linux; the Windows ZIP is built here but must be validated on your Windows computer with its real audio devices.

On this Debian 13 cloud image, `python scripts/cloud-xvfb.py` prepares a checksum-verified Xvfb binary in an ignored cache. Start `.cache/xvfb/usr/bin/Xvfb :97 -screen 0 1360x900x24 -nolisten tcp` if display `:97` is free. Then run:

```sh
DISPLAY=:97 ELECTRON_TEST_NO_SANDBOX=1 XDG_CACHE_HOME="$PWD/.cache" XDG_CONFIG_HOME=/tmp/waveform-electron-config npm run test:desktop
```

This test-only sandbox flag is necessary in the isolated cloud container; the application keeps renderer sandboxing enabled by default. The native X11 test hides the app window and injects global shortcuts, verifying that they play and stop a looping clip. Windows fullscreen games and virtual-cable routing remain separate device-level checks.

## Guided VB-CABLE setup on Windows

The soundboard installer offers to open the official VB-CABLE download page. Waveform's **Audio routing guide** also has **Download official VB-CABLE** and **Launch driver installer** buttons. Download and extract the official ZIP, then select `VBCABLE_Setup_x64.exe`. Waveform requires a valid Windows Authenticode signature identifying VB-Audio or Vincent Burel, shows the verified publisher, and launches the installer using Windows administrator approval. Complete that installer and reboot if requested, then refresh devices. Launching is not reported as a successful driver installation.

The driver is not redistributed in Waveform. Its redistribution terms could not be verified from this cloud environment because the vendor site denied access. This guided flow and the optional NSIS step require validation on Windows; the cloud ZIP build does not install a driver.

## Waveform 0.3.1

On Windows, run **Waveform Setup 0.3.1.exe** once, then double-click the Waveform desktop or Start-menu shortcut. Node.js is only needed for source development. Source users can also double-click **Start Waveform.cmd** after installing Node.js 24; it prepares and launches the source checkout.

**Find new sounds / Search online** opens Myinstants search in an isolated in-app browser. It is a community soundboard site, accessed interactively rather than through an unofficial API. Choose **Download MP3** on a sound page to import it automatically. Quick searches include vine boom, bruh, metal pipe, air horn and fart. Online clips use only the first 15 seconds by default; choose 5, 10, 15 or 30 seconds. Website previews are muted at the selected limit. Source-page credits remain in the editor; rights vary by upload. Saved clips work offline. Search/download requires `www.myinstants.com` and `myinstants.com`.

MP3 importing uses a bundled mpg123 WebAssembly decoder instead of depending on the system codec. Imports are converted to WAV and saved as owned bytes, avoiding persistent references to selected files. Local files are limited to 50 MB and the first 10 minutes; online downloads to 20 MB. Errors identify unreadable files, download pages, decoding or storage failures. The desktop app now saves audio and metadata as ordinary files in its profile’s `sound-library` folder. Readable legacy database clips are copied there without deleting the originals. If the old database cannot open, a message explains that existing files remain and new imports use desktop storage. Disk write failures report their cause. The running version appears at the bottom of the sidebar. Bundled decoder licenses, source and rebuilding instructions are included under `resources/licenses` and `resources/third-party-sources` in the installed application.

**Voice studio** includes fan-inspired Hulk, Venom, Lash, Rem, TF2 Heavy/Pyro, and GLaDOS presets, editable microphone pitch (-12 to +12 semitones), bass/body, distortion, and synthetic texture. These effects process your own voice; they do not reproduce the actors or use trained character models. Clean preserves pitch; the gate can operate on any preset. Echo remains independently adjustable.

**Settings** adds microphone, clip-bus and master boosts, a noise gate/threshold, requested microphone echo cancellation, library ordering, reduced motion, close-to-tray, start-minimized and login startup. Automatic login startup is enabled only for installed Windows/macOS builds. Quit explicitly from the tray when close-to-tray is enabled. Only one app instance can run for the same profile, preventing duplicate audio routing. Large boosts can introduce noise/distortion; echo cancellation cannot replace correct headphone routing.

The ICO includes 16, 32, 48, 64, 128 and 256 pixel artwork. `scripts/build-icons.cjs` regenerates it from the SVG using Chromium (set CHROMIUM_PATH if necessary).
