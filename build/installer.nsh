!macro customInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Set up VB-CABLE for Discord audio routing?$\r$\n$\r$\nThis opens the official download page. Download and extract the driver, then choose Audio routing guide in Waveform to launch its verified installer. Windows administrator approval may be required." IDNO waveform_cable_skip
  ExecShell "open" "https://vb-audio.com/Cable/"
  waveform_cable_skip:
!macroend
