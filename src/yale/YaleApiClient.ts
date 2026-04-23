import { Panel, PanelState, AccessToken, ContactSensor, ContactSensorState, MotionSensor, MotionSensorState, Sensor } from './YaleModels';
import { Logger } from './Logger';
// import { Lock } from './Lock'; // Uncomment if concurrency is needed

const BASE_URL = 'https://mob.yalehomesystem.co.uk/';
// Static Yale auth token from original implementation
const YALE_AUTH_TOKEN = 'VnVWWDZYVjlXSUNzVHJhcUVpdVNCUHBwZ3ZPakxUeXNsR1LUHBjdTpkd3RPbE15WEtENUJ5ZW1GWHV0am55eGhrc0U3V0ZFY2p0dFcyOXRaSWNuWHlSWHFsWVBEZBSZE1xczF4R3VwVTlxa1o4UE5ubGlQanY5Z2hBZFFtMHpsM0h4V3dlS0ZBcGZzakpMcW1GMm1HR1lXRlpad01MRkw3MGR0bmNndQ==';

export class YaleApiClient {
  private username: string;
  private password: string;
  private accessToken: AccessToken | null = null;
  private panelIdentifier: string | null = null;
  // private lock = new Lock(); // Uncomment if concurrency is needed

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken || new Date() > this.accessToken.expiration) {
      await this.authenticate();
    }
    options.headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${this.accessToken!.token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    return fetch(url, options);
  }

  private async authenticate(): Promise<void> {
    const url = BASE_URL + 'o/token/';
    const body = `grant_type=password&username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${YALE_AUTH_TOKEN}`,
      },
      body,
    });
    if (!resp.ok) {
      Logger.error('Failed to authenticate with Yale API', await resp.text());
      throw new Error('Authentication failed');
    }
    const data = await resp.json();
    this.accessToken = {
      token: data.access_token,
      expiration: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
    Logger.info('Authenticated with Yale API');
  }

  private async getPanelIdentifier(): Promise<string> {
    if (this.panelIdentifier) return this.panelIdentifier;
    const url = BASE_URL + 'api/panel/services/';
    const resp = await this.fetchWithAuth(url);
    if (!resp.ok) {
      Logger.error('Failed to fetch panel identifier', await resp.text());
      throw new Error('Failed to fetch panel identifier');
    }
    const data = await resp.json();
    // Assume first service is the panel
    this.panelIdentifier = data[0]?.id;
    if (!this.panelIdentifier) throw new Error('Panel identifier not found');
    return this.panelIdentifier;
  }

  async getPanel(): Promise<Panel> {
    const panelId = await this.getPanelIdentifier();
    const url = BASE_URL + `api/panel/${panelId}/mode/`;
    const resp = await this.fetchWithAuth(url);
    if (!resp.ok) {
      Logger.error('Failed to fetch panel state', await resp.text());
      throw new Error('Failed to fetch panel state');
    }
    const data = await resp.json();
    return {
      identifier: panelId,
      name: data.name || 'Yale Panel',
      state: data.mode as PanelState,
    };
  }

  async setPanelState(state: PanelState): Promise<Panel> {
    const panelId = await this.getPanelIdentifier();
    const url = BASE_URL + `api/panel/${panelId}/mode/`;
    const resp = await this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify({ mode: state }),
    });
    if (!resp.ok) {
      Logger.error('Failed to set panel state', await resp.text());
      throw new Error('Failed to set panel state');
    }
    const data = await resp.json();
    return {
      identifier: panelId,
      name: data.name || 'Yale Panel',
      state: data.mode as PanelState,
    };
  }

  async getSensors(): Promise<Sensor[]> {
    const panelId = await this.getPanelIdentifier();
    const url = BASE_URL + `api/panel/${panelId}/device_status/`;
    const resp = await this.fetchWithAuth(url);
    if (!resp.ok) {
      Logger.error('Failed to fetch sensors', await resp.text());
      throw new Error('Failed to fetch sensors');
    }
    const data = await resp.json();
    // Parse sensors
    const sensors: Sensor[] = [];
    for (const device of data) {
      if (device.type === 'contact') {
        sensors.push({
          identifier: device.id,
          name: device.name,
          state: device.status === 'open' ? ContactSensorState.Open : ContactSensorState.Closed,
        });
      } else if (device.type === 'motion') {
        sensors.push({
          identifier: device.id,
          name: device.name,
          state: device.status === 'triggered' ? MotionSensorState.Triggered : MotionSensorState.None,
        });
      }
    }
    return sensors;
  }
}
