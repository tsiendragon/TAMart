import type { TamAsset, TargetPlatform } from '../manifest/schema.js'
import type { PlanResult } from '../planner/types.js'

export interface Adapter {
  readonly target: TargetPlatform
  plan(assets: TamAsset[], pkgDir: string, scopeRoot: string, pkgRef: string): Promise<PlanResult>
}
