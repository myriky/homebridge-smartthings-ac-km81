# Homebridge SmartThings ACs (v1.0.0)

`homebridge-smartthings-acs`는 SmartThings 에어컨을 HomeKit에 연동하고, **웹훅(Webhook)을 통한 실시간 상태 업데이트**를 지원하는 고성능 Homebridge 플러그인입니다.

## 핵심 기능

* **실시간 상태 동기화**: SmartThings의 웹훅을 사용하여, 에어컨 상태가 변경되는 즉시 HomeKit에 반영됩니다. "세탁 완료 시 알림"과 같은 자동화가 지연 없이 실행됩니다.
* **안전한 OAuth 2.0 인증**: 한 번의 설정으로 토큰이 자동 갱신되는 안정적인 인증 방식을 사용합니다.
* **다중 디바이스 지원**: 여러 대의 에어컨을 한 번에 등록하고 관리할 수 있습니다.
* **커스텀 기능 매핑**: 무풍, 자동 건조 등 삼성 에어컨의 고유 기능을 홈킷의 스윙, 잠금 기능에 매핑하여 제어할 수 있습니다.

## 사전 준비

1.  **공개 접속 가능 주소**: SmartThings 서버가 Homebridge에 접속할 수 있는 공개 주소(URL)가 필요합니다. (예: DuckDNS, Synology DDNS를 이용한 `https://your-domain.com`)
2.  **Node.js 18.0.0 이상**
3.  **SmartThings CLI** 및 **OAuth App 생성**: 아래 설정 가이드를 따라 `clientId`와 `clientSecret`을 발급받아야 합니다.

## 설정 및 설치

#### 1. OAuth App 생성 및 Webhook 설정

* **SmartThings CLI**를 사용하여 OAuth App을 생성합니다. (기존 가이드와 동일)
* **중요**: `smartthings apps:create` 과정에서 `Target URL`을 입력하라는 질문이 나옵니다. 여기에 `config.json`에 입력할 **`webhookUrl`**을 입력해주세요.
    * `Target URL`: `https://your-domain.com/webhook`

#### 2. 플러그인 설치
```shell
npm install -g homebridge-smartthings-acs
```

#### 3. `config.json` 설정
```json
{
  "platform": "SmartThingsACs",
  "name": "SmartThings ACs",
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "webhookUrl": "[https://your-domain.com/webhook](https://your-domain.com/webhook)",
  "devices": [
    {
      "deviceLabel": "거실 에어컨"
    }
  ]
}
```
* `webhookUrl`: SmartThings가 접속할 수 있는, Homebridge가 실행 중인 서버의 공개 주소입니다.

#### 4. 최초 인증 및 Webhook 등록
1.  Homebridge를 재시작하면 로그에 **인증 URL**이 표시됩니다. 접속하여 권한을 허용합니다.
2.  인증 성공 후 Homebridge를 재시작하면, 플러그인이 자동으로 SmartThings에 Webhook을 등록하고 실시간 업데이트 수신을 시작합니다.
