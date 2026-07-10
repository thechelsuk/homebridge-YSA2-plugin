# homebridge-ysa2-plugin - Homebridge 2 support for Yale Sync Alarms

Homebridge plugin for the [Yale Sync Smart Home Alarm](https://www.yale.co.uk/en/yale/couk/products/smart-living/smart-home-alarms/sync-smart-alarm/) and [Yale Smart Home Alarm](https://www.yale.co.uk/en/yale/couk/products/smart-living/smart-home-alarms/smart-home-alarm-starter-kit/).

## Usage

This plugin pairs very nicely with the Dummy homebridge switch. Apple does not allow alarms to be set via automation directly, however, using a dummy switch enables this to happy with one hop. Automation (e.g. last person leaves home) sets the dummy to on, another automation sets the alarm to 'away/armed' when dummy is on, and vice versa for when first person arrives home.

## Features

- Exposes the alarm system as a Home.app security system. You can set it to "Home", "Away", "Night" and "Off" modes. Yale alarms only have 3 modes. So both "Home" and "Night" will "part-arm" the system. Based on your Yale app config, this might be to arm downstairs whilst you sleep upstairs.
- Contact and motion sensors are exposed in Home.app (these only work/trigger during an alarm going off due to the Yale API).
- Updated with Homebridge 2.0.0 in mind.

## Installation

`npm install -g homebridge-ysa2-plugin`

## Configuration

Add in your username and password. In Yale you can create a secondary user.

```json
"platforms": [
    {
        "platform": "YaleSyncAlarm",
        "name": "Burglar Alarm",
        "username": "username@mail.com",
        "password": "password",
        "refreshInterval": 10
    }
]
```

## Building from Source

```bash
git clone https://github.com/thechelsuk/homebridge-ysa2-plugin.git
&& cd homebridge-ysa2-plugin
&& npm install
```

## Notes

After running `npm install`, `npm` should automatically run `npm run build`, which runs `node_modules/typescript/bin/tsc` to compile the typescript files. If it doesn't then you can run either `node_modules/typescript/bin/tsc` or `npm run build`.

There are useful configs already included for [prettier](https://prettier.io) and [Visual Studio Code](https://code.visualstudio.com).

Visual Studio Code is configured to use the version of typescript installed as a development dependency in the npm package.
