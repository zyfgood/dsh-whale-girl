/**
 * dsh-whale-girl host half.
 *
 * 鲸鱼女孩桌宠的宿主侧：把持久会话事件折叠成一个小状态机
 * （working / thinking / tool / approval / done / fail / idle），维护养成
 * 数据（经验、等级、好感度、互动计数），把一切经 `GET /whale-girl/state`
 * 快照给浏览器半（轮询），并接受 `POST /whale-girl/act` 交互。注册
 * `whale_say` 工具，让 Agent 能借她说一句话或做一个动作。
 *
 * 状态持久化在 `~/.dsh/whale-girl/state.json`（写回合并去抖）；只读会话
 * 事件，不改会话与工作区文件。
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Plugin identity for cordis.yml rows. */
export const name = '@zyfgood/dsh-whale-girl'

/** Services required before mounting: routes, request admission, tool registry. */
export const inject = ['webServer', 'connection', 'tools']

export const Config = Schema.intersect([
  Schema.object({
    visible: Schema.boolean().default(true).description('启动时显示桌宠'),
    size: Schema.number().min(80).max(320).default(160).description('桌宠尺寸（像素）'),
    bubbleScale: Schema.number().min(0.4).max(1.5).default(1).description('气泡缩放'),
    speechEnabled: Schema.boolean().default(true).description('允许她说话（台词气泡）'),
    soundsEnabled: Schema.boolean().default(true).description('合成音效（点击吱吱声等）'),
    petSayTool: Schema.boolean().default(true).description('向 Agent 提供 whale_say 工具'),
    idleNagMinutes: Schema.number().min(1).max(120).default(5).description('闲置几分钟后主动讨活'),
    sleepAfterMinutes: Schema.number().min(1).max(240).default(10).description('闲置几分钟后睡着'),
  }).description('鲸鱼女孩设置'),
])

/** Level titles unlocked as XP grows. */
const TITLES = ['初来乍到', '眼熟了', '小伙伴', '好朋友', '挚友', '家人']
/** Cumulative XP needed for a level: level = floor(sqrt(xp/20))+1. */
const xpToLevel = (xp) => Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1)
const titleOf = (level) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 4))]
const xpForLevel = (level) => Math.ceil((level - 1) ** 2 * 20)

/** How long a done/fail celebration mood lasts before falling back to idle. */
const CELEBRATION_MS = 6000
/** How long one whale_say bubble stays in the queue. */
const SAY_TTL_MS = 12000
/** Max say entries kept at once (whale_say bursts included). */
const SAY_MAX = 8
/** 摸摸冷却：更快的连点不再加好感（也不惩罚）。 */
const PET_COOLDOWN_MS = 8000

const stateDir = () => join(homedir(), '.dsh', 'whale-girl')
const statePath = () => join(stateDir(), 'state.json')

const DEFAULT_PERSISTED = {
  stats: {
    turns: 0, okTurns: 0, tools: 0, xp: 0,
    affinity: 0, pokes: 0, pets: 0, feeds: 0, petRejects: 0,
    firstSeenAt: 0, lastPetAt: 0, lastFeedAt: 0,
  },
  display: { visible: true, muted: false, right: 24, bottom: 16 },
}

/**
 * The pet: live mood machine + persisted stats/display, with debounced
 * write-behind persistence. One instance per host activation.
 */
class WhaleGirl {
  constructor(config) {
    this.config = config
    this.persisted = structuredClone(DEFAULT_PERSISTED)
    // Live turn tracking (never persisted — a restart forgets the in-flight turn).
    this.mood = { kind: 'idle', since: Date.now(), until: 0 }
    this.currentTool = undefined
    this.turnStartAt = 0
    this.turnTools = 0
    this.lastTurn = undefined
    this.lastActivityAt = Date.now()
    this.say = []
    this.dirty = false
    this.saveTimer = undefined
  }

  /** Load persisted state (missing/corrupt file falls back to defaults). */
  async load() {
    try {
      const raw = await readFile(statePath(), 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object') {
        const p = this.persisted
        if (parsed.stats !== null && typeof parsed.stats === 'object') Object.assign(p.stats, parsed.stats)
        if (parsed.display !== null && typeof parsed.display === 'object') Object.assign(p.display, parsed.display)
        if (!p.stats.firstSeenAt) { p.stats.firstSeenAt = Date.now(); this.markDirty() }
      }
    } catch { /* first run: defaults */ }
    if (this.config.visible === false) this.persisted.display.visible = false
  }

  markDirty() {
    this.dirty = true
    if (this.saveTimer !== undefined) return
    this.saveTimer = setTimeout(() => { this.saveTimer = undefined; void this.saveNow() }, 1500)
  }

  async saveNow() {
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    if (!this.dirty) return
    this.dirty = false
    try {
      const dir = stateDir()
      await mkdir(dir, { recursive: true })
      const tmp = join(dir, `.state-${process.pid}.tmp`)
      await writeFile(tmp, JSON.stringify(this.persisted, null, 2) + '\n', 'utf8')
      await rename(tmp, statePath())
    } catch (error) {
      this.dirty = true // retry on the next change
      console.warn('[dsh-whale-girl] state save failed:', error?.message ?? error)
    }
  }

  /** The mood right now, applying done/fail expiry. */
  effectiveMood(now = Date.now()) {
    const { kind } = this.mood
    if ((kind === 'done' || kind === 'fail') && now > this.mood.until) return 'idle'
    return kind
  }

  setMood(kind, until = 0) {
    if (this.mood.kind === kind) {
      if (until) this.mood.until = until
      return
    }
    this.mood = { kind, since: Date.now(), until }
  }

  /** One whale_say / celebration bubble. */
  enqueueSay(text, action = 'idle') {
    if (!this.config.speechEnabled) return
    this.say.push({ id: randomUUID(), text: String(text).slice(0, 240), action, at: Date.now() })
    if (this.say.length > SAY_MAX) this.say.splice(0, this.say.length - SAY_MAX)
  }

  pruneSay(now = Date.now()) {
    this.say = this.say.filter((entry) => now - entry.at < SAY_TTL_MS)
  }

  /** A durable session event folded into the mood machine. */
  onSessionEvent(event) {
    const type = event?.type
    if (typeof type !== 'string') return
    this.lastActivityAt = Date.now()
    const data = (event !== null && typeof event === 'object' && event.data !== null && typeof event.data === 'object') ? event.data : {}
    switch (type) {
      case 'turn/start': {
        this.setMood('working')
        this.turnStartAt = Date.now()
        this.turnTools = 0
        this.currentTool = undefined
        break
      }
      case 'assistant/message':
      case 'assistant/attempt': {
        const now = this.effectiveMood()
        if (now === 'working' || now === 'thinking') this.setMood('thinking')
        break
      }
      case 'tool/call': {
        if (this.effectiveMood() === 'idle') this.setMood('working')
        this.currentTool = typeof data.name === 'string' && data.name !== '' ? data.name
          : typeof data.toolName === 'string' ? data.toolName : 'tool'
        this.turnTools += 1
        this.persisted.stats.tools += 1
        this.setMood('tool')
        this.markDirty()
        break
      }
      case 'tool/result': {
        if (this.effectiveMood() === 'tool') { this.setMood('working'); this.currentTool = undefined }
        break
      }
      case 'approval/asked': {
        this.setMood('approval')
        break
      }
      case 'approval/decided': {
        if (this.effectiveMood() === 'approval') this.setMood('working')
        break
      }
      case 'turn/end': {
        const durationMs = this.turnStartAt > 0 ? Math.max(0, Date.now() - this.turnStartAt) : 0
        const raw = (() => { try { return JSON.stringify(data) } catch { return '' } })()
        const ok = !/(?:error|abort|cancel|interrupt|fail)/i.test(raw)
        this.lastTurn = { durationMs, tools: this.turnTools, ok }
        this.setMood(ok ? 'done' : 'fail', Date.now() + CELEBRATION_MS)
        this.currentTool = undefined
        this.turnStartAt = 0
        const stats = this.persisted.stats
        stats.turns += 1
        if (ok) {
          stats.okTurns += 1
          stats.xp += 8
          stats.affinity += 1
          const seconds = Math.round(durationMs / 1000)
          this.enqueueSay(ok
            ? `搞定！这一轮 ${seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`}，跑了 ${this.turnTools} 个工具 🎉`
            : '呜……这轮好像搞砸了，我下沉一会儿 😢', ok ? 'happy' : 'sad')
        } else {
          stats.xp += 2
        }
        this.markDirty()
        break
      }
      default:
        break
    }
  }

  /** One browser interaction. Returns extra info for the caller to log. */
  act(kind, payload = {}) {
    const stats = this.persisted.stats
    const now = Date.now()
    switch (kind) {
      case 'poke': {
        stats.pokes += 1
        stats.xp += 1
        this.markDirty()
        return { ok: true }
      }
      case 'pet': {
        stats.pets += 1
        if (now - stats.lastPetAt < PET_COOLDOWN_MS) {
          stats.petRejects += 1
          this.markDirty()
          return { ok: true, rejected: true }
        }
        stats.lastPetAt = now
        stats.affinity += 2
        stats.xp += 2
        this.markDirty()
        return { ok: true }
      }
      case 'feed': {
        stats.feeds += 1
        stats.lastFeedAt = now
        stats.affinity += 3
        stats.xp += 3
        this.enqueueSay('好吃！还想再吃一只 🍤', 'happy')
        this.markDirty()
        return { ok: true }
      }
      case 'move': {
        const display = this.persisted.display
        if (Number.isFinite(payload.right)) display.right = Math.min(2000, Math.max(-2000, Math.round(payload.right)))
        if (Number.isFinite(payload.bottom)) display.bottom = Math.min(2000, Math.max(-2000, Math.round(payload.bottom)))
        this.markDirty()
        return { ok: true }
      }
      case 'hide': {
        this.persisted.display.visible = false
        this.markDirty()
        return { ok: true }
      }
      case 'show': {
        this.persisted.display.visible = true
        this.markDirty()
        return { ok: true }
      }
      case 'mute': {
        this.persisted.display.muted = payload.value === true
        this.markDirty()
        return { ok: true }
      }
      case 'reset': {
        this.persisted.display.right = DEFAULT_PERSISTED.display.right
        this.persisted.display.bottom = DEFAULT_PERSISTED.display.bottom
        this.markDirty()
        return { ok: true }
      }
      default:
        return { ok: false, error: `unknown act "${String(kind)}"` }
    }
  }

  /** The full snapshot the browser half renders. */
  snapshot() {
    const now = Date.now()
    this.pruneSay(now)
    const stats = this.persisted.stats
    const level = xpToLevel(stats.xp)
    return {
      ok: true,
      now,
      pet: {
        mood: this.effectiveMood(now),
        currentTool: this.currentTool ?? null,
        turnStartAt: this.turnStartAt > 0 ? this.turnStartAt : null,
        turnTools: this.turnTools,
        lastTurn: this.lastTurn ?? null,
        lastActivityAt: this.lastActivityAt,
        say: this.say.slice(-3),
      },
      stats: { ...stats },
      display: { ...this.persisted.display },
      growth: {
        level,
        title: titleOf(level),
        xp: stats.xp,
        nextLevelXp: xpForLevel(level + 1),
        thisLevelXp: xpForLevel(level),
        hearts: Math.min(5, Math.floor(stats.affinity / 60)),
      },
      config: {
        size: this.config.size,
        bubbleScale: this.config.bubbleScale,
        speechEnabled: this.config.speechEnabled,
        soundsEnabled: this.config.soundsEnabled,
        idleNagMinutes: this.config.idleNagMinutes,
        sleepAfterMinutes: this.config.sleepAfterMinutes,
      },
    }
  }
}

/** Read one JSON POST body with a hard cap. */
async function readJsonBody(req, capBytes = 32 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > capBytes) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Plugin body: mount the fenced /whale-girl routes and the whale_say tool.
 * @param ctx - host plugin context (webServer, connection, tools).
 * @param config - resolved plugin config.
 */
export function apply(ctx, config) {
  const pet = new WhaleGirl(config)
  void pet.load()

  // ── Session feeds ────────────────────────────────────────────────────────
  ctx.effect(() => {
    const off = ctx.on('session/event', (_session, event) => { pet.onSessionEvent(event) })
    return () => { off() }
  }, 'dsh-whale-girl: session feed')
  ctx.effect(() => () => { void pet.saveNow() }, 'dsh-whale-girl: save on dispose')

  // ── Fenced HTTP routes ───────────────────────────────────────────────────
  const fence = (req) => {
    try {
      return ctx.connection.requestRejection(req) === undefined
    } catch {
      return false
    }
  }
  const send = (res, code, body) => {
    res.statusCode = code
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/whale-girl',
    handler: async (req, res) => {
      if (!fence(req)) { send(res, 403, { ok: false, error: 'forbidden' }); return }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const rest = pathname.replace(/^\/whale-girl/, '')
      if ((req.method === 'GET' || req.method === 'HEAD') && (rest === '' || rest === '/' || rest === '/state')) {
        send(res, 200, pet.snapshot())
        return
      }
      if (req.method === 'POST' && rest === '/act') {
        try {
          const body = await readJsonBody(req)
          const result = pet.act(typeof body.kind === 'string' ? body.kind : '', body)
          send(res, result.ok ? 200 : 400, { ...result, state: pet.snapshot() })
        } catch (error) {
          send(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
        return
      }
      send(res, 404, { ok: false, error: 'not found' })
    },
  }), 'dsh-whale-girl: /whale-girl routes')

  // ── whale_say: the Agent's channel into the pet ─────────────────────────
  if (config.petSayTool !== false) {
    ctx.effect(() => ctx.tools.register(defineTool({
      name: 'whale_say',
      description:
        '让桌面角落的鲸鱼女孩桌宠说一句话（或附一个动作），作为给用户的轻量可见通知通道。'
        + '适合：任务阶段性进展播报、温馨提醒、小型庆祝。文本请简短（建议 ≤ 60 字），用用户的主要语言。'
        + '若用户关闭了桌宠（visible=false），内容不会被看到，工具结果会如实说明。',
      parameters: {
        text: {
          type: 'string',
          required: true,
          description: '她要说的话（简短）。',
        },
        action: {
          type: 'string',
          description: '可选动作：happy（开心跳一下）| sad（难过下沉）| surprise（惊讶）| sleep（打瞌睡）。缺省为普通说话。',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            spoken: { type: 'boolean', required: true, description: '话是否进入了展示队列（false = 用户关了台词）。' },
            visible: { type: 'boolean', required: true, description: '桌宠当前是否显示。' },
            text: { type: 'string', required: true, description: '实际入队的话。' },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: (value.spoken && value.visible)
            ? `鲸鱼女孩说："${value.text}"（用户可见）`
            : `台词已入队但当前用户${value.visible ? '关闭了台词气泡' : '隐藏了桌宠'}，大概率看不到。`,
        }],
      },
      execute: async (args, exec) => {
        exec.signal.throwIfAborted()
        const text = String(args.text ?? '').trim()
        if (text === '') throw new Error('whale_say: text must not be empty')
        const action = ['happy', 'sad', 'surprise', 'sleep'].includes(args.action) ? args.action : 'idle'
        pet.enqueueSay(text, action)
        pet.lastActivityAt = Date.now()
        return { spoken: config.speechEnabled, visible: pet.persisted.display.visible, text }
      },
    })), 'dsh-whale-girl: whale_say tool')
  }
}
