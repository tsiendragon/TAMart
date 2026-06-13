import { writeAtomic, readFileSafe } from '../util/fs.js';
export async function applyOp(op) {
    if (op.op === 'write') {
        await writeAtomic(op.destPath, op.content);
    }
    else if (op.op === 'append-block') {
        await applyBlock(op);
    }
    else if (op.op === 'remove-block') {
        await removeBlock(op);
    }
}
async function applyBlock(op) {
    if (!op.blockId)
        throw new Error('append-block op missing blockId');
    const existing = await readFileSafe(op.destPath);
    const startMarker = `<!-- tam:start assetId=${op.blockId}`;
    const endPattern = new RegExp(`<!-- tam:start assetId=${op.blockId}[^]*?<!-- tam:end assetId=${op.blockId}[^\n]*\n?`, 'g');
    let updated;
    if (existing === null) {
        updated = op.content + '\n';
    }
    else if (existing.includes(startMarker)) {
        // Replace existing block
        updated = existing.replace(endPattern, op.content + '\n');
        if (updated === existing) {
            // Fallback: simple append (shouldn't happen if marker format is consistent)
            updated = existing + '\n' + op.content + '\n';
        }
    }
    else {
        // Append block
        updated = existing + (existing.endsWith('\n') ? '' : '\n') + op.content + '\n';
    }
    await writeAtomic(op.destPath, updated);
}
async function removeBlock(op) {
    if (!op.blockId)
        return;
    const existing = await readFileSafe(op.destPath);
    if (!existing)
        return;
    const endPattern = new RegExp(`<!-- tam:start assetId=${op.blockId}[^]*?<!-- tam:end assetId=${op.blockId}[^\n]*\n?`, 'g');
    const updated = existing.replace(endPattern, '');
    await writeAtomic(op.destPath, updated);
}
//# sourceMappingURL=writer.js.map