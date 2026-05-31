$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path (Split-Path $scriptDir -Parent) -Parent
$appPath = Join-Path $appDir "My Pact.exe"
$appName = "My Pact"
$sessionId = (Get-Process -Id $PID).SessionId
$lockPath = Join-Path $env:TEMP "MyPactWatchdog-$sessionId.lock"
$disabledPath = Join-Path $env:ProgramData "MyPact\Admin\watchdog-disabled.flag"
$lockStream = $null

if (Test-Path $disabledPath) {
    exit 0
}

try {
    $lockStream = [System.IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
} catch {
    exit 0
}

function Ensure-MyPactRunning {
    if (Test-Path $disabledPath) {
        exit 0
    }
    $runningInThisSession = Get-Process -Name $appName -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $sessionId }
    if (-not $runningInThisSession) {
        if (Test-Path $appPath) {
            Start-Process -FilePath $appPath -ArgumentList "--from-watchdog --start-hidden"
        }
    }
}

Ensure-MyPactRunning

while ($true) {
    Start-Sleep -Seconds 3
    if (Test-Path $disabledPath) {
        exit 0
    }
    Ensure-MyPactRunning
}
