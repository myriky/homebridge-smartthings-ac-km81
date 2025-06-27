# Homebridge SmartThings AC (KM81 Custom)

[![npm version](https://badge.fury.io/js/homebridge-smartthings-ac-km81.svg)](https://badge.fury.io/js/homebridge-smartthings-ac-km81)

`homebridge-smartthings-ac-km81`은 삼성 에어컨을 SmartThings API를 통해 HomeKit에 연동하기 위한 Homebridge 플러그인입니다. 여러 대의 에어컨을 지원하며, 다양한 커스텀 기능을 제공하여 HomeKit 경험을 향상시킵니다.

## 주요 기능

* **다중 디바이스 지원**: 여러 대의 에어컨을 `config.json`에 등록하여 한 번에 관리할 수 있습니다.
* **상세한 상태 반영**: SmartThings 에어컨의 실제 운전 모드(`cool`, `dry`, `heat`, `fan`, `auto`)를 분석하여 홈 앱의 `냉방`, `난방`, `자동`, `쉼` 상태에 정확하게 반영합니다.
* **고유 기능 커스텀 매핑**:
    * 홈 앱의 **'냉방'** 버튼 → 실제 에어컨의 **'제습(dry)'** 모드를 실행합니다. (여름철 효율적인 사용을 위한 커스텀 로직)
    * 홈 앱의 **'스윙'** 토글 → 실제 에어컨의 **'무풍(Wind-Free)'** 기능을 제어합니다.
    * 홈 앱의 **'잠금'** 토글 → 실제 에어컨의 **'자동 청소'** 기능을 제어합니다.
* **안정적인 API 통신**: API 요청을 효율적으로 관리하고 캐싱하여, 서버의 과도한 요청(Rate Limit) 오류를 방지하고 안정적인 상태 업데이트를 보장합니다.
* **GUI 설정 지원**: Homebridge UI의 GUI 환경에서 설정을 쉽게 입력하고 관리할 수 있도록 `config.schema.json`을 지원합니다.

## 설치

1.  Homebridge가 설치된 환경의 터미널에서 아래 명령어를 실행하여 플러그인을 설치합니다.
    ```shell
    npm install -g homebridge-smartthings-ac-km81
    ```
2.  Homebridge `config.json` 파일의 `platforms` 배열에 아래 설정을 추가합니다. Homebridge UI를 사용하면 더 쉽게 설정할 수 있습니다.

## 설정 (`config.json`)

```json
{
  "platform": "SmartThingsAC-KM81",
  "name": "SmartThings AC",
  "token": "YOUR_SMARTTHINGS_PERSONAL_ACCESS_TOKEN",
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
* `name`: Homebridge 로그에 표시될 플랫폼 이름 (예: "SmartThings AC")
* `token`: [SmartThings 개발자 페이지](https://account.smartthings.com/tokens)에서 발급받은 개인용 액세스 토큰. **반드시 `l:devices`, `r:devices:*`, `x:devices:*` 권한이 모두 포함되어야 합니다.**
* `devices`: 연동할 에어컨 목록 (배열).
    * `deviceLabel`: 연동할 에어컨의 SmartThings 상의 이름. **띄어쓰기까지 정확하게 일치해야 합니다.**

## 저작권 및 라이선스

이 플러그인은 MIT 라이선스에 따라 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참고하세요.
