import type { FileOp } from '../planner/types.js';
export type ConflictKind = 'safe-overwrite' | 'user-modified' | 'conflict' | 'new-file';
export interface ConflictResult {
    op: FileOp;
    kind: ConflictKind;
    currentDigest: string | null;
    baseDigest: string | null;
}
export declare function checkConflicts(ops: FileOp[], baseDigests: Map<string, string>): Promise<ConflictResult[]>;
//# sourceMappingURL=conflict.d.ts.map