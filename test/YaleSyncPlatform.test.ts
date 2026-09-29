import { PanelState, ContactSensorState, MotionSensorState } from '../src/yale/YaleModels';

// ---- Homebridge mock helpers ----

function makeCharacteristic() {
  const characteristic: any = {
    onGet: jest.fn((handler: Function) => { characteristic._get = handler; return characteristic; }),
    onSet: jest.fn((handler: Function) => { characteristic._set = handler; return characteristic; }),
    setProps: jest.fn(),
    _get: undefined as Function | undefined,
    _set: undefined as Function | undefined,
    setValue: jest.fn(),
    getValue: jest.fn(),
    updateValue: jest.fn(),
  };
  return characteristic;
}

function makeService(name: string) {
  const characteristics: Record<string, ReturnType<typeof makeCharacteristic>> = {};
  return {
    name,
    getCharacteristic: jest.fn((key: string) => {
      if (!characteristics[key]) characteristics[key] = makeCharacteristic();
      return characteristics[key];
    }),
    setCharacteristic: jest.fn().mockReturnThis(),
    _characteristics: characteristics,
  };
}

function makePlatformAccessory(displayName: string, uuid: string) {
  const services: Record<string, ReturnType<typeof makeService>> = {
    AccessoryInformation: makeService('AccessoryInformation'),
  };
  return {
    UUID: uuid,
    displayName,
    context: {} as Record<string, any>,
    getService: jest.fn((key: string) => services[key]),
    addService: jest.fn((key: string) => {
      services[key] = makeService(key);
      return services[key];
    }),
    _services: services,
  };
}

const Characteristic = {
  Name: 'Name',
  Manufacturer: 'Manufacturer',
  Model: 'Model',
  SerialNumber: 'SerialNumber',
  SecuritySystemCurrentState: { AWAY_ARM: 1, DISARMED: 3, NIGHT_ARM: 2, STAY_ARM: 0, ALARM_TRIGGERED: 4 },
  SecuritySystemTargetState: { STAY_ARM: 0, AWAY_ARM: 1, NIGHT_ARM: 2, DISARM: 3 },
  MotionDetected: 'MotionDetected',
  ContactSensorState: 'ContactSensorState',
};

// Give the enum-like characteristics distinct string keys (the mock service keys by String(key)).
for (const name of ['SecuritySystemCurrentState', 'SecuritySystemTargetState'] as const) {
  Object.defineProperty((Characteristic as any)[name], 'toString', { value: () => name, enumerable: false });
}

const Service = {
  AccessoryInformation: 'AccessoryInformation',
  SecuritySystem: 'SecuritySystem',
  MotionSensor: 'MotionSensor',
  ContactSensor: 'ContactSensor',
};

let uuidCounter = 0;
const UUIDGenerator = {
  generate: (id: string) => `uuid-${id}`,
};

function makeApi(registerCallback?: jest.Mock) {
  const listeners: Record<string, Function> = {};
  return {
    hap: { Service, Characteristic, uuid: UUIDGenerator },
    platformAccessory: makePlatformAccessory,
    on: jest.fn((event: string, handler: Function) => {
      listeners[event] = handler;
    }),
    registerPlatformAccessories: registerCallback ?? jest.fn(),
    _fire: (event: string) => listeners[event]?.(),
  };
}

function makeLog() {
  return { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
}

// ---- Import the platform (after mocking deps) ----

// Mock YaleApiClient so tests don't need real network
jest.mock('../src/yale/YaleApiClient');
import { YaleApiClient } from '../src/yale/YaleApiClient';

// Mock wait so heartbeat doesn't actually sleep
jest.mock('../src/Wait', () => () => Promise.resolve());

// Dynamic require so mocks are in place before module load
let YaleSyncPlatform: any;
beforeAll(() => {
  YaleSyncPlatform = require('../src/YaleSyncPlatform').default;
});

// ---- Tests ----

describe('YaleSyncPlatform', () => {
  let mockYale: jest.Mocked<YaleApiClient>;
  let api: ReturnType<typeof makeApi>;
  let log: ReturnType<typeof makeLog>;
  const config = { platform: 'YaleSyncAlarm', name: 'Yale Alarm', username: 'u', password: 'p', refreshInterval: 10 };

  const PANEL = { identifier: '1', name: 'Yale Panel', state: PanelState.Armed };
  const MOTION_SENSOR = { identifier: 'pir-001', name: 'Hallway', state: MotionSensorState.None };
  const CONTACT_SENSOR = { identifier: 'door-001', name: 'Front Door', state: ContactSensorState.Closed };

  beforeEach(() => {
    jest.clearAllMocks();
    mockYale = new (YaleApiClient as jest.MockedClass<typeof YaleApiClient>)('u', 'p') as jest.Mocked<YaleApiClient>;
    mockYale.getPanel = jest.fn().mockResolvedValue(PANEL);
    mockYale.getSensors = jest.fn().mockResolvedValue([MOTION_SENSOR, CONTACT_SENSOR]);
    (YaleApiClient as jest.MockedClass<typeof YaleApiClient>).mockImplementation(() => mockYale);

    api = makeApi();
    log = makeLog();
  });

  // Helper: build a panel accessory with real mock services
  function makePanelAccessory(uuid = 'uuid-panel-ca') {
    const accessory = makePlatformAccessory('Yale Panel', uuid);
    accessory.context = { kind: 'panel', identifier: '1' };
    const infoService = makeService('AccessoryInformation');
    const secService = makeService('SecuritySystem');
    accessory.getService = jest.fn((key: string) => {
      if (key === Service.AccessoryInformation) return infoService;
      if (key === Service.SecuritySystem) return secService;
      return undefined;
    }) as any;
    accessory.addService = jest.fn((key: string) => {
      if (key === Service.SecuritySystem) return secService;
      return makeService(key);
    }) as any;
    return { accessory, secService };
  }

  describe('configureAccessory (Homebridge cached-accessory startup path)', () => {
    it('registers a set handler on the panel so HomeKit commands reach the API', async () => {
      // This is the critical regression test: configureAccessory must fully wire up
      // handlers, not just store the accessory. If the order is wrong (store before
      // configure), the guard inside configurePanel short-circuits and no handlers
      // are ever attached — commands from HomeKit are silently dropped.
      mockYale.setPanelState = jest.fn().mockResolvedValue({
        identifier: '1', name: 'Yale Panel', state: PanelState.Armed,
      });
      const platform = new YaleSyncPlatform(log, config, api);
      const { accessory, secService } = makePanelAccessory();

      platform.configureAccessory(accessory);

      const setHandler = secService.getCharacteristic(Characteristic.SecuritySystemTargetState as any)?._set;

      expect(setHandler).toBeDefined(); // fails if handlers were never registered
      await setHandler!(Characteristic.SecuritySystemTargetState.AWAY_ARM);
      expect(mockYale.setPanelState).toHaveBeenCalledWith(PanelState.Armed);
    });

    it('stores the accessory even if _yale is not initialised', () => {
      // Config is invalid so _yale will be undefined
      const badConfig = { platform: 'YaleSyncAlarm', name: 'Yale' }; // missing username/password
      const platform = new YaleSyncPlatform(log, badConfig as any, api);
      const { accessory } = makePanelAccessory('uuid-fallback');

      platform.configureAccessory(accessory);

      // Accessory should still be stored so Homebridge doesn't evict it
      expect((platform as any)._accessories['uuid-fallback']).toBe(accessory);
    });
  });

  describe('configurePanel', () => {
    it('adds SecuritySystem service and stores accessory', () => {
      const platform = new YaleSyncPlatform(log, config, api);
      const accessory = makePlatformAccessory('Yale Panel', 'uuid-panel');
      accessory.context = { kind: 'panel', identifier: '1' };
      // Return AccessoryInformation service but nothing for SecuritySystem
      const infoService = makeService('AccessoryInformation');
      accessory.getService = jest.fn((key: string) =>
        key === Service.AccessoryInformation ? infoService : undefined
      ) as any;
      accessory.addService = jest.fn().mockReturnValue(makeService('SecuritySystem'));

      platform.configurePanel(accessory);

      expect(accessory.addService).toHaveBeenCalledWith(Service.SecuritySystem);
    });

    it('does not re-configure an already-stored accessory', () => {
      const platform = new YaleSyncPlatform(log, config, api);
      const accessory = makePlatformAccessory('Yale Panel', 'uuid-panel');
      accessory.context = { kind: 'panel', identifier: '1' };
      const infoService = makeService('AccessoryInformation');
      accessory.getService = jest.fn((key: string) =>
        key === Service.AccessoryInformation ? infoService : undefined
      ) as any;
      accessory.addService = jest.fn().mockReturnValue(makeService('SecuritySystem'));

      platform.configurePanel(accessory);
      const firstCallCount = (accessory.addService as jest.Mock).mock.calls.length;
      platform.configurePanel(accessory);
      expect((accessory.addService as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('configureMotionSensor', () => {
    it('adds MotionSensor service and stores accessory', () => {
      const platform = new YaleSyncPlatform(log, config, api);
      const accessory = makePlatformAccessory('Hallway PIR', 'uuid-pir-001');
      accessory.context = { kind: 'motionSensor', identifier: 'pir-001' };
      const infoService = makeService('AccessoryInformation');
      accessory.getService = jest.fn((key: string) =>
        key === Service.AccessoryInformation ? infoService : undefined
      ) as any;
      accessory.addService = jest.fn().mockReturnValue(makeService('MotionSensor'));

      platform.configureMotionSensor(accessory);

      expect(accessory.addService).toHaveBeenCalledWith(Service.MotionSensor);
    });
  });

  describe('configureContactSensor', () => {
    it('adds ContactSensor service and stores accessory', () => {
      const platform = new YaleSyncPlatform(log, config, api);
      const accessory = makePlatformAccessory('Front Door', 'uuid-door-001');
      accessory.context = { kind: 'contactSensor', identifier: 'door-001' };
      const infoService = makeService('AccessoryInformation');
      accessory.getService = jest.fn((key: string) =>
        key === Service.AccessoryInformation ? infoService : undefined
      ) as any;
      accessory.addService = jest.fn().mockReturnValue(makeService('ContactSensor'));

      platform.configureContactSensor(accessory);

      expect(accessory.addService).toHaveBeenCalledWith(Service.ContactSensor);
    });
  });

  describe('heartbeat', () => {
    it('registers panel and sensor accessories on first run', async () => {
      const registerMock = jest.fn();
      api.registerPlatformAccessories = registerMock;
      const platform = new YaleSyncPlatform(log, config, api);

      await platform.poll();

      expect(registerMock).toHaveBeenCalledTimes(1);
      const registered: any[] = registerMock.mock.calls[0][2];
      const names = registered.map((a: any) => a.displayName);
      expect(names).toContain('Yale Panel');
      expect(names).toContain('Hallway');
      expect(names).toContain('Front Door');
    });

    it('does not re-register accessories already cached', async () => {
      const registerMock = jest.fn();
      api.registerPlatformAccessories = registerMock;
      const platform = new YaleSyncPlatform(log, config, api);

      await platform.poll();
      await platform.poll();

      // First iteration registers 3; second iteration should register 0
      expect(registerMock).toHaveBeenCalledTimes(1);
    });

    it('logs error and continues looping on API failure', async () => {
      const platform = new YaleSyncPlatform(log, config, api);

      let calls = 0;
      mockYale.getPanel.mockImplementation(async () => {
        if (++calls === 1) throw new Error('network error');
        (platform as any)._stopped = true; // second pass succeeds, then end the loop
        return PANEL;
      });
      mockYale.getSensors.mockResolvedValue([]);

      await platform.heartbeat(0);

      expect(calls).toBe(2);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Heartbeat error'),
        expect.any(Error),
      );
    });
  });

  // ---- Helper: configure a real panel accessory and extract the 'set' handler ----
  function setupPanelSetHandler(cfg: any = config) {
    const platform = new YaleSyncPlatform(log, cfg, api);
    const accessory = makePlatformAccessory('Yale Panel', 'uuid-panel-set');
    accessory.context = { kind: 'panel', identifier: '1' };

    const infoService = makeService('AccessoryInformation');
    const secService = makeService('SecuritySystem');
    accessory.getService = jest.fn((key: string) => {
      if (key === Service.AccessoryInformation) return infoService;
      if (key === Service.SecuritySystem) return secService;
      return undefined;
    }) as any;
    accessory.addService = jest.fn() as any;

    platform.configurePanel(accessory);

    const setHandler = secService.getCharacteristic(Characteristic.SecuritySystemTargetState as any)._set as Function;
    const currentStateCharacteristic = secService.getCharacteristic(Characteristic.SecuritySystemCurrentState as any);
    const targetGet = secService.getCharacteristic(Characteristic.SecuritySystemTargetState as any)._get as Function;
    const currentGet = currentStateCharacteristic._get as Function;
    return { platform, setHandler, currentStateCharacteristic, targetGet, currentGet, secService };
  }

  describe('panel set handler', () => {
    it('calls setPanelState with the correct mode and updates current state on success', async () => {
      mockYale.setPanelState = jest.fn().mockResolvedValue({ identifier: '1', name: 'Yale Panel', state: PanelState.Armed });
      const { setHandler, currentStateCharacteristic } = setupPanelSetHandler();

      await setHandler(Characteristic.SecuritySystemTargetState.AWAY_ARM);

      expect(mockYale.setPanelState).toHaveBeenCalledWith(PanelState.Armed);
      expect(currentStateCharacteristic.updateValue).toHaveBeenCalledWith(
        Characteristic.SecuritySystemCurrentState.AWAY_ARM
      );
    });

    it('rejects and logs when setPanelState rejects', async () => {
      const apiError = new Error('API failure');
      mockYale.setPanelState = jest.fn().mockRejectedValue(apiError);
      const { setHandler } = setupPanelSetHandler();

      await expect(setHandler(Characteristic.SecuritySystemTargetState.AWAY_ARM)).rejects.toBe(apiError);
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Set alarm failed'), apiError);
    });

    it('logs the requested HomeKit target state and Yale mode before calling API', async () => {
      mockYale.setPanelState = jest.fn().mockResolvedValue({ identifier: '1', name: 'Yale Panel', state: PanelState.Armed });
      const { setHandler } = setupPanelSetHandler();

      await setHandler(Characteristic.SecuritySystemTargetState.AWAY_ARM);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringMatching(/Set alarm requested.*away.*arm/i)
      );
    });

    it('part-arms (home) for both Stay and Night, never disarms', async () => {
      mockYale.setPanelState = jest.fn().mockResolvedValue({ identifier: '1', name: 'Yale Panel', state: PanelState.Home });
      const { setHandler } = setupPanelSetHandler();

      await setHandler(Characteristic.SecuritySystemTargetState.NIGHT_ARM);
      await setHandler(Characteristic.SecuritySystemTargetState.STAY_ARM);

      expect(mockYale.setPanelState).toHaveBeenNthCalledWith(1, PanelState.Home);
      expect(mockYale.setPanelState).toHaveBeenNthCalledWith(2, PanelState.Home);
    });

    it('shows part-arm as Stay by default and hides Night', async () => {
      mockYale.getPanel = jest.fn().mockResolvedValue({ ...PANEL, state: PanelState.Home });
      const { currentGet, targetGet, secService } = setupPanelSetHandler();

      expect(await currentGet()).toBe(Characteristic.SecuritySystemCurrentState.STAY_ARM);
      expect(await targetGet()).toBe(Characteristic.SecuritySystemTargetState.STAY_ARM);
      const targetProps = secService.getCharacteristic(Characteristic.SecuritySystemTargetState as any).setProps.mock.calls[0][0];
      expect(targetProps.validValues).not.toContain(Characteristic.SecuritySystemTargetState.NIGHT_ARM);
    });

    it('shows part-arm as Night and hides Stay when partialArmMode is night', async () => {
      mockYale.getPanel = jest.fn().mockResolvedValue({ ...PANEL, state: PanelState.Home });
      const { currentGet, targetGet, secService } = setupPanelSetHandler({ ...config, partialArmMode: 'night' });

      expect(await currentGet()).toBe(Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
      expect(await targetGet()).toBe(Characteristic.SecuritySystemTargetState.NIGHT_ARM);
      const targetProps = secService.getCharacteristic(Characteristic.SecuritySystemTargetState as any).setProps.mock.calls[0][0];
      expect(targetProps.validValues).not.toContain(Characteristic.SecuritySystemTargetState.STAY_ARM);
    });
  });

  describe('HomeKit reads', () => {
    it('reject (rather than hang) when the Yale API fails', async () => {
      mockYale.getPanel = jest.fn().mockRejectedValue(new Error('boom'));
      const { currentGet } = setupPanelSetHandler();

      await expect(currentGet()).rejects.toThrow('boom');
      expect(log.error).toHaveBeenCalled();
    });

    it('are served from one shared fetch instead of one request per read', async () => {
      const { currentGet, targetGet } = setupPanelSetHandler();

      await Promise.all([currentGet(), targetGet(), currentGet()]);
      await currentGet();

      expect(mockYale.getPanel).toHaveBeenCalledTimes(1);
      expect(mockYale.getSensors).toHaveBeenCalledTimes(1);
    });

    it('a poll refreshes the cache and pushes target state too', async () => {
      const platform = new YaleSyncPlatform(log, config, api);
      const { accessory, secService } = makePanelAccessory('uuid-1');
      platform.configureAccessory(accessory);
      mockYale.getPanel.mockResolvedValue({ ...PANEL, state: PanelState.Disarmed });

      await platform.poll();

      const target = secService.getCharacteristic(Characteristic.SecuritySystemTargetState as any);
      expect(target.updateValue).toHaveBeenCalledWith(Characteristic.SecuritySystemTargetState.DISARM);
    });

    it('fetch panel and sensors in parallel', async () => {
      const platform = new YaleSyncPlatform(log, config, api);
      let panelStarted = false;
      mockYale.getPanel.mockImplementation(async () => { panelStarted = true; return PANEL; });
      mockYale.getSensors.mockImplementation(async () => {
        expect(panelStarted).toBe(true); // started before getPanel resolved a tick later
        return [];
      });
      await platform.poll();
    });
  });
});
