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

npm install -g @smartthings/cli
