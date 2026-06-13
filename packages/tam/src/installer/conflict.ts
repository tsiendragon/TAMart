import { digestOfFile } from '../util/digest.js'
import { fileExists } from '../util/fs.js'
import type { FileOp } from '../planner/types.js'

export type ConflictKind = 'safe-overwrite' | 'user-modified' | 'conflict' | 'new-file'

export interface ConflictResult {
  op: FileOp
  kind: ConflictKind
  currentDigest: string | null
  baseDigest: string | null   // from tam.lock
}

export async function checkConflicts(
  ops: FileOp[],
  baseDigests: Map<string, string>   // destPath → baseDigest from lock
): Promise<ConflictResult[]> {
  const results: ConflictResult[] = []

  for (const op of ops) {
    const exists = await fileExists(op.destPath)

    if (!exists) {
      results.push({ op, kind: 'new-file', currentDigest: null, baseDigest: null })
      continue
    }

    const currentDigest = await digestOfFile(op.destPath)
    const baseDigest = baseDigests.get(op.destPath) ?? null

    if (baseDigest === null) {
      // File exists but not in lock — treat as user-owned, safe to overwrite only if content matches expected
      results.push({ op, kind: 'user-modified', currentDigest, baseDigest })
      continue
    }

    if (currentDigest === baseDigest) {
      // File unchanged since install — safe to update
      results.push({ op, kind: 'safe-overwrite', currentDigest, baseDigest })
    } else if (currentDigest === op.digest) {
      // Already up to date
      results.push({ op, kind: 'safe-overwrite', currentDigest, baseDigest })
    } else {
      // User modified AND new content differs — true conflict
      results.push({ op, kind: 'conflict', currentDigest, baseDigest })
    }
  }

  return results
}
