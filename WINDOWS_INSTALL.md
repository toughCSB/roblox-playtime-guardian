# Windows 설치 안내

## ⚠️ SmartScreen 경고가 나올 수 있습니다

현재 GitHub Release에 올라간 Windows 설치 파일은 코드 서명(Code Signing) 인증서가 적용되지 않은 unsigned 설치본입니다. Windows Defender SmartScreen 또는 Smart App Control이 "인식되지 않는 앱"으로 판단해 설치나 실행을 막을 수 있습니다.

이 경고는 앱 기능 오류가 아니라 Windows 보안 정책에 따른 경고입니다. 소스 코드는 이 저장소에서 직접 확인할 수 있습니다.

Release 페이지:
https://github.com/toughCSB/roblox-playtime-guardian/releases

## 설치 방법

### 1. 설치 파일 실행

GitHub Release에서 `My Pact Setup 0.60.6.exe` 파일을 다운로드한 뒤 실행합니다.

아래와 같은 화면이 나올 수 있습니다.

```text
Windows에서 PC를 보호했습니다
Microsoft Defender SmartScreen에서 인식되지 않는 앱의 시작을 막았습니다.
```

이 화면이 나오면:

1. `추가 정보`를 클릭합니다.
2. 앱 이름과 게시자를 확인합니다.
3. `실행` 버튼을 클릭합니다.
4. 설치 마법사를 계속 진행합니다.

### 2. 파일 차단 해제

설치 파일을 실행해도 계속 차단되면 다운로드 파일의 차단 상태를 해제합니다.

1. 다운로드한 `.exe` 파일을 우클릭합니다.
2. `속성`을 엽니다.
3. 하단에 `차단 해제` 체크박스가 보이면 체크합니다.
4. `확인`을 누른 뒤 다시 실행합니다.

PowerShell을 사용할 수 있다면 아래 명령으로도 해제할 수 있습니다.

```powershell
Unblock-File "C:\Users\<사용자>\Downloads\My Pact Setup 0.60.6.exe"
```

### 3. 사용자 계정 컨트롤 확인

설치 과정에서 사용자 계정 컨트롤(UAC) 창이 나오면 `예`를 눌러 설치를 계속합니다.

## 그래도 실행 버튼이 안 보일 때

일부 Windows 11 PC에서는 Smart App Control 정책이 강하게 적용되어 `추가 정보 -> 실행` 버튼이 표시되지 않을 수 있습니다. 이 경우 unsigned 설치본을 바로 실행할 수 없습니다.

가능한 방법은 아래 중 하나입니다.

- Windows 보안 설정에서 Smart App Control 상태를 확인합니다.
- 소스 코드를 직접 내려받아 빌드합니다.
- 코드 서명 인증서가 적용된 새 릴리즈를 기다립니다.
- Microsoft Store 배포판이 준비되면 Store를 통해 설치합니다.

## 왜 이런 경고가 뜨나요?

SmartScreen은 앱의 배포 이력과 코드 서명 상태를 함께 봅니다.

| 항목 | 의미 |
|------|------|
| 코드 서명 인증서 | 앱 배포자가 검증되었는지 확인하는 서명 |
| 평판(Reputation) | 같은 배포자/파일이 충분히 많이 안전하게 사용되었는지에 대한 Windows 신뢰도 |

이 앱은 개인/소규모 프로젝트로 공개 CA 코드 서명 인증서를 적용하지 않은 상태로 배포하고 있어, 초기 실행 시 Windows가 경고를 표시할 수 있습니다.

## 직접 빌드하기

소스 코드를 직접 확인하고 빌드할 수 있습니다.

```bash
git clone https://github.com/toughCSB/roblox-playtime-guardian.git
cd roblox-playtime-guardian
npm install
npm run package:win:unsigned
```

빌드 결과물은 `dist/` 폴더에 생성됩니다.

## 현재 릴리즈 파일 정보

```text
버전: v0.60.6
파일: My Pact Setup 0.60.6.exe
SHA256: 61BA370504B780396BA0C277E48782D8418FB1117FA9F9CA4A96880ADA1AD0C5
```

다운로드한 파일의 해시를 확인하려면 PowerShell에서 아래 명령을 실행합니다.

```powershell
Get-FileHash "C:\Users\<사용자>\Downloads\My Pact Setup 0.60.6.exe" -Algorithm SHA256
```

출력된 SHA256 값이 위 값과 같으면 GitHub Release에 올린 파일과 동일한 파일입니다.

## 정식 서명 배포에 대해

Windows SmartScreen 경고를 줄이려면 공개 CA 코드 서명 인증서, Azure Trusted Signing, Microsoft Store 배포 같은 신뢰 경로가 필요합니다. 비용과 신원 검증 절차가 있어 현재 릴리즈는 unsigned 방식으로 제공됩니다.

서명 인증서가 준비되면 signed 설치본을 별도 릴리즈로 배포할 예정입니다.
