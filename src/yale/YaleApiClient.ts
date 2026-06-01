import { Panel, PanelState, AccessToken, ContactSensor, ContactSensorState, MotionSensor, MotionSensorState, Sensor } from './YaleModels';
import { Logger } from './Logger';
// import { Lock } from './Lock'; // Uncomment if concurrency is needed

const BASE_URL = 'https://mob.yalehomesystem.co.uk/yapi/';
// Static Yale auth token from the old plugin (matches legacy working code)
const YALE_AUTH_TOKEN = 'VnVWWDZYVjlXSUNzVHJhcUVpdVNCUHBwZ3ZPakxUeXNsRU1LUHBjdTpkd3RPbE15WEtENUJ5ZW1GWHV0am55eGhrc0U3V0ZFY2p0dFcyOXRaSWNuWHlSWHFsWVBEZ1BSZE1xczF4R3VwVTlxa1o4UE5ubGlQanY5Z2hBZFFtMHpsM0h4V3dlS0ZBcGZzakpMcW1GMm1HR1lXRlpad01MRkw3MGR0bmNndQ==';

export class YaleApiClient {
  private username: string;
  private password: string;
  private accessToken: AccessToken | null = null;
  // private lock = new Lock(); // Uncomment if concurrency is needed

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken || new Date() > this.accessToken.expiration) {
      await this.authenticate();
    }
    const headers = {
      'Authorization': `Bearer ${this.accessToken!.token}`,
      'Accept': 'application/json, application/xml, text/plain, text/html, *.*',
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  }

  private async authenticate(): Promise<void> {
    const url = BASE_URL + 'o/token/';
    const body = `grant_type=password&username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded ; charset=utf-8',
      'Accept': 'application/json',
      'Authorization': `Basic ${YALE_AUTH_TOKEN}`,
    };
    // Only log success or failure, not request details
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    const respText = await resp.text();
    if (!resp.ok) {
      Logger.error('Failed to authenticate with Yale API', respText);
      throw new Error('Authentication failed');
    }
    const data = JSON.parse(respText);
    this.accessToken = {
      token: data.access_token,
      expiration: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
    Logger.info('Authenticated with Yale API');
  }

  async getPanel(): Promise<Panel> {
    // Old plugin uses api/panel/mode endpoint (no panelId)
    const url = BASE_URL + 'api/panel/mode/';
    const resp = await this.fetchWithAuth(url);
    if (!resp.ok) {
      Logger.error('Failed to fetch panel state', await resp.text());
      throw new Error('Failed to fetch panel state');
    }
    const data = await resp.json();
    const entry = Array.isArray(data.data) ? data.data[0] : data;
    const rawMode: string = entry.mode ?? entry.state ?? '';
    // Normalise: API sometimes returns 'arm_full'/'arm_partial' instead of 'arm'/'home'
    const normalisedMode = rawMode === 'arm_full' ? 'arm' : rawMode === 'arm_partial' ? 'home' : rawMode;
    if (normalisedMode !== rawMode) {
      Logger.info(`getPanel: normalised raw mode '${rawMode}' -> '${normalisedMode}'`);
    }
    return {
      identifier: '1',
      name: entry.name || 'Yale Panel',
      state: normalisedMode as PanelState,
    };
  }

  async setPanelState(state: PanelState): Promise<Panel> {
    // Old plugin uses api/panel/mode endpoint (no panelId) and x-www-form-urlencoded body
    const url = BASE_URL + 'api/panel/mode/';
    const body = `area=1&mode=${state}`;
    Logger.info(`setPanelState: sending mode='${state}' to ${url}`);
    const resp = await this.fetchWithAuth(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded ; charset=utf-8',
      },
    });
    const respText = await resp.text();
    Logger.info(`setPanelState: HTTP ${resp.status}, response body: ${respText}`);
    if (!resp.ok) {
      Logger.error('Failed to set panel state (non-2xx)', respText);
      throw new Error(`Failed to set panel state (HTTP ${resp.status})`);
    }
    let data: any;
    try {
      data = JSON.parse(respText);
    } catch {
      throw new Error(`Yale API returned non-JSON response: ${respText}`);
    }
    // Yale API returns { "code": "000", ... } for success
    if (data.code !== '000') {
      throw new Error(`Yale panel rejected state change: code=${data.code}, message=${data.message ?? ''}`);
    }
    return {
      identifier: '1',
      name: 'Yale Panel',
      state,
    };
  }

  async getSensors(): Promise<Sensor[]> {
    // Old plugin uses api/panel/device_status endpoint (no panelId)
    const url = BASE_URL + 'api/panel/device_status/';
    const resp = await this.fetchWithAuth(url);
    if (!resp.ok) {
      Logger.error('Failed to fetch sensors', await resp.text());
      throw new Error('Failed to fetch sensors');
    }
    const data = await resp.json();
    const devices = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : null;
    if (!devices) {
      Logger.error('Expected array for sensors, got:', JSON.stringify(data));
      throw new Error('Yale API: Unexpected response format for sensors');
    }
    // Parse sensors
    const sensors: Sensor[] = [];
    for (const device of devices) {
      if (device.type === 'device_type.door_contact') {
        sensors.push({
          identifier: device.device_id || device.id,
          name: device.name,
          state: device.status1 === 'device_status.dc_open' ? ContactSensorState.Open : ContactSensorState.Closed,
        });
      } else if (device.type === 'device_type.pir') {
        sensors.push({
          identifier: device.device_id || device.id,
          name: device.name,
          state: device.status1 === 'device_status.pir_triggered' ? MotionSensorState.Triggered : MotionSensorState.None,
        });
      }
    }
    return sensors;
  }
}
