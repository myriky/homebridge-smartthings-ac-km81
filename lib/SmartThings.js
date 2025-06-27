// lib/SmartThings.js
// SmartThings API 연동, 승준 에어컨 기능 매핑 한글 커스텀 버전

const axios = require('axios');

class SmartThings {
  constructor(token, deviceLabel, log) {
    this.token = token;
    this.deviceLabel = deviceLabel;
    this.log = log || console.log;
    this.baseUrl = 'https://api.smartthings.com/v1';
  }

  // 디바이스 전체 리스트 조회
  async getDevices() {
    try {
      const res = await axios.get(`${this.baseUrl}/devices`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return res.data.items || [];
    } catch (e) {
      this.log('디바이스 조회 오류:', e);
      return [];
    }
  }

  // 특정 에어컨의 전원 on/off
  async setPower(deviceId, on) {
    return this.sendCommand(deviceId, [{
      component: 'main',
      capability: 'switch',
      command: on ? 'on' : 'off'
    }]);
  }

  // 현재 운전 모드(dry, cool, fan 등) 조회
  async getMode(deviceId) {
    try {
      const res = await axios.get(`${this.baseUrl}/devices/${deviceId}/components/main/status`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      // airConditionerMode가 dry(제습)일 때만 냉방상태로 인식
      return res.data.airConditionerMode?.airConditionerMode?.value || 'off';
    } catch (e) {
      this.log('운전모드 조회 오류:', e);
      return 'off';
    }
  }

  // 운전 모드(dry: 제습) 설정
  async setMode(deviceId, mode) {
    // mode: 'dry'만 사용, 추후 필요시 cool, fan 등도 가능
    return this.sendCommand(deviceId, [{
      component: 'main',
      capability: 'airConditionerMode',
      command: 'setAirConditionerMode',
      arguments: [mode]
    }]);
  }

  // 온도 설정 (18~30도)
  async setTemperature(deviceId, value) {
    return this.sendCommand(deviceId, [{
      component: 'main',
      capability: 'thermostatCoolingSetpoint',
      command: 'setCoolingSetpoint',
      arguments: [value]
    }]);
  }

  // 무풍(스윙)모드 설정 (on/off)
  async setWindFree(deviceId, enable) {
    // 무풍은 custom.airConditionerOptionalMode.capability의 windFree 모드
    return this.sendCommand(deviceId, [{
      component: 'main',
      capability: 'custom.airConditionerOptionalMode',
      command: 'setAcOptionalMode',
      arguments: [enable ? 'windFree' : 'off']
    }]);
  }

  // 자동청소(autoclean) 설정 (on/off)
  async setAutoClean(deviceId, enable) {
    // custom.autoCleaningMode.capability의 autoCleaningMode
    return this.sendCommand(deviceId, [{
      component: 'main',
      capability: 'custom.autoCleaningMode',
      command: 'setAutoCleaningMode',
      arguments: [enable ? 'on' : 'off']
    }]);
  }

  // SmartThings 명령 전송 공통 함수
  async sendCommand(deviceId, commands) {
    try {
      await axios.post(
        `${this.baseUrl}/devices/${deviceId}/commands`,
        { commands },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      this.log(`[명령 전송] deviceId: ${deviceId}, commands:`, JSON.stringify(commands));
    } catch (e) {
      this.log('명령 전송 오류:', e.response?.data || e.message);
      throw e;
    }
  }
}

module.exports = SmartThings;