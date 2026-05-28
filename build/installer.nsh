!include "LogicLib.nsh"

; Pact 앱 NSIS 커스텀 매크로
; 설치 시: 관리자 권한 Scheduled Task 등록 + 제거 PIN 레지스트리 기록
; 제거 시: un.onInit에서 PIN 검증 (틀리면 Abort) → customUnInstall에서 정리

!macro customInstall
  ; 기존 레지스트리 자동 실행 항목 제거 (Scheduled Task로 대체)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pact"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "나의 약속"
  ; 로그온 시 HIGHEST 권한으로 앱 실행 (표준 사용자가 작업 관리자로 종료 불가)
  ExecWait 'schtasks /create /tn "MyPactForMyFuture" /tr "\"$INSTDIR\나의 약속.exe\"" /sc onlogon /rl HIGHEST /delay 0000:30 /f'
  ; 초기 제거 PIN 레지스트리 기록 (기본값: 0000)
  WriteRegStr HKLM "Software\MyPact" "UninstallPin" "0000"
!macroend

; 제거 시작 전 PIN 검증 — 여기서 Abort하면 파일 삭제 전에 완전 취소됨
Function un.onInit
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
FunctionEnd

!macro customUnInstall
  ExecWait 'schtasks /delete /tn "MyPactForMyFuture" /f'
  DeleteRegKey HKLM "Software\MyPact"
!macroend
