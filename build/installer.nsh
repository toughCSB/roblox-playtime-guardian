!include "LogicLib.nsh"

; Pact 앱 NSIS 커스텀 매크로
; 설치 시: 관리자 권한 Scheduled Task 등록 + 제거 PIN 레지스트리 기록
; 제거 시: customUnInit에서 PIN 검증 (틀리면 Abort) → customUnInstall에서 정리

!macro customInstall
  ; 기존 레지스트리 자동 실행 항목 정리
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pact"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "나의 약속"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "My Pact for My Future"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPactForMyFuture"
  ; HKLM\Run: 모든 사용자 로그온 시 각자 세션에서 자동 시작 (자녀 표준 계정 포함)
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPactForMyFuture" '"$INSTDIR\My Pact for My Future.exe"'
  ; Scheduled Task: admin 세션용 HIGHEST 권한 자동 시작 (병행 유지)
  ExecWait 'schtasks /create /tn "MyPactForMyFuture" /tr "\"$INSTDIR\My Pact for My Future.exe\"" /sc onlogon /rl HIGHEST /delay 0000:30 /f'
  ; 초기 제거 PIN 레지스트리 기록 (기본값: 0000)
  WriteRegStr HKLM "Software\MyPact" "UninstallPin" "0000"
!macroend

; 제거 시작 전 PIN 검증 — electron-builder un.onInit 내부에서 customUnInit 호출됨
; 여기서 Abort하면 파일 삭제 전에 완전 취소됨
!macro customUnInit
  ReadRegStr $R5 HKLM "Software\MyPact" "UninstallPin"
  ${If} $R5 != ""
    ; 임시 PowerShell 스크립트 생성 (VB InputBox로 PIN 입력창 표시)
    GetTempFileName $R0
    Rename $R0 "$R0.ps1"
    StrCpy $R0 "$R0.ps1"

    FileOpen $R1 $R0 w
    FileWrite $R1 'Add-Type -AssemblyName Microsoft.VisualBasic$\r$\n'
    FileWrite $R1 '$$p=[Microsoft.VisualBasic.Interaction]::InputBox("Enter admin PIN to uninstall Pact.","Pact - Uninstall","");Write-Host $$p -NoNewline'
    FileClose $R1

    nsExec::ExecToStack '"powershell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File "$R0"'
    Pop $R3  ; exit code
    Pop $R4  ; stdout (입력된 PIN)
    Delete $R0

    ${If} $R3 != 0
      MessageBox MB_OK|MB_ICONSTOP "PIN verification failed. Uninstall cancelled."
      Abort
    ${EndIf}

    ${If} $R4 != $R5
      MessageBox MB_OK|MB_ICONSTOP "Wrong PIN. Uninstall cancelled."
      Abort
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ExecWait 'schtasks /delete /tn "MyPactForMyFuture" /f'
  ExecWait 'schtasks /delete /tn "PactWatchdog" /f'
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "MyPactForMyFuture"
  DeleteRegKey HKLM "Software\MyPact"
!macroend
