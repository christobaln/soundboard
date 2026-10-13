# Waveform 0.3.0 for Windows

Download **Waveform.Setup.0.3.0.exe**, close Waveform from its tray menu and run
the installer. Launch from the desktop shortcut. Node.js is not required.
Existing sounds and settings remain in the same app profile.

- Replaces the long Commons recordings with Myinstants, a community soundboard
  site opened inside the app. Search reaction/meme sounds and choose **Download
  MP3** on a sound page to add it automatically. This uses interactive browsing,
  not an unofficial API. Default online length is the first 15 seconds;
  select 5, 10, 15 or 30 seconds. Website previews mute at the chosen limit.
- MP3 decoding is bundled rather than dependent on the Windows codec. Imported
  clips are converted to WAV and saved as owned bytes. Errors now explain file,
  decoder or storage problems. Legacy clips remain readable.
- Original source-page credits remain available in the editor. Saved sounds
  work offline. Bundled decoder source and licenses are included.

Validation includes a real MP3 file import, restart/persistence and playback;
a regression where browser decoding throws “Internal error”; automatic import
through the real Electron download event with a deterministic provider fixture;
short online clip limits; and the existing audio, settings and shortcut checks.
Physical VB-CABLE/Discord routing and fullscreen-game hotkeys still require
checking on your PC. The installer is unsigned. Website availability and
community upload rights vary.

The ZIP is an alternative portable package; extract it before running
Waveform.exe. SHA256SUMS.txt contains checksums of both downloads.
