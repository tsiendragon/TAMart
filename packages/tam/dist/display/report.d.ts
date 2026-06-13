import type { FileOp } from '../planner/types.js';
export declare function printSupportMatrix(ops: FileOp[], skipped: Array<{
    assetId: string;
    target: string;
    reason: string;
}>): void;
export declare function printInstallResult(ops: FileOp[], skipped: Array<{
    assetId: string;
    target: string;
    reason: string;
}>): void;
//# sourceMappingURL=report.d.ts.map