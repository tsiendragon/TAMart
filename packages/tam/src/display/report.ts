import chalk from 'chalk'
import type { FileOp } from '../planner/types.js'
import type { SupportLevel } from '../manifest/schema.js'

const LEVEL_COLOR: Record<SupportLevel, (s: string) => string> = {
  native: chalk.green,
  translated: chalk.yellow,
  degraded: chalk.red,
  unsupported: chalk.gray,
  skipped: chalk.gray,
}

export function printSupportMatrix(ops: FileOp[], skipped: Array<{ assetId: string; target: string; reason: string }>): void {
  console.log('\n  Support matrix:')
  const rows = [
    ...ops.map(op => ({ assetId: op.assetId, target: op.target, level: op.supportLevel, note: '' })),
    ...skipped.map(s => ({ assetId: s.assetId, target: s.target, level: 'skipped' as SupportLevel, note: s.reason })),
  ]
  for (const row of rows) {
    const color = LEVEL_COLOR[row.level]
    const note = row.note ? chalk.dim(` (${row.note})`) : ''
    console.log(`    ${chalk.bold(row.assetId)}  ${row.target}  ${color(row.level)}${note}`)
  }
  console.log()
}

export function printInstallResult(ops: FileOp[], skipped: Array<{ assetId: string; target: string; reason: string }>): void {
  const native = ops.filter(o => o.supportLevel === 'native').length
  const translated = ops.filter(o => o.supportLevel === 'translated').length
  const skip = skipped.length
  const parts = [
    native > 0 ? chalk.green(`${native} native`) : null,
    translated > 0 ? chalk.yellow(`${translated} translated`) : null,
    skip > 0 ? chalk.gray(`${skip} skipped`) : null,
  ].filter(Boolean)
  console.log(`\n  Installed: ${parts.join(', ')}`)
}
