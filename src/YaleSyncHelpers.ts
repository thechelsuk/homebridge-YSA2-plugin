// Helper functions for YaleSyncPlatform
import { Panel } from 'yalesyncalarm/dist/Model';
import { CharacteristicValue } from 'homebridge';

export function modeToCurrentState(Characteristic: any, mode: Panel.State) {
  switch (mode) {
    case Panel.State.Armed:
      return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
    case Panel.State.Disarmed:
      return Characteristic.SecuritySystemCurrentState.DISARMED;
    case Panel.State.Home:
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

export function targetStateToMode(Characteristic: any, Panel: any, state: CharacteristicValue) {
  if (state === Characteristic.SecuritySystemTargetState.STAY_ARM) {
    return Panel.State.Home;
  } else if (state === Characteristic.SecuritySystemTargetState.AWAY_ARM) {
    return Panel.State.Armed;
  }
  return Panel.State.Disarmed;
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
