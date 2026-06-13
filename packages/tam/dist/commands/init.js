import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
const TEMPLATE = (name, id) => `schema: 1
name: "${name}"
version: "0.1.0"
description: "A brief description of what this package provides"
license: "MIT"

assets:
  - type: skill
    id: ${id}
    src: "."
`;
export function initCommand() {
    return new Command('init')
        .description('Scaffold a tam.yaml in the current directory')
        .argument('[name]', 'Package name (@scope/name)', '')
        .option('--force', 'Overwrite existing tam.yaml')
        .action(async (nameArg, opts) => {
        const pkgDir = process.cwd();
        const yamlPath = path.join(pkgDir, 'tam.yaml');
        if (!opts.force && fs.existsSync(yamlPath)) {
            console.error(chalk.red('  tam.yaml already exists. Use --force to overwrite.'));
            process.exit(1);
        }
        const dirName = path.basename(pkgDir);
        const name = nameArg || `@local/${dirName}`;
        const id = dirName.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'my-skill';
        fs.writeFileSync(yamlPath, TEMPLATE(name, id), 'utf-8');
        console.log(chalk.green(`  ✓ Created tam.yaml`));
        console.log(chalk.dim(`    Edit name, description, and assets as needed.`));
        console.log(chalk.dim(`    Then run: tam validate`));
    });
}
//# sourceMappingURL=init.js.map