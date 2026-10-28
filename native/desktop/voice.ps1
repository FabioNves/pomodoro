param([ValidateSet('voices', 'speak')][string]$Mode)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ($Mode -eq 'voices') {
    $names = @($speaker.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { $_.VoiceInfo.Name })
    ConvertTo-Json -InputObject $names -Compress
  } else {
    # Input is data on stdin, never interpolated into PowerShell source.
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($request.voice) { $speaker.SelectVoice([string]$request.voice) }
    $speaker.Rate = [int]$request.rate
    $speaker.Volume = [int]$request.volume
    $speaker.Speak([string]$request.text)
  }
} finally { $speaker.Dispose() }
