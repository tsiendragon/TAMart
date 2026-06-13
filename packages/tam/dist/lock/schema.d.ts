import type { TargetPlatform, ScopeLevel } from '../manifest/schema.js';
export interface LockFile {
    path: string;
    baseDigest: string;
    assetId: string;
    target: TargetPlatform;
    package: string;
}
export interface LockPackage {
    name: string;
    source: string;
    installedAt: string;
    scope: ScopeLevel;
    targets: TargetPlatform[];
    files: LockFile[];
}
export interface TamLock {
    version: 1;
    packages: LockPackage[];
}
//# sourceMappingURL=schema.d.ts.map