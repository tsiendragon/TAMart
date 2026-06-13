import { readFile, writeFile, mkdir, access, rename, stat, readdir } from 'fs/promises';
import { constants } from 'fs';
import * as path from 'path';
export async function fileExists(filePath) {
    try {
        await access(filePath, constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
export async function readFileSafe(filePath) {
    try {
        return await readFile(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
export async function writeAtomic(filePath, content) {
    const tmpPath = filePath + '.tmp';
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, filePath);
}
export async function ensureDir(dirPath) {
    await mkdir(dirPath, { recursive: true });
}
export async function isDir(p) {
    try {
        const s = await stat(p);
        return s.isDirectory();
    }
    catch {
        return false;
    }
}
export async function listFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.isFile()) {
            files.push(path.join(dir, entry.name));
        }
    }
    return files;
}
//# sourceMappingURL=fs.js.map