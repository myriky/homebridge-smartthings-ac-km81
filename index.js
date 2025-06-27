// index.js
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
    let found = false;
    devices.forEach(device => {
      if (normalizeKorean(device.label) === normalizeKorean(this.deviceLabel)) {
        found = true;
        this.log(`매칭된 디바이스 발견: ${device.label} (ID: ${device.deviceId})`);
        this.addOrUpdateAccessory(device);
      }
    });
    if (!found) {
      this.log(`[경고] "${this.deviceLabel}"에 해당하는 디바이스를 SmartThings에서 찾지 못했습니다!`);
    }
  }

  addOrUpdateAccessory(device) {
    const uuid = UUIDGen.generate(device.deviceId);
    let accessory = this.accessories.find(acc => acc.UUID === uuid);

    if (!accessory) {
      accessory = new Accessory(device.label, uuid);
      accessory.context.device = device;
      this.setupHeaterCoolerService(accessory); // 서비스 설정 분리
      this.api.registerPlatformAccessories('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', [accessory]);
      this.accessories.push(accessory);
      this.log(`새 액세서리 등록: ${device.label}`);
    } else {
      accessory.context.device = device;
      this.setupHeaterCoolerService(accessory); // 기존 액세서리도 서비스 갱신
      this.log(`기존 액세서리 갱신: ${device.label}`);
    }
  }

  setupHeaterCoolerService(accessory) {
    const deviceId = accessory.context.device.deviceId;
    const service = accessory.getService(Service.HeaterCooler) ||
      accessory.addService(Service.HeaterCooler, accessory.displayName);

    // --- Active (전원) ---
    service.getCharacteristic(Characteristic.Active)
      .on('get', async (callback) => {
        try {
          const power = await this.smartthings.getPower(deviceId);
          callback(null, power ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
        } catch (e) {
          callback(e);
        }
      })
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setPower(deviceId, value === Characteristic.Active.ACTIVE);
          callback();
        } catch (e) {
          this.log('전원 제어 오류:', e);
          callback(e);
        }
      });

    // --- CurrentHeaterCoolerState (현재 기기 상태) ---
    service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .on('get', async (callback) => {
        try {
          const power = await this.smartthings.getPower(deviceId);
          if (!power) {
              callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE);
              return;
          }
          const mode = await this.smartthings.getMode(deviceId);
          // 'dry' 모드일 때 COOLING으로 표시 (기존 로직 유지)
          if (mode === 'dry') {
            callback(null, Characteristic.CurrentHeaterCoolerState.COOLING);
          } else {
            // 다른 모드도 필요 시 여기에 추가 가능
            callback(null, Characteristic.CurrentHeaterCoolerState.IDLE); // 꺼져있지 않고, 냉방도 아닐 때
          }
        } catch (e) {
          this.log('현재 모드 조회 오류:', e);
          callback(e);
        }
      });
      
    // --- TargetHeaterCoolerState (목표 기기 상태) ---
    service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({ validValues: [Characteristic.TargetHeaterCoolerState.COOL] })
      .on('set', async (value, callback) => {
        try {
          // COOL을 설정하면 'dry' 모드로 동작 (기존 로직 유지)
          await this.smartthings.setMode(deviceId, 'dry');
          callback();
        } catch (e) {
          this.log('모드 변경 오류:', e);
          callback(e);
        }
      });

    // --- CurrentTemperature (현재 온도) ---
    service.getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', async (callback) => {
        try {
          const temp = await this.smartthings.getCurrentTemperature(deviceId);
          callback(null, temp);
        } catch(e) {
          this.log('현재 온도 조회 오류:', e);
          callback(e);
        }
      });

    // --- CoolingThresholdTemperature (냉방 설정 온도) ---
    service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps({ minValue: 18, maxValue: 30, minStep: 1 })
      .on('get', async (callback) => {
          try {
              const temp = await this.smartthings.getCoolingSetpoint(deviceId);
              callback(null, temp);
          } catch(e) {
              this.log('설정 온도 조회 오류:', e);
              callback(e);
          }
      })
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setTemperature(deviceId, value);
          callback();
        } catch (e) {
          this.log('온도 설정 오류:', e);
          callback(e);
        }
      });

    // --- SwingMode (무풍 모드) ---
    service.getCharacteristic(Characteristic.SwingMode)
      .on('get', async (callback) => {
          try {
              const enabled = await this.smartthings.getWindFree(deviceId);
              callback(null, enabled ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED);
          } catch(e) {
              this.log('무풍(스윙) 조회 오류:', e);
              callback(e);
          }
      })
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setWindFree(deviceId, value === Characteristic.SwingMode.SWING_ENABLED);
          callback();
        } catch (e) {
          this.log('무풍(스윙) 설정 오류:', e);
          callback(e);
        }
      });

    // --- LockPhysicalControls (자동청소 모드) ---
    service.getCharacteristic(Characteristic.LockPhysicalControls)
      .on('get', async (callback) => {
          try {
              const enabled = await this.smartthings.getAutoClean(deviceId);
              callback(null, enabled ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
          } catch (e) {
              this.log('자동청소 조회 오류:', e);
              callback(e);
          }
      })
      .on('set', async (value, callback) => {
        try {
          await this.smartthings.setAutoClean(deviceId, value === Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
          callback();
        } catch (e) {
          this.log('자동청소 설정 오류:', e);
          callback(e);
        }
      });
  }
}
