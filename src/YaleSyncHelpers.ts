// Helper functions for YaleSyncPlatform
import { Panel, PanelState } from './yale/YaleModels';
import { CharacteristicValue } from 'homebridge';


export function modeToCurrentState(Characteristic: any, mode: PanelState) {
  switch (mode) {
    case PanelState.Armed:
      return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
    case PanelState.Disarmed:
      return Characteristic.SecuritySystemCurrentState.DISARMED;
    case PanelState.Home:
      return Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
    default:
      return Characteristic.SecuritySystemCurrentState.DISARMED;
  }
  }

export function targetStateToString(Characteristic: any, state: CharacteristicValue) {
  if (state === Characteristic.SecuritySystemTargetState.STAY_ARM) {
    return 'home';
  } else if (state === Characteristic.SecuritySystemTargetState.AWAY_ARM) {
    return 'away';
  }
  return 'off';
}

export function targetStateToMode(Characteristic: any, state: CharacteristicValue) {
  if (state === Characteristic.SecuritySystemTargetState.STAY_ARM) {
    return PanelState.Home;
  } else if (state === Characteristic.SecuritySystemTargetState.AWAY_ARM) {
    return PanelState.Armed;
  }
  return PanelState.Disarmed;
}

export function currentStateToString(Characteristic: any, state: number) {
  switch (state) {
    case Characteristic.SecuritySystemCurrentState.STAY_ARM:
      return 'home';
    case Characteristic.SecuritySystemCurrentState.AWAY_ARM:
      return 'away';
    case Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
      return 'night';
    case Characteristic.SecuritySystemCurrentState.DISARMED:
      return 'off';
    default:
      return 'unknown';
  }
}
