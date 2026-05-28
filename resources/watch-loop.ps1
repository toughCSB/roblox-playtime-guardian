$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path (Split-Path $scriptDir -Parent) -Parent
$appPath = Join-Path $appDir "My Pact for My Future.exe"
$appName = "My Pact for My Future"

while ($true) {
    Start-Sleep -Seconds 30
    if (-not (Get-Process -Name $appName -ErrorAction SilentlyContinue)) {
        if (Test-Path $appPath) {
            Start-Process -FilePath $appPath
        }
    }
}
