// index.js (냉방/꺼짐 전용 최종 버전)
'use strict';

const SmartThings = require('./lib/SmartThings');
const pkg = require('./package.json');

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
    // ... 이 부분은 수정 없음 ...
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = [];

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
    // ... 이 부분은 수정 없음 ...
    this.log.info(`캐시된 액세서리 불러오기: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  async discoverDevices() {
    // ... 이 부분은 수정 없음 ...
    this.log.info('SmartThings에서 장치 목록을 가져오는 중...');
    try {
        const stDevices = await this.smartthings.getDevices();
        const configDevices = this.config.devices;

        if (stDevices.length === 0) {
            this.log.warn('SmartThings에서 어떤 장치도 찾지 못했습니다. 토큰이나 연결을 확인해주세요.');
            return;
        }

        this.log.info(`총 ${stDevices.length}개의 SmartThings 장치를 발견했습니다. 설정된 장치와 비교합니다.`);

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
    } catch(e) {
        this.log.error('장치 검색 중 오류가 발생했습니다:', e.message);
    }
  }

  addOrUpdateAccessory(device) {
    // ... 이 부분은 수정 없음 ...
    const uuid = UUIDGen.generate(device.deviceId);
    let accessory = this.accessories.find(acc => acc.UUID === uuid);

    if (accessory) {
      this.log.info(`기존 액세서리 갱신: ${device.label}`);
      accessory.context.device = device;
    } else {
      this.log.info(`새 액세서리 등록: ${device.label}`);
      accessory = new Accessory(device.label, uuid);
      accessory.context.device = device;
      this.api.registerPlatformAccessories('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', [accessory]);
      this.accessories.push(accessory);
    }

    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, 'AW06C7155WWA')
      .setCharacteristic(Characteristic.SerialNumber, '0LC5PDOY601505H')
      .setCharacteristic(Characteristic.FirmwareRevision, pkg.version);

    this.setupHeaterCoolerService(accessory);
  }
  
  _bindCharacteristic({ service, characteristic, props, getter, setter }) {
    // ... 이 부분은 수정 없음 ...
    const char = service.getCharacteristic(characteristic);
    
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
        this.log.error(`[${service.displayName}] ${characteristic.displayName} GET 오류:`, e.message);
        callback(e);
      }
    });

    if (setter) {
      char.on('set', async (value, callback) => {
        try {
          await setter(value);
          callback(null);
        } catch (e) {
          this.log.error(`[${service.displayName}] ${characteristic.displayName} SET 오류:`, e.message);
          callback(e);
        }
      });
    }
  }

  setupHeaterCoolerService(accessory) {
    const deviceId = accessory.context.device.deviceId;
    const service = accessory.getService(Service.HeaterCooler) ||
      accessory.addService(Service.HeaterCooler, accessory.displayName);

    // 전원 켜기/끄기
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.Active,
      getter: async () => await this.smartthings.getPower(deviceId) ? 1 : 0,
      setter: async (value) => await this.smartthings.setPower(deviceId, value === 1),
    });

    // ▼▼▼ 핵심 수정 부분 v2 ▼▼▼

    // 현재 기기 상태 (꺼짐 / 냉방중)
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.CurrentHeaterCoolerState,
      getter: async () => {
        const isPoweredOn = await this.smartthings.getPower(deviceId);
        // 전원이 켜져있으면 무조건 '냉방중'으로, 꺼져있으면 '비활성'으로 표시
        return isPoweredOn ? Characteristic.CurrentHeaterCoolerState.COOLING : Characteristic.CurrentHeaterCoolerState.INACTIVE;
      },
    });

    // 목표 상태 (냉방 모드만 선택 가능)
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.TargetHeaterCoolerState,
      // 선택 가능한 모드에서 '자동'과 '난방'을 제거하고 '냉방'만 남김
      props: { validValues: [Characteristic.TargetHeaterCoolerState.COOL] },
      getter: async () => {
        // 켜져있다면 항상 목표 상태는 '냉방'
        return Characteristic.TargetHeaterCoolerState.COOL;
      },
      setter: async (value) => {
        // 홈킷에서 '냉방'으로 설정하면, 실제 에어컨은 '제습(dry)' 모드로 켬
        if (value === Characteristic.TargetHeaterCoolerState.COOL) {
          await this.smartthings.setMode(deviceId, 'dry');
        }
      },
    });

    // ▲▲▲ 핵심 수정 부분 v2 ▲▲▲

    // 현재 온도
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.CurrentTemperature,
      getter: async () => await this.smartthings.getCurrentTemperature(deviceId),
    });

    // 목표 온도
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.CoolingThresholdTemperature,
      props: { minValue: 18, maxValue: 30, minStep: 1 },
      getter: async () => await this.smartthings.getCoolingSetpoint(deviceId),
      setter: async (value) => await this.smartthings.setTemperature(deviceId, value),
    });

    // 무풍 모드 (스윙으로 제어)
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.SwingMode,
      getter: async () => await this.smartthings.getWindFree(deviceId) ? 1 : 0,
      setter: async (value) => await this.smartthings.setWindFree(deviceId, value === 1),
    });

    // 자동 건조 (잠금으로 제어)
    this._bindCharacteristic({
      service,
      characteristic: Characteristic.LockPhysicalControls,
      getter: async () => await this.smartthings.getAutoClean(deviceId),
      setter: async (value) => await this.smartthings.setAutoClean(deviceId, value === 1),
    });
  }
}
