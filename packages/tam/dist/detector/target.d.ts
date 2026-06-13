import type { TargetPlatform, ScopeLevel } from '../manifest/schema.js';
export interface ScopeRoots {
    scopeLevel: ScopeLevel;
    cwd: string;
    claudeRoot: string | null;
    cursorRoot: string | null;
}
export declare function detectTargets(cwd: string, scopeLevel: ScopeLevel, explicitTargets?: TargetPlatform[]): {
    targets: TargetPlatform[];
    roots: ScopeRoots;
};
export declare function getRootForTarget(roots: ScopeRoots, target: TargetPlatform): string;
//# sourceMappingURL=target.d.ts.map