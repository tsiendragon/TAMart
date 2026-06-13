export declare function fileExists(filePath: string): Promise<boolean>;
export declare function readFileSafe(filePath: string): Promise<string | null>;
export declare function writeAtomic(filePath: string, content: string): Promise<void>;
export declare function ensureDir(dirPath: string): Promise<void>;
export declare function isDir(p: string): Promise<boolean>;
export declare function listFiles(dir: string): Promise<string[]>;
//# sourceMappingURL=fs.d.ts.map