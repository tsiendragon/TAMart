import * as fs from 'fs';
import * as path from 'path';
import { TamError, E } from '../util/errors.js';
export function lockPath(scopeRoot) {
    return path.join(scopeRoot, 'tam.lock');
}
export function readLock(lockFile) {
    if (!fs.existsSync(lockFile)) {
        return { version: 1, packages: [] };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
        if (raw.version !== 1) {
            throw new TamError(E.LOCK_CORRUPT, `Unsupported lock version: ${raw.version}`);
        }
        return raw;
    }
    catch (e) {
        if (e instanceof TamError)
            throw e;
        throw new TamError(E.LOCK_CORRUPT, `Failed to parse tam.lock: ${e.message}`);
    }
}
//# sourceMappingURL=reader.js.map