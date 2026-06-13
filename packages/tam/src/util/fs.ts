import { readFile, writeFile, mkdir, access, rename, stat, readdir } from 'fs/promises'
import { constants } from 'fs'
import * as path from 'path'

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

export async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.tmp'
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, filePath)
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isDirectory()
  } catch {
    return false
  }
}

export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isFile()) {
      files.push(path.join(dir, entry.name))
    }
  }
  return files
}
