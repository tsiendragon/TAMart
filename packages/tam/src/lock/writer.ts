import { writeAtomic } from '../util/fs.js'
import type { TamLock, LockPackage } from './schema.js'

export async function writeLock(lockFile: string, lock: TamLock): Promise<void> {
  await writeAtomic(lockFile, JSON.stringify(lock, null, 2) + '\n')
}

export function upsertPackage(lock: TamLock, pkg: LockPackage): TamLock {
  const existing = lock.packages.findIndex(p => p.name === pkg.name)
  const packages = [...lock.packages]
  if (existing >= 0) {
    packages[existing] = pkg
  } else {
    packages.push(pkg)
  }
  return { ...lock, packages }
}

export function removePackage(lock: TamLock, pkgName: string): TamLock {
  return { ...lock, packages: lock.packages.filter(p => p.name !== pkgName) }
}
