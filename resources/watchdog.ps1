$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path (Split-Path $scriptDir -Parent) -Parent
$appPath = Join-Path $appDir "My Pact for My Future.exe"

if (-not (Get-Process -Name "My Pact for My Future" -ErrorAction SilentlyContinue)) {
    if (Test-Path $appPath) {
        Start-Process -FilePath $appPath
    }
}
