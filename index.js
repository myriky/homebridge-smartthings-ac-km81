// index.js
// Homebridge-SmartThings-AC-KM81: 승준 에어컨 전용 한글 커스텀 버전
// 주요 기능: "승준 에어컨"만 등록, 홈킷 냉방은 제습 매핑, 무풍/자동청소/온도 18~30/한글화

'use strict';

const SmartThings = require('./lib/SmartThings');

let Accessory, Service, Characteristic, UUIDGen;

module.exports = (homebridge) => {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', SmartThingsACPlatform, true);
};

// 한글: 플랫폼 클래스
class SmartThingsACPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.token = config.token;
    this.deviceLabel = config.deviceLabel || '승준 에어컨'; // 한글: 기본값

    this.accessories = [];
    this.smartthings = new SmartThings(this.token, this.deviceLabel, this.log);

    if (api) {
      this.api.on('didFinishLaunching', () => {
        this.discoverDevices();
      });
    }
  }

  // 한글: "승준 에어컨"만 Homebridge에 등록
  async discoverDevices() {
    const devices = await this.smartthings.getDevices();
    devices.forEach(device => {
      if (device.label === this.deviceLabel) {
        this.addAccessory(device);
      }
    });
  }

  addAccessory(device) {
    const uuid = UUIDGen.generate(device.deviceId);
    let accessory = this.accessories.find(acc => acc.UUID === uuid);

    if (!accessory) {
      accessory = new Accessory(device.label, uuid);
      accessory.context.device = device;
      this.api.registerPlatformAccessories('homebridge-smartthings-ac-km81', 'SmartThingsAC-KM81', [accessory]);
    }

    const service = accessory.getService(Service.HeaterCooler) ||
      accessory.addService(Service.HeaterCooler, device.label);

    // 한글: 홈킷 냉방 모드를 "제습"에 매핑 (냉방만 남기고, 자동/난방 제거)
    service.getCharacteristic(Characteristic.Active)
      .on('set', async (value, callback) => {
        try {
          if (value) {
            await this.smartthings.setPower(device.deviceId, true);
          } else {
            await this.smartthings.setPower(device.deviceId, false);
          }
          callback();
        } catch (e) {
          this.log('전원 제어 오류:', e);
          callback(e);
        }
      });

    // 한글: 냉방 모드(실제 제습)만 사용
    service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .on('get', async callback => {
        const mode = await this.smartthings.getMode(device.deviceId);
        if (mode === 'dry') {
          callback(null, Characteristic.CurrentHeaterCoolerState.COOLING);
        } else {
          callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE);
        }
      });

    service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({ validValues: [Characteristic.TargetHeaterCoolerState.COOL] }) // 냉방만
      .on('set', async (value, callback) => {
        try {
          // 한글: 항상 "제습"으로 설정
          await this.smartthings.setMode(device.deviceId, 'dry');
          callback();
        } catch (e) {
          this.log('모드 변경 오류:', e);
          callback(e);
        }
      });

    // 한글: 온도 18~30도, 1도 단위로 제한
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

    // 한글: 무풍(스윙)모드 매핑 (HomeKit 스윙모드 <-> SmartThings 무풍)
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

    // 한글: 잠금(자동청소) 매핑 (HomeKit 잠금 <-> SmartThings 자동청소)
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