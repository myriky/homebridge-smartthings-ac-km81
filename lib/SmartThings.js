// SmartThings API Library for AC v1.0.9
const axios = require('axios');

class SmartThings {
  constructor(token, deviceLabel, log) {
    this.token = token;
    this.deviceLabel = deviceLabel;
    this.log = log || console.log;
    this.baseUrl = 'https://api.smartthings.com/v1';
    
    // 장치별 상태 관리 객체
    this.deviceState = {};
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

  // 특정 디바이스의 전체 상태 조회 (요청 관리 기능 추가)
  async getStatus(deviceId) {
    const state = this.deviceState[deviceId] || {};

    // 1. 캐시 확인: 2초 이내의 유효한 캐시가 있으면 즉시 반환
    if (state.cachedData && (Date.now() - state.timestamp < 2000)) {
      return state.cachedData;
    }

    // 2. 진행 중인 요청 확인: 이미 진행 중인 요청이 있으면 그 결과를 기다림
    if (state.pendingPromise) {
      return state.pendingPromise;
    }

    // 3. 새 요청 시작
    const promise = (async () => {
      try {
        const res = await axios.get(`${this.baseUrl}/devices/${deviceId}/status`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = res.data.components.main;
        
        // 상태 업데이트
        state.cachedData = data;
        state.timestamp = Date.now();
        
        return data;
      } catch (e) {
        this.log(`[${deviceId}] 상태 조회 오류:`, e.response?.data || e.message);
        // 오류 발생 시, 이전 캐시가 있다면 그것을 반환하여 앱 오류 방지
        if (state.cachedData) {
            this.log(`[${deviceId}] 오류 발생. 이전 캐시 데이터 사용.`);
            return state.cachedData;
        }
        return null; // 캐시도 없으면 null 반환
      } finally {
        // 요청이 끝나면 진행 중 상태 해제
        delete state.pendingPromise;
      }
    })();

    // 진행 중인 promise를 저장
    state.pendingPromise = promise;
    this.deviceState[deviceId] = state;

    return promise;
  }
  
  // --- 각 속성별 Getter 함수 (내부는 getStatus를 호출하므로 수정 없음) ---

  async getPower(deviceId) {
    const status = await this.getStatus(deviceId);
    return status?.switch?.switch?.value === 'on';
  }
  
  async getMode(deviceId) {
    const status = await this.getStatus(deviceId);
    return status?.airConditionerMode?.airConditionerMode?.value || 'off';
  }
  
  async getCurrentTemperature(deviceId) {
    const status = await this.getStatus(deviceId);
    return status?.temperatureMeasurement?.temperature?.value ?? 0;
  }
  
  async getCoolingSetpoint(deviceId) {
    const status = await this.getStatus(deviceId);
    return status?.thermostatCoolingSetpoint?.coolingSetpoint?.value ?? 18;
  }

  async getWindFree(deviceId) {
    const status = await this.getStatus(deviceId);
    return status?.['custom.airConditionerOptionalMode']?.acOptionalMode?.value === 'windFree';
  }

  async getAutoClean(deviceId) {
    const status = await this.getStatus(deviceId);
    return status?.['custom.autoCleaningMode']?.autoCleaningMode?.value === 'on';
  }

  // --- 명령 전송 및 Set 함수들 (수정 없음) ---
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

  async setPower(deviceId, on) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'switch', command: on ? 'on' : 'off' }]); }
  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'custom.airConditionerOptionalMode', command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'custom.autoCleaningMode', command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
