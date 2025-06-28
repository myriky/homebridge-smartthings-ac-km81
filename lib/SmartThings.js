// lib/SmartThings.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { LRUCache } = require('lru-cache');

const CAPABILITY = {
  OPTIONAL_MODE: 'custom.airConditionerOptionalMode',
  AUTO_CLEANING: 'custom.autoCleaningMode',
};

class SmartThings {
  constructor(config, log, api) {
    this.config = config;
    this.log = log;
    this.api = api;
    this.tokenPath = path.join(this.api.user.persistPath(), 'smartthings-ac-tokens.json');
    this.tokens = null;

    this.cache = new LRUCache({ max: 100, ttl: 1000 * 2 });
    this.pendingPromises = new Map();
  }

  async initialize() {
    try {
      this.tokens = await this.loadTokens();
      this.log.info('저장된 OAuth 토큰을 성공적으로 불러왔습니다.');
    } catch (e) {
      if (this.config.authCode) {
        this.log.info('인증 코드를 발견했습니다. 새로운 토큰 발급을 시도합니다...');
        await this.getInitialTokens(this.config.authCode);
      } else {
        this.log.warn('저장된 토큰이 없습니다. 사용자 인증이 필요합니다.');
        this.log.warn('--------------------[최초 인증 안내]--------------------');
        this.log.warn('1. 아래 URL을 복사하여 웹 브라우저에서 열고, 스마트싱스에 로그인하여 권한을 허용해주세요.');
        const authUrl = `https://api.smartthings.com/oauth/authorize?client_id=${this.config.clientId}&scope=r:devices:* w:devices:* x:devices:*&response_type=code&redirect_uri=https://localhost`;
        this.log.warn(`인증 URL: ${authUrl}`);
        this.log.warn('2. 권한 허용 후 리디렉션된 페이지의 주소창에서 "code=" 뒤의 값을 복사하세요.');
        this.log.warn('3. 복사한 코드를 config.json 파일의 "authCode" 필드에 붙여넣고 Homebridge를 재시작하세요.');
        this.log.warn('---------------------------------------------------------');
        throw new Error('인증 필요');
      }
    }
  }

  async loadTokens() {
    const data = await fs.readFile(this.tokenPath, 'utf8');
    const tokens = JSON.parse(data);
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('Invalid token file');
    this.tokens = tokens;
    return tokens;
  }

  async saveTokens() {
    this.tokens.timestamp = Date.now();
    await fs.writeFile(this.tokenPath, JSON.stringify(this.tokens, null, 2), 'utf8');
    this.log.info('OAuth 토큰을 성공적으로 저장/갱신했습니다.');
  }

  async getInitialTokens(code) {
    const res = await axios.post('https://api.smartthings.com/oauth/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'https://localhost',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    }));
    this.tokens = res.data;
    await this.saveTokens();
    this.log.info('초기 토큰 발급 성공! 이제 config.json에서 authCode를 제거하셔도 됩니다.');
  }

  async refreshToken() {
    if (!this.tokens || !this.tokens.refresh_token) throw new Error('리프레시 토큰 없음');
    this.log.info('액세스 토큰 갱신을 시도합니다...');
    try {
      const res = await axios.post('https://api.smartthings.com/oauth/token', new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }));
      this.tokens = res.data;
      await this.saveTokens();
      return this.tokens.access_token;
    } catch(e) {
      this.log.error('토큰 갱신 실패! 재인증이 필요할 수 있습니다.', e.response?.data || e.message);
      throw new Error('토큰 갱신 실패');
    }
  }

  async _request(method, url, data = null, isRetry = false) {
    if (!this.tokens) throw new Error('API 호출 실패: 인증 토큰 없음');

    try {
      const res = await axios({
        method,
        url: `https://api.smartthings.com/v1${url}`,
        headers: { 'Authorization': `Bearer ${this.tokens.access_token}` },
        data,
        timeout: 10000,
      });
      return res.data;
    } catch (e) {
      if (e.response && e.response.status === 401 && !isRetry) {
        this.log.warn('액세스 토큰 만료됨. 갱신 후 재시도합니다.');
        await this.refreshToken();
        return this._request(method, url, data, true);
      }
      this.log.error(`API 요청 실패: ${method} ${url}`, e.response?.data || e.message);
      throw e;
    }
  }

  async getDevices() { return (await this._request('get', '/devices')).items || []; }
  async getStatus(deviceId) {
    const cachedData = this.cache.get(deviceId);
    if (cachedData) return cachedData;
    if (this.pendingPromises.has(deviceId)) return this.pendingPromises.get(deviceId);
    
    const promise = this._request('get', `/devices/${deviceId}/status`)
      .then(data => {
        const componentData = data.components.main;
        this.cache.set(deviceId, componentData);
        return componentData;
      }).finally(() => {
        this.pendingPromises.delete(deviceId);
      });
    
    this.pendingPromises.set(deviceId, promise);
    return promise;
  }
  
  async sendCommand(deviceId, commands) {
    this.log.info(`[명령 전송] deviceId: ${deviceId}, commands:`, JSON.stringify(commands));
    return this._request('post', `/devices/${deviceId}/commands`, { commands });
  }

  async getPower(deviceId) { return (await this.getStatus(deviceId)).switch.switch.value === 'on'; }
  async getMode(deviceId) { return (await this.getStatus(deviceId)).airConditionerMode.airConditionerMode.value || 'off'; }
  async getCurrentTemperature(deviceId) { return (await this.getStatus(deviceId)).temperatureMeasurement.temperature.value ?? 0; }
  async getCoolingSetpoint(deviceId) { return (await this.getStatus(deviceId)).thermostatCoolingSetpoint.coolingSetpoint.value ?? 18; }
  async getWindFree(deviceId) { return (await this.getStatus(deviceId))[CAPABILITY.OPTIONAL_MODE]?.acOptionalMode?.value === 'windFree'; }
  async getAutoClean(deviceId) { return (await this.getStatus(deviceId))[CAPABILITY.AUTO_CLEANING]?.autoCleaningMode?.value === 'on'; }
  
  async setPower(deviceId, on) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'switch', command: on ? 'on' : 'off' }]); }
  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.OPTIONAL_MODE, command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.AUTO_CLEANING, command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
