# Homebridge Verified Plugin: readiness check for `homebridge-ysa2`

Checked on 2026-10-29 against `homebridge-ysa2@2.5.2` (npm `latest`) and this working copy on `main`.

## Verdict

**Ready after the fixes listed below.** One item blocks submission. The published 2.5.2 package on npm does not include `config.schema.json`, so the Homebridge UI cannot show a Settings screen for people who install it. This is fixed in the working copy (see "Changes made"), but it only reaches users once a new version (for example 2.5.3) is released. Release that version before you submit the request.

Every other required criterion passes, or is "unsure" only because it couldn't be tested here (Node 22 and 24).

## Sources used

| Source | URL |
| --- | --- |
| Verification criteria (wiki, "Current Requirements", last updated 2026-05-05) | https://github.com/homebridge/plugins/wiki/Verified-Plugins |
| How to request verification (README) | https://github.com/homebridge/plugins |
| Request form (issue template) | https://raw.githubusercontent.com/homebridge/plugins/latest/.github/ISSUE_TEMPLATE/1_verification-request.yml |
| Old wiki page (now just points to the plugins repo) | https://github.com/homebridge/homebridge/wiki/Verified-Plugins |
| Homebridge v2 notes for plugin developers (`engines`) | https://github.com/homebridge/homebridge/wiki/Updating-To-Homebridge-v2.0 |

The "new issue" chooser (https://github.com/homebridge/plugins/issues/new/choose) needs a GitHub sign-in, so the form fields below come from the template file. The repo's default branch is `latest`, not `main`.

## Criteria checklist

The 12 criteria are copied from the wiki. Line numbers refer to this working copy.

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Must be a **dynamic platform** | ✅ Pass | `src/YaleSyncPlatform.ts:24` `implements DynamicPlatformPlugin`. It uses `configureAccessory` (line 69) and `api.registerPlatformAccessories` (line 165). Registered as a platform in `index.ts:4`; `config.schema.json:3` sets `"pluginType": "platform"`. |
| 2 | Must not offer the same or less functionality than an existing verified plugin | ✅ Pass (by name only) | No plugin with "yale" in its name is in the verified index on the wiki page. The index lists names only, with no descriptions, so a verified plugin covering Yale under another name can't be ruled out. Verified security plugins found by name (alarm-dot-com, simplisafe3, qolsys, jablotron and others) cover other brands. |
| 3 | Published to npm, source on GitHub, **issues enabled** | ✅ Pass | npm `homebridge-ysa2` `latest` = 2.5.2. GitHub `thechelsuk/homebridge-ysa2` (renamed from homebridge-YSA2-plugin; the old URL redirects): `hasIssuesEnabled: true`, not archived (checked with `gh repo view`). `package.json` `repository` and `bugs` point to it. |
| 4 | A GitHub release with release notes for every new version | ⚠️ Pass going forward, gaps in history | `.github/workflows/release.yml` creates a tagged release with notes for each version bump. Releases exist for v2.1.1, v2.2.5, v2.2.6, v2.4.1 to v2.5.2. **No release** for npm versions 2.0.6 (and its betas), 2.1.0, 2.2.0, 2.2.2, 2.2.3, 2.2.4 (tags v2.2.3 and v2.2.4 exist without releases). The wording is "should", and recent versions comply. Release notes are the last commit message, which can be thin. There is no CHANGELOG file. |
| 5 | Runs on all supported Node LTS versions (**22 and 24**) | ❓ Unsure | Tests (60/60) and `require('./dist/index.js')` pass on **Node 26.0.0** only. Node 22 isn't installed here, and `node@24` on this Mac is a symlink to 26. The release workflow builds on Node 24 but doesn't run tests. The code needs Node ≥ 18 (global `fetch`, `src/yale/YaleApiClient.ts:29`), and nothing found is version-specific, so likely fine. `engines.node` is `>=18.0.0` (`package.json:50`). |
| 6 | Installs, and **does not start unless configured** | ✅ Pass | If config fails to decode (missing username, password or refreshInterval), the constructor logs one error and returns before registering `didFinishLaunching` (`src/YaleSyncPlatform.ts:37-43`), and `heartbeat`/`poll` return early when unconfigured (lines 89, 137). Checked by constructing the built platform with `{platform:'YaleSyncAlarm'}`: one `Invalid configuration` log, no listeners, no throw. |
| 7 | No post-install scripts that modify the system | ✅ Pass | No `preinstall`/`install`/`postinstall` in `package.json`. `prepare` (build + husky) doesn't run when users install from the npm registry. The only runtime dependency, `type-safe-json-decoder@0.2.0`, has no install scripts and no dependencies. |
| 8 | Doesn't need a TTY or non-standard startup parameters | ✅ Pass | Configured only through `config.json` or the UI. No prompts, no CLI flags. |
| 9 | Implements the **Homebridge Plugin Settings GUI** | ❌ Fail on npm 2.5.2 / ✅ fixed locally | `config.schema.json` exists (alias `YaleSyncAlarm`, `singular: true`, fields name, username, password, refreshInterval, partialArmMode). But `package.json` `files` didn't list it, so it's **missing from the published tarball** (`npm pack homebridge-ysa2@2.5.2 --dry-run` lists 27 files, no schema). Fixed in this working copy; `npm pack --dry-run` now includes `config.schema.json`. A new release is needed. |
| 10 | No analytics or user tracking | ✅ Pass | The only network host is `https://mob.yalehomesystem.co.uk/yapi/` (`src/yale/YaleApiClient.ts:6`), used for login, panel mode and device status. A grep of `src/` and `index.ts` found no other URLs. |
| 11 | Files written to disk go in the Homebridge storage directory | ✅ Pass (n/a) | Writes no files. No `fs` usage in `src/`. |
| 12 | No unhandled exceptions; catch and log its own errors | ✅ Pass | The polling loop catches and logs every error and retries (`src/YaleSyncPlatform.ts:92-99`). The `heartbeat` promise has a `.catch` (line 48). HomeKit get/set handlers catch, log and throw a `HapStatusError` (`SERVICE_COMMUNICATION_FAILURE`), which shows "No Response" instead of crashing (lines 127-133 and 235-238, 258-261, 295-298, 306-309, 321-324). Config decode is wrapped in try/catch (lines 37-43). |

### Other checks (not verification criteria)

| Check | Result | Evidence |
| --- | --- | --- |
| `package.json` name starts `homebridge-` | ✅ | `homebridge-ysa2` |
| Keyword `homebridge-plugin` | ✅ | `package.json` keywords |
| `engines.homebridge` signals v2 ready | ✅ | `^1.6.0 \|\| ^2.0.0`, the exact value on the Homebridge v2 wiki page |
| `displayName` | ✅ (added) | See "Changes made" |
| `repository`, `bugs`, `homepage`, `license` | ✅ | `package.json` |
| Licence | ✅ MIT, with a note | `LICENSE` is MIT. GitHub detects it as "Other" because of the extra fork-attribution lines above the standard text. Not a criterion. |
| Hardcoded credentials | ✅ No user credentials, see note | `YALE_AUTH_TOKEN` (`src/yale/YaleApiClient.ts:8`) is a static Basic token sent to Yale's `/o/token/` endpoint. It identifies the Yale app client, not a user. The comment says it comes from the original plugin. Users' username and password come from config only. A reviewer may ask about it, so it's mentioned in "More Information" below. |
| Tests | ✅ | `npm test`: 3 suites, **60/60 passed** (Node 26.0.0) |
| Build | ✅ | `npm run build` (tsc): no errors |
| Lint | ⚠️ | No lint script. `npx prettier --check "src/**/*.ts"` reports style issues in all 6 source files (the `.prettierrc` sets tabs and no semicolons, but `YaleApiClient.ts`, for example, uses spaces and semicolons). |
| `npm audit --omit=dev` | ✅ | 0 vulnerabilities |
| Supported transport keywords | Optional | The README describes `supports-hap` / `supports-matter` keywords. They aren't required for verification. If you add `supports-hap`, don't add `supports-matter` (this plugin doesn't register Matter accessories). |

## Changes made in this working copy (uncommitted)

1. `package.json` `files`: replaced `".tsconfig.json"` (no such file exists, so it matched nothing) with `"config.schema.json"`, so the Settings GUI schema ships to npm. **This is the blocking fix.**
2. `package.json`: added `"displayName": "Homebridge YSA2 (Yale Sync Alarm)"`. Change the wording if you prefer.
3. `README.md` "Installation": the command said `npm install -g homebridge-ysa2-plugin`, which is not the npm package name. It now says `npm install -g homebridge-ysa2` and mentions installing and configuring through the Homebridge UI.
4. Added this file, `VERIFICATION.md`. You may not want it in the published package. It isn't in `files`, so it won't be published, but you may prefer not to commit it.

Nothing was committed, pushed or published.

## Fixes still needed before submitting

**Required**

1. **Release a new version** (for example 2.5.3) with the `files` fix, then check that the package includes the schema: `npm pack homebridge-ysa2@<new> --dry-run | grep config.schema`. Release that version before you submit.
2. **Confirm Node 22 and 24.** `.github/workflows/test.yml` (added, uncommitted) runs `npm ci`, `npm run build` and `npm test` on Node 22 and 24 for every push to main and every PR. Once it passes on GitHub, mark criterion 5 as a pass and add the run link to the form.

**Recommended (likely review feedback, not hard criteria)**

3. Route `YaleApiClient` logging through the Homebridge logger instead of `console.log` (`src/yale/Logger.ts`). Move the full Yale response body logged at info level on every arm/disarm (`src/yale/YaleApiClient.ts:107,116`) to debug.
4. Treat a missing `refreshInterval` as 10 rather than "Invalid configuration". `platformConfigDecoder` requires it (`src/YaleSyncPlatformConfig.ts:21`), but `src/YaleSyncPlatform.ts:47` already defaults it to 10. Also treat blank username or password as "not configured" instead of polling and failing login every interval.
5. Mask the password in the settings screen (for example `"x-schema-form": { "type": "password" }` on the `password` property in `config.schema.json`). Not checked against the current Homebridge UI docs, so test it in the UI first.
6. Bring `engines.node` in line with Homebridge itself. Homebridge 2's `engines.node` is `^22 || ^24 || ^26`, and the v2 wiki example is `^22.12.0 || ^24.0.0`. The plugin's `>=18.0.0` is not wrong, but it advertises versions Homebridge 2 doesn't support.
7. Run `npm run format` (Prettier) so the code matches `.prettierrc`, and fix the "Building from Source" snippet in `README.md`: each `&&` line starts a new line, so it won't paste-run as written.
8. Add a CHANGELOG, or fuller release notes than the last commit message.
9. Stale files in the local `dist/` (for example `dist/src/yale/Lock.js`, `dist/YaleSyncPlatform.js`) would be included in a local `npm pack`. CI builds from a clean checkout, so releases aren't affected. Only publish through CI, or `rm -rf dist && npm run build` first.

## What to paste into the request form

Open a new issue at https://github.com/homebridge/plugins/issues/new/choose and pick **"Plugin Verification Request"**. The title is pre-filled as `Verification Request: homebridge-`. Make it:

```
Verification Request: homebridge-ysa2
```

**Plugin Name** (required)

```
homebridge-ysa2
```

**Link To GitHub Repo** (required)

```
https://github.com/thechelsuk/homebridge-ysa2
```

**Plugin Icon (Optional)**: attach a square PNG, around 100×100 px. Don't use Yale's logo; the form says the icon must not violate any trademark. Leave it blank if you don't have one.

**General**

- The plugin does not offer the same nor less functionality than that of any existing verified plugin. → `🟢 Yes`

**Environment**

- The plugin successfully installs and does not start unless it is configured. → `🟢 Yes`
- The plugin does not require the user to run Homebridge in a TTY or with non-standard startup parameters, even for initial configuration. → `🟢 Yes`

**Codebase**

- The plugin does not contain any analytics or calls that enable you to track the user. → `🟢 Yes`
- If the plugin needs to write files to disk (cache, keys, etc.), it stores them inside the Homebridge storage directory. → `🟢 Yes`
- The plugin does not throw unhandled exceptions, the plugin must catch and log its own errors. → `🟢 Yes`

**More Information** (optional; replace `2.5.3` with the version you release)

```
homebridge-ysa2 exposes a Yale Sync Smart Home Alarm / Yale Smart Home Alarm (UK) to HomeKit as a Security System, plus its door contact and PIR motion sensors. I couldn't find a verified plugin for Yale alarms.

- Dynamic platform plugin (DynamicPlatformPlugin, cached accessories restored via configureAccessory), HAP only.
- Configured entirely from the Homebridge UI Settings screen (config.schema.json, singular platform). If credentials are missing it logs one error and does nothing else.
- engines: homebridge "^1.6.0 || ^2.0.0" (Homebridge 2 ready).
- Only network calls are to Yale's own API (mob.yalehomesystem.co.uk). No analytics, no files written to disk, no install scripts.
- Polling and all HomeKit get/set handlers catch and log their errors; failures show as "No Response" in Home rather than crashing Homebridge.
- The static Basic token in src/yale/YaleApiClient.ts is Yale's app client identifier used for the OAuth password grant, not a user credential; the user's own Yale login comes from config.
- Each new version gets a GitHub release with notes and is published to npm from CI. Latest: 2.5.3.
```

Before you paste it, check that each claim still holds for the version you release. The text doesn't claim Node 22/24 testing or a live Homebridge 2 run, because neither was confirmed here. Add a line for each once you have checked it.
