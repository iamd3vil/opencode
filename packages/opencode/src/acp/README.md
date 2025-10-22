# ACP (Agent Client Protocol) Implementation

This directory contains a clean, protocol-compliant implementation of the [Agent Client Protocol](https://agentclientprotocol.com/) for opencode.

## Architecture

The implementation follows a clean separation of concerns:

### Core Components

- **`agent.ts`** - Implements the `Agent` interface from `@agentclientprotocol/sdk`
  - Handles initialization and capability negotiation
  - Manages session lifecycle (`session/new`, `session/load`)
  - Processes prompts and returns responses
  - Properly implements ACP protocol v1

- **`client.ts`** - Implements the `Client` interface for client-side capabilities
  - File operations (`readTextFile`, `writeTextFile`)
  - Permission requests (auto-approves for now)
  - Terminal support (stub implementation)

- **`session.ts`** - Session state management
  - Creates and tracks ACP sessions
  - Maps ACP sessions to internal opencode sessions
  - Maintains working directory context
  - Handles MCP server configurations

- **`server.ts`** - ACP server startup and lifecycle
  - Sets up JSON-RPC over stdio using the official library
  - Manages graceful shutdown on SIGTERM/SIGINT
  - Provides Instance context for the agent

- **`types.ts`** - Type definitions for internal use

## Usage

### Command Line

```bash
# Start the ACP server in the current directory
opencode acp

# Start in a specific directory
opencode acp --cwd /path/to/project
```

### Programmatic

```typescript
import { ACPServer } from "./acp/server"

await ACPServer.start()
```

### Integration with Zed

Add to your Zed configuration (`~/.config/zed/settings.json`):

```json
{
  "agent_servers": {
    "OpenCode": {
      "command": "opencode",
      "args": ["acp"]
    }
  }
}
```

## Protocol Compliance

This implementation follows the ACP specification v1:

✅ **Initialization**

- Proper `initialize` request/response with protocol version negotiation
- Capability advertisement (`agentCapabilities`)
- Authentication support (stub)

✅ **Session Management**

- `session/new` - Create new conversation sessions
- `session/load` - Resume existing sessions (basic support)
- Working directory context (`cwd`)
- MCP server configuration support

✅ **Prompting**

- `session/prompt` - Process user messages
- Content block handling (text, resources)
- Response with stop reasons

✅ **Client Capabilities**

- File read/write operations
- Permission requests (integrated with opencode's permission system)
- Terminal support (stub for future)

## Permission Handling

When tools require user approval (configured via `opencode.json` with `permission: { edit: "ask", bash: "ask" }`), the ACP implementation automatically delegates permission requests to the client via the `requestPermission` method.

The permission flow:

1. Tool execution requires approval (e.g., edit, bash, write)
2. OpenCode checks if ACP connection is active
3. If ACP mode: Calls client's `requestPermission` with options (Allow Once, Always Allow, Reject)
4. If not ACP mode: Uses Bus events for UI-based approval (desktop/TUI)
5. Permission response is processed and tool execution continues or fails

This ensures that ACP clients (like Avante.nvim, Zed) can properly prompt users for permission instead of tools hanging indefinitely.

## Current Limitations

### Not Yet Implemented

1. **Session Modes** - No mode switching support yet
2. **Authentication** - No actual auth implementation
3. **Terminal Support** - Placeholder only
4. **Session Persistence** - `session/load` doesn't restore actual conversation history

### Implemented Features

- **Real-time Streaming**: Implemented `session/update` notifications for progressive responses and text chunks
- **Tool Call Visibility**: Reports tool executions as they happen with status updates
- **Permission Handling**: Integrated with opencode's permission system, requests permissions via ACP client's `requestPermission` when tools require approval

### Future Enhancements

- **Session Persistence**: Save and restore full conversation history
- **Mode Support**: Implement different operational modes (ask, code, etc.)
- **Enhanced Permissions**: More sophisticated permission handling with granular controls
- **Terminal Integration**: Full terminal support via opencode's bash tool

## Testing

```bash
# Run ACP tests
bun test test/acp.test.ts

# Test manually with stdio
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}' | opencode acp
```

## Design Decisions

### Why the Official Library?

We use `@agentclientprotocol/sdk` instead of implementing JSON-RPC ourselves because:

- Ensures protocol compliance
- Handles edge cases and future protocol versions
- Reduces maintenance burden
- Works with other ACP clients automatically

### Clean Architecture

Each component has a single responsibility:

- **Agent** = Protocol interface
- **Client** = Client-side operations
- **Session** = State management
- **Server** = Lifecycle and I/O

This makes the codebase maintainable and testable.

### Mapping to OpenCode

ACP sessions map cleanly to opencode's internal session model:

- ACP `session/new` → creates internal Session
- ACP `session/prompt` → uses SessionPrompt.prompt()
- Working directory context preserved per-session
- Tool execution uses existing ToolRegistry

## References

- [ACP Specification](https://agentclientprotocol.com/)
- [TypeScript Library](https://github.com/agentclientprotocol/typescript-sdk)
- [Protocol Examples](https://github.com/agentclientprotocol/typescript-sdk/tree/main/src/examples)
