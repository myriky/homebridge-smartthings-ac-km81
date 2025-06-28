// Homebridge-SmartThings-AC-KM81 v1.1.2
'use strict';

const SmartThings = require('./lib/SmartThings');
const pkg = require('./package.json'); // package.json을 불러와 버전 정보 사용

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

  async discoverDevices() {
    this.log.info('SmartThings에서 장치 목록을 가져오는 중...');
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
  }

  addOrUpdateAccessory(device) {
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

    // 액세서리 정보 설정
    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, 'AW06C7155WWA')
      .setCharacteristic(Characteristic.SerialNumber, '0LC5PDOY601505H')
      .setCharacteristic(Characteristic.FirmwareRevision, pkg.version); // package.json의 버전과 연동

    // 서비스 설정 (HeaterCooler 등)
    this.setupHeaterCoolerService(accessory);
  }
  
  _bindCharacteristic({ service, characteristic, props, getter, setter }) {
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
          default:
            return Characteristic.CurrentHeaterCoolerState.IDLE;
        }
      },
    });

    this._bindCharacteristic({
      service,
      characteristic: Characteristic.TargetHeaterCoolerState,
      props: { validValues: [Characteristic.TargetHeaterCoolerState.AUTO, Characteristic.TargetHeaterCoolerState.HEAT, Characteristic.TargetHeaterCoolerState.COOL] },
      getter: async () => {
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
      setter: async (value) => {
        let mode;
        switch (value) {
            case Characteristic.TargetHeaterCoolerState.COOL:
                mode = 'dry';
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
