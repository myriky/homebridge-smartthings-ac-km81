// Homebridge-SmartThings-AC-KM81 v1.1.1
'use strict';

const SmartThings = require('./lib/SmartThings');

let Accessory, Service, Characteristic, UUIDGen;

const normalizeKorean = s => (s || '').normalize('NFC').trim();

module.exports = (homebridge) => {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', SmartThingsACPlatform);
};

class SmartThingsACPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = [];

    // 1. 설정값 검증 강화
    if (!config) {
      this.log.warn('설정이 없습니다. 플러그인을 비활성화합니다.');
      return;
    }
    if (!config.token) {
      this.log.error('SmartThings 토큰이 설정되지 않았습니다. config.json을 확인해주세요.');
      return;
    }
    if (!config.devices || !Array.isArray(config.devices) || config.devices.length === 0) {
      this.log.error('연동할 디바이스가 설정되지 않았습니다. config.json의 "devices" 배열을 확인해주세요.');
      return;
    }

    this.smartthings = new SmartThings(config.token, this.log);

    if (this.api) {
      this.log.info('SmartThings AC 플랫폼 초기화 중...');
      this.api.on('didFinishLaunching', async () => {
        this.log.info('Homebridge 실행 완료. 장치 검색을 시작합니다.');
        await this.discoverDevices();
      });
    }
  }

  configureAccessory(accessory) {
    this.log.info(`캐시된 액세서리 불러오기: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  // 2. 다중 디바이스 지원 로직
  async discoverDevices() {
    this.log.info('SmartThings에서 장치 목록을 가져오는 중...');
    const stDevices = await this.smartthings.getDevices();
    const configDevices = this.config.devices;

    if (stDevices.length === 0) {
        this.log.warn('SmartThings에서 어떤 장치도 찾지 못했습니다. 토큰이나 연결을 확인해주세요.');
        return;
    }

    this.log.info(`총 ${stDevices.length}개의 SmartThings 장치를 발견했습니다. 설정된 장치와 비교합니다.`);

    // 설정 파일에 있는 장치들을 순회
    for (const configDevice of configDevices) {
      const targetLabel = normalizeKorean(configDevice.deviceLabel);
      const foundDevice = stDevices.find(stDevice => normalizeKorean(stDevice.label) === targetLabel);

      if (foundDevice) {
        this.log.info(`'${configDevice.deviceLabel}' 장치를 찾았습니다. HomeKit에 추가/갱신합니다.`);
        this.addOrUpdateAccessory(foundDevice);
      } else {
        this.log.warn(`'${configDevice.deviceLabel}'에 해당하는 장치를 SmartThings에서 찾지 못했습니다.`);
      }
    }
  }

  addOrUpdateAccessory(device) {
    const uuid = UUIDGen.generate(device.deviceId);
    const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

    if (existingAccessory) {
      this.log.info(`기존 액세서리 갱신: ${device.label}`);
      existingAccessory.context.device = device;
      this.setupHeaterCoolerService(existingAccessory);
    } else {
      this.log.info(`새 액세서리 등록: ${device.label}`);
      const accessory = new Accessory(device.label, uuid);
      accessory.context.device = device;
      this.setupHeaterCoolerService(accessory);
      this.api.registerPlatformAccessories('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', [accessory]);
      this.accessories.push(accessory);
    }
  }
  
  // 3. 코드 구조화 (헬퍼 함수) 및 리스너 중복 방지
  _bindCharacteristic({ service, characteristic, props, getter, setter }) {
    const char = service.getCharacteristic(characteristic);
    
    // 기존 리스너 모두 제거하여 중복 방지
    char.removeAllListeners('get');
    char.removeAllListeners('set');

    if (props) {
      char.setProps(props);
    }
    
    char.on('get', async (callback) => {
      try {
        const value = await getter();
        callback(null, value);
      } catch (e) {
        this.log.error(`[${service.displayName}] ${characteristic.name} GET 오류:`, e.message);
        callback(e);
      }
    });

    if (setter) {
      char.on('set', async (value, callback) => {
        try {
          await setter(value);
          callback(null);
        } catch (e) {
          this.log.error(`[${service.displayName}] ${characteristic.name} SET 오류:`, e.message);
          callback(e);
        }
      });
    }
  }

  setupHeaterCoolerService(accessory) {
    const deviceId = accessory.context.device.deviceId;
    const service = accessory.getService(Service.HeaterCooler) ||
      accessory.addService(Service.HeaterCooler, accessory.displayName);

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.Active,
      getter: async () => await this.smartthings.getPower(deviceId) ? 1 : 0,
      setter: async (value) => await this.smartthings.setPower(deviceId, value === 1),
    });

    // 4. 모드 상태 상세 반영
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.CurrentHeaterCoolerState,
      getter: async () => {
        if (!await this.smartthings.getPower(deviceId)) {
          return Characteristic.CurrentHeaterCoolerState.INACTIVE;
        }
        const mode = await this.smartthings.getMode(deviceId);
        switch (mode) {
          case 'cool':
          case 'dry':
            return Characteristic.CurrentHeaterCoolerState.COOLING;
          case 'heat':
            return Characteristic.CurrentHeaterCoolerState.HEATING;
          default: // fan, auto 등
            return Characteristic.CurrentHeaterCoolerState.IDLE;
        }
      },
    });

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.TargetHeaterCoolerState,
      props: { validValues: [Characteristic.TargetHeaterCoolerState.AUTO, Characteristic.TargetHeaterCoolerState.HEAT, Characteristic.TargetHeaterCoolerState.COOL] },
      getter: async () => { // 목표 상태도 실제 상태 기반으로 추정
        const mode = await this.smartthings.getMode(deviceId);
        switch (mode) {
          case 'cool':
          case 'dry':
            return Characteristic.TargetHeaterCoolerState.COOL;
          case 'heat':
            return Characteristic.TargetHeaterCoolerState.HEAT;
          default:
            return Characteristic.TargetHeaterCoolerState.AUTO;
        }
      },
      setter: async (value) => { // 홈 앱의 목표 상태에 따라 실제 모드 변경 (커스텀 가능)
        let mode;
        switch (value) {
            case Characteristic.TargetHeaterCoolerState.COOL:
                mode = 'dry'; // 기존 로직: '냉방' 선택 시 '제습'으로 동작
                break;
            case Characteristic.TargetHeaterCoolerState.HEAT:
                mode = 'heat';
                break;
            case Characteristic.TargetHeaterCoolerState.AUTO:
                mode = 'auto';
                break;
        }
        await this.smartthings.setMode(deviceId, mode);
      },
    });

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.CurrentTemperature,
      getter: async () => await this.smartthings.getCurrentTemperature(deviceId),
    });

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.CoolingThresholdTemperature,
      props: { minValue: 18, maxValue: 30, minStep: 1 },
      getter: async () => await this.smartthings.getCoolingSetpoint(deviceId),
      setter: async (value) => await this.smartthings.setTemperature(deviceId, value),
    });
    
    // 난방 희망 온도 (필요 시)
    // this._bindCharacteristic({ ... Characteristic.HeatingThresholdTemperature ... });

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.SwingMode,
      getter: async () => await this.smartthings.getWindFree(deviceId) ? 1 : 0,
      setter: async (value) => await this.smartthings.setWindFree(deviceId, value === 1),
    });

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.LockPhysicalControls,
      getter: async () => await this.smartthings.getAutoClean(deviceId) ? 1 : 0,
      setter: async (value) => await this.smartthings.setAutoClean(deviceId, value === 1),
    });
  }
}
