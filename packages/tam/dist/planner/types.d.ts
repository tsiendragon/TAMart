import type { TargetPlatform, SupportLevel } from '../manifest/schema.js';
export interface FileOp {
    op: 'write' | 'append-block' | 'remove-block';
    destPath: string;
    content: string;
    digest: string;
    assetId: string;
    target: TargetPlatform;
    supportLevel: SupportLevel;
    blockId?: string;
}
export interface PlanResult {
    ops: FileOp[];
    skipped: Array<{
        assetId: string;
        target: TargetPlatform;
        reason: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map