import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
export function digestOf(content) {
    return 'sha256:' + createHash('sha256').update(content, 'utf-8').digest('hex');
}
export async function digestOfFile(filePath) {
    try {
        const content = await readFile(filePath, 'utf-8');
        return digestOf(content);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=digest.js.map