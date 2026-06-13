import { Command } from 'commander'
import * as path from 'path'
import * as os from 'os'
import chalk from 'chalk'
import { lockPath, readLock } from '../lock/reader.js'
import { writeLock } from '../lock/writer.js'
import { loadManifest } from '../manifest/loader.js'
import { validateManifest } from '../manifest/validator.js'
import { detectTargets, getRootForTarget } from '../detector/target.js'
import { getAdapter } from '../adapters/index.js'
import { checkConflicts } from '../installer/conflict.js'
import { applyOp } from '../installer/writer.js'
import { digestOfFile } from '../util/digest.js'
import { TamError } from '../util/errors.js'
import type { TargetPlatform } from '../manifest/schema.js'
import type { LockFile } from '../lock/schema.js'

export function syncCommand(): Command {
  return new Command('sync')
    .description('Rebuild all installed packages from tam.lock')
    .option('--global', 'Sync user-level lock (~/.tam.lock)')
    .option('--yes', 'Skip confirmation prompts')
    .option('--dry-run', 'Show plan without making changes')
    .action(async (opts: { global?: boolean; yes?: boolean; dryRun?: boolean }) => {
      try {
        await runSync(opts)
      } catch (e) {
        if (e instanceof TamError) {
          console.error(chalk.red(`  Error [${e.code}]: ${e.message}`))
          process.exit(1)
        }
        throw e
      }
    })
}

async function runSync(opts: { global?: boolean; yes?: boolean; dryRun?: boolean }): Promise<void> {
  const scopeLevel = opts.global ? 'user' : 'project'
  const cwd = process.cwd()
  const scopeRoot = scopeLevel === 'user' ? os.homedir() : cwd
  const lf = lockPath(scopeRoot)
  const lock = readLock(lf)

  if (lock.packages.length === 0) {
    console.log(chalk.dim('  Nothing in tam.lock to sync.'))
    return
  }

  console.log(chalk.bold(`\n  Syncing ${lock.packages.length} package(s) from ${lf}\n`))

  let totalOps = 0
  let totalSkipped = 0

  for (const lpkg of lock.packages) {
    const pkgDir = path.resolve(lpkg.source)
    console.log(chalk.dim(`  ${lpkg.name}  →  ${pkgDir}`))

    let manifest
    try {
      const loaded = loadManifest(pkgDir)
      manifest = loaded.manifest
      validateManifest(manifest, pkgDir)
    } catch (e) {
      console.error(chalk.red(`    Failed to load manifest: ${(e as Error).message}`))
      continue
    }

    const { targets, roots } = detectTargets(cwd, lpkg.scope, lpkg.targets as TargetPlatform[])

    const baseDigests = new Map<string, string>()
    for (const f of lpkg.files) {
      baseDigests.set(f.path, f.baseDigest)
    }

    const newFiles: LockFile[] = []

    for (const target of targets) {
      const adapter = getAdapter(target)
      const targetRoot = getRootForTarget(roots, target)
      const { ops, skipped } = await adapter.plan(manifest.assets, pkgDir, targetRoot, lpkg.name)

      totalSkipped += skipped.length

      const conflicts = await checkConflicts(ops, baseDigests)
      const trueConflicts = conflicts.filter(c => c.kind === 'conflict')

      if (trueConflicts.length > 0) {
        console.log(chalk.yellow(`    ${trueConflicts.length} conflict(s) — skipping (run tam install to resolve)`))
        continue
      }

      // Check if already up to date
      let upToDate = 0
      const opsToApply = []
      for (const c of conflicts) {
        const current = await digestOfFile(c.op.destPath)
        if (current === c.op.digest) {
          upToDate++
        } else {
          opsToApply.push(c.op)
        }
      }

      if (opsToApply.length === 0) {
        console.log(chalk.dim(`    ${target}  already up to date (${upToDate} file(s))`))
      } else {
        if (!opts.dryRun) {
          for (const op of opsToApply) {
            await applyOp(op)
            totalOps++
          }
          console.log(chalk.green(`    ${target}  updated ${opsToApply.length} file(s)`))
        } else {
          console.log(chalk.cyan(`    ${target}  would update ${opsToApply.length} file(s) (dry-run)`))
        }
      }

      for (const op of ops) {
        newFiles.push({
          path: op.destPath,
          baseDigest: op.digest,
          assetId: op.assetId,
          target: op.target,
          package: lpkg.name,
        })
      }
    }

    // Update lock entry with fresh baseDigests
    if (!opts.dryRun && newFiles.length > 0) {
      lpkg.files = newFiles
    }
  }

  if (!opts.dryRun) {
    await writeLock(lf, lock)
  }

  const summary = opts.dryRun ? 'Dry run complete' : 'Sync complete'
  console.log(chalk.green(`\n  ✓ ${summary}  (${totalOps} file(s) updated, ${totalSkipped} skipped)\n`))
}
