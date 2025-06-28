# Homebridge SmartThings AC (KM81 Custom) v2.1.0

[![npm version](https://badge.fury.io/js/homebridge-smartthings-ac-km81.svg)](https://badge.fury.io/js/homebridge-smartthings-ac-km81)

`homebridge-smartthings-ac-km81`은 삼성 에어컨을 SmartThings API를 통해 HomeKit에 연동하기 위한 Homebridge 플러그인입니다. v2.1.0부터 **OAuth2 자동 인증**을 지원하여, 한 번의 설정으로 토큰 만료 없이 안정적으로 사용할 수 있습니다.

## 이 플러그인을 선택해야 하는 이유

SmartThings 정책 변경으로 인해, 과거에 사용되던 간단한 **개인용 액세스 토큰(PAT)** 방식은 24시간마다 만료되어 매일 재인증이 필요한 문제가 발생합니다. 또한, **SmartThings 개발자 웹사이트**를 통해 OAuth 앱을 생성하는 방법은 Webhook 소유권 인증이라는 해결 불가능한 단계에 막히게 됩니다.

이 플러그인은 현재 시점에서 개인이 안정적으로 토큰 자동 갱신을 구현할 수 있는, **SmartThings CLI를 이용한 OAuth2 인증 방식을 채택**하여 이러한 문제들을 모두 해결했습니다.

## 주요 기능

* **안정적인 자동 인증**: SmartThings CLI로 인증 정보를 생성하고, 플러그인의 내장 서버가 콜백을 자동으로 처리하여 사용자가 코드를 복사/붙여넣기 할 필요 없이 편리하게 인증할 수 있습니다.
* **다중 디바이스 지원**: 여러 대의 에어컨을 `config.json`에 등록하여 한 번에 관리할 수 있습니다.
* **상세한 상태 반영**: SmartThings 에어컨의 실제 운전 모드를 분석하여 홈 앱의 상태에 정확하게 반영합니다.
* **고유 기능 커스텀 매핑**:
    * 홈 앱의 **'냉방'** 버튼 → 실제 에어컨의 **'제습(dry)'** 모드 실행
    * 홈 앱의 **'스윙'** 토글 → 실제 에어컨의 **'무풍(Wind-Free)'** 기능 제어
    * 홈 앱의 **'잠금'** 토글 → 실제 에어컨의 **'자동 청소'** 기능 제어
* **안정적인 API 통신**: API 요청을 효율적으로 관리하고 캐싱하여, 서버의 과도한 요청(Rate Limit) 오류를 방지합니다.
* **GUI 설정 지원**: Homebridge UI 환경에서 설정을 쉽게 입력하고 관리할 수 있습니다.

## 사전 준비

* 정상적으로 실행 중인 Homebridge 환경
* Node.js 및 npm이 설치된 터미널 환경 (PC/Mac의 터미널, 또는 GitHub Codespaces)

## 설치

Homebridge가 설치된 환경의 터미널에서 아래 명령어를 실행하여 플러그인을 설치합니다.
```shell
npm install -g homebridge-smartthings-ac-km81
설정 방법
설정 과정은 2단계로 나뉩니다: 1) SmartThings CLI로 인증 정보 생성, 2) Homebridge 설정 및 인증.

1단계: SmartThings CLI로 Client ID 및 Secret 생성하기

이 단계는 PC/Mac의 터미널이나, 아이패드만 있는 경우 GitHub Codespaces 환경에서 진행합니다.

SmartThings CLI 설치 (최초 1회):

Shell
npm install -g @smartthings/cli
SmartApp 생성 명령어 실행:

Shell
smartthings apps:create
CLI 로그인 (매우 중요!):

위 명령어를 실행하면 CLI가 인증을 시도합니다.

[문제 해결 팁] GitHub Codespaces 같은 환경에서는 브라우저가 자동으로 열리지 않을 수 있습니다. 터미널에 아래와 같은 메시지가 나타나면,

A browser window should open for you to log in. If it does not, use this link:
https://auth-global.api.smartthings.com/login/sso?....

메시지에 포함된 https://... 링크를 복사하여 직접 웹 브라우저에 붙여넣고 로그인 및 권한 허용을 진행해야 합니다.

대화형 프롬프트 답변:

로그인이 완료되면 터미널이 몇 가지 질문을 합니다. 아래와 같이 정확히 답변해주세요.

Display Name: Homebridge SmartThings AC

Description: Homebridge plugin for AC

Target URL: 아무것도 입력하지 말고 그냥 Enter

Permissions: 스페이스바를 눌러 아래 세 가지를 선택합니다. (* 모양으로 표시됨)

[ ] r:devices:* → [*] r:devices:*

[ ] w:devices:* → [*] w:devices:*

[ ] x:devices:* → [*] x:devices:*

Redirect URIs: http://localhost:8999/oauth/callback 입력 후 Enter

[문제 해결 팁] 403 Forbidden 오류 발생 시:

만약 마지막 단계에서 403 Forbidden 오류가 발생한다면, CLI를 인증하는 과정에 문제가 있었던 것입니다. 아래 방법으로 해결하세요.

a. 강력한 권한의 임시 토큰(PAT) 발급: **이 링크**에서 새 토큰을 만듭니다. 이름은 CLI-Admin-Token으로 하고, 모든 권한(Scopes)을 다 체크한 후 토큰을 생성하고 복사합니다.

b. 터미널에 토큰 등록: 터미널로 돌아와 Ctrl+C로 명령어를 취소하고, 아래 명령어를 실행합니다.

Shell
export SMARTTHINGS_TOKEN="여기에_방금_만든_임시_토큰_붙여넣기"
c. apps:create 재실행: 다시 smartthings apps:create 명령어를 실행하면 이번에는 오류 없이 진행됩니다.

인증 정보 저장:

모든 과정이 성공적으로 완료되면, 화면에 Client ID와 Client Secret이 최종적으로 출력됩니다.

이 두 값을 반드시 복사하여 안전한 곳에 저장하세요.

2단계: Homebridge 설정 및 최종 인증

Homebridge config.json 파일의 platforms 배열에 아래 설정을 추가합니다.

JSON
{
  "platform": "SmartThingsAC-KM81",
  "name": "SmartThings AC",
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "redirectUri": "http://localhost:8999/oauth/callback",
  "devices": [
    {
      "deviceLabel": "거실 에어컨"
    },
    {
      "deviceLabel": "안방 에어컨"
    }
  ]
}
**clientId**와 clientSecret 필드에 1단계에서 발급받은 값을 붙여넣습니다. redirectUri는 CLI에서 입력한 값과 동일해야 합니다.

Homebridge를 재시작합니다.

Homebridge 로그를 확인하면 **'인증 URL'**이 나타납니다. 이 URL을 복사하여 웹 브라우저에서 엽니다.

SmartThings에 로그인하고, 생성한 Homebridge SmartThings AC 앱에 대한 권한을 허용합니다.

권한 허용 후, 브라우저에 "인증 성공!" 메시지가 나타나면 정상적으로 처리된 것입니다.

브라우저 창을 닫고, Homebridge를 마지막으로 한 번 더 재시작합니다.

이제 플러그인이 자동으로 토큰을 발급받아 저장하였으므로 모든 인증 절차가 완료되었습니다. 앞으로는 토큰 만료 걱정 없이 사용하시면 됩니다.

저작권 및 라이선스
이 플러그인은 MIT 라이선스에 따라 배포됩니다. 자세한 내용은 LICENSE 파일을 참고하세요.
