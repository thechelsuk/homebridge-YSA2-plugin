import { Yale } from 'yalesyncalarm';
import { platformConfigDecoder } from './YaleSyncPlatformConfig';
import { Logger, LogLevel } from 'yalesyncalarm/dist/Logger';
import { ContactSensor, MotionSensor, Panel } from 'yalesyncalarm/dist/Model';
import { modeToCurrentState, targetStateToString, targetStateToMode, currentStateToString } from './YaleSyncHelpers';
import wait from './Wait';
import { API, DynamicPlatformPlugin, Logger as HBLogger, PlatformConfig, PlatformAccessory as HBPlatformAccessory, CharacteristicValue, CharacteristicGetCallback, CharacteristicSetCallback } from 'homebridge';

const pluginName = 'homebridge-yalesyncalarm';
const platformName = 'YaleSyncAlarm';

class YaleSyncPlatform implements DynamicPlatformPlugin {
	private _yale?: Yale;
	private _accessories: { [key: string]: any } = {};
	private readonly _log!: HBLogger;
	private readonly _api!: API;
	private readonly _config!: PlatformConfig;
	private Service: any;
	private Characteristic: any;
	private UUIDGenerator: any;
	private PlatformAccessory: any;

		configureAccessory(accessory: HBPlatformAccessory): void {
			// Required by Homebridge v2 platform interface
			// Store or restore accessory as needed
			this._accessories[accessory.UUID] = accessory;
		}

		async heartbeat(interval: number) {
		if (!this._yale) return;
		await wait(interval * 1000);
		await this._yale.update();
		const [panel, motionSensors, contactSensors] = await Promise.all([
		    this._yale.panel(),
		    this._yale.motionSensors(),
		    this._yale.contactSensors(),
		]);
		for (const [uuid, accessory] of Object.entries(this._accessories)) {
		    if (accessory.context.kind === 'panel' && panel !== undefined) {
			if (accessory.identifier === panel.identifier) {
			    accessory
				.getService(this.Service.SecuritySystem)
				.getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
				?.setValue(modeToCurrentState(this.Characteristic, panel.state), undefined, 'no_recurse');
			}
		    } else if (accessory.context.kind === 'motionSensor') {
			const motionSensor = motionSensors[accessory.context.identifier];
			if (motionSensor) {
			    accessory
				.getService(this.Service.MotionSensor)
				.getCharacteristic(this.Characteristic.MotionDetected)
				?.setValue(
				    motionSensor.state === MotionSensor.State.Triggered ? true : false,
				    undefined,
				    'no_recurse'
				);
			}
		    } else if (accessory.context.kind === 'contactSensor') {
			const contactSensor = contactSensors[accessory.context.identifier];
			if (contactSensor) {
			    accessory
				.getService(this.Service.ContactSensor)
				.getCharacteristic(this.Characteristic.ContactSensorState)
				?.setValue(
				    contactSensor.state === ContactSensor.State.Closed ? 0 : 1,
				    undefined,
				    'no_recurse'
				);
			}
		    }
		}
	    }

			public configureMotionSensor(accessory: any): void {
				if (this._yale === undefined) {
					// Incorrectly configured plugin.
					return;
				}
				if (this._accessories[accessory.UUID] === undefined) {
					const informationService: any = accessory.getService(this.Service.AccessoryInformation);
					informationService
						.setCharacteristic(this.Characteristic.Name, accessory.displayName)
						.setCharacteristic(this.Characteristic.Manufacturer, 'Yale')
						.setCharacteristic(this.Characteristic.Model, 'Motion Sensor')
						.setCharacteristic(this.Characteristic.SerialNumber, accessory.context.identifier);
					const sensorService: any =
						accessory.getService(this.Service.MotionSensor) !== undefined
							? accessory.getService(this.Service.MotionSensor)
							: accessory.addService(this.Service.MotionSensor);
					sensorService
						.getCharacteristic(this.Characteristic.MotionDetected)
						.on('get' as any, async (callback: CharacteristicGetCallback) => {
							if (this._yale === undefined) {
								callback(new Error(`${pluginName} incorrectly configured`));
								return;
							}
							const motionSensors = await this._yale.motionSensors();
							const motionSensor = motionSensors[accessory.context.identifier];
							if (motionSensor !== undefined) {
								   this._log.info(`Fetching status of motion sensor: ${motionSensor.name} ${motionSensor.identifier}`);
								callback(null, false);
								const updated = await this._yale.updateMotionSensor(motionSensor);
								if (updated !== undefined) {
									   this._log.info(`Motion sensor: ${motionSensor.name} ${motionSensor.identifier}, state: ${updated.state === MotionSensor.State.Triggered ? 'triggered' : 'none detected'}`);
									sensorService.getCharacteristic(this.Characteristic.MotionDetected)?.updateValue(updated.state === MotionSensor.State.Triggered ? true : false);
								} else {
									callback(new Error(`Failed to get status of motion sensor: ${motionSensor.name} ${motionSensor.identifier}`));
								}
							} else {
								callback(new Error(`Motion sensor: ${accessory.context.identifier} not found`));
							}
						});
					this._accessories[accessory.UUID] = accessory;
				}
			}

			public configurePanel(accessory: any): void {
				if (this._yale === undefined) {
					// Incorrectly configured plugin.
					return;
				}
				if (this._accessories[accessory.UUID] === undefined) {
					const informationService: any = accessory.getService(this.Service.AccessoryInformation);
					informationService
						.setCharacteristic(this.Characteristic.Name, accessory.displayName)
						.setCharacteristic(this.Characteristic.Manufacturer, 'Yale')
						.setCharacteristic(this.Characteristic.Model, 'Yale IA-320')
						.setCharacteristic(this.Characteristic.SerialNumber, accessory.context.identifier);
					const securitySystem: any =
						accessory.getService(this.Service.SecuritySystem) !== undefined
							? accessory.getService(this.Service.SecuritySystem)
							: accessory.addService(this.Service.SecuritySystem);
					securitySystem
						.getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
						.on('get' as any, async (callback: CharacteristicGetCallback) => {
							if (this._yale === undefined) {
								callback(new Error(`${pluginName} incorrectly configured`));
								return;
							}
							   this._log.info(`Fetching panel state`);
							let panelMode = await this._yale.getPanelState();
							let panelState = modeToCurrentState(this.Characteristic, panelMode);
							   this._log.info(`Panel mode: ${panelMode}, HomeKit state: ${currentStateToString(this.Characteristic, panelState)}`);
							callback(null, panelState);
						});
					securitySystem
						.getCharacteristic(this.Characteristic.SecuritySystemTargetState)
						.on('get' as any, async (callback: CharacteristicGetCallback) => {
							if (this._yale === undefined) {
								callback(new Error(`${pluginName} incorrectly configured`));
								return;
							}
							let panelState = await this._yale.getPanelState();
							callback(null, modeToCurrentState(this.Characteristic, panelState));
						})
						.on('set' as any, async (targetState: CharacteristicValue, callback: CharacteristicSetCallback, context?: any) => {
							if (this._yale === undefined) {
								callback(new Error(`${pluginName} incorrectly configured`));
								return;
							}
							if (context !== 'no_recurse') {
								callback();
								const mode = await this._yale.setPanelState(targetStateToMode(this.Characteristic, Panel, targetState));
								   this._log.info(`Panel mode: ${mode}, HomeKit state: ${currentStateToString(this.Characteristic, modeToCurrentState(this.Characteristic, mode))}`);
								securitySystem.getCharacteristic(this.Characteristic.SecuritySystemCurrentState)?.updateValue(modeToCurrentState(this.Characteristic, mode));
							}
						});
					this._accessories[accessory.UUID] = accessory;
				}
			}
		}

		export = YaleSyncPlatform;
