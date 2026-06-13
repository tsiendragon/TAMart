import * as path from 'path'
import * as fs from 'fs'
import { digestOf } from '../util/digest.js'
import type { Adapter } from './adapter.js'
import type { TamAsset } from '../manifest/schema.js'
import type { FileOp, PlanResult } from '../planner/types.js'

export const cursorAdapter: Adapter = {
  target: 'cursor',

  async plan(assets: TamAsset[], pkgDir: string, scopeRoot: string, pkgRef: string): Promise<PlanResult> {
    const ops: FileOp[] = []
    const skipped: PlanResult['skipped'] = []

    for (const asset of assets) {
      const srcPath = path.resolve(pkgDir, asset.src)

      switch (asset.type) {
        case 'skill': {
          const skillMd = path.join(srcPath, 'SKILL.md')
          const content = fs.readFileSync(skillMd, 'utf-8')
          const dest = path.join(scopeRoot, 'skills', asset.id, 'SKILL.md')
          ops.push({
            op: 'write',
            destPath: dest,
            content,
            digest: digestOf(content),
            assetId: asset.id,
            target: 'cursor',
            supportLevel: 'native',
          })
          break
        }

        case 'command': {
          const content = fs.readFileSync(srcPath, 'utf-8')
          const dest = path.join(scopeRoot, 'prompts', asset.id + '.md')
          ops.push({
            op: 'write',
            destPath: dest,
            content,
            digest: digestOf(content),
            assetId: asset.id,
            target: 'cursor',
            supportLevel: 'native',
          })
          break
        }

        case 'agent': {
          const content = fs.readFileSync(srcPath, 'utf-8')
          const dest = path.join(scopeRoot, 'prompts', asset.id + '.md')
          ops.push({
            op: 'write',
            destPath: dest,
            content,
            digest: digestOf(content),
            assetId: asset.id,
            target: 'cursor',
            supportLevel: 'native',
          })
          break
        }

        case 'rule': {
          // Cursor uses .mdc files in .cursor/rules/
          const content = fs.readFileSync(srcPath, 'utf-8')
          const dest = path.join(scopeRoot, 'rules', asset.id + '.mdc')
          ops.push({
            op: 'write',
            destPath: dest,
            content,
            digest: digestOf(content),
            assetId: asset.id,
            target: 'cursor',
            supportLevel: 'native',
          })
          break
        }

        case 'hook':
        case 'mcp':
          skipped.push({
            assetId: asset.id,
            target: 'cursor',
            reason: `${asset.type} support is deferred to M3`,
          })
          break
      }
    }

    return { ops, skipped }
  },
}
