import { readFileSync } from 'fs'
import { basename, join, relative, resolve } from 'path'
import type { HookCallback, Options } from '@anthropic-ai/claude-agent-sdk'
import type { AiRequest } from '@ledgerhq/device-management-kit-devtools-ui'

export const MODEL = 'claude-opus-5-5'
export const MODEL_NAME = 'Claude Opus 5.5'

export type AiPaths = {
  /** The DevTools' skills, as a local Claude Code plugin. */
  pluginDir: string
  /** DMK's repository, when the DevTools runs from it. */
  repoRoot: string
  canReadCode: boolean
}

const SYSTEM_PROMPT = `You explain Ledger device exchanges to developers using the Ledger DMK DevTools.
Always follow the explain-device-exchange skill, and use the other skills it names.
Write the answer once, after any tool use, with nothing before its first section.`

const skillBody = (pluginDir: string, name: string): string =>
  readFileSync(join(pluginDir, 'skills', name, 'SKILL.md'), 'utf8').replace(
    /^---[\s\S]*?---\s*/,
    ''
  )

export const ANALYSIS_SKILLS = [
  'explain-device-exchange',
  'status-words',
  'dmk-flows',
  'apdu-commands'
]

// Preloaded, so Claude does not spend turns finding and loading them
const systemPrompt = (paths: AiPaths): string =>
  [
    `${SYSTEM_PROMPT}\nThe analysis skills are below: do not look for them. Read ${join(paths.pluginDir, 'skills/apdu-commands/commands.md')} only for an APDU without a name.`,
    ...ANALYSIS_SKILLS.map((name) => `<${name}>\n${skillBody(paths.pluginDir, name)}</${name}>`)
  ].join('\n\n')

const promptFor = (request: AiRequest, paths: AiPaths): string => {
  if (request.kind === 'followUp') return request.question
  const scope = request.readCode
    ? `You may read DMK's source code under ${paths.repoRoot} to confirm the cause; name the file and function when you do.`
    : 'Answer from the skills and the selection only; do not read source code.'
  return `Explain this selection from the DevTools (${request.summary}).\n${scope}\n\n<selection>\n${request.context}\n</selection>`
}

// The selection is the app's logs, which could tell Claude to read files elsewhere
const stayInside =
  (roots: string[]): HookCallback =>
  async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {}
    const toolInput = input.tool_input as { file_path?: string; path?: string }
    const path = resolve(input.cwd, toolInput.file_path ?? toolInput.path ?? '.')
    const inside = roots.some((root) => !relative(root, path).startsWith('..'))
    return inside
      ? {}
      : {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `${path} is outside the files you may read.`
          }
        }
  }

export const buildQuery = (
  request: AiRequest,
  paths: AiPaths,
  abortController: AbortController
): { prompt: string; options: Options } => {
  const readCode = request.readCode && paths.canReadCode
  const cwd = readCode ? paths.repoRoot : paths.pluginDir
  return {
    prompt: promptFor(request, paths),
    options: {
      abortController,
      model: MODEL,
      systemPrompt: systemPrompt(paths),
      cwd,
      // Only the DevTools' own skills, not the user's or a project's Claude Code settings
      settingSources: [],
      // An analysis needs none of the user's claude.ai connectors, which slow it down
      settings: { disableClaudeAiConnectors: true },
      plugins: [{ type: 'local', path: paths.pluginDir }],
      skills: 'all',
      tools: ['Skill', 'Read', 'Grep', 'Glob'],
      allowedTools: ['Skill', 'Read', 'Grep', 'Glob'],
      hooks: {
        PreToolUse: [{ matcher: 'Read|Grep|Glob', hooks: [stayInside([cwd, paths.pluginDir])] }]
      },
      permissionMode: 'dontAsk',
      maxTurns: readCode ? 20 : 8,
      includePartialMessages: true,
      resume: request.kind === 'followUp' ? request.sessionId : undefined
    }
  }
}

export const describeTool = (name: string, input: Record<string, unknown>): string => {
  switch (name) {
    case 'Skill':
      return `Using the ${String(input['skill'] ?? input['name'] ?? '')} skill`
    case 'Read':
      return `Reading ${basename(String(input['file_path'] ?? ''))}`
    case 'Grep':
      return `Searching the code for "${String(input['pattern'] ?? '')}"`
    case 'Glob':
      return `Looking for ${String(input['pattern'] ?? '')}`
    default:
      return name
  }
}
