import * as fs from 'fs';
import * as path from 'path';

// Checks the Homebridge verification bot runs against package.json and config.schema.json

const root = path.join(__dirname, '..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

describe('package.json', () => {
  const pkg = readJson('package.json');

  it('declares the homebridge-plugin keyword', () => {
    expect(pkg.keywords).toContain('homebridge-plugin');
  });

  it('declares HAP as its transport, and not Matter', () => {
    expect(pkg.keywords).toContain('supports-hap');
    expect(pkg.keywords).not.toContain('supports-matter');
  });

  it('ships config.schema.json to npm', () => {
    expect(pkg.files).toContain('config.schema.json');
  });
});

describe('config.schema.json', () => {
  const config = readJson('config.schema.json');
  const schema = config.schema;

  it('is a singular platform with the alias the plugin registers', () => {
    expect(config.pluginAlias).toBe('YaleSyncAlarm');
    expect(config.pluginType).toBe('platform');
    expect(config.singular).toBe(true);
  });

  it('has no boolean "required" on individual properties', () => {
    for (const [name, prop] of Object.entries<Record<string, unknown>>(schema.properties)) {
      expect({ name, required: prop.required }).toEqual({ name, required: undefined });
    }
  });

  it('lists the fields the config decoder needs in an object-level "required" array', () => {
    expect(schema.required).toEqual(['name', 'username', 'password', 'refreshInterval']);
    for (const name of schema.required) {
      expect(Object.keys(schema.properties)).toContain(name);
    }
  });
});
