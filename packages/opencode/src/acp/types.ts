import type { McpServer } from "@agentclientprotocol/sdk"

export type SessionModeId = "ask" | "approve_all" | "read_only"

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  openCodeSessionId: string
  createdAt: Date
  mode: SessionModeId
}

export interface ACPConfig {
  defaultModel?: {
    providerID: string
    modelID: string
  }
}
