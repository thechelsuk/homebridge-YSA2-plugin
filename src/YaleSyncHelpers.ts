// Helper functions for YaleSyncPlatform
import { PanelState } from './yale/YaleModels';
import { CharacteristicValue } from 'homebridge';


// Yale has a single part-arm mode ('home'); HomeKit has both Stay and Night.
// `partial` decides which HomeKit state a Yale 'home' reading is shown as.
export type PartialArmState = 'stay' | 'night';

export function modeToCurrentState(Characteristic: any, mode: PanelState, partial: PartialArmState = 'stay') {
  switch (mode) {
    case PanelState.Armed:
      return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
    case PanelState.Disarmed:
      return Characteristic.SecuritySystemCurrentState.DISARMED;
    case PanelState.Home:
      return partial === 'night'
        ? Characteristic.SecuritySystemCurrentState.NIGHT_ARM
        : Characteristic.SecuritySystemCurrentState.STAY_ARM;
    default:
      return Characteristic.SecuritySystemCurrentState.DISARMED;
  }
}

export function modeToTargetState(Characteristic: any, mode: PanelState, partial: PartialArmState = 'stay') {
  switch (mode) {
    case PanelState.Armed:
      return Characteristic.SecuritySystemTargetState.AWAY_ARM;
    case PanelState.Disarmed:
      return Characteristic.SecuritySystemTargetState.DISARM;
    case PanelState.Home:
      return partial === 'night'
        ? Characteristic.SecuritySystemTargetState.NIGHT_ARM
        : Characteristic.SecuritySystemTargetState.STAY_ARM;
    default:
      return Characteristic.SecuritySystemTargetState.DISARM;
  }
}

export function targetStateToString(Characteristic: any, state: CharacteristicValue) {
  if (state === Characteristic.SecuritySystemTargetState.STAY_ARM) {
    return 'home';
  } else if (state === Characteristic.SecuritySystemTargetState.NIGHT_ARM) {
    return 'night';
  } else if (state === Characteristic.SecuritySystemTargetState.AWAY_ARM) {
    return 'away';
  }
  return 'off';
}

export function targetStateToMode(Characteristic: any, state: CharacteristicValue) {
  if (
    state === Characteristic.SecuritySystemTargetState.STAY_ARM ||
    state === Characteristic.SecuritySystemTargetState.NIGHT_ARM
  ) {
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
