# Homebridge Verified Plugin: readiness check for `homebridge-ysa2`

First checked on 2026-10-29 against `homebridge-ysa2@2.5.2`. Updated on 2026-11-12 for the 2.5.3 release and the criteria as updated on 2026-11-01.

## Verdict

**Submitted; waiting for 2.5.5 on npm.** The verification request is open. Its automated checks failed on three points, all fixed in 2.5.5 (see "Bot checks on the request" below). 2.5.5 is tagged, released on GitHub and staged on npm. It needs your 2FA approval, after which npm and GitHub both show 2.5.5.

Every other required criterion passes. Criterion 5 (Node 22, 24 and 26) now passes in CI.

## Status on 2026-11-12

| Step | State |
| --- | --- |
| Fix committed and pushed | ✅ `49eb508` (files fix, displayName, README), `dd170e9` (CI tests on Node 26), `d2969f3` (release 2.5.3) |
| Tests on Node 22, 24, 26 | ✅ [Test run 43325088622](https://github.com/thechelsuk/homebridge-ysa2/actions/runs/43325088622) |
| Tag and GitHub release | ✅ [v2.5.3](https://github.com/thechelsuk/homebridge-ysa2/releases/tag/v2.5.3). The attached `homebridge-ysa2-2.5.3.tgz` contains `package/config.schema.json` |
| npm publish | ✅ The first staging attempt ([run 43325088714](https://github.com/thechelsuk/homebridge-ysa2/actions/runs/43325088714)) failed with E401 because the npm trusted publisher still named the old repo. After you fixed it, [run 43327646017](https://github.com/thechelsuk/homebridge-ysa2/actions/runs/43327646017) staged 2.5.3, and you approved it with 2FA. `npm view homebridge-ysa2 version` → `2.5.3` |
| Verification request | ✅ Opened by Mat. The bot reported 3 failed checks, all fixed in 2.5.5 |

**Bot checks on the request (2026-11-12)**

| Bot check | Fix |
| --- | --- |
| `keywords` must include `supports-hap` or `supports-matter` | Added `supports-hap` in `f670a8f`. HAP only, no Matter. |
| Version mismatch: npm v2.5.3, GitHub `package.json` v2.5.4 | 2.5.4 (dev-only dependency overrides for Dependabot alerts 58 and 61) was staged but never approved. 2.5.5 is staged now ([run 43329946756](https://github.com/thechelsuk/homebridge-ysa2/actions/runs/43329946756)). Approving it makes npm match GitHub. |
| `config.schema.json`: `required` must not be a boolean on individual fields | Moved to an object-level `"required": ["name", "username", "password", "refreshInterval"]` in `f670a8f`. `test/PackageMetadata.test.ts` checks this and the keywords. |

**What's left (Mat)**

1. On npmjs.com, approve the staged **2.5.5** with 2FA. You can skip 2.5.4: 2.5.5 includes it, and npm will still list 2.5.4 if you approve it as well.
2. Check that `npm view homebridge-ysa2 version --prefer-online` shows `2.5.5`.
3. Ask the bot to check again, by re-running it or commenting on the request issue, whichever the issue says. In the "More Information" text, the version is now 2.5.5.

## Sources used

| Source | URL |
| --- | --- |
| Verification criteria (wiki, "Current Requirements", last updated 2026-11-01) | https://github.com/homebridge/plugins/wiki/Verified-Plugins |
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
| 3 | Published to npm, source on GitHub, **issues enabled** | ✅ Pass | npm `homebridge-ysa2` `latest` = 2.5.3. GitHub `thechelsuk/homebridge-ysa2` (renamed from homebridge-YSA2-plugin; the old URL redirects): `hasIssuesEnabled: true`, not archived (checked with `gh repo view`). `package.json` `repository` and `bugs` point to it. |
| 4 | A GitHub release with release notes for every new version | ⚠️ Pass going forward, gaps in history | `.github/workflows/release.yml` creates a tagged release with notes for each version bump. Releases exist for v2.1.1, v2.2.5, v2.2.6, v2.4.1 to v2.5.3. **No release** for npm versions 2.0.6 (and its betas), 2.1.0, 2.2.0, 2.2.2, 2.2.3, 2.2.4 (tags v2.2.3 and v2.2.4 exist without releases). The wording is "should", and recent versions comply. Release notes are the last commit message, which can be thin. There is no CHANGELOG file. |
| 5 | Runs on all supported Node LTS versions (**22, 24 and 26**; the wiki added 26 on 2026-11-01) | ✅ Pass | `.github/workflows/test.yml` runs `npm ci`, `npm run build` and `npm test` on Node 22, 24 and 26 for every push and PR. All passed for 2.5.3: [run 43325088622](https://github.com/thechelsuk/homebridge-ysa2/actions/runs/43325088622). Locally, 60/60 tests also pass on Node 26.0.0. |
| 6 | Installs, and **does not start unless configured** | ✅ Pass | If config fails to decode (missing username, password or refreshInterval), the constructor logs one error and returns before registering `didFinishLaunching` (`src/YaleSyncPlatform.ts:37-43`), and `heartbeat`/`poll` return early when unconfigured (lines 89, 137). Checked by constructing the built platform with `{platform:'YaleSyncAlarm'}`: one `Invalid configuration` log, no listeners, no throw. |
| 7 | No post-install scripts that modify the system | ✅ Pass | No `preinstall`/`install`/`postinstall` in `package.json`. `prepare` (build + husky) doesn't run when users install from the npm registry. The only runtime dependency, `type-safe-json-decoder@0.2.0`, has no install scripts and no dependencies. |
| 8 | Doesn't need a TTY or non-standard startup parameters | ✅ Pass | Configured only through `config.json` or the UI. No prompts, no CLI flags. |
| 9 | Implements the **Homebridge Plugin Settings GUI** | ✅ Pass in 2.5.3 (2.5.2 lacked the schema) | `config.schema.json` exists (alias `YaleSyncAlarm`, `singular: true`, fields name, username, password, refreshInterval, partialArmMode). But `package.json` `files` didn't list it, so it's **missing from the published tarball** (`npm pack homebridge-ysa2@2.5.2 --dry-run` lists 27 files, no schema). Fixed in `49eb508`. `npm pack --dry-run` lists 28 files including `config.schema.json`, and so does the v2.5.3 GitHub release tarball. Confirmed in the published npm 2.5.3 tarball. |
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

## Changes made

1. `package.json` `files`: replaced `".tsconfig.json"` (no such file exists, so it matched nothing) with `"config.schema.json"`, so the Settings GUI schema ships to npm. **This is the blocking fix.**
2. `package.json`: added `"displayName": "Homebridge YSA2 (Yale Sync Alarm)"`. Change the wording if you prefer.
3. `README.md` "Installation": the command said `npm install -g homebridge-ysa2-plugin`, which is not the npm package name. It now says `npm install -g homebridge-ysa2` and mentions installing and configuring through the Homebridge UI.
4. Added this file, `VERIFICATION.md`. You may not want it in the published package. It isn't in `files`, so it won't be published, but you may prefer not to commit it.

Items 1 to 4 were committed in `49eb508`. On 2026-11-12, Node 26 was added to the test matrix (`dd170e9`) and the version was bumped to 2.5.3 (`d2969f3`), with release notes as the commit message.

## Fixes still needed before submitting

**Required**

1. ~~Get 2.5.3 onto npm.~~ Done on 2026-11-12: `npm pack homebridge-ysa2@2.5.3 --dry-run` lists `config.schema.json`.
2. ~~Confirm Node 22 and 24.~~ Done: tests pass on Node 22, 24 and 26 in CI.

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
- Tested in CI on Node 22, 24 and 26 for every push: https://github.com/thechelsuk/homebridge-ysa2/actions/workflows/test.yml
- Each new version gets a GitHub release with notes and is published to npm from CI (trusted publishing, with provenance). Latest: 2.5.5.
```

Before you paste it, check that each claim still holds for the version you release. The text doesn't claim a live Homebridge 2 run, because none was done here. Add a line once you've checked it in the Homebridge UI, including that the Settings screen appears for 2.5.3.
