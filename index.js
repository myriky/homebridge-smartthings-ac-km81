// index.js v2.3.0
'use strict';

const SmartThings = require('./lib/SmartThings');
const pkg = require('./package.json');
const http = require('http');
const url = require('url');
const https = require('https');

let Accessory, Service, Characteristic, UUIDGen;

const PLATFORM_NAME = 'SmartThingsAC-KM81';
const PLUGIN_NAME = 'homebridge-smartthings-ac-km81';

const normalizeKorean = s => (s || '').normalize('NFC').trim();

module.exports = (homebridge) => {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SmartThingsACPlatform);
};

class SmartThingsACPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = [];
        this.server = null;

        if (!config || !config.clientId || !config.clientSecret || !config.redirectUri) {
            this.log.error('SmartThings 인증 정보(clientId, clientSecret, redirectUri)가 설정되지 않았습니다.');
            return;
        }
        if (!config.devices || !Array.isArray(config.devices) || config.devices.length === 0) {
            this.log.error('연동할 디바이스가 설정되지 않았습니다.');
            return;
        }

        this.smartthings = new SmartThings(this.log, this.api, this.config);

        if (this.api) {
            this.log.info('SmartThings AC 플랫폼 초기화 중...');
            this.api.on('didFinishLaunching', async () => {
                this.log.info('Homebridge 실행 완료. 인증 상태 확인 및 장치 검색을 시작합니다.');
                const hasToken = await this.smartthings.init();
                if (hasToken) {
                    await this.discoverDevices();
                } else {
                    this.startAuthServer();
                }
            });
        }
    }

    // ... (startAuthServer, configureAccessory 등 기존 코드는 변경 없음) ...
    startAuthServer() {
        if (this.server) {
            this.server.close();
        }

        const listenPort = 8999;

        this.server = http.createServer(async (req, res) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                const reqUrl = url.parse(req.url, true);
                
                if (req.method === 'GET' && reqUrl.pathname === new url.URL(this.config.redirectUri).pathname) {
                    await this._handleOAuthCallback(req, res, reqUrl);
                } else if (req.method === 'POST') {
                    this._handleWebhookConfirmation(req, res, body);
                } else {
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.end('Not Found');
                }
            });
        }).listen(listenPort, () => {
            const scope = 'r:devices:* w:devices:* x:devices:*';
            const authUrl = `https://api.smartthings.com/oauth/authorize?client_id=${this.config.clientId}&scope=${encodeURIComponent(scope)}&response_type=code&redirect_uri=${encodeURIComponent(this.config.redirectUri)}`;

            this.log.warn('====================[ 스마트싱스 인증 필요 ]====================');
            this.log.warn(`1. 임시 인증 서버가 포트 ${listenPort}에서 실행 중입니다.`);
            this.log.warn('2. 아래 URL을 복사하여 웹 브라우저에서 열고, 스마트싱스에 로그인하여 권한을 허용해주세요.');
            this.log.warn(`인증 URL: ${authUrl}`);
            this.log.warn('3. 권한 허용 후, 자동으로 인증이 처리됩니다.');
            this.log.warn('================================================================');
        });

        this.server.on('error', (e) => { this.log.error(`인증 서버 오류: ${e.message}`); });
    }

    async _handleOAuthCallback(req, res, reqUrl) {
        const code = reqUrl.query.code;
        if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>인증 성공!</h1><p>SmartThings 인증에 성공했습니다. 이 창을 닫고 Homebridge를 재시작해주세요.</p>');
            this.log.info('인증 코드를 성공적으로 수신했습니다. 토큰을 발급받습니다...');
            try {
                await this.smartthings.getInitialTokens(code);
                this.log.info('최초 토큰 발급 완료! Homebridge를 재시작하면 장치가 연동됩니다.');
                if (this.server) this.server.close();
            } catch (e) {
                this.log.error('수신된 코드로 토큰 발급 중 오류 발생:', e.message);
            }
        } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>인증 실패</h1><p>URL에서 인증 코드를 찾을 수 없습니다.</p>');
        }
    }
    
    _handleWebhookConfirmation(req, res, body) {
        try {
            const payload = JSON.parse(body);
            if (payload.lifecycle === 'CONFIRMATION' && payload.confirmationData?.confirmationUrl) {
                const confirmationUrl = payload.confirmationData.confirmationUrl;
                this.log.info('스마트싱스로부터 Webhook CONFIRMATION 요청을 수신했습니다. 확인 URL에 접속합니다...');
                this.log.info(`확인 URL: ${confirmationUrl}`);

                https.get(confirmationUrl, (confirmRes) => {
                    this.log.info(`Webhook 확인 완료, 상태 코드: ${confirmRes.statusCode}`);
                }).on('error', (e) => {
                    this.log.error(`Webhook 확인 요청 오류: ${e.message}`);
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ "targetUrl": confirmationUrl }));
            } else {
                res.writeHead(200);
                res.end();
            }
        } catch (e) {
            this.log.error('POST 요청 처리 중 오류:', e.message);
            res.writeHead(400);
            res.end();
        }
    }

    configureAccessory(accessory) {
        this.log.info(`캐시된 액세서리 불러오기: ${accessory.displayName}`);
        this.accessories.push(accessory);
    }
    
    // _syncDevices 함수 수정: configDevice 전달
    _syncDevices(stDevices, configDevices) {
        for (const configDevice of configDevices) {
            const targetLabel = normalizeKorean(configDevice.deviceLabel);
            const foundDevice = stDevices.find(stDevice => normalizeKorean(stDevice.label) === targetLabel);

            if (foundDevice) {
                this.log.info(`'${configDevice.deviceLabel}' 장치를 찾았습니다. HomeKit에 추가/갱신합니다.`);
                this.addOrUpdateAccessory(foundDevice, configDevice); // configDevice 전달
            } else {
                this.log.warn(`'${configDevice.deviceLabel}'에 해당하는 장치를 SmartThings에서 찾지 못했습니다.`);
            }
        }
    }

    async discoverDevices() {
        this.log.info('SmartThings에서 장치 목록을 가져오는 중...');
        try {
            const stDevices = await this.smartthings.getDevices();
            if (!stDevices || stDevices.length === 0) {
                this.log.warn('SmartThings에서 어떤 장치도 찾지 못했습니다. 권한이나 연결을 확인해주세요.');
                return;
            }
            this.log.info(`총 ${stDevices.length}개의 SmartThings 장치를 발견했습니다. 설정된 장치와 비교합니다.`);
            
            this._syncDevices(stDevices, this.config.devices);

        } catch (e) {
            this.log.error('장치 검색 중 오류가 발생했습니다:', e.message);
        }
    }

    // addOrUpdateAccessory 함수 수정: configDevice 파라미터 추가 및 정보 설정
    addOrUpdateAccessory(device, configDevice) {
        const uuid = UUIDGen.generate(device.deviceId);
        let accessory = this.accessories.find(acc => acc.UUID === uuid);

        if (accessory) {
            this.log.info(`기존 액세서리 갱신: ${device.label}`);
            accessory.context.device = device;
            accessory.displayName = device.label;
        } else {
            this.log.info(`새 액세서리 등록: ${device.label}`);
            accessory = new Accessory(device.label, uuid);
            accessory.context.device = device;
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
        }

        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, 'Samsung')
            .setCharacteristic(Characteristic.Model, configDevice.model || 'AC-Model')
            .setCharacteristic(Characteristic.SerialNumber, configDevice.serialNumber || device.deviceId)
            .setCharacteristic(Characteristic.FirmwareRevision, pkg.version);

        this.setupHeaterCoolerService(accessory);
    }

    // ... (setupHeaterCoolerService, _bindCharacteristic 등 나머지 코드는 변경 없음) ...
    _bindCharacteristic({ service, characteristic, props, getter, setter }) {
        const char = service.getCharacteristic(characteristic);

        char.removeAllListeners('get');
        if (setter) char.removeAllListeners('set');

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
        
        this._bindCharacteristic({
            service,
            characteristic: Characteristic.Active,
            getter: () => this.smartthings.getPower(deviceId).then(p => p ? 1 : 0),
            setter: (value) => this.smartthings.setPower(deviceId, value === 1),
        });

        this._bindCharacteristic({
            service,
            characteristic: Characteristic.CurrentHeaterCoolerState,
            getter: async () => {
                if (!await this.smartthings.getPower(deviceId)) {
                    return Characteristic.CurrentHeaterCoolerState.INACTIVE;
                }
                return Characteristic.CurrentHeaterCoolerState.COOLING;
            },
        });

        this._bindCharacteristic({
            service,
            characteristic: Characteristic.TargetHeaterCoolerState,
            props: { validValues: [Characteristic.TargetHeaterCoolerState.COOL] },
            getter: () => Characteristic.TargetHeaterCoolerState.COOL,
            setter: async (value) => {
                if (value === Characteristic.TargetHeaterCoolerState.COOL) {
                    await this.smartthings.setMode(deviceId, 'auto');
                }
            },
        });

        this._bindCharacteristic({
            service,
            characteristic: Characteristic.CurrentTemperature,
            getter: () => this.smartthings.getCurrentTemperature(deviceId),
        });

        this._bindCharacteristic({
            service,
            characteristic: Characteristic.CoolingThresholdTemperature,
            props: { minValue: 18, maxValue: 30, minStep: 0.5 },
            getter: () => this.smartthings.getCoolingSetpoint(deviceId),
            setter: (value) => this.smartthings.setTemperature(deviceId, value),
        });

        this._bindCharacteristic({
            service,
            characteristic: Characteristic.SwingMode,
            getter: () => this.smartthings.getWindFree(deviceId).then(w => w ? 1 : 0),
            setter: (value) => this.smartthings.setWindFree(deviceId, value === 1),
        });

        this._bindCharacteristic({
            service,
            characteristic: Characteristic.LockPhysicalControls,
            getter: () => this.smartthings.getAutoClean(deviceId).then(a => a ? 1 : 0),
            setter: (value) => this.smartthings.setAutoClean(deviceId, value === 1),
        });
    }
}
