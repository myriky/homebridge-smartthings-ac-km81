// SmartThings API Library for AC v1.1.1
const axios = require('axios');

// 2. 매직 스트링 상수화: 커스텀 Capability 문자열을 상수로 관리
const CAPABILITY = {
  OPTIONAL_MODE: 'custom.airConditionerOptionalMode',
  AUTO_CLEANING: 'custom.autoCleaningMode',
};

class SmartThings {
  /**
   * SmartThings 클래스 생성자
   * @param {string} token - SmartThings 개인용 액세스 토큰 (PAT)
   * @param {object} log - Homebridge 로거 객체
   */
  constructor(token, log) {
    this.log = log || console.log;

    // 1. Axios 인스턴스 분리 및 설정 통일화
    this.client = axios.create({
      baseURL: 'https://api.smartthings.com/v1',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000, // 10초 타임아웃
    });

    this.deviceState = {};
  }

  /**
   * 사용자의 모든 SmartThings 장치 목록을 가져옵니다.
   * @returns {Promise<Array>} 장치 객체의 배열
   */
  async getDevices() {
    try {
      const res = await this.client.get('/devices');
      return res.data.items || [];
    } catch (e) {
      this.log.error('디바이스 조회 오류:', e.message);
      throw e;
    }
  }

  /**
   * 특정 장치의 최신 상태를 가져옵니다. (캐시 및 동시성 제어 포함)
   * @param {string} deviceId - 상태를 조회할 장치의 ID
   * @returns {Promise<object|null>} 장치의 main 컴포넌트 상태 객체
   */
  async getStatus(deviceId) {
    const state = this.deviceState[deviceId] || {};

    if (state.cachedData && (Date.now() - state.timestamp < 2000)) {
      return state.cachedData;
    }

    if (state.pendingPromise) {
      return state.pendingPromise;
    }

    const promise = this.client.get(`/devices/${deviceId}/status`)
      .then(res => {
        const data = res.data.components.main;
        state.cachedData = data;
        state.timestamp = Date.now();
        return data;
      })
      .catch(e => {
        this.log.error(`[${deviceId}] 상태 조회 실패:`, e.message);
        if (state.cachedData) {
            this.log.warn(`[${deviceId}] 오류 발생. 이전 캐시 데이터 사용.`);
            return state.cachedData;
        }
        throw new Error(`[${deviceId}] 상태 조회에 실패했습니다.`);
      })
      .finally(() => {
        delete state.pendingPromise;
      });

    state.pendingPromise = promise;
    this.deviceState[deviceId] = state;

    return promise;
  }
  
  async getPower(deviceId) {
    const status = await this.getStatus(deviceId);
    return status.switch.switch.value === 'on';
  }
  
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
    // 상수 사용
    return status[CAPABILITY.OPTIONAL_MODE]?.acOptionalMode?.value === 'windFree';
  }

  async getAutoClean(deviceId) {
    const status = await this.getStatus(deviceId);
    // 상수 사용
    return status[CAPABILITY.AUTO_CLEANING]?.autoCleaningMode?.value === 'on';
  }

  /**
   * SmartThings 장치에 명령을 전송합니다.
   * @param {string} deviceId - 명령을 보낼 장치의 ID
   * @param {Array<object>} commands - 전송할 명령 객체의 배열
   */
  async sendCommand(deviceId, commands) {
    try {
      await this.client.post(`/devices/${deviceId}/commands`, { commands });
      this.log.info(`[명령 전송] deviceId: ${deviceId}, commands:`, JSON.stringify(commands));
    } catch (e) {
      this.log.error('명령 전송 오류:', e.message);
      throw e;
    }
  }

  async setPower(deviceId, on) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'switch', command: on ? 'on' : 'off' }]); }
  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  // 상수 사용
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.OPTIONAL_MODE, command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  // 상수 사용
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.AUTO_CLEANING, command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
