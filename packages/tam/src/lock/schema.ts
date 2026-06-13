import type { TargetPlatform, ScopeLevel } from '../manifest/schema.js'

export interface LockFile {
  path: string        // absolute path to installed file
  baseDigest: string  // sha256 of content when installed (for conflict detection)
  assetId: string
  target: TargetPlatform
  package: string     // @scope/name@version
}

export interface LockPackage {
  name: string        // @scope/name@version key
  source: string      // local path or future registry ref
  installedAt: string // ISO 8601
  scope: ScopeLevel
  targets: TargetPlatform[]
  files: LockFile[]
}

export interface TamLock {
  version: 1
  packages: LockPackage[]
}
