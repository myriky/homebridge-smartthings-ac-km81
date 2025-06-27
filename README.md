# Homebridge SmartThings AC (KM81 Custom)

`homebridge-smartthings-ac-km81`은 삼성 에어컨을 SmartThings API를 통해 HomeKit에 연동하기 위한 Homebridge 플러그인입니다. 특정 사용 환경에 맞춰 고도로 커스터마이징된 버전입니다.

## 주요 기능

* **특정 에어컨 연동**: 설정 파일에 지정된 `deviceLabel`과 일치하는 SmartThings 장치 하나만 HomeKit에 추가합니다.
* **상태 표시 최적화**: SmartThings에서 에어컨이 어떤 모드(냉방, 제습, 송풍 등)로 작동하든, 전원이 켜져 있으면 홈 앱에서는 항상 '냉방' 상태로 표시하여 상태를 직관적으로 파악할 수 있습니다.
* **핵심 기능 매핑**:
    * 홈 앱의 **'냉방'** 버튼 -> 실제 에어컨의 **'제습(dry)'** 모드를 실행합니다.
    * 홈 앱의 **'스윙'** 토글 -> 실제 에어컨의 **'무풍(Wind-Free)'** 기능을 제어합니다.
    * 홈 앱의 **'잠금'** 토글 -> 실제 에어컨의 **'자동 청소'** 기능을 제어합니다.
* **안정적인 API 통신**: SmartThings API 요청을 효율적으로 관리하여, 서버의 과도한 요청(Rate Limit) 오류를 방지하고 안정적인 상태 업데이트를 보장합니다.

## 설치

1.  Homebridge가 설치된 환경에서 다음 명령어를 실행합니다.
    ```
    npm install -g /path/to/your/plugin/folder
    ```
    (이 플러그인은 npm에 공개되지 않았으므로 로컬 경로로 설치해야 합니다.)

2.  Homebridge `config.json` 파일에 아래와 같이 플랫폼 설정을 추가합니다.

## 설정 (`config.json`)

```json
{
  "platforms": [
    {
      "platform": "SmartThingsAC-KM81",
      "name": "승준 에어컨",
      "token": "YOUR_SMARTTHINGS_PERSONAL_ACCESS_TOKEN",
      "deviceLabel": "승준 에어컨"
    }
  ]
}
```

* `platform`: **"SmartThingsAC-KM81"** (고정값)
* `name`: Homebridge 로그에 표시될 플랫폼 이름 (자유롭게 지정)
* `token`: [SmartThings 개발자 페이지](https://account.smartthings.com/tokens)에서 발급받은 개인용 액세스 토큰. **반드시 `l:devices`, `r:devices:*`, `x:devices:*` 권한이 모두 포함되어야 합니다.**
* `deviceLabel`: 연동할 에어컨의 SmartThings 상의 이름. **띄어쓰기까지 정확하게 일치해야 합니다.**

## 저작권 및 라이선스

이 플러그인은 MIT 라이선스에 따라 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참고하세요.
