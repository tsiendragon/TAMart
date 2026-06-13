import { writeAtomic } from '../util/fs.js';
export async function writeLock(lockFile, lock) {
    await writeAtomic(lockFile, JSON.stringify(lock, null, 2) + '\n');
}
export function upsertPackage(lock, pkg) {
    const existing = lock.packages.findIndex(p => p.name === pkg.name);
    const packages = [...lock.packages];
    if (existing >= 0) {
        packages[existing] = pkg;
    }
    else {
        packages.push(pkg);
    }
    return { ...lock, packages };
}
export function removePackage(lock, pkgName) {
    return { ...lock, packages: lock.packages.filter(p => p.name !== pkgName) };
}
//# sourceMappingURL=writer.js.map