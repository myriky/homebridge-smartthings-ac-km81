# Homebridge SmartThings AC (KM81 Custom) v2.0.0

[![npm version](https://badge.fury.io/js/homebridge-smartthings-ac-km81.svg)](https://badge.fury.io/js/homebridge-smartthings-ac-km81)

`homebridge-smartthings-ac-km81`은 삼성 에어컨을 SmartThings API를 통해 HomeKit에 연동하기 위한 Homebridge 플러그인입니다. v2.0.0부터 안정적인 **OAuth2 인증 방식**을 채택하여, 한 번의 설정으로 지속적인 사용이 가능합니다.

## 주요 기능

* **OAuth2 인증 지원**: 더 이상 만료 걱정이 없는 OAuth2 인증 방식을 통해 안정적인 연결을 보장합니다.
* **다중 디바이스 지원**: 여러 대의 에어컨을 `config.json`에 등록하여 한 번에 관리할 수 있습니다.
* **상세한 상태 반영**: SmartThings 에어컨의 실제 운전 모드(`cool`, `dry`, `heat`, `fan`, `auto`)를 분석하여 홈 앱의 `냉방`, `난방`, `자동`, `쉼` 상태에 정확하게 반영합니다.
* **고유 기능 커스텀 매핑**:
    * 홈 앱의 **'냉방'** 버튼 → 실제 에어컨의 **'제습(dry)'** 모드를 실행합니다. (여름철 효율적인 사용을 위한 커스텀 로직)
    * 홈 앱의 **'스윙'** 토글 → 실제 에어컨의 **'무풍(Wind-Free)'** 기능을 제어합니다.
    * 홈 앱의 **'잠금'** 토글 → 실제 에어컨의 **'자동 청소'** 기능을 제어합니다.
* **안정적인 API 통신**: API 요청을 효율적으로 관리하고 캐싱하여, 서버의 과도한 요청(Rate Limit) 오류를 방지하고 안정적인 상태 업데이트를 보장합니다.
* **GUI 설정 지원**: Homebridge UI의 GUI 환경에서 설정을 쉽게 입력하고 관리할 수 있도록 `config.schema.json`을 지원합니다.

## 설치 및 설정

v2.0.0부터 설정 과정이 변경되었습니다. 아래 단계를 순서대로 따라주세요.

### 1단계: SmartThings 앱 생성 및 인증 정보 획득

Homebridge 설정에 앞서, SmartThings 개발자 페이지에서 API 접근에 필요한 **Client ID**와 **Client Secret**을 발급받아야 합니다.

1.  **[SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace)** 로 이동하여 로그인합니다.
2.  **'New project'** 버튼을 클릭합니다.
3.  프로젝트 유형으로 **`Automation for the SmartThings App`** (오른쪽 옵션)을 선택하고 `CONTINUE`를 누릅니다.
4.  왼쪽 메뉴에서 **`Develop` > `Automation Connector | SmartApp`** 을 클릭합니다.
5.  호스팅 설정에서 **`Webhook Endpoint`** 를 선택하고, URL 입력칸에 아래와 같이 아무 주소나 입력합니다. (실제로 사용되지 않는 값이므로 그대로 복사해서 사용하세요.)
    ```
    [https://myhomebridge.local/callback](https://myhomebridge.local/callback)
    ```
6.  `NEXT` 버튼을 누르고, 다음 **'Name & Scope'** 페이지에서 아래 정보를 입력합니다.
    * **App Display Name**: `Homebridge AC` 등 원하는 이름을 입력합니다.
    * **Description**: `Homebridge 연동용` 등 간단한 설명을 입력합니다.
    * **Permissions**: 가장 중요한 단계입니다. 아래 **세 가지 권한**의 체크박스를 **모두** 선택해주세요.
        * ✅ `r:devices:*` (기기 목록 및 상태 읽기)
        * ✅ `w:devices:*` (기기 정보 수정)
        * ✅ `x:devices:*` (기기 제어 및 명령어 실행)
7.  `NEXT` 버튼을 누르고 다음 화면에서 **`SAVE`** 버튼을 누릅니다.
8.  'Save Client ID & Secret' 팝업창이 나타납니다. 여기에 표시되는 **`Client ID`**와 **`Client Secret`**을 **즉시 복사하여 안전한 곳에 보관**하세요. 이 창을 닫으면 Client Secret은 다시 볼 수 없습니다.
9.  값을 모두 복사했다면 `GO TO PROJECT OVERVIEW` 버튼을 누릅니다.
10. 마지막으로, `Overview` 페이지에서 회색 **`DEPLOY TO TEST`** 버튼을 눌러 앱을 활성화합니다.

### 2단계: Homebridge 플러그인 설치 및 `config.json` 설정

1.  Homebridge가 설치된 환경의 터미널에서 아래 명령어를 실행하여 플러그인을 설치합니다.
    ```shell
    npm install -g homebridge-smartthings-ac-km81
    ```
2.  Homebridge `config.json` 파일의 `platforms` 배열에 아래 설정을 추가합니다. Homebridge UI를 사용하면 더 쉽게 설정할 수 있습니다.

    ```json
    {
      "platform": "SmartThingsAC-KM81",
      "name": "SmartThings AC",
      "clientId": "YOUR_CLIENT_ID",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "authCode": "",
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
    * `platform`: **"SmartThingsAC-KM81"** (고정값)
    * `clientId`: 1단계에서 발급받은 **Client ID**를 붙여넣습니다.
    * `clientSecret`: 1단계에서 발급받은 **Client Secret**을 붙여넣습니다.
    * `authCode`: **지금은 비워둡니다.**
    * `devices`: 연동할 에어컨 목록 (배열).
        * `deviceLabel`: 연동할 에어컨의 SmartThings 상의 이름.
