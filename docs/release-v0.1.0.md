Waveform is a desktop soundboard for Windows 10/11 with saved clips, global shortcuts, microphone mixing, voice filters, and a Spotify-inspired interface.

Download **Waveform Setup 0.1.0.exe** for the installer, or extract the entire **Waveform-0.1.0-win.zip** and launch **Waveform.exe**. The builds are unsigned. SHA256SUMS.txt contains checksums for both downloads.

For Discord routing, install VB-CABLE separately from its official provider. The installer offers the official download page, and the app's Audio routing guide can validate and launch an extracted VB-CABLE installer. Set Waveform output to CABLE Input and Discord input to CABLE Output. Administrator approval and a restart may be required for the driver.

This is an initial prerelease. Cloud tests verified clip/library behavior and native background shortcuts on X11. Windows desktop smoke tests and packaging run in this release workflow; physical microphone routing, fullscreen games, and Discord bot reception need testing on the target PC. Voice effects are filters, distortion, and echo; they are not AI voice conversion.
