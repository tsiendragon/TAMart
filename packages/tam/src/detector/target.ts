import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { TamError, E } from '../util/errors.js'
import type { TargetPlatform, ScopeLevel } from '../manifest/schema.js'

export interface ScopeRoots {
  scopeLevel: ScopeLevel
  cwd: string
  claudeRoot: string | null   // .claude/ or ~/.claude/
  cursorRoot: string | null   // .cursor/ or ~/.cursor/
}

function dirExists(p: string): boolean {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

function fileExists(p: string): boolean {
  try { return fs.statSync(p).isFile() } catch { return false }
}

export function detectTargets(
  cwd: string,
  scopeLevel: ScopeLevel,
  explicitTargets?: TargetPlatform[]
): { targets: TargetPlatform[]; roots: ScopeRoots } {
  const home = os.homedir()

  let claudeRoot: string | null = null
  let cursorRoot: string | null = null

  if (scopeLevel === 'user') {
    claudeRoot = path.join(home, '.claude')
    cursorRoot = path.join(home, '.cursor')
    // Always use user dirs for --global, create them if needed
  } else {
    // project scope: look in cwd
    const localClaude = path.join(cwd, '.claude')
    const localCursor = path.join(cwd, '.cursor')
    const hasClaude = dirExists(localClaude) || fileExists(path.join(cwd, 'CLAUDE.md'))
    const hasCursor = dirExists(localCursor)

    if (hasClaude) claudeRoot = localClaude
    if (hasCursor) cursorRoot = localCursor
  }

  const detected: TargetPlatform[] = []
  if (claudeRoot !== null) detected.push('claude-code')
  if (cursorRoot !== null) detected.push('cursor')

  if (explicitTargets && explicitTargets.length > 0) {
    // Validate explicit targets
    const unsupported = explicitTargets.filter(t => !['claude-code', 'cursor'].includes(t))
    if (unsupported.length > 0) {
      console.warn(`Warning: targets ${unsupported.join(', ')} are not supported in v1, skipping`)
    }
    const valid = explicitTargets.filter(t => t === 'claude-code' || t === 'cursor')

    // Ensure roots exist for explicit targets
    if (valid.includes('claude-code') && claudeRoot === null) {
      claudeRoot = scopeLevel === 'user' ? path.join(home, '.claude') : path.join(cwd, '.claude')
    }
    if (valid.includes('cursor') && cursorRoot === null) {
      cursorRoot = scopeLevel === 'user' ? path.join(home, '.cursor') : path.join(cwd, '.cursor')
    }

    return {
      targets: valid,
      roots: { scopeLevel, cwd, claudeRoot, cursorRoot },
    }
  }

  if (detected.length === 0 && scopeLevel === 'project') {
    throw new TamError(
      E.NO_TARGET_DETECTED,
      `No .claude/ or .cursor/ directory found in ${cwd}.\n` +
      `Use --target claude-code or --target cursor to specify explicitly.`
    )
  }

  // For --global with no explicit targets, always install to both
  if (scopeLevel === 'user' && detected.length === 0) {
    detected.push('claude-code')
  }

  return {
    targets: detected,
    roots: { scopeLevel, cwd, claudeRoot, cursorRoot },
  }
}

export function getRootForTarget(roots: ScopeRoots, target: TargetPlatform): string {
  const home = os.homedir()
  if (target === 'claude-code') {
    return roots.claudeRoot ?? path.join(roots.scopeLevel === 'user' ? home : roots.cwd, '.claude')
  }
  return roots.cursorRoot ?? path.join(roots.scopeLevel === 'user' ? home : roots.cwd, '.cursor')
}
