// lib/SmartThings.js

const axios = require('axios');

class SmartThings {
  constructor(token, deviceLabel, log) {
    this.token = token;
    this.deviceLabel = deviceLabel;
    this.log = log || console.log;
    this.baseUrl = 'https://api.smartthings.com/v1';
    this.statusCache = {}; // 간단한 캐시 객체
  }

  // 디바이스 전체 리스트 조회
  async getDevices() {
    try {
      const res = await axios.get(`${this.baseUrl}/devices`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return res.data.items || [];
    } catch (e) {
      this.log('디바이스 조회 오류:', e.response?.data || e.message);
      return [];
    }
  }

  // 특정 디바이스의 전체 상태 조회 (핵심 기능)
  async getStatus(deviceId) {
    // 2초 이내의 캐시된 데이터가 있으면 재사용하여 API 호출 줄이기
    if (this.statusCache[deviceId] && (Date.now() - this.statusCache[deviceId].timestamp < 2000)) {
        return this.statusCache[deviceId].data;
    }

    try {
      const res = await axios.get(`${this.baseUrl}/devices/${deviceId}/status`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      
      // 캐시에 저장
      this.statusCache[deviceId] = {
        data: res.data.components.main,
        timestamp: Date.now(),
      };
      
      return res.data.components.main;
    } catch (e) {
      this.log(`[${deviceId}] 상태 조회 오류:`, e.response?.data || e.message);
      return null;
    }
  }
  
  // 현재 전원 상태 조회
  async getPower(deviceId) {
    const status = await this.getStatus(deviceId);
    const power = status?.switch?.switch?.value === 'on';
    this.log(`[${deviceId}] 전원 상태: ${power}`);
    return power;
  }
  
  // 현재 운전 모드 조회
  async getMode(deviceId) {
    const status = await this.getStatus(deviceId);
    const mode = status?.airConditionerMode?.airConditionerMode?.value || 'off';
    this.log(`[${deviceId}] 운전 모드: ${mode}`);
    return mode;
  }
  
  // 현재 실내 온도 조회
  async getCurrentTemperature(deviceId) {
    const status = await this.getStatus(deviceId);
    // 온도는 0도일 수 있으므로 nullish coalescing 사용
    const temp = status?.temperatureMeasurement?.temperature?.value ?? 0;
    this.log(`[${deviceId}] 현재 온도: ${temp}`);
    return temp;
  }
  
  // 현재 설정(희망) 온도 조회
  async getCoolingSetpoint(deviceId) {
    const status = await this.getStatus(deviceId);
    const temp = status?.thermostatCoolingSetpoint?.coolingSetpoint?.value ?? 18;
    this.log(`[${deviceId}] 설정 온도: ${temp}`);
    return temp;
  }

  // 현재 무풍 모드 상태 조회
  async getWindFree(deviceId) {
    const status = await this.getStatus(deviceId);
    const windFree = status?.['custom.airConditionerOptionalMode']?.acOptionalMode?.value === 'windFree';
    this.log(`[${deviceId}] 무풍 모드: ${windFree}`);
    return windFree;
  }

  // 현재 자동청소 모드 상태 조회
  async getAutoClean(deviceId) {
    const status = await this.getStatus(deviceId);
    const autoClean = status?.['custom.autoCleaningMode']?.autoCleaningMode?.value === 'on';
     this.log(`[${deviceId}] 자동청소 모드: ${autoClean}`);
    return autoClean;
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

  // --- 기존의 Set 함수들은 그대로 유지 ---
  async setPower(deviceId, on) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'switch', command: on ? 'on' : 'off' }]); }
  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'custom.airConditionerOptionalMode', command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'custom.autoCleaningMode', command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
