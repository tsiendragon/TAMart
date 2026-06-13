import { createTwoFilesPatch } from 'diff';
import chalk from 'chalk';
import { readFileSafe } from '../util/fs.js';
export async function renderDiff(op) {
    const existing = await readFileSafe(op.destPath) ?? '';
    const patch = createTwoFilesPatch(op.destPath, op.destPath, existing, op.content, '', '');
    const lines = patch.split('\n');
    const colored = lines.map(line => {
        if (line.startsWith('+++') || line.startsWith('---'))
            return chalk.bold(line);
        if (line.startsWith('@@'))
            return chalk.cyan(line);
        if (line.startsWith('+'))
            return chalk.green(line);
        if (line.startsWith('-'))
            return chalk.red(line);
        return line;
    });
    return colored.join('\n');
}
export async function renderPlan(ops) {
    for (const op of ops) {
        const existing = await readFileSafe(op.destPath);
        const label = existing === null ? chalk.green('+ new') : chalk.yellow('~ update');
        console.log(`  ${label}  ${op.destPath}`);
    }
}
//# sourceMappingURL=diff.js.map