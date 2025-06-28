// lib/SmartThings.js (v1.1.2 기반 Power 기능만 수정한 최종본)
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

    const promise = this.client.get(`/devices/${deviceId}/status`)
      .then(res => {
        const data = res.data.components.main;
        this.cache.set(deviceId, data);
        return data;
      })
      .catch(e => {
        this.log.error(`[${deviceId}] 상태 조회 실패:`, e.message);
        throw new Error(`[${deviceId}] 상태 조회에 실패했습니다.`);
      })
      .finally(() => {
        this.pendingPromises.delete(deviceId);
      });

    this.pendingPromises.set(deviceId, promise);
    return promise;
  }
  
  // ▼▼▼ 여기에만 수정이 적용되었습니다 ▼▼▼
  async getPower(deviceId) {
    const status = await this.getStatus(deviceId);
    // airConditionerMode의 값이 null(비어있음)이 아니면 켜진 것으로 판단합니다.
    return status.airConditionerMode?.airConditionerMode?.value !== null;
  }

  async setPower(deviceId, on) {
    // 전원을 끄는 것은 'off' 모드로, 켜는 것은 'auto'(자동) 모드로 설정하여 확실하게 제어합니다.
    const mode = on ? 'auto' : 'off';
    return this.setMode(deviceId, mode);
  }
  // ▲▲▲ 여기까지 수정되었습니다 ▲▲▲
  
  async getMode(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.airConditionerMode.airConditionerMode.value || 'off';
  }
  
  async getCurrentTemperature(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.temperatureMeasurement.temperature.value ?? 0;
  }
  
  async getCoolingSetpoint(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.thermostatCoolingSetpoint.coolingSetpoint.value ?? 18;
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
    // 명령 전송 직후 캐시를 무효화하여 최신 상태를 바로 가져오도록 함
    this.cache.delete(deviceId);
    try {
      await this.client.post(`/devices/${deviceId}/commands`, { commands });
      this.log.info(`[명령 전송] deviceId: ${deviceId}, commands:`, JSON.stringify(commands));
    } catch (e) {
      this.log.error('명령 전송 오류:', e.message);
      throw e;
    }
  }

  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.OPTIONAL_MODE, command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.AUTO_CLEANING, command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
