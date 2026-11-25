// State contract for the agent-designer-pane mod. The pane mirrors the DesignSpec receipts
// the governed gateway emits — it is VISUAL ONLY, never the driver.

export type GroundedObject = { object: string; fields: { api: string; type: string }[] }
export type DesignTopic = { name: string; description: string; fields: string[]; dropped: string[] }

export type DesignState = {
  agentName: string | null
  agentType: string | null
  status: 'idle' | 'drafting' | 'drafted' | 'gated'
  stage: string | null              // current step key, drives the context help tier
  objects: GroundedObject[]         // grounded objects + confirmed fields (live describe)
  topics: DesignTopic[]             // lattice cells; fields = grounded, dropped = ungrounded rejected
  gate: { ok: boolean; nError: number } | null
}

declare module 'claude-code' {
  interface PluginState {
    'agent-designer': { design: Shaped<DesignState> }
  }
}
