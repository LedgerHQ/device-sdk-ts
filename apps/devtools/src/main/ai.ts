import { ipcMain, type WebContents } from 'electron'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AiEvent, AiRequest, AiStatus } from '@ledgerhq/device-management-kit-devtools-ui'

import { type AiPaths, ANALYSIS_SKILLS, buildQuery, describeTool, MODEL_NAME } from './aiOptions'

// The skills the DevTools gives Claude; a packaged app unpacks resources/ beside its archive
const PLUGIN_DIR = join(__dirname, '../../resources/ai').replace('app.asar', 'app.asar.unpacked')

// DMK's source is only there when the DevTools runs from the repository
const REPO_ROOT = resolve(__dirname, '../../../..')
const PATHS: AiPaths = {
  pluginDir: PLUGIN_DIR,
  repoRoot: REPO_ROOT,
  canReadCode: existsSync(join(REPO_ROOT, 'packages/device-management-kit'))
}

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
          skills: ANALYSIS_SKILLS,
          canReadCode: PATHS.canReadCode
        }
      : { ready: false, error: 'Claude Code is not signed in.' }
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    probe.close()
  }
}

const analyze = async (
  request: AiRequest,
  abortController: AbortController,
  emit: (event: AiEvent) => void
): Promise<void> => {
  const { query } = await loadSdk()
  const { prompt, options } = buildQuery(request, PATHS, abortController)

  for await (const message of query({ prompt, options }) as AsyncIterable<SDKMessage>) {
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
