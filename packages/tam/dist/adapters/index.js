import { claudeCodeAdapter } from './claude-code.js';
import { cursorAdapter } from './cursor.js';
const adapters = new Map([
    ['claude-code', claudeCodeAdapter],
    ['cursor', cursorAdapter],
]);
export function getAdapter(target) {
    const a = adapters.get(target);
    if (!a)
        throw new Error(`No adapter for target: ${target}`);
    return a;
}
export { claudeCodeAdapter, cursorAdapter };
//# sourceMappingURL=index.js.map