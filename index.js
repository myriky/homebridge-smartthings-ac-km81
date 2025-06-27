// index.js
// Homebridge-SmartThings-AC-KM81: 승준 에어컨 전용 한글 커스텀 버전 (디버그 로그 강화)
'use strict';

const SmartThings = require('./lib/SmartThings');

let Accessory, Service, Characteristic, UUIDGen;

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
    this.token = config.token;
    this.deviceLabel = config.deviceLabel || '승준 에어컨';

    this.accessories = [];
    this.smartthings = new SmartThings(this.token, this.deviceLabel, this.log);

    if (api) {
      this.api.on('didFinishLaunching', async () => {
        await this.discoverDevices();
      });
    }
  }

  configureAccessory(accessory) {
    this.log(`캐시된 액세서리 불러오기: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  async discoverDevices() {
    const devices = await this.smartthings.getDevices();
    this.log('[디버그] SmartThings에서 받아온 디바이스 label 목록:', devices.map(d => `"${d.label}"`).join(', '));

    let found = false;
    devices.forEach(device => {
      // 실제 label(공백 등 포함)을 로그로 확인
      this.log(`[디버그] 디바이스 label: [${device.label}] (ID: ${device.deviceId})`);
      if (device.label === this.deviceLabel) {
        found = true;
        this.log(`[디버그] 매칭된 디바이스: ${device.label}, deviceId: ${device.deviceId}`);
        this.addOrUpdateAccessory(device);
      }
    });
    if (!found) {
      this.log(`[경고] "${this.deviceLabel}"에 해당하는 디바이스를 SmartThings에서 찾지 못함!`);
    }
  }

  addOrUpdateAccessory(device) {
    const uuid = UUIDGen.generate(device.deviceId);
    let accessory = this.accessories.find(acc => acc.UUID === uuid);

    if (!accessory) {
      accessory = new Accessory(device.label, uuid);
      accessory.context.device = device;
      this.api.registerPlatformAccessories('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', [accessory]);
      this.accessories.push(accessory);
      this.log(`새 액세서리 등록: ${device.label}`);
    } else {
      accessory.context.device = device;
      this.log(`기존 액세서리 갱신: ${device.label}`);
    }

    this.setupHeaterCoolerService(accessory, device);
  }

  setupHeaterCoolerService(accessory, device) {
    const service = accessory.getService(Service.HeaterCooler) ||
      accessory.addService(Service.HeaterCooler, device.label);

    // 전원 제어
    service.getCharacteristic(Characteristic.Active)
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setPower(device.deviceId, !!value);
          callback();
        } catch (e) {
          this.log('전원 제어 오류:', e);
          callback(e);
        }
      });

    // 현재 모드: 제습만 "냉방"으로 매핑
    service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .on('get', async callback => {
        try {
          const mode = await this.smartthings.getMode(device.deviceId);
          if (mode === 'dry') {
            callback(null, Characteristic.CurrentHeaterCoolerState.COOLING);
          } else {
            callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE);
          }
        } catch (e) {
          this.log('모드 조회 오류:', e);
          callback(e);
        }
      });

    // 타겟 모드: 냉방(실제 제습)만 노출
    service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({ validValues: [Characteristic.TargetHeaterCoolerState.COOL] })
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setMode(device.deviceId, 'dry');
          callback();
        } catch (e) {
          this.log('모드 변경 오류:', e);
          callback(e);
        }
      });

    // 온도 설정: 18~30도, 1도 단위
    service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps({ minValue: 18, maxValue: 30, minStep: 1 })
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setTemperature(device.deviceId, value);
          callback();
        } catch (e) {
          this.log('온도 설정 오류:', e);
          callback(e);
        }
      });

    // 무풍(스윙)모드 매핑
    service.getCharacteristic(Characteristic.SwingMode)
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setWindFree(device.deviceId, !!value);
          callback();
        } catch (e) {
          this.log('무풍(스윙) 설정 오류:', e);
          callback(e);
        }
      });

    // 잠금(자동청소) 매핑
    service.getCharacteristic(Characteristic.LockPhysicalControls)
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setAutoClean(device.deviceId, !!value);
          callback();
        } catch (e) {
          this.log('자동청소 설정 오류:', e);
          callback(e);
        }
      });
  }
}
