import * as fs from 'fs';
import * as path from 'path';
import { ValidationError } from '../util/errors.js';
const NAME_RE = /^@[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,38}$/;
const VERSION_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ASSET_TYPES = new Set(['rule', 'skill', 'agent', 'command', 'hook', 'mcp']);
const TARGETS_V1 = new Set(['claude-code', 'cursor']);
export function validateManifest(raw, pkgDir) {
    const issues = [];
    const err = (code, msg) => issues.push({ code, severity: 'error', message: msg });
    const warn = (code, msg) => issues.push({ code, severity: 'warning', message: msg });
    if (raw.schema !== 1) {
        err('E_SCHEMA_UNSUPPORTED', `schema must be 1, got ${raw.schema}`);
    }
    if (!raw.name || !NAME_RE.test(raw.name)) {
        err('E_NAME_INVALID', `name must be @scope/name (lowercase alphanumeric), got "${raw.name}"`);
    }
    if (!raw.version || !VERSION_RE.test(raw.version)) {
        err('E_VERSION_INVALID', `version must be x.y.z semver, got "${raw.version}"`);
    }
    if (!raw.description || typeof raw.description !== 'string' ||
        raw.description.length < 1 || raw.description.length > 200) {
        err('E_DESCRIPTION_INVALID', `description must be 1–200 chars`);
    }
    if (!raw.license) {
        err('E_LICENSE_MISSING', `license is required (use SPDX identifier, e.g. MIT)`);
    }
    if (raw.targets) {
        for (const t of raw.targets) {
            if (!TARGETS_V1.has(t)) {
                warn('W_TARGET_DEFERRED', `target "${t}" is not supported in v1 (deferred to M3)`);
            }
        }
    }
    if (!Array.isArray(raw.assets) || raw.assets.length === 0) {
        err('E_ASSETS_EMPTY', `assets must be a non-empty array`);
    }
    else {
        const seen = new Set();
        let hasExecutable = false;
        for (const asset of raw.assets) {
            if (!asset.id || !ID_RE.test(asset.id)) {
                err('E_ASSET_ID_INVALID', `asset id "${asset.id}" must match ^[a-z0-9][a-z0-9-]{0,63}$`);
                continue;
            }
            if (seen.has(asset.id)) {
                err('E_ASSET_ID_DUP', `duplicate asset id "${asset.id}"`);
                continue;
            }
            seen.add(asset.id);
            if (!ASSET_TYPES.has(asset.type)) {
                err('E_ASSET_TYPE_INVALID', `unknown type "${asset.type}" in asset "${asset.id}"`);
            }
            if (asset.type === 'hook')
                hasExecutable = true;
            if (!asset.src) {
                err('E_SRC_MISSING', `asset "${asset.id}" is missing src`);
            }
            else {
                const resolved = path.resolve(pkgDir, asset.src);
                if (!resolved.startsWith(path.resolve(pkgDir) + path.sep) && resolved !== path.resolve(pkgDir)) {
                    err('E_SRC_ESCAPE', `asset "${asset.id}" src "${asset.src}" escapes package root`);
                }
                else if (!fs.existsSync(resolved)) {
                    err('E_SRC_MISSING', `asset "${asset.id}" src "${asset.src}" does not exist`);
                }
                else if (asset.type === 'skill') {
                    const skillMd = path.join(resolved, 'SKILL.md');
                    if (!fs.existsSync(skillMd)) {
                        err('E_SKILL_NO_SKILLMD', `skill asset "${asset.id}" src directory must contain SKILL.md`);
                    }
                }
            }
            if (asset.attach && asset.type !== 'rule') {
                err('E_ATTACH_MISPLACED', `attach is only valid on rule assets, not "${asset.type}"`);
            }
        }
        if (hasExecutable && !raw.permissions?.exec?.length) {
            err('E_PERM_UNDECLARED', `manifest contains hook assets but permissions.exec is not declared`);
        }
    }
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0)
        throw new ValidationError(issues);
    return issues;
}
//# sourceMappingURL=validator.js.map