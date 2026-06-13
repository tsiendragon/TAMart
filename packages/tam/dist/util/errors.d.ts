export declare const E: {
    readonly MANIFEST_AMBIGUOUS: "E_MANIFEST_AMBIGUOUS";
    readonly MANIFEST_MISSING: "E_MANIFEST_MISSING";
    readonly SCHEMA_UNSUPPORTED: "E_SCHEMA_UNSUPPORTED";
    readonly NAME_INVALID: "E_NAME_INVALID";
    readonly VERSION_INVALID: "E_VERSION_INVALID";
    readonly DESCRIPTION_INVALID: "E_DESCRIPTION_INVALID";
    readonly LICENSE_MISSING: "E_LICENSE_MISSING";
    readonly ASSETS_EMPTY: "E_ASSETS_EMPTY";
    readonly ASSET_ID_INVALID: "E_ASSET_ID_INVALID";
    readonly ASSET_ID_DUP: "E_ASSET_ID_DUP";
    readonly ASSET_TYPE_INVALID: "E_ASSET_TYPE_INVALID";
    readonly SRC_MISSING: "E_SRC_MISSING";
    readonly SRC_ESCAPE: "E_SRC_ESCAPE";
    readonly SKILL_NO_SKILLMD: "E_SKILL_NO_SKILLMD";
    readonly PERM_UNDECLARED: "E_PERM_UNDECLARED";
    readonly NO_TARGET_DETECTED: "E_NO_TARGET_DETECTED";
    readonly UNSUPPORTED_FAIL: "E_UNSUPPORTED_FAIL";
    readonly SECRET_INLINE: "E_SECRET_INLINE";
    readonly LOCK_CORRUPT: "E_LOCK_CORRUPT";
    readonly CONFLICT: "E_CONFLICT";
};
export declare const W: {
    readonly LICENSE_NONSTANDARD: "W_LICENSE_NONSTANDARD";
    readonly TARGET_DEFERRED: "W_TARGET_DEFERRED";
    readonly USER_MODIFIED: "W_USER_MODIFIED";
};
export type ErrorCode = typeof E[keyof typeof E];
export type WarnCode = typeof W[keyof typeof W];
export declare class TamError extends Error {
    readonly code: string;
    readonly details?: string[] | undefined;
    constructor(code: string, message: string, details?: string[] | undefined);
}
export interface ValidationIssue {
    code: string;
    severity: 'error' | 'warning';
    message: string;
}
export declare class ValidationError extends TamError {
    readonly issues: ValidationIssue[];
    constructor(issues: ValidationIssue[]);
}
//# sourceMappingURL=errors.d.ts.map