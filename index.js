'use strict';

const SmartThingsClient = require('./smartthings-client'); // SmartThings API 연결부(가정)
const { normalizeKorean } = require('./normalize'); // 한글 정규화 모듈(아래 참고)

class SmartThingsACPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.token = config.token;
    this.deviceLabel = config.deviceLabel;
    this.accessories = [];
    this.smartthings = new SmartThingsClient(this.token);

    // Homebridge 플랫폼 초기화 이벤트
    if (api) {
      api.on('didFinishLaunching', () => {
        this.log('플랫폼 시작됨. 디바이스 검색...');
        this.discoverDevices();
      });
    }
  }

  async discoverDevices() {
    this.log(`[discoverDevices] deviceLabel 설정값: "${this.deviceLabel}"`);
    const devices = await this.smartthings.getDevices();

    let found = false;
    devices.forEach(device => {
      const dLabel = normalizeKorean(device.label);
      const tLabel = normalizeKorean(this.deviceLabel);

      // 내부값 숨은 문자까지 진단!
      this.log(`[DEBUG] device.label raw:`, JSON.stringify(device.label));
      this.log(`[DEBUG] config.deviceLabel raw:`, JSON.stringify(this.deviceLabel));
      this.log(`[DEBUG] device.label normalize:`, JSON.stringify(dLabel));
      this.log(`[DEBUG] config.deviceLabel normalize:`, JSON.stringify(tLabel));

      // ★포함 match 허용 (임시, 원래는 dLabel === tLabel)
      if (dLabel === tLabel || dLabel.includes(tLabel) || tLabel.includes(dLabel)) {
        found = true;
        this.log(`[매칭!] label "${device.label}" / deviceId: ${device.deviceId}`);
        this.addOrUpdateAccessory(device);
      }
    });
    if (!found) {
      this.log(`[경고] "${this.deviceLabel}"에 해당하는 디바이스를 SmartThings에서 찾지 못함!`);
    }
  }

  addOrUpdateAccessory(device) {
    // 악세사리 등록/업데이트 구현
    this.log(`[addOrUpdateAccessory] deviceId: ${device.deviceId}, label: ${device.label}`);
    // ... 기존 악세사리 등록/업데이트 코드
  }

  // 기타 필요 메서드
}

module.exports = SmartThingsACPlatform;

// normalize.js (같은 폴더에 두거나 utils로)
// 한글/공백/유니코드 정규화 함수 (NFC, NFD, 공백, Zero-width, 등)
function normalizeKorean(str) {
  if (!str) return '';
  return str
    .normalize('NFC') // 유니코드 조합문자 정규화
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width char 삭제
    .replace(/\s+/g, '') // 모든 공백 제거 (좌우/중간)
    .replace(/[\r\n\t]/g, '') // 줄바꿈, 탭 제거
    .trim();
}
