export type AssetType = 'rule' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type TargetPlatform = 'claude-code' | 'cursor';
export type ScopeLevel = 'project' | 'user';
export type SupportLevel = 'native' | 'translated' | 'degraded' | 'unsupported' | 'skipped';
export interface TamAsset {
    type: AssetType;
    id: string;
    src: string;
    scope?: ScopeLevel;
    attach?: {
        globs: string[];
        alwaysApply: boolean;
    };
}
export interface TamPermissions {
    exec?: string[];
    network?: string[];
}
export interface TamManifest {
    schema: 1;
    name: string;
    version: string;
    description: string;
    license: string;
    keywords?: string[];
    repository?: string;
    targets?: TargetPlatform[];
    assets: TamAsset[];
    permissions?: TamPermissions;
    dependencies?: Record<string, string>;
}
//# sourceMappingURL=schema.d.ts.map