import { YaleApiClient } from './yale/YaleApiClient';
import { platformConfigDecoder } from './YaleSyncPlatformConfig';
import { ContactSensor, MotionSensor, Panel, PanelState, MotionSensorState, ContactSensorState, Sensor } from './yale/YaleModels';
import { modeToCurrentState, modeToTargetState, targetStateToString, targetStateToMode, currentStateToString, PartialArmState } from './YaleSyncHelpers';
import wait from './Wait';
import { API, DynamicPlatformPlugin, Logger as HBLogger, PlatformConfig, PlatformAccessory as HBPlatformAccessory, CharacteristicValue } from 'homebridge';


const pluginName = 'homebridge-ysa2';
const platformName = 'YaleSyncAlarm';
const MIN_REFRESH_SECONDS = 1;
// HomeKit reads within this window are served from the last poll instead of hitting Yale again.
const SNAPSHOT_MAX_AGE_MS = 5000;

interface Snapshot {
	panel: Panel;
	sensors: Sensor[];
	at: number;
}

const isMotion = (s: Sensor): s is MotionSensor => Object.values(MotionSensorState).includes((s as any).state);
const isContact = (s: Sensor): s is ContactSensor => Object.values(ContactSensorState).includes((s as any).state);

class YaleSyncPlatform implements DynamicPlatformPlugin {

	constructor(log: HBLogger, config: PlatformConfig, api: API) {
		this._log = log;
		this._config = config;
		this._api = api;
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;
		this.PlatformAccessory = api.platformAccessory;
		this.UUIDGenerator = api.hap.uuid;
		this._partialArm = config.partialArmMode === 'night' ? 'night' : 'stay';

		// Decode config and initialize YaleApiClient
		try {
			const decodedConfig = platformConfigDecoder.decodeAny(config);
			this._yale = new YaleApiClient(decodedConfig.username, decodedConfig.password);
		} catch (e) {
			this._log.error('Invalid configuration:', e);
			return;
		}

		api.on('didFinishLaunching', () => {
			this._log.info('Homebridge platform didFinishLaunching, starting discovery/heartbeat');
			const interval = typeof config.refreshInterval === 'number' ? config.refreshInterval : 10;
			this.heartbeat(interval).catch(err => this._log.error('Heartbeat error:', err));
		});
		api.on('shutdown', () => {
			this._stopped = true;
		});
	}
	private _yale?: YaleApiClient;
	private _stopped = false;
	private _accessories: { [key: string]: any } = {};
	private _snapshot?: Snapshot;
	private _inflight?: Promise<Snapshot>;
	// Yale has one part-arm mode; this is the HomeKit state (Stay or Night) it is shown as.
	private _partialArm: PartialArmState;
	private readonly _log!: HBLogger;
	private readonly _api!: API;
	private readonly _config!: PlatformConfig;
	private Service: any;
	private Characteristic: any;
	private UUIDGenerator: any;
	private PlatformAccessory: any;

	configureAccessory(accessory: HBPlatformAccessory): void {
		// Called by Homebridge for every cached accessory on startup.
		// Must call the configure methods first so handlers are registered before storing,
		// because the configure methods guard on accessories[UUID] === undefined.
		const kind = (accessory as any).context?.kind;
		if (kind === 'panel') {
			this.configurePanel(accessory);
		} else if (kind === 'motionSensor') {
			this.configureMotionSensor(accessory);
		} else if (kind === 'contactSensor') {
			this.configureContactSensor(accessory);
		}
		// Fallback: store the accessory even if _yale was not ready during configure,
		// so Homebridge doesn't think it's been removed and unregister it.
		if (!this._accessories[(accessory as any).UUID]) {
			this._accessories[(accessory as any).UUID] = accessory;
		}
	}

	async heartbeat(interval: number) {
		if (!this._yale) return;
		// Guard against a hot loop hammering the Yale API if refreshInterval is 0/negative.
		const delayMs = Math.max(interval, MIN_REFRESH_SECONDS) * 1000;
		while (!this._stopped) {
			try {
				await this.poll();
			} catch (err) {
				this._log.error('Heartbeat error (will retry):', err);
			}
			await wait(delayMs);
		}
	}

	// Fetch panel and sensors in parallel; concurrent callers share one round trip.
	private refresh(): Promise<Snapshot> {
		if (!this._inflight) {
			const yale = this._yale!;
			this._inflight = Promise.all([yale.getPanel(), yale.getSensors()])
				.then(([panel, sensors]) => {
					this._snapshot = { panel, sensors, at: Date.now() };
					return this._snapshot;
				})
				.finally(() => {
					this._inflight = undefined;
				});
		}
		return this._inflight;
	}

	// Used by HomeKit reads: serve the recent poll result when it is fresh enough.
	private async getSnapshot(): Promise<Snapshot> {
		if (this._snapshot && Date.now() - this._snapshot.at < SNAPSHOT_MAX_AGE_MS) {
			return this._snapshot;
		}
		return this.refresh();
	}

	// Errors thrown from onGet/onSet show as "No Response" (rather than hanging) in Home.app.
	private commError(err: unknown): Error {
		const hap: any = this._api.hap;
		if (hap?.HapStatusError && hap?.HAPStatus) {
			return new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
		return err instanceof Error ? err : new Error(String(err));
	}

	// A single discovery/refresh pass. Throws on API failure; heartbeat() handles retry.
	async poll() {
		if (!this._yale) return;
		const { panel, sensors } = await this.refresh();
		const motionSensors: { [id: string]: MotionSensor } = {};
		const contactSensors: { [id: string]: ContactSensor } = {};
		const newAccessories: any[] = [];

		const register = (kind: string, identifier: string, name: string, label: string, configure: (a: any) => void) => {
			const uuid = this.UUIDGenerator.generate(identifier);
			if (this._accessories[uuid]) return;
			const accessory = new this.PlatformAccessory(name, uuid);
			accessory.context = { kind, identifier };
			configure(accessory);
			newAccessories.push(accessory);
			this._log.info(`Registering new ${label} accessory: ${name}`);
		};

		register('panel', panel.identifier, panel.name, 'panel', a => this.configurePanel(a));
		for (const sensor of sensors) {
			if (isMotion(sensor)) {
				motionSensors[sensor.identifier] = sensor;
				register('motionSensor', sensor.identifier, sensor.name, 'motion sensor', a => this.configureMotionSensor(a));
			} else if (isContact(sensor)) {
				contactSensors[sensor.identifier] = sensor;
				register('contactSensor', sensor.identifier, sensor.name, 'contact sensor', a => this.configureContactSensor(a));
			}
		}

		if (newAccessories.length > 0) {
			this._api.registerPlatformAccessories(pluginName, platformName, newAccessories);
		}

		// Update values for all known accessories
		for (const acc of Object.values(this._accessories)) {
			const accessory = acc as any;
			if (accessory.context.kind === 'panel') {
				if (accessory.context.identifier === panel.identifier) {
					this.pushPanelState(accessory, panel.state);
				}
			} else if (accessory.context.kind === 'motionSensor') {
				const motionSensor = motionSensors[accessory.context.identifier];
				if (motionSensor) {
					accessory
						.getService(this.Service.MotionSensor)
						.getCharacteristic(this.Characteristic.MotionDetected)
						?.updateValue(motionSensor.state === MotionSensorState.Triggered);
				}
			} else if (accessory.context.kind === 'contactSensor') {
				const contactSensor = contactSensors[accessory.context.identifier];
				if (contactSensor) {
					accessory
						.getService(this.Service.ContactSensor)
						.getCharacteristic(this.Characteristic.ContactSensorState)
						?.updateValue(contactSensor.state === ContactSensorState.Closed ? 0 : 1);
				}
			}
		}
	}

	// Push a panel mode to both HomeKit characteristics, so a change made in the Yale app
	// also moves the target state shown in Home.app.
	private pushPanelState(accessory: any, mode: PanelState): void {
		const service = accessory.getService(this.Service.SecuritySystem);
		service
			?.getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
			?.updateValue(modeToCurrentState(this.Characteristic, mode, this._partialArm));
		service
			?.getCharacteristic(this.Characteristic.SecuritySystemTargetState)
			?.updateValue(modeToTargetState(this.Characteristic, mode, this._partialArm));
	}

	private configureInformation(accessory: any, model: string): void {
		accessory
			.getService(this.Service.AccessoryInformation)
			.setCharacteristic(this.Characteristic.Name, accessory.displayName)
			.setCharacteristic(this.Characteristic.Manufacturer, 'Yale')
			.setCharacteristic(this.Characteristic.Model, model)
			.setCharacteristic(this.Characteristic.SerialNumber, accessory.context.identifier);
	}

	private getOrAddService(accessory: any, type: any): any {
		return accessory.getService(type) ?? accessory.addService(type);
	}

	public configureContactSensor(accessory: any): void {
		if (this._yale === undefined || this._accessories[accessory.UUID] !== undefined) {
			return;
		}
		this.configureInformation(accessory, 'Contact Sensor');
		this.getOrAddService(accessory, this.Service.ContactSensor)
			.getCharacteristic(this.Characteristic.ContactSensorState)
			.onGet(async () => {
				try {
					const { sensors } = await this.getSnapshot();
					const sensor = sensors.find(s => s.identifier === accessory.context.identifier && isContact(s)) as ContactSensor | undefined;
					if (sensor === undefined) {
						throw new Error(`Contact sensor: ${accessory.context.identifier} not found`);
					}
					return sensor.state === ContactSensorState.Closed ? 0 : 1;
				} catch (err) {
					this._log.error('Contact sensor read failed:', err);
					throw this.commError(err);
				}
			});
		this._accessories[accessory.UUID] = accessory;
	}

	public configureMotionSensor(accessory: any): void {
		if (this._yale === undefined || this._accessories[accessory.UUID] !== undefined) {
			return;
		}
		this.configureInformation(accessory, 'Motion Sensor');
		this.getOrAddService(accessory, this.Service.MotionSensor)
			.getCharacteristic(this.Characteristic.MotionDetected)
			.onGet(async () => {
				try {
					const { sensors } = await this.getSnapshot();
					const sensor = sensors.find(s => s.identifier === accessory.context.identifier && isMotion(s)) as MotionSensor | undefined;
					if (sensor === undefined) {
						throw new Error(`Motion sensor: ${accessory.context.identifier} not found`);
					}
					return sensor.state === MotionSensorState.Triggered;
				} catch (err) {
					this._log.error('Motion sensor read failed:', err);
					throw this.commError(err);
				}
			});
		this._accessories[accessory.UUID] = accessory;
	}

	public configurePanel(accessory: any): void {
		if (this._yale === undefined || this._accessories[accessory.UUID] !== undefined) {
			return;
		}
		this.configureInformation(accessory, 'Yale IA-320');
		const securitySystem = this.getOrAddService(accessory, this.Service.SecuritySystem);
		const { SecuritySystemCurrentState: Current, SecuritySystemTargetState: Target } = this.Characteristic;

		// Yale can't tell Home from Night, so only offer the one selected in config.
		// (Both would part-arm the panel identically, and the readback could only match one.)
		const unusedTarget = this._partialArm === 'night' ? Target.STAY_ARM : Target.NIGHT_ARM;
		const unusedCurrent = this._partialArm === 'night' ? Current.STAY_ARM : Current.NIGHT_ARM;
		const validValues = (all: number[], unused: number) => all.filter(v => v !== unused);
		securitySystem.getCharacteristic(Current)?.setProps?.({
			validValues: validValues([Current.STAY_ARM, Current.AWAY_ARM, Current.NIGHT_ARM, Current.DISARMED, Current.ALARM_TRIGGERED], unusedCurrent),
		});
		securitySystem.getCharacteristic(Target)?.setProps?.({
			validValues: validValues([Target.STAY_ARM, Target.AWAY_ARM, Target.NIGHT_ARM, Target.DISARM], unusedTarget),
		});

		securitySystem
			.getCharacteristic(Current)
			.onGet(async () => {
				try {
					this._log.info(`Fetching panel state`);
					const { panel } = await this.getSnapshot();
					const panelState = modeToCurrentState(this.Characteristic, panel.state, this._partialArm);
					this._log.info(`Panel mode: ${panel.state}, HomeKit state: ${currentStateToString(this.Characteristic, panelState)}`);
					return panelState;
				} catch (err) {
					this._log.error('Panel read failed:', err);
					throw this.commError(err);
				}
			});
		securitySystem
			.getCharacteristic(Target)
			.onGet(async () => {
				try {
					const { panel } = await this.getSnapshot();
					return modeToTargetState(this.Characteristic, panel.state, this._partialArm);
				} catch (err) {
					this._log.error('Panel read failed:', err);
					throw this.commError(err);
				}
			})
			.onSet(async (targetState: CharacteristicValue) => {
				const requestedMode = targetStateToMode(this.Characteristic, targetState);
				this._log.info(`Set alarm requested: HomeKit targetState=${targetState} (${targetStateToString(this.Characteristic, targetState)}) -> Yale mode='${requestedMode}'`);
				try {
					const mode = await this._yale!.setPanelState(requestedMode);
					if (this._snapshot) {
						this._snapshot = { ...this._snapshot, panel: { ...this._snapshot.panel, state: mode.state } };
					}
					this._log.info(`Set alarm succeeded: Yale mode='${mode.state}', HomeKit current state=${currentStateToString(this.Characteristic, modeToCurrentState(this.Characteristic, mode.state, this._partialArm))}`);
					securitySystem.getCharacteristic(Current)?.updateValue(modeToCurrentState(this.Characteristic, mode.state, this._partialArm));
				} catch (err) {
					this._log.error('Set alarm failed:', err);
					throw this.commError(err);
				}
			});
		this._accessories[accessory.UUID] = accessory;
	}
}

export default YaleSyncPlatform;
