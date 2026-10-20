# dsh-whale-girl 🐳 鲸鱼女孩

> npm 包名：`dsh-whale-girl`（配置里插件行的 `name:` 也必须写这个名字）。

DeepSeek Harness（DSH）插件：**鲸鱼女孩桌宠**。她住在 Web GUI 右下角，
实时反映 Agent 的工作状态，也能陪你玩。纯程序化 SVG + CSS 动画，
**零素材、零运行时依赖**，只读会话事件，不改会话与工作区文件。

## 她会做什么

| Agent 在干嘛 | 鲸鱼女孩在干嘛 |
|---|---|
| 任务运行中 | 游泳 🏊 |
| 模型输出中 | 陪它思考，头顶泡泡 💭 |
| 调用工具 | 吐一个带友好标签的泡泡（敲命令 / 读文件 / 改文件 / …）🔧 |
| **请求批准** | **贴着屏幕敲玻璃 + 琥珀色脉冲 + 提醒气泡** 🔔 |
| 任务完成 | 跳起来庆祝 + 开口汇报："搞定！这一轮 X 分 Y 秒，跑了 N 个工具" 🎉 |
| 任务失败 | 下沉，眼睛变 > < 😢 |
| 闲置超时 | 主动讨活："我闲着呢，有活吗？" |
| 闲置更久 / 本地 00:00–06:00 | 戴睡帽睡觉 💤（睡觉时仍有呼吸动画） |

## 互动与成长

- **单击**：戳戳（随机台词 + 吱吱声，经验 +1）
- **双击**：摸摸（好感 +2，浮出爱心；8 秒冷却，太频繁会被她嫌弃）
- **拖拽**：移动位置，自动记住（按右/下边距锚定）
- **右键菜单**：喂食 🍤 / 静音 / 回默认位置 / 隐藏（隐藏后右下角小 🐳 恢复）
- **悬停**：成长卡片——等级、称号、经验条、好感 ❤、本轮/上轮统计

成长规则（**零负反馈**：永不扣分、永不惩罚）：

- 每完成一轮 +8 经验（失败也 +2）、好感 +1；互动另有加成
- 等级 = `floor(sqrt(xp / 20)) + 1`；称号从「初来乍到」到「家人」共 6 档
- 好感每 60 点亮一颗 ❤（最多 5 颗）
- 全部数据持久化在 `~/.dsh/whale-girl/state.json`

## whale_say 工具

插件向 Agent 注册 **`whale_say`** 工具（配置可关）：让鲸鱼女孩说一句话
（或附 `happy` / `sad` / `surprise` / `sleep` 动作），作为给用户的轻量可见
通知通道——适合任务阶段性进展播报、温馨提醒、小型庆祝。文本建议 ≤ 60 字，
用用户的主要语言。若用户隐藏了桌宠或关了台词，工具结果会如实告知。

## 配置（设置 → 插件 → whale-girl，或 profile patch）

| 字段 | 默认 | 说明 |
|---|---|---|
| `visible` | `true` | 启动时显示 |
| `size` | `160` | 尺寸（80–320 px） |
| `bubbleScale` | `1` | 气泡缩放（0.4–1.5） |
| `speechEnabled` | `true` | 台词气泡 |
| `soundsEnabled` | `true` | 合成音效（WebAudio 实时合成，零音频文件） |
| `petSayTool` | `true` | 向 Agent 提供 `whale_say` 工具 |
| `idleNagMinutes` | `5` | 闲置几分钟后主动讨活 |
| `sleepAfterMinutes` | `10` | 闲置几分钟后睡着 |

## Install / 安装

```bash
# Git 渠道（仓库根目录即插件）
dsh plugin --profile web add "github:zyfgood/dsh-whale-girl#main&path:/"
# 桌面版用 desktop profile：
dsh plugin --profile desktop add "github:zyfgood/dsh-whale-girl#main&path:/"

# 本地开发（junction 链接，改 lib/client.js 保存即热更）
dsh plugin --profile desktop add /path/to/dsh-whale-girl
```

安装后打开（或刷新）DSH Web GUI 即可，无需重启 Host。卸载：
`dsh plugin --profile desktop remove dsh-whale-girl`。

---

## English Summary

**dsh-whale-girl** is a desktop pet for the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI:
a little whale girl living in the corner of the window who reflects your
agent's state in real time — swimming while tasks run, blowing labeled
bubbles on tool calls, **tapping the glass when an approval is waiting**,
backflipping with a duration/tool-count report on success, sinking with
`> <` eyes on failure, and wearing a nightcap after dark or when idle.

- **Hand-written SVG + CSS animation** — zero assets, zero runtime dependencies.
- **Interactions**: click to poke, double-click to pet (affinity hearts),
  drag to reposition (remembered), right-click menu (feed / mute / reset /
  hide), hover card with level, title, XP bar and per-turn stats.
- **Growth**: XP and affinity from completed turns and interactions,
  6 titles from 初来乍到 to 家人; strictly positive — never penalizes.
- **`whale_say` tool**: the agent can make her speak or perform an action
  (`happy` / `sad` / `surprise` / `sleep`) as a lightweight visible
  notification channel.
- **State machine** maps durable session events (`turn/start`, `tool/call`,
  `approval/asked`, `turn/end`, …) to moods; stats persist to
  `~/.dsh/whale-girl/state.json`.
- Read-only with respect to sessions and workspace files.

```bash
dsh plugin --profile web add "github:zyfgood/dsh-whale-girl#main&path:/"
```

## 结构

```
lib/index.js    宿主半：session/event → 状态机；/whale-girl/state|act 路由；
                whale_say 工具注册；状态持久化（写回合并去抖）
lib/client.js   浏览器半：shell.overlay 槽位挂载；SVG 鲸鱼女孩 + CSS 动画；
                600ms 轮询快照 + 交互上报；WebAudio 合成音效
cordis.patch.yml         官方安装自动挂载的 bundle patch
cordis.patch.example.yml 手工挂载示例（不需要时忽略）
```

## License

MIT.
