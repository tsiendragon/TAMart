import * as path from 'path';
import * as fs from 'fs';
import { digestOf } from '../util/digest.js';
const MANAGED_BLOCK_START = (id, pkg) => `<!-- tam:start assetId=${id} package=${pkg} -->`;
const MANAGED_BLOCK_END = (id, pkg) => `<!-- tam:end assetId=${id} package=${pkg} -->`;
export const claudeCodeAdapter = {
    target: 'claude-code',
    async plan(assets, pkgDir, scopeRoot, pkgRef) {
        const ops = [];
        const skipped = [];
        for (const asset of assets) {
            const srcPath = path.resolve(pkgDir, asset.src);
            switch (asset.type) {
                case 'skill': {
                    const skillMd = path.join(srcPath, 'SKILL.md');
                    const content = fs.readFileSync(skillMd, 'utf-8');
                    const dest = path.join(scopeRoot, 'skills', asset.id, 'SKILL.md');
                    ops.push({
                        op: 'write',
                        destPath: dest,
                        content,
                        digest: digestOf(content),
                        assetId: asset.id,
                        target: 'claude-code',
                        supportLevel: 'native',
                    });
                    break;
                }
                case 'command': {
                    const content = fs.readFileSync(srcPath, 'utf-8');
                    const dest = path.join(scopeRoot, 'commands', asset.id + '.md');
                    ops.push({
                        op: 'write',
                        destPath: dest,
                        content,
                        digest: digestOf(content),
                        assetId: asset.id,
                        target: 'claude-code',
                        supportLevel: 'native',
                    });
                    break;
                }
                case 'agent': {
                    const content = fs.readFileSync(srcPath, 'utf-8');
                    const dest = path.join(scopeRoot, 'agents', asset.id + '.md');
                    ops.push({
                        op: 'write',
                        destPath: dest,
                        content,
                        digest: digestOf(content),
                        assetId: asset.id,
                        target: 'claude-code',
                        supportLevel: 'native',
                    });
                    break;
                }
                case 'rule': {
                    // Rules go into AGENTS.md as a managed block
                    // AGENTS.md lives in the scope root (project root for local, ~/.claude/ for global)
                    const ruleContent = fs.readFileSync(srcPath, 'utf-8');
                    const blockStart = MANAGED_BLOCK_START(asset.id, pkgRef);
                    const blockEnd = MANAGED_BLOCK_END(asset.id, pkgRef);
                    const blockContent = `${blockStart}\n${ruleContent}\n${blockEnd}`;
                    const dest = path.join(scopeRoot, 'AGENTS.md');
                    ops.push({
                        op: 'append-block',
                        destPath: dest,
                        content: blockContent,
                        digest: digestOf(blockContent),
                        assetId: asset.id,
                        target: 'claude-code',
                        supportLevel: 'native',
                        blockId: asset.id,
                    });
                    break;
                }
                case 'hook':
                case 'mcp':
                    skipped.push({
                        assetId: asset.id,
                        target: 'claude-code',
                        reason: `${asset.type} support is deferred to M3`,
                    });
                    break;
            }
        }
        return { ops, skipped };
    },
};
//# sourceMappingURL=claude-code.js.map