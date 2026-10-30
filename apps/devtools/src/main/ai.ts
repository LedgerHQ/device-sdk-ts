import { ipcMain, type WebContents } from 'electron'
import { existsSync } from 'fs'
import { basename, join, relative, resolve } from 'path'
import type { HookCallback, Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AiEvent, AiRequest, AiStatus } from '@ledgerhq/device-management-kit-devtools-ui'

const MODEL = 'claude-opus-5-5'
const MODEL_NAME = 'Claude Opus 5.5'
const SKILLS = ['explain-device-exchange', 'apdu-commands', 'status-words', 'dmk-flows']

// The skills the DevTools gives Claude; a packaged app unpacks resources/ beside its archive
const PLUGIN_DIR = join(__dirname, '../../resources/ai').replace('app.asar', 'app.asar.unpacked')

// DMK's source is only there when the DevTools runs from the repository
const REPO_ROOT = resolve(__dirname, '../../../..')
const CAN_READ_CODE = existsSync(join(REPO_ROOT, 'packages/device-management-kit'))

const SYSTEM_PROMPT = `You explain Ledger device exchanges to developers using the Ledger DMK DevTools.
Always follow the explain-device-exchange skill, and use the other skills it names.
Write the answer once, after any tool use, with nothing before its first section.`

// The SDK only ships as an ES module, which this CommonJS bundle loads on demand
const loadSdk = (): Promise<typeof import('@anthropic-ai/claude-agent-sdk')> =>
  import('@anthropic-ai/claude-agent-sdk')

const STATUS_TTL_MS = 30_000
let cachedStatus: { at: number; status: Promise<AiStatus> } | null = null

// Checking starts a Claude Code process, so the panel reuses a recent answer
const getCachedStatus = (refresh: boolean): Promise<AiStatus> => {
  if (refresh || !cachedStatus || Date.now() - cachedStatus.at > STATUS_TTL_MS) {
    cachedStatus = { at: Date.now(), status: getStatus() }
  }
  return cachedStatus.status
}

const getStatus = async (): Promise<AiStatus> => {
  const { query } = await loadSdk()
  const probe = query({
    prompt: '',
    options: { settingSources: [], tools: [], maxTurns: 0, persistSession: false }
  })
  try {
    const account = await probe.accountInfo()
    const signedIn = [account.email, account.tokenSource, account.apiKeySource].some(
      (source) => source !== undefined && source !== 'none'
    )
    return signedIn
      ? {
          ready: true,
          account: account.email,
          model: MODEL_NAME,
          skills: SKILLS,
          canReadCode: CAN_READ_CODE
        }
      : { ready: false, error: 'Claude Code is not signed in.' }
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    probe.close()
  }
}

const describeTool = (name: string, input: Record<string, unknown>): string => {
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

const promptFor = (request: AiRequest): string => {
  if (request.kind === 'followUp') return request.question
  const scope = request.readCode
    ? `You may read DMK's source code under ${REPO_ROOT} to confirm the cause; name the file and function when you do.`
    : 'Answer from the skills and the selection only; do not read source code.'
  return `Explain this selection from the DevTools (${request.summary}).\n${scope}\n\n<selection>\n${request.context}\n</selection>`
}

const analyze = async (
  request: AiRequest,
  abortController: AbortController,
  emit: (event: AiEvent) => void
): Promise<void> => {
  const { query } = await loadSdk()
  const readCode = request.readCode && CAN_READ_CODE
  const cwd = readCode ? REPO_ROOT : PLUGIN_DIR
  const options: Options = {
    abortController,
    model: MODEL,
    systemPrompt: SYSTEM_PROMPT,
    cwd,
    // Only the DevTools' own skills, not the user's or a project's Claude Code settings
    settingSources: [],
    plugins: [{ type: 'local', path: PLUGIN_DIR }],
    skills: 'all',
    tools: ['Read', 'Grep', 'Glob'],
    allowedTools: ['Read', 'Grep', 'Glob'],
    hooks: {
      PreToolUse: [{ matcher: 'Read|Grep|Glob', hooks: [stayInside([cwd, PLUGIN_DIR])] }]
    },
    permissionMode: 'dontAsk',
    maxTurns: readCode ? 20 : 8,
    includePartialMessages: true,
    resume: request.kind === 'followUp' ? request.sessionId : undefined
  }

  for await (const message of query({
    prompt: promptFor(request),
    options
  }) as AsyncIterable<SDKMessage>) {
    if (message.type === 'stream_event') {
      const { event } = message
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        emit({ type: 'text', text: event.delta.text })
      }
    } else if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'tool_use') {
          emit({
            type: 'step',
            text: describeTool(block.name, block.input as Record<string, unknown>)
          })
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success' && !message.is_error) {
        emit({ type: 'done', sessionId: message.session_id, answer: message.result })
      } else {
        const reason = message.subtype === 'success' ? message.result : message.errors.join('\n')
        emit({ type: 'error', message: reason || message.subtype })
      }
    }
  }
}

const send = (contents: WebContents, id: string, event: AiEvent): void => {
  if (!contents.isDestroyed()) contents.send('ai:event', id, event)
}

export const setupAi = (): void => {
  const running = new Map<string, AbortController>()

  ipcMain.handle('ai:status', (_event, refresh: boolean) => getCachedStatus(refresh))

  ipcMain.on('ai:analyze', (event, id: string, request: AiRequest) => {
    const abortController = new AbortController()
    running.set(id, abortController)
    const abort = (): void => abortController.abort()
    event.sender.once('destroyed', abort)
    analyze(request, abortController, (aiEvent) => send(event.sender, id, aiEvent))
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          send(event.sender, id, {
            type: 'error',
            message: error instanceof Error ? error.message : String(error)
          })
        }
      })
      .finally(() => {
        running.delete(id)
        if (!event.sender.isDestroyed()) event.sender.removeListener('destroyed', abort)
      })
  })

  ipcMain.on('ai:stop', (_event, id: string) => running.get(id)?.abort())
}
