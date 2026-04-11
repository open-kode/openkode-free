/**
 * Agent Handoff Module
 * 
 * Route tasks to external CLI agents:
 * - Cursor (cursor.com)
 * - GitHub Copilot (gh copilot)
 * - OpenAI Codex (codex)
 * - Aider (aider.chat)
 * - Custom CLI tools
 */

export {
  AgentRouter,
  BuiltInAgents,
  createAgentRouter,
  type AgentType,
  type AgentConfig,
  type AgentCapabilities,
  type HandoffRequest,
  type HandoffResult
} from './agentRouter';
