# Homebridge SmartThings AC (KM81)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B0B11K13X5)

삼성 시스템 에어컨을 SmartThings API를 통해 HomeKit에 연동하기 위한 Homebridge 플러그인입니다. 이 플러그인은 HomeKit 환경에서 에어컨을 더 단순하고 직관적으로 사용하고자 하는 목적에 맞춰져 있으며, 특히 **냉방/제습 위주의 사용**에 최적화되어 있습니다.

## 주요 기능

* **HomeKit을 통한 삼성 시스템 에어컨 제어**: 전원, 온도 설정 등 기본적인 제어가 가능합니다.
* **단순화된 제어 모드**: HomeKit UI의 복잡성을 줄이기 위해 제어 모드를 **'냉방'과 '끔'**으로 제한했습니다. '난방' 및 '자동' 모드는 UI에 표시되지 않습니다.
* **제습 모드 연동**: HomeKit에서 '냉방' 모드를 선택하면, 실제 에어컨은 **'제습(Dry)' 모드로 동작**합니다. 여름철 습도 관리에 유용합니다.
* **통합된 '냉방 중' 상태**: 에어컨의 실제 동작 모드(냉방, 제습, 송풍 등)와 관계없이, **전원이 켜져 있다면 HomeKit에서는 항상 '냉방 중'**으로 상태가 표시됩니다.
* **부가 기능 지원**:
    * **무풍 모드**: HomeKit의 '스윙' 기능으로 켜고 끌 수 있습니다.
    * **자동 건조 모드**: HomeKit의 '물리 제어 잠금' 기능으로 켜고 끌 수 있습니다.
* **안전한 인증**: SmartThings의 공식 OAuth 2.0 인증 방식을 사용하여 안전하게 계정을 연동합니다.
* **간편한 최초 인증**: 플러그인이 로컬 인증 서버를 잠시 구동하여 복잡한 과정 없이 토큰을 발급받을 수 있습니다.

## 사전 준비

1.  [Homebridge](https://homebridge.io/)가 설치되어 있어야 합니다. (Homebridge UI 사용을 권장합니다.)
2.  **Node.js 18.0.0 이상** 버전이 필요합니다.
3.  SmartThings 계정이 있어야 하며, 제어하려는 에어컨이 SmartThings 앱에 정상적으로 등록되어 있어야 합니다.

## 설치

Homebridge UI의 '플러그인' 탭에서 `homebridge-smartthings-ac-km81`을 검색하여 설치하거나, 터미널에서 아래 명령어를 직접 실행합니다.

```sh
npm install -g homebridge-smartthings-ac-km81
```

## 설정

### 1. SmartThings API Key 발급

Homebridge 설정에 필요한 `clientId`와 `clientSecret`을 발급받아야 합니다.

1.  [SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace)에 접속하여 로그인합니다.
2.  **'New project'** 버튼을 클릭합니다.
3.  **'Automation for the SmartThings App'**을 선택하고 **'OK'**를 누릅니다.
4.  프로젝트 이름을 입력합니다. (예: `Homebridge AC Control`)
5.  프로젝트가 생성되면, 왼쪽 메뉴에서 **'App Credentials'**를 선택합니다.
    * **Client ID**와 **Client Secret**을 복사하여 안전한 곳에 잠시 보관합니다.
6.  왼쪽 메뉴에서 **'App Scopes'**를 선택합니다.
    * `devices` 항목을 찾아 **View(r), Control(w), Command(x)** 3가지 권한을 모두 체크합니다. (`r:devices:*`, `w:devices:*`, `x:devices:*`)
7.  왼쪽 메뉴에서 **'App Settings'**를 선택합니다.
    * **'Hosted by'** 섹션에서 **'Non-SmartThings Cloud (3rd-party)'**를 선택합니다.
    * **'Redirect URIs'** 항목에 **`http://<HOMEBRIDGE_IP_ADDRESS>:8999/oauth/callback`** 형식의 주소를 추가하고 **'Save'**를 누릅니다.
        * `<HOMEBRIDGE_IP_ADDRESS>`는 Homebridge가 설치된 서버의 IP 주소로 변경해야 합니다. (예: `http://192.168.1.10:8999/oauth/callback`)
        * **경로 `/oauth/callback`까지 모두 포함해야 합니다.**
8.  마지막으로 오른쪽 상단의 **'Save'** 버튼을 눌러 프로젝트 전체 설정을 저장합니다.

### 2. Homebridge `config.json` 설정

Homebridge UI의 설정 화면 또는 `config.json` 파일을 직접 수정하여 아래 내용을 추가합니다.

```json
{
  "platform": "SmartThingsAC-KM81",
  "name": "SmartThings AC",
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "redirectUri": "http://<HOMEBRIDGE_IP_ADDRESS>:8999/oauth/callback",
  "devices": [
    {
      "deviceLabel": "거실 에어컨"
    },
    {
      "deviceLabel": "안방 에어컨"
    }
  ]
}
```

* **`platform`**: `SmartThingsAC-KM81` 로 고정합니다.
* **`name`**: Homebridge에 표시될 플랫폼의 이름입니다. 자유롭게 변경 가능합니다.
* **`clientId`**: 1단계에서 발급받은 Client ID를 입력합니다.
* **`clientSecret`**: 1단계에서 발급받은 Client Secret을 입력합니다.
* **`redirectUri`**: 1단계에서 설정한 Redirect URI를 **정확히 동일하게** 입력합니다.
* **`devices`**: HomeKit에 추가할 에어컨 목록입니다.
    * **`deviceLabel`**: **SmartThings 앱에 표시되는 에어컨의 이름과 정확히 일치**해야 합니다. 오타나 띄어쓰기가 다를 경우 장치를 찾지 못합니다.

### 3. 플러그인 최초 인증

1.  설정 저장이 완료되면 Homebridge를 **재시작**합니다.
2.  Homebridge 로그(Log)를 확인하면, **`[스마트싱스 인증 필요]`** 라는 문구와 함께 인증 URL이 나타납니다.
3.  로그에 표시된 `인증 URL` 전체를 복사하여 웹 브라우저 주소창에 붙여넣고 접속합니다.
4.  SmartThings 계정으로 로그인하고, 생성한 앱에 대한 권한을 **'허용(Authorize)'** 합니다.
5.  "인증 성공!" 메시지가 브라우저에 표시되면 정상적으로 완료된 것입니다.
6.  다시 Homebridge를 **재시작**하면 플러그인이 에어컨 장치를 인식하고 HomeKit에 추가합니다.

## 상세 기능 설명

| HomeKit 기능 | 실제 에어컨 동작 | 비고 |
| :--- | :--- | :--- |
| **상태** (State) | 꺼짐: `비활성(Inactive)` <br> 켜짐: `냉방 중(Cooling)` | 에어컨이 켜져 있으면 실제 모드(냉방, 제습, 송풍 등)와 관계없이 항상 '냉방 중'으로 표시됩니다. |
| **모드** (Mode) | UI에 '냉방(Cool)'만 표시 <br> '냉방' 선택 시 `제습(Dry)` 모드로 설정 | 난방/자동 모드는 UI에서 제거되어 선택할 수 없습니다. |
| **온도 설정** (Temperature) | 희망 온도(18°C ~ 30°C) 설정 | 일반적인 온도 제어와 동일합니다. |
| **스윙** (Swing) | 켜짐: `무풍(Wind-Free)` 모드 On <br> 꺼짐: `무풍(Wind-Free)` 모드 Off | HomeKit의 스윙 토글을 이용해 무풍 모드를 제어합니다. |
| **물리 제어 잠금** (Lock) | 켜짐: `자동 건조(Auto Clean)` 모드 On <br> 꺼짐: `자동 건조(Auto Clean)` 모드 Off | HomeKit의 부가 기능 토글을 재활용하여 자동 건조 기능을 제어합니다. |

## 문제 해결 (Troubleshooting)

* **"장치를 찾지 못했습니다" 로그가 표시될 경우:**
    * `config.json`의 `deviceLabel`이 SmartThings 앱의 장치 이름과 **완전히 동일한지** 확인하세요. (띄어쓰기 포함)
    * SmartThings API Key 발급 시 **'devices' 관련 권한 3가지**를 모두 체크했는지 확인하세요.
* **인증이 실패하거나 "invalid_grant" 오류가 발생할 경우:**
    * `config.json`의 `clientId`, `clientSecret`, `redirectUri` 값이 올바르게 입력되었는지 다시 한번 확인하세요.
    * Homebridge 서버가 실행 중인 기기의 방화벽이 `8999` 포트를 차단하고 있지 않은지 확인하세요.
