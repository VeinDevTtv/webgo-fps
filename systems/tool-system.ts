import { GAME_CONFIG } from '@/lib/config/game-config'

export interface ToolData {
  id: string
  name: string
  type: 'hatchet' | 'pickaxe' | 'shovel'
  durability: number
  maxDurability: number
  efficiency: number
  cooldown: number
  lastUseTime: number
  icon: string
}

export interface ToolUseResult {
  success: boolean
  durabilityLoss: number
  resourcesGained: number
  toolBroken: boolean
}

export class ToolSystem {
  private tools: Map<string, ToolData> = new Map()
  private onToolUpdate?: (tool: ToolData) => void
  private onToolBreak?: (tool: ToolData) => void
  private onResourceGain?: (resourceType: string, amount: number) => void

  constructor() {
    this.initializeDefaultTools()
  }

  private initializeDefaultTools(): void {
    // Create default tools
    this.addTool({
      id: 'hatchet_1',
      name: 'Iron Hatchet',
      type: 'hatchet',
      durability: GAME_CONFIG.TOOLS.HATCHET.MAX_DURABILITY,
      maxDurability: GAME_CONFIG.TOOLS.HATCHET.MAX_DURABILITY,
      efficiency: GAME_CONFIG.TOOLS.HATCHET.EFFICIENCY,
      cooldown: GAME_CONFIG.TOOLS.HATCHET.CHOP_COOLDOWN,
      lastUseTime: 0,
      icon: '🪓',
    })

    this.addTool({
      id: 'pickaxe_1',
      name: 'Iron Pickaxe',
      type: 'pickaxe',
      durability: GAME_CONFIG.TOOLS.PICKAXE.MAX_DURABILITY,
      maxDurability: GAME_CONFIG.TOOLS.PICKAXE.MAX_DURABILITY,
      efficiency: GAME_CONFIG.TOOLS.PICKAXE.EFFICIENCY,
      cooldown: GAME_CONFIG.TOOLS.PICKAXE.MINE_COOLDOWN,
      lastUseTime: 0,
      icon: '⛏️',
    })
  }

  public addTool(toolData: ToolData): void {
    this.tools.set(toolData.id, { ...toolData })
  }

  public getTool(toolId: string): ToolData | null {
    return this.tools.get(toolId) || null
  }

  public getAllTools(): ToolData[] {
    return Array.from(this.tools.values())
  }

  public canUseTool(toolId: string): boolean {
    const tool = this.getTool(toolId)
    if (!tool) return false

    const now = Date.now()
    return (
      tool.durability > 0 &&
      now - tool.lastUseTime >= tool.cooldown
    )
  }

  public useTool(toolId: string, targetType: 'tree' | 'stone' | 'dirt'): ToolUseResult {
    const tool = this.getTool(toolId)
    if (!tool) {
      return { success: false, durabilityLoss: 0, resourcesGained: 0, toolBroken: false }
    }

    if (!this.canUseTool(toolId)) {
      return { success: false, durabilityLoss: 0, resourcesGained: 0, toolBroken: false }
    }

    // Check if tool is appropriate for target
    const isValidTarget = this.isValidToolTarget(tool.type, targetType)
    if (!isValidTarget) {
      return { success: false, durabilityLoss: 0, resourcesGained: 0, toolBroken: false }
    }

    const now = Date.now()
    tool.lastUseTime = now

    // Calculate durability loss
    const durabilityLoss = this.getDurabilityLoss(tool.type)
    tool.durability = Math.max(0, tool.durability - durabilityLoss)

    // Calculate resources gained
    const resourcesGained = this.calculateResourceGain(tool, targetType)

    // Check if tool broke
    const toolBroken = tool.durability === 0

    // Notify listeners
    this.onToolUpdate?.(tool)
    if (toolBroken) {
      this.onToolBreak?.(tool)
    }

    // Add resources to inventory
    const resourceType = this.getResourceType(targetType)
    if (resourcesGained > 0) {
      this.onResourceGain?.(resourceType, resourcesGained)
    }

    return {
      success: true,
      durabilityLoss,
      resourcesGained,
      toolBroken,
    }
  }

  private isValidToolTarget(toolType: string, targetType: string): boolean {
    switch (toolType) {
      case 'hatchet':
        return targetType === 'tree'
      case 'pickaxe':
        return targetType === 'stone'
      case 'shovel':
        return targetType === 'dirt'
      default:
        return false
    }
  }

  private getDurabilityLoss(toolType: string): number {
    switch (toolType) {
      case 'hatchet':
        return GAME_CONFIG.TOOLS.HATCHET.DURABILITY_LOSS_PER_USE
      case 'pickaxe':
        return GAME_CONFIG.TOOLS.PICKAXE.DURABILITY_LOSS_PER_USE
      case 'shovel':
        return GAME_CONFIG.TOOLS.SHOVEL.DURABILITY_LOSS_PER_USE
      default:
        return 1
    }
  }

  private calculateResourceGain(tool: ToolData, targetType: string): number {
    // Base resource gain
    let baseGain = 1

    switch (targetType) {
      case 'tree':
        baseGain = Math.floor(GAME_CONFIG.RESOURCES.WOOD_PER_TREE / 10) // 10 hits per tree
        break
      case 'stone':
        baseGain = Math.floor(GAME_CONFIG.RESOURCES.STONE_PER_NODE / 8) // 8 hits per node
        break
      case 'dirt':
        baseGain = 1
        break
    }

    // Apply tool efficiency
    const efficiency = tool.efficiency
    const durabilityMultiplier = tool.durability / tool.maxDurability

    // Tools work less efficiently when damaged
    const finalGain = Math.floor(baseGain * efficiency * (0.5 + 0.5 * durabilityMultiplier))
    
    return Math.max(1, finalGain)
  }

  private getResourceType(targetType: string): string {
    switch (targetType) {
      case 'tree':
        return 'wood'
      case 'stone':
        return 'stone'
      case 'dirt':
        return 'dirt'
      default:
        return 'unknown'
    }
  }

  public repairTool(toolId: string, repairAmount: number): boolean {
    const tool = this.getTool(toolId)
    if (!tool) return false

    const maxRepair = tool.maxDurability - tool.durability
    const actualRepair = Math.min(repairAmount, maxRepair)

    tool.durability += actualRepair
    this.onToolUpdate?.(tool)

    return actualRepair > 0
  }

  public getToolDurabilityPercentage(toolId: string): number {
    const tool = this.getTool(toolId)
    if (!tool) return 0

    return (tool.durability / tool.maxDurability) * 100
  }

  public isToolNearBreaking(toolId: string): boolean {
    const percentage = this.getToolDurabilityPercentage(toolId)
    return percentage <= GAME_CONFIG.TOOLS.DURABILITY_WARNING_THRESHOLD
  }

  public isToolBroken(toolId: string): boolean {
    const tool = this.getTool(toolId)
    return tool ? tool.durability === 0 : true
  }

  public getRepairCost(toolId: string): number {
    const tool = this.getTool(toolId)
    if (!tool) return 0

    const damagePercentage = 1 - (tool.durability / tool.maxDurability)
    const baseCost = this.getToolBaseCost(tool.type)
    
    return Math.floor(baseCost * damagePercentage * GAME_CONFIG.TOOLS.REPAIR_COST_MULTIPLIER)
  }

  private getToolBaseCost(toolType: string): number {
    // Base costs for different tool types
    switch (toolType) {
      case 'hatchet':
        return 50
      case 'pickaxe':
        return 75
      case 'shovel':
        return 30
      default:
        return 50
    }
  }

  // Multiplayer synchronization
  public getStateForSync(): any {
    return {
      tools: Array.from(this.tools.entries()).map(([id, tool]) => ({
        ...tool,
      })),
    }
  }

  public applyStateFromSync(syncData: any): void {
    this.tools.clear()
    
    for (const toolData of syncData.tools) {
      this.tools.set(toolData.id, {
        id: toolData.id,
        name: toolData.name,
        type: toolData.type,
        durability: toolData.durability,
        maxDurability: toolData.maxDurability,
        efficiency: toolData.efficiency,
        cooldown: toolData.cooldown,
        lastUseTime: toolData.lastUseTime,
        icon: toolData.icon,
      })
    }
  }

  // Event listeners
  public onToolUpdateEvent(callback: (tool: ToolData) => void): void {
    this.onToolUpdate = callback
  }

  public onToolBreakEvent(callback: (tool: ToolData) => void): void {
    this.onToolBreak = callback
  }

  public onResourceGainEvent(callback: (resourceType: string, amount: number) => void): void {
    this.onResourceGain = callback
  }
} 