// lib/SmartThings.js v2.0.0
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { LRUCache } = require('lru-cache');

const CAPABILITY = {
  OPTIONAL_MODE: 'custom.airConditionerOptionalMode',
  AUTO_CLEANING: 'custom.autoCleaningMode',
};

class SmartThings {
  constructor(log, api, config) {
    this.log = log;
    this.api = api;
    this.config = config;

    this.tokenPath = path.join(this.api.user.persistPath(), 'smartthings_ac_token.json');
    this.tokens = null;
    this.isRefreshing = false;
    this.pendingRequests = [];

    this.client = axios.create({
      baseURL: 'https://api.smartthings.com/v1',
      timeout: 10000,
    });

    this.setupInterceptors();

    this.cache = new LRUCache({ max: 100, ttl: 1000 * 2 });
    this.statusPromises = new Map();
  }

  setupInterceptors() {
    this.client.interceptors.request.use(
      config => {
        if (this.tokens && this.tokens.access_token) {
          config.headers.Authorization = `Bearer ${this.tokens.access_token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (!this.isRefreshing) {
            this.isRefreshing = true;
            try {
              const newAccessToken = await this.refreshToken();
              this.isRefreshing = false;
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              this.onRefreshed(null, newAccessToken);
              return this.client(originalRequest);
            } catch (refreshError) {
              this.isRefreshing = false;
              this.onRefreshed(refreshError, null);
              this.log.error('토큰 갱신 실패! 재인증이 필요할 수 있습니다.');
              return Promise.reject(refreshError);
            }
          }

          return new Promise((resolve, reject) => {
            this.pendingRequests.push({
              resolve: (newAccessToken) => {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                resolve(this.client(originalRequest));
              },
              reject
            });
          });
        }
        return Promise.reject(error);
      }
    );
  }
  
  onRefreshed(err, newAccessToken) {
      this.pendingRequests.forEach(({ resolve, reject }) => {
          if (err) {
              reject(err);
          } else {
              resolve(newAccessToken);
          }
      });
      this.pendingRequests = [];
  }

  async init() {
    try {
      this.tokens = JSON.parse(await fs.readFile(this.tokenPath, 'utf8'));
      this.log.info('저장된 OAuth 토큰을 성공적으로 불러왔습니다.');
    } catch (e) {
      this.log.warn('저장된 토큰이 없습니다. 사용자 인증 절차를 시작합니다.');

      if (this.config.authCode) {
        await this.getInitialTokens(this.config.authCode);
      } else {
        this.log.warn('====================[ 스마트싱스 인증 필요 ]====================');
        this.log.warn('1. 아래 URL을 복사하여 웹 브라우저에서 열고, 스마트싱스에 로그인하여 권한을 허용해주세요.');
        const authUrl = `https://api.smartthings.com/oauth/authorize?client_id=${this.config.clientId}&scope=r:devices:*+w:devices:*+x:devices:*&response_type=code&redirect_uri=https://localhost`;
        this.log.warn(`인증 URL: ${authUrl}`);
        this.log.warn('2. 권한 허용 후 리디렉션된 페이지의 주소창에서 "code=" 뒤의 값을 복사하세요.');
        this.log.warn('3. 복사한 코드를 config.json 파일의 "authCode" 필드에 붙여넣고 Homebridge를 재시작하세요.');
        this.log.warn('================================================================');
      }
    }
  }

  async getInitialTokens(code) {
    this.log.info('인증 코드를 사용하여 첫 토큰 발급을 시도합니다...');
    const tokenUrl = 'https://api.smartthings.com/oauth/token';
    const authHeader = 'Basic ' + Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    
    try {
        const response = await axios.post(tokenUrl, new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'https://localhost',
            client_id: this.config.clientId,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader,
            },
        });
        
        await this.saveTokens(response.data);
        this.log.info('초기 토큰 발급 및 저장이 완료되었습니다. 이제 플러그인이 정상 동작합니다.');
        this.log.warn('보안을 위해 config.json에서 "authCode" 값을 지워주세요.');

    } catch(e) {
        this.log.error(`초기 토큰 발급 실패: ${e.response?.status}`, e.response?.data || e.message);
        throw new Error('초기 토큰 발급에 실패했습니다. 코드가 유효한지 확인하세요.');
    }
  }
  
  async refreshToken() {
    this.log.info('액세스 토큰 갱신을 시도합니다...');
    if (!this.tokens || !this.tokens.refresh_token) {
        throw new Error('리프레시 토큰이 없어 갱신할 수 없습니다.');
    }
  
    const tokenUrl = 'https://api.smartthings.com/oauth/token';
    const authHeader = 'Basic ' + Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
  
    const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token,
    }), {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    await this.saveTokens(response.data);
    return this.tokens.access_token;
  }

  async saveTokens(tokens) {
    this.tokens = tokens;
    await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
    this.log.info('토큰을 성공적으로 저장/갱신했습니다.');
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

    if (this.statusPromises.has(deviceId)) {
      return this.statusPromises.get(deviceId);
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
        this.statusPromises.delete(deviceId);
      });

    this.statusPromises.set(deviceId, promise);
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

  async setPower(deviceId, on) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'switch', command: on ? 'on' : 'off' }]); }
  async setMode(deviceId, mode) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [mode] }]); }
  async setTemperature(deviceId, value) { return this.sendCommand(deviceId, [{ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [value] }]); }
  async setWindFree(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.OPTIONAL_MODE, command: 'setAcOptionalMode', arguments: [enable ? 'windFree' : 'off'] }]); }
  async setAutoClean(deviceId, enable) { return this.sendCommand(deviceId, [{ component: 'main', capability: CAPABILITY.AUTO_CLEANING, command: 'setAutoCleaningMode', arguments: [enable ? 'on' : 'off'] }]); }
}

module.exports = SmartThings;
