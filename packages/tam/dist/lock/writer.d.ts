import type { TamLock, LockPackage } from './schema.js';
export declare function writeLock(lockFile: string, lock: TamLock): Promise<void>;
export declare function upsertPackage(lock: TamLock, pkg: LockPackage): TamLock;
export declare function removePackage(lock: TamLock, pkgName: string): TamLock;
//# sourceMappingURL=writer.d.ts.map