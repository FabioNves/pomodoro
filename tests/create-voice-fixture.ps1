$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $destination = Join-Path $PSScriptRoot '../native/desktop/voice-assets/smoke.wav'
  $speaker.SetOutputToWaveFile([System.IO.Path]::GetFullPath($destination))
  $speaker.Speak('Open settings.')
} finally { $speaker.Dispose() }
