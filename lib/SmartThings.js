// lib/SmartThings.js (최종 맞춤 버전)
const axios = require('axios');
const { LRUCache } = require('lru-cache');

const CAPABILITY = {
  OPTIONAL_MODE: 'custom.airConditionerOptionalMode',
  AUTO_CLEANING: 'custom.autoCleaningMode',
};

class SmartThings {
  constructor(token, log) {
    this.log = log || console.log;

    this.client = axios.create({
      baseURL: 'https://api.smartthings.com/v1',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000,
    });

    this.cache = new LRUCache({
      max: 100,
      ttl: 1000 * 2,
    });

    this.pendingPromises = new Map();
  }

  async getDevices() {
    try {
      const res = await this.client.get('/devices');
      return res.data.items || [];
    } catch (e) {
      this.log.error('디바이스 조회 오류:', e.message);
      throw e;
    }
  }

  async getStatus(deviceId) {
    const cachedData = this.cache.get(deviceId);
    if (cachedData) {
      return cachedData;
    }

    if (this.pendingPromises.has(deviceId)) {
      return this.pendingPromises.get(deviceId);
    }

    const promise = this.client.get(`/devices/${deviceId}/components/main/status`) // API 경로를 더 명확하게 수정
      .then(res => {
        const data = res.data; // 이제 components.main이 아닌 data 전체를 사용
        this.cache.set(deviceId, data);
        return data;
      })
      .catch(e => {
        this.log.error(`[${deviceId}] 상태 조회 실패:`, e.response?.data ? JSON.stringify(e.response.data) : e.message);
        throw new Error(`[${deviceId}] 상태 조회에 실패했습니다.`);
      })
      .finally(() => {
        this.pendingPromises.delete(deviceId);
      });

    this.pendingPromises.set(deviceId, promise);
    return promise;
  }
  
  // ▼▼▼ 핵심 수정 부분 ▼▼▼
  async getPower(deviceId) {
    const status = await this.getStatus(deviceId);
    // 'switch' Capability에 value가 없으므로, 'airConditionerMode'의 값이 'off'가 아니면 켜진 것으로 판단
    return status.airConditionerMode?.airConditionerMode?.value !== 'off';
  }
  
  async getMode(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.airConditionerMode?.airConditionerMode?.value || 'off';
  }
  // ▲▲▲ 핵심 수정 부분 ▲▲▲
  
  async getCurrentTemperature(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.temperatureMeasurement?.temperature?.value ?? 0;
  }
  
  async getCoolingSetpoint(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.thermostatCoolingSetpoint?.coolingSetpoint?.value ?? 18;
  }

  async getWindFree(deviceId) {
    const status = await this.getStatus(deviceId);
    return status[CAPABILITY.OPTIONAL_MODE]?.acOptionalMode?.value === 'windFree';
  }

  async getAutoClean(deviceId) {
    const status = await this.getStatus(deviceId);
    return status[CAPABILITY.AUTO_CLEANING]?.autoCleaningMode?.value === 'on';
  }

  async sendCommand(deviceId, commands) {
    try {
      await this.client.post(`/devices/${deviceId}/commands`, { commands });
      this.log.info(`[명령 전송] deviceId: ${deviceId}, commands:`, JSON.stringify(commands));
    } catch (e) {
      this.log.error('명령 전송 오류:', e.message);
      throw e;
    }
  }

  async setPower(deviceId, on) {
    // 전원을 끄는 것은 airConditionerMode를 'off'로, 켜는 것은 'auto'로 설정
    const mode = on ? 'auto' : 'off';
    return this.setMode(deviceId, mode);
  }
  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.OPTIONAL_MODE, command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.AUTO_CLEANING, command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
