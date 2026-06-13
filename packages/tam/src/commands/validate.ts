import { Command } from 'commander'
import * as path from 'path'
import chalk from 'chalk'
import { loadManifest } from '../manifest/loader.js'
import { validateManifest } from '../manifest/validator.js'
import { ValidationError } from '../util/errors.js'

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate tam.yaml in the current directory')
    .argument('[dir]', 'Package directory (default: cwd)', '.')
    .option('--json', 'Output results as JSON')
    .action(async (dir: string, opts: { json?: boolean }) => {
      const pkgDir = path.resolve(dir)
      try {
        const { manifest } = loadManifest(pkgDir)
        const issues = validateManifest(manifest, pkgDir)
        const warnings = issues.filter(i => i.severity === 'warning')

        if (opts.json) {
          console.log(JSON.stringify({ valid: true, issues }))
          return
        }

        if (warnings.length > 0) {
          for (const w of warnings) {
            console.log(chalk.yellow(`  warning  ${w.code}  ${w.message}`))
          }
        }

        console.log(chalk.green(`  ✓ ${manifest.name}@${manifest.version} is valid`))
        if (warnings.length > 0) {
          console.log(chalk.yellow(`    ${warnings.length} warning(s)`))
        }
      } catch (e) {
        if (e instanceof ValidationError) {
          if (opts.json) {
            console.log(JSON.stringify({ valid: false, issues: e.issues }))
            process.exit(1)
          }
          for (const issue of e.issues) {
            const color = issue.severity === 'error' ? chalk.red : chalk.yellow
            console.error(color(`  ${issue.severity}  ${issue.code}  ${issue.message}`))
          }
          process.exit(1)
        }
        console.error(chalk.red(`  Error: ${(e as Error).message}`))
        process.exit(1)
      }
    })
}
