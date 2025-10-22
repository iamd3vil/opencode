import type {
  Agent,
  AgentSideConnection,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  InitializeRequest,
  InitializeResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SetSessionModeRequest,
  SetSessionModeResponse,
} from "@agentclientprotocol/sdk"
import { Log } from "../util/log"
import { ACPSessionManager } from "./session"
import type { ACPConfig } from "./types"
import { Provider } from "../provider/provider"
import { SessionPrompt } from "../session/prompt"
import { Identifier } from "../id/id"

export class OpenCodeAgent implements Agent {
  private log = Log.create({ service: "acp-agent" })
  private sessionManager = new ACPSessionManager()
  private connection: AgentSideConnection
  private config: ACPConfig

  constructor(connection: AgentSideConnection, config: ACPConfig = {}) {
    this.connection = connection
    this.config = config
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    this.log.info("initialize", { protocolVersion: params.protocolVersion })

    return {
      protocolVersion: 1,
      agentCapabilities: {
        loadSession: false,
      },
      _meta: {
        opencode: {
          version: await import("../installation").then((m) => m.Installation.VERSION),
        },
      },
    }
  }

  async authenticate(params: AuthenticateRequest): Promise<void | AuthenticateResponse> {
    this.log.info("authenticate", { methodId: params.methodId })
    throw new Error("Authentication not yet implemented")
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    this.log.info("newSession", { cwd: params.cwd, mcpServers: params.mcpServers.length })

    const session = await this.sessionManager.create(params.cwd, params.mcpServers)

    return {
      sessionId: session.id,
      modes: {
        currentModeId: session.mode,
        availableModes: [
          {
            id: "ask",
            name: "Always Ask",
            description: "Prompts for permission before each tool use",
          },
          {
            id: "approve_all",
            name: "Approve All",
            description: "Automatically approves all tool uses",
          },
          {
            id: "read_only",
            name: "Read Only",
            description: "Only allows read operations, blocks all edits and commands",
          },
        ],
      },
      _meta: {},
    }
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.log.info("loadSession", { sessionId: params.sessionId, cwd: params.cwd })

    await this.sessionManager.load(params.sessionId, params.cwd, params.mcpServers)

    return {
      _meta: {},
    }
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    this.log.info("prompt", {
      sessionId: params.sessionId,
      promptLength: params.prompt.length,
    })

    const acpSession = this.sessionManager.get(params.sessionId)
    if (!acpSession) {
      throw new Error(`Session not found: ${params.sessionId}`)
    }

    const model = this.config.defaultModel || (await Provider.defaultModel())

    const parts = params.prompt.map((content) => {
      if (content.type === "text") {
        return {
          type: "text" as const,
          text: content.text,
        }
      }
      if (content.type === "resource") {
        const resource = content.resource
        let text = ""
        if ("text" in resource && typeof resource.text === "string") {
          text = resource.text
        }
        return {
          type: "text" as const,
          text,
        }
      }
      return {
        type: "text" as const,
        text: JSON.stringify(content),
      }
    })

    await SessionPrompt.prompt({
      sessionID: acpSession.openCodeSessionId,
      messageID: Identifier.ascending("message"),
      model: {
        providerID: model.providerID,
        modelID: model.modelID,
      },
      parts,
      acpConnection: {
        connection: this.connection,
        sessionId: params.sessionId,
        mode: acpSession.mode,
      },
    })

    this.log.debug("prompt response completed")

    // Streaming notifications are now handled during prompt execution
    // No need to send final text chunk here

    return {
      stopReason: "end_turn",
      _meta: {},
    }
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.log.info("cancel", { sessionId: params.sessionId })
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    this.log.info("setSessionMode", { sessionId: params.sessionId, modeId: params.modeId })

    const session = this.sessionManager.get(params.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`)
    }

    const validModes = ["ask", "approve_all", "read_only"]
    if (!validModes.includes(params.modeId)) {
      throw new Error(`Invalid mode: ${params.modeId}`)
    }

    this.sessionManager.setMode(params.sessionId, params.modeId as any)

    // Notify client of mode change
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "current_mode_update",
        currentModeId: params.modeId,
      },
    })

    return {}
  }
}
