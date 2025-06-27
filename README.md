# homebridge-smartthings-ac-km81

## 승준 에어컨 전용 한글 커스텀 Homebridge 플러그인

이 플러그인은 SmartThings에 등록된 "승준 에어컨"만 HomeKit(집 앱)에 연동하고,
기능 및 UI를 한국 사용자에 맞게 최적화한 버전입니다.

### 주요 기능

- "승준 에어컨"만 HomeKit에 등록 (SmartThings 디바이스 이름 기준)
- HomeKit 냉방 모드는 실제로 "제습"에 매핑 (냉방/끔만 보임, 난방/자동 없음)
- 온도 설정 18~30도, 1도 단위로 제한
- HomeKit 스윙(스윙모드)은 SmartThings의 **무풍(windFree)** 기능과 연동
- HomeKit 잠금(LOCK) 기능은 SmartThings의 **자동청소** 기능과 연동
- 모든 로그, 에러, 안내문을 한글로 제공

### 설치 방법

1. Homebridge에 본 플러그인 폴더를 설치
2. npm 의존성 설치