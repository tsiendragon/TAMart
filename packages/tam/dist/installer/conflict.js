import { digestOfFile } from '../util/digest.js';
import { fileExists } from '../util/fs.js';
export async function checkConflicts(ops, baseDigests // destPath → baseDigest from lock
) {
    const results = [];
    for (const op of ops) {
        const exists = await fileExists(op.destPath);
        if (!exists) {
            results.push({ op, kind: 'new-file', currentDigest: null, baseDigest: null });
            continue;
        }
        const currentDigest = await digestOfFile(op.destPath);
        const baseDigest = baseDigests.get(op.destPath) ?? null;
        if (baseDigest === null) {
            // File exists but not in lock — treat as user-owned, safe to overwrite only if content matches expected
            results.push({ op, kind: 'user-modified', currentDigest, baseDigest });
            continue;
        }
        if (currentDigest === baseDigest) {
            // File unchanged since install — safe to update
            results.push({ op, kind: 'safe-overwrite', currentDigest, baseDigest });
        }
        else if (currentDigest === op.digest) {
            // Already up to date
            results.push({ op, kind: 'safe-overwrite', currentDigest, baseDigest });
        }
        else {
            // User modified AND new content differs — true conflict
            results.push({ op, kind: 'conflict', currentDigest, baseDigest });
        }
    }
    return results;
}
//# sourceMappingURL=conflict.js.map