$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appPath = Join-Path (Split-Path $scriptDir -Parent) "My Pact for My Future.exe"

if (-not (Get-Process -Name "My Pact for My Future" -ErrorAction SilentlyContinue)) {
    if (Test-Path $appPath) {
        Start-Process -FilePath $appPath
    }
}
