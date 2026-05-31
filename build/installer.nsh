!include "LogicLib.nsh"

; Pact 앱 NSIS 커스텀 매크로
; 설치 시: 관리자 권한 Scheduled Task 등록 + 보호된 admin-secret 초기화
; 제거 시: customUnInit에서 PIN 검증 (틀리면 Abort) → customUnInstall에서 정리

!macro customInstall
  ; 설치/업데이트 중 기존 watchdog이 앱을 다시 띄워 app.asar 제거를 막지 않도록 먼저 정지
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MyPact"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPact"
  ExecWait 'schtasks /delete /tn "MyPact" /f'
  ExecWait 'taskkill /F /IM "My Pact.exe" /T'
  ExecWait 'taskkill /F /IM "My Pact for My Future.exe" /T'
  ExecWait 'taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq MyPactWatchdog" /T'
  ExecWait `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq 'powershell.exe' -or $$_.Name -eq 'wscript.exe') -and ($$_.CommandLine -like '*watch-loop.ps1*' -or $$_.CommandLine -like '*start-watch-loop.vbs*') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"`
  ; 기존 레지스트리 자동 실행 항목 정리
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pact"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "나의 약속"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "My Pact for My Future"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MyPact"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPactForMyFuture"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPact"
  ExecWait 'schtasks /delete /tn "MyPactForMyFuture" /f'
  ExecWait 'schtasks /delete /tn "PactWatchdog" /f'
  ; HKLM\Run: 모든 사용자 로그온 시 각자 세션에서 watchdog을 띄워 앱을 시작/재시작
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPact" 'wscript.exe //B //Nologo "$INSTDIR\resources\resources\start-watch-loop.vbs"'
  ; Scheduled Task: 관리자 세션용 HIGHEST watchdog 보조
  ExecWait 'schtasks /create /tn "MyPact" /tr "wscript.exe //B //Nologo \"$INSTDIR\resources\resources\start-watch-loop.vbs\"" /sc onlogon /rl HIGHEST /delay 0000:10 /f'
  ExecWait `cmd.exe /c mkdir C:\ProgramData\MyPact C:\ProgramData\MyPact\Admin C:\ProgramData\MyPact\Data 2>nul`
  Delete "C:\ProgramData\MyPact\watchdog-disabled.flag"
  Delete "C:\ProgramData\MyPact\Admin\watchdog-disabled.flag"
  ExecWait `icacls.exe C:\ProgramData\MyPact /inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F *S-1-5-32-545:(OI)(CI)M /C`
  ExecWait `icacls.exe C:\ProgramData\MyPact\settings*.json /inheritance:e /grant:r *S-1-5-18:F *S-1-5-32-544:F *S-1-5-32-545:M /C`
  ExecWait `icacls.exe C:\ProgramData\MyPact\Admin /inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F *S-1-5-32-545:(OI)(CI)RX /T /C`
  ExecWait `icacls.exe C:\ProgramData\MyPact\Data /inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F *S-1-5-32-545:(OI)(CI)M /T /C`
  ExecWait `icacls.exe C:\ProgramData\MyPact\Data\*.json /inheritance:e /grant:r *S-1-5-18:F *S-1-5-32-544:F *S-1-5-32-545:M /C`
  ExecWait `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$p='C:\ProgramData\MyPact\Admin\admin-secret.json'; if (!(Test-Path -LiteralPath $$p)) { [IO.File]::WriteAllBytes($$p, [Convert]::FromBase64String('eyJhZG1pblBhc3N3b3JkSGFzaCI6IjlhZjE1YjMzNmU2YTk2MTk5Mjg1MzdkZjMwYjJlNmEyMzc2NTY5ZmNmOWQ3ZTc3M2VjY2VkZTY1NjA2NTI5YTAifQ==')) }"`
  ExecWait `icacls.exe C:\ProgramData\MyPact\Admin\admin-secret.json /inheritance:r /grant:r *S-1-5-18:F *S-1-5-32-544:F *S-1-5-32-545:R /C`
!macroend

; 제거 시작 전 PIN 검증 — electron-builder un.onInit 내부에서 customUnInit 호출됨
; 여기서 Abort하면 파일 삭제 전에 완전 취소됨
!macro customUnInit
  ; 보호된 C:\ProgramData\MyPact\Admin\admin-secret.json의 SHA-256 해시와 입력 PIN을 비교한다.
  ; PIN 원문은 레지스트리에 저장하지 않는다.
  GetTempFileName $R0
  Rename $R0 "$R0.ps1"
  StrCpy $R0 "$R0.ps1"

  FileOpen $R1 $R0 w
  FileWrite $R1 'Add-Type -AssemblyName Microsoft.VisualBasic$\r$\n'
  FileWrite $R1 '$$pin=[Microsoft.VisualBasic.Interaction]::InputBox("Enter admin PIN to uninstall My Pact.","My Pact - Uninstall","")$\r$\n'
  FileWrite $R1 '$$root=[Environment]::GetFolderPath("CommonApplicationData")$\r$\n'
  FileWrite $R1 '$$secret=Join-Path $$root "MyPact\Admin\admin-secret.json"$\r$\n'
  FileWrite $R1 'if (!(Test-Path -LiteralPath $$secret)) { exit 2 }$\r$\n'
  FileWrite $R1 '$$expected=(Get-Content -LiteralPath $$secret -Raw | ConvertFrom-Json).adminPasswordHash$\r$\n'
  FileWrite $R1 'if (!($$expected -match "^[0-9a-f]{64}$$")) { exit 3 }$\r$\n'
  FileWrite $R1 '$$sha=[System.Security.Cryptography.SHA256]::Create()$\r$\n'
  FileWrite $R1 '$$bytes=[Text.Encoding]::UTF8.GetBytes($$pin)$\r$\n'
  FileWrite $R1 '$$actual=($$sha.ComputeHash($$bytes) | ForEach-Object { $$_.ToString("x2") }) -join ""$\r$\n'
  FileWrite $R1 'if ($$actual -ne $$expected) { exit 4 }$\r$\n'
  FileClose $R1

  nsExec::ExecToStack '"powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$R0"'
  Pop $R3  ; exit code
  Pop $R4  ; stdout
  Delete $R0

  ${If} $R3 != 0
    MessageBox MB_OK|MB_ICONSTOP "PIN verification failed. Uninstall cancelled."
    Abort
  ${EndIf}
  FileOpen $R1 "C:\ProgramData\MyPact\Admin\watchdog-disabled.flag" w
  FileWrite $R1 'uninstall'
  FileClose $R1
  ExecWait 'schtasks /delete /tn "MyPact" /f'
  ExecWait 'taskkill /F /IM "My Pact.exe" /T'
  ExecWait 'taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq MyPactWatchdog" /T'
  ExecWait `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq 'powershell.exe' -or $$_.Name -eq 'wscript.exe') -and ($$_.CommandLine -like '*watch-loop.ps1*' -or $$_.CommandLine -like '*start-watch-loop.vbs*') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"`
!macroend

!macro customUnInstall
  ExecWait 'schtasks /delete /tn "MyPact" /f'
  ExecWait 'schtasks /delete /tn "MyPactForMyFuture" /f'
  ExecWait 'schtasks /delete /tn "PactWatchdog" /f'
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPact"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPactForMyFuture"
  ExecWait 'taskkill /F /IM "My Pact.exe" /T'
  ExecWait 'taskkill /F /IM "My Pact for My Future.exe" /T'
  ExecWait 'taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq MyPactWatchdog" /T'
  ExecWait `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq 'powershell.exe' -or $$_.Name -eq 'wscript.exe') -and ($$_.CommandLine -like '*watch-loop.ps1*' -or $$_.CommandLine -like '*start-watch-loop.vbs*') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"`
  DeleteRegKey HKLM "Software\MyPact"
!macroend
