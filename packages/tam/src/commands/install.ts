import { Command } from 'commander'
import * as path from 'path'
import * as os from 'os'
import chalk from 'chalk'
import { loadManifest } from '../manifest/loader.js'
import { validateManifest } from '../manifest/validator.js'
import { detectTargets, getRootForTarget } from '../detector/target.js'
import { getAdapter } from '../adapters/index.js'
import { checkConflicts } from '../installer/conflict.js'
import { applyOp } from '../installer/writer.js'
import { renderPlan } from '../display/diff.js'
import { printSupportMatrix, printInstallResult } from '../display/report.js'
import { confirm, conflictChoice } from '../display/prompt.js'
import { lockPath, readLock } from '../lock/reader.js'
import { writeLock, upsertPackage } from '../lock/writer.js'
import { TamError, ValidationError } from '../util/errors.js'
import type { TargetPlatform } from '../manifest/schema.js'
import type { FileOp } from '../planner/types.js'
import type { LockFile, LockPackage } from '../lock/schema.js'

export function installCommand(): Command {
  return new Command('install')
    .description('Install a package into the current project or user directory')
    .argument('<pkg>', 'Package name (@scope/name) or local path (./path)')
    .option('--global', 'Install to user directory (~/.claude, ~/.cursor)')
    .option('--local', 'Install to current project (default)')
    .option('--target <targets>', 'Comma-separated targets (claude-code,cursor)')
    .option('--yes', 'Skip confirmation prompts')
    .option('--dry-run', 'Show plan without making changes')
    .action(async (pkg: string, opts: {
      global?: boolean
      local?: boolean
      target?: string
      yes?: boolean
      dryRun?: boolean
    }) => {
      try {
        await runInstall(pkg, opts)
      } catch (e) {
        if (e instanceof ValidationError) {
          for (const issue of e.issues) {
            const color = issue.severity === 'error' ? chalk.red : chalk.yellow
            console.error(color(`  ${issue.severity}  ${issue.code}  ${issue.message}`))
          }
          process.exit(1)
        }
        if (e instanceof TamError) {
          console.error(chalk.red(`  Error [${e.code}]: ${e.message}`))
          if (e.details) e.details.forEach(d => console.error(chalk.dim(`    ${d}`)))
          process.exit(1)
        }
        throw e
      }
    })
}

async function runInstall(pkg: string, opts: {
  global?: boolean
  target?: string
  yes?: boolean
  dryRun?: boolean
}): Promise<void> {
  const scopeLevel = opts.global ? 'user' : 'project'
  const cwd = process.cwd()

  // Resolve local path
  const pkgDir = path.resolve(pkg)

  // Load and validate manifest
  const { manifest } = loadManifest(pkgDir)
  validateManifest(manifest, pkgDir)

  const pkgRef = `${manifest.name}@${manifest.version}`
  console.log(chalk.bold(`\n  Installing ${pkgRef}`))
  console.log(chalk.dim(`  Source: ${pkgDir}`))
  console.log(chalk.dim(`  Scope:  ${scopeLevel === 'user' ? 'global (~/.claude)' : 'local (.claude/)'}\n`))

  // Detect targets
  const explicitTargets = opts.target
    ? (opts.target.split(',').map(t => t.trim()) as TargetPlatform[])
    : undefined

  const { targets, roots } = detectTargets(cwd, scopeLevel, explicitTargets)
  console.log(chalk.dim(`  Targets: ${targets.join(', ')}\n`))

  // Plan file ops for each target
  const allOps: FileOp[] = []
  const allSkipped: Array<{ assetId: string; target: string; reason: string }> = []

  for (const target of targets) {
    const adapter = getAdapter(target)
    const scopeRoot = getRootForTarget(roots, target)
    const { ops, skipped } = await adapter.plan(manifest.assets, pkgDir, scopeRoot, pkgRef)
    allOps.push(...ops)
    allSkipped.push(...skipped)
  }

  if (allOps.length === 0 && allSkipped.length === 0) {
    console.log(chalk.yellow('  Nothing to install.'))
    return
  }

  // Show plan
  console.log('  Files to write:')
  await renderPlan(allOps)
  printSupportMatrix(allOps, allSkipped)

  if (opts.dryRun) {
    console.log(chalk.cyan('  Dry run — no changes made.'))
    return
  }

  // Load lock for conflict detection
  const scopeRoot = scopeLevel === 'user'
    ? os.homedir()
    : cwd
  const lf = lockPath(scopeRoot)
  const lock = readLock(lf)

  const baseDigests = new Map<string, string>()
  for (const lpkg of lock.packages) {
    for (const f of lpkg.files) {
      baseDigests.set(f.path, f.baseDigest)
    }
  }

  const conflicts = await checkConflicts(allOps, baseDigests)
  const trueConflicts = conflicts.filter(c => c.kind === 'conflict')

  if (trueConflicts.length > 0 && !opts.yes) {
    console.log(chalk.yellow(`\n  ${trueConflicts.length} conflict(s) detected:\n`))
    for (const c of trueConflicts) {
      console.log(chalk.yellow(`    ${c.op.destPath}`))
    }
    console.log()
  }

  // Confirm
  if (!opts.yes) {
    const ok = await confirm('  Proceed with installation?')
    if (!ok) {
      console.log(chalk.dim('  Cancelled.'))
      return
    }
  }

  // Resolve conflicts
  const opsToApply: FileOp[] = []
  for (const c of conflicts) {
    if (c.kind === 'conflict' && !opts.yes) {
      const choice = await conflictChoice(c.op.destPath)
      if (choice === 'skip') continue
      if (choice === 'keep') continue
    }
    opsToApply.push(c.op)
  }

  // Apply ops
  for (const op of opsToApply) {
    await applyOp(op)
  }

  // Update lock
  const lockFiles: LockFile[] = opsToApply.map(op => ({
    path: op.destPath,
    baseDigest: op.digest,
    assetId: op.assetId,
    target: op.target,
    package: pkgRef,
  }))

  const lockPkg: LockPackage = {
    name: pkgRef,
    source: pkgDir,
    installedAt: new Date().toISOString(),
    scope: scopeLevel,
    targets,
    files: lockFiles,
  }

  const updatedLock = upsertPackage(lock, lockPkg)
  await writeLock(lf, updatedLock)

  printInstallResult(opsToApply, allSkipped)
  console.log(chalk.green(`  ✓ Done  (lock: ${lf})\n`))
}
