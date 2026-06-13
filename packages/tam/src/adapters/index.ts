import type { Adapter } from './adapter.js'
import { claudeCodeAdapter } from './claude-code.js'
import { cursorAdapter } from './cursor.js'
import type { TargetPlatform } from '../manifest/schema.js'

const adapters = new Map<TargetPlatform, Adapter>([
  ['claude-code', claudeCodeAdapter],
  ['cursor', cursorAdapter],
])

export function getAdapter(target: TargetPlatform): Adapter {
  const a = adapters.get(target)
  if (!a) throw new Error(`No adapter for target: ${target}`)
  return a
}

export { claudeCodeAdapter, cursorAdapter }
