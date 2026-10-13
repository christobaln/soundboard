# Waveform 0.3.1: desktop import storage fix

Quit Waveform completely from the tray menu, run Waveform.Setup.0.3.1.exe,
and launch the desktop shortcut. Check that the bottom of the sidebar says
Waveform 0.3.1. Node.js is not needed.

Version 0.3.0 added bundled MP3 decoding, but opening the existing Chromium
library database could still reject every import with the bare “Internal
error” message. This update moves desktop audio and metadata storage to
ordinary files in the app profile's sound-library folder. It does not require
IndexedDB to save new sounds.

Readable legacy sounds are copied without deleting their original database.
If that database cannot open, the app explains the problem and retains its
files; existing unreadable sounds cannot be claimed recovered. New imports
continue through desktop storage. Library edits/deletions use atomic metadata
writes, and errors identify decoding, preparing audio, or filesystem failures.
The running app version is visible in the sidebar.

Validation forces IndexedDB.open to return UnknownError/Internal error, then
imports and plays a real MP3 through the desktop library, verifies restart
persistence, and checks migration preserves original data and does not restore
deleted clips. Unit tests cover byte persistence, updates/deletion, path
validation and disk errors; existing browser audio and settings tests remain.
Physical Discord/VB-CABLE routing requires the user's computer.

Myinstants and the default adjustable 15-second online clip limit are retained.
The installer is unsigned. SHA256SUMS.txt covers the installer and ZIP.
