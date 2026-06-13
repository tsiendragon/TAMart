import type { Adapter } from './adapter.js';
import { claudeCodeAdapter } from './claude-code.js';
import { cursorAdapter } from './cursor.js';
import type { TargetPlatform } from '../manifest/schema.js';
export declare function getAdapter(target: TargetPlatform): Adapter;
export { claudeCodeAdapter, cursorAdapter };
//# sourceMappingURL=index.d.ts.map