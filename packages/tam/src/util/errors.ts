export const E = {
  MANIFEST_AMBIGUOUS: 'E_MANIFEST_AMBIGUOUS',
  MANIFEST_MISSING: 'E_MANIFEST_MISSING',
  SCHEMA_UNSUPPORTED: 'E_SCHEMA_UNSUPPORTED',
  NAME_INVALID: 'E_NAME_INVALID',
  VERSION_INVALID: 'E_VERSION_INVALID',
  DESCRIPTION_INVALID: 'E_DESCRIPTION_INVALID',
  LICENSE_MISSING: 'E_LICENSE_MISSING',
  ASSETS_EMPTY: 'E_ASSETS_EMPTY',
  ASSET_ID_INVALID: 'E_ASSET_ID_INVALID',
  ASSET_ID_DUP: 'E_ASSET_ID_DUP',
  ASSET_TYPE_INVALID: 'E_ASSET_TYPE_INVALID',
  SRC_MISSING: 'E_SRC_MISSING',
  SRC_ESCAPE: 'E_SRC_ESCAPE',
  SKILL_NO_SKILLMD: 'E_SKILL_NO_SKILLMD',
  PERM_UNDECLARED: 'E_PERM_UNDECLARED',
  NO_TARGET_DETECTED: 'E_NO_TARGET_DETECTED',
  UNSUPPORTED_FAIL: 'E_UNSUPPORTED_FAIL',
  SECRET_INLINE: 'E_SECRET_INLINE',
  LOCK_CORRUPT: 'E_LOCK_CORRUPT',
  CONFLICT: 'E_CONFLICT',
} as const

export const W = {
  LICENSE_NONSTANDARD: 'W_LICENSE_NONSTANDARD',
  TARGET_DEFERRED: 'W_TARGET_DEFERRED',
  USER_MODIFIED: 'W_USER_MODIFIED',
} as const

export type ErrorCode = typeof E[keyof typeof E]
export type WarnCode = typeof W[keyof typeof W]

export class TamError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: string[]
  ) {
    super(message)
    this.name = 'TamError'
  }
}

export interface ValidationIssue {
  code: string
  severity: 'error' | 'warning'
  message: string
}

export class ValidationError extends TamError {
  constructor(public readonly issues: ValidationIssue[]) {
    const errs = issues.filter(i => i.severity === 'error').length
    super('E_VALIDATION', `Validation failed with ${errs} error(s)`)
    this.name = 'ValidationError'
  }
}
