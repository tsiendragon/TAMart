import type { TargetPlatform, SupportLevel } from '../manifest/schema.js'

export interface FileOp {
  op: 'write' | 'append-block' | 'remove-block'
  destPath: string    // absolute path
  content: string
  digest: string      // sha256 of content
  assetId: string
  target: TargetPlatform
  supportLevel: SupportLevel
  blockId?: string    // for AGENTS.md managed blocks
}

export interface PlanResult {
  ops: FileOp[]
  skipped: Array<{ assetId: string; target: TargetPlatform; reason: string }>
}
