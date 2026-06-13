import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { TamError, E } from '../util/errors.js';
export function loadManifest(pkgDir) {
    const yamlPath = path.join(pkgDir, 'tam.yaml');
    const ymlPath = path.join(pkgDir, 'tam.yml');
    const hasYaml = fs.existsSync(yamlPath);
    const hasYml = fs.existsSync(ymlPath);
    if (hasYaml && hasYml) {
        throw new TamError(E.MANIFEST_AMBIGUOUS, `Both tam.yaml and tam.yml exist in ${pkgDir}`);
    }
    if (!hasYaml && !hasYml) {
        throw new TamError(E.MANIFEST_MISSING, `No tam.yaml found in ${pkgDir}`);
    }
    const manifestPath = hasYaml ? yamlPath : ymlPath;
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const raw = yaml.load(content);
    if (typeof raw !== 'object' || raw === null) {
        throw new TamError(E.MANIFEST_MISSING, `tam.yaml is empty or not a valid YAML object`);
    }
    return { manifest: raw, manifestPath };
}
//# sourceMappingURL=loader.js.map