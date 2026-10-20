/**
 * @zyfgood/dsh-whale-girl client half (browser bundle).
 *
 * 挂载到 shell.overlay 槽位：渲染角落里的鲸鱼女孩（纯 SVG + CSS 动画），
 * 轮询宿主 GET /whale-girl/state 驱动状态机动画，POST /whale-girl/act 上报
 * 交互（戳戳/摸摸/喂食/移动/隐藏/静音）。好感度与成长数据都在宿主侧持久化。
 */
window.__ModuleLoader__.load({
	id: "@zyfgood/dsh-whale-girl",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { useState, useEffect, useRef, useCallback } = React;
		const h = React.createElement;

		/** Client-side service needs: the overlay slot registry. */
		const inject = ["slots"];

		/* ── styles (injected once per page) ─────────────────────────────── */

		const CSS = `
.wg-root{position:fixed;z-index:2147482000;user-select:none;-webkit-user-select:none;contain:layout style;}
.wg-stage{position:relative;width:var(--wg-size);height:calc(var(--wg-size) * 0.78);cursor:grab;touch-action:none;}
.wg-stage.wg-dragging{cursor:grabbing;}
.wg-whale{width:100%;height:100%;animation:wg-float 3.8s ease-in-out infinite;transform-origin:50% 80%;filter:drop-shadow(0 10px 14px rgba(30,60,120,.25));}
.wg-root.wg-working .wg-whale{animation:wg-swim 1.7s ease-in-out infinite;}
.wg-root.wg-thinking .wg-whale{animation:wg-float 3s ease-in-out infinite;}
.wg-root.wg-tool .wg-whale{animation:wg-swim 2.4s ease-in-out infinite;}
.wg-root.wg-approval .wg-whale{animation:wg-shake .22s linear infinite;filter:drop-shadow(0 0 10px rgba(245,180,60,.85)) drop-shadow(0 10px 14px rgba(30,60,120,.25));}
.wg-root.wg-done .wg-whale{animation:wg-jump 1.1s cubic-bezier(.3,.7,.4,1) infinite;filter:drop-shadow(0 0 8px rgba(120,200,140,.6));}
.wg-root.wg-fail .wg-whale{animation:wg-droop 2.6s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgba(60,60,90,.4));}
.wg-root.wg-sleep .wg-whale{animation:wg-breath 5s ease-in-out infinite;}
.wg-tail{transform-origin:186px 70px;animation:wg-tail 3.8s ease-in-out infinite;}
.wg-root.wg-working .wg-tail,.wg-root.wg-tool .wg-tail{animation-duration:1.1s;}
.wg-eye{transform-origin:center;animation:wg-blink 4.6s infinite;}
.wg-flipper{transform-origin:120px 108px;animation:wg-flipper 3.8s ease-in-out infinite;}
.wg-spout{opacity:0;}
.wg-root.wg-done .wg-spout,.wg-root.wg-flash-happy .wg-spout{opacity:1;}
.wg-spout .wg-drop{animation:wg-drop 1.1s ease-out infinite;}
.wg-spout .wg-drop:nth-child(2){animation-delay:.25s;}
.wg-spout .wg-drop:nth-child(3){animation-delay:.5s;}
.wg-z{opacity:0;}
.wg-root.wg-sleep .wg-z{opacity:1;}
.wg-z text{animation:wg-z-rise 2.6s ease-in-out infinite;}
.wg-z text:nth-child(2){animation-delay:.9s;}
.wg-z text:nth-child(3){animation-delay:1.8s;}
.wg-cap{display:none;}
.wg-root.wg-night .wg-cap,.wg-root.wg-sleep .wg-cap{display:block;}
.wg-ring{position:absolute;inset:-14%;border-radius:50%;pointer-events:none;opacity:0;}
.wg-root.wg-approval .wg-ring{opacity:1;animation:wg-ring 1.1s ease-out infinite;border:3px solid rgba(245,180,60,.75);}
.wg-deadeyes,.wg-frown{display:none;}
.wg-root.wg-fail .wg-eyes{display:none;}
.wg-root.wg-fail .wg-deadeyes{display:block;}
.wg-root.wg-fail .wg-smile{display:none;}
.wg-root.wg-fail .wg-frown{display:block;}
@keyframes wg-float{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-7px) rotate(-2deg);}}
@keyframes wg-swim{0%,100%{transform:translateY(0) rotate(-3deg);}50%{transform:translateY(-9px) rotate(3deg);}}
@keyframes wg-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-4px);}75%{transform:translateX(4px);}}
@keyframes wg-jump{0%,100%{transform:translateY(0) scale(1);}35%{transform:translateY(-24px) scale(1.05) rotate(-4deg);}70%{transform:translateY(0) scale(.98);}}
@keyframes wg-droop{0%,100%{transform:translateY(10px) rotate(5deg);}50%{transform:translateY(14px) rotate(7deg);}}
@keyframes wg-breath{0%,100%{transform:translateY(6px) scale(1);}50%{transform:translateY(3px) scale(1.03);}}
@keyframes wg-tail{0%,100%{transform:rotate(-9deg);}50%{transform:rotate(14deg);}}
@keyframes wg-flipper{0%,100%{transform:rotate(0deg);}50%{transform:rotate(-14deg);}}
@keyframes wg-blink{0%,92%,100%{transform:scaleY(1);}95%{transform:scaleY(.06);}}
@keyframes wg-drop{0%{transform:translateY(0);opacity:.9;}100%{transform:translateY(-16px);opacity:0;}}
@keyframes wg-z-rise{0%{transform:translateY(4px);opacity:0;}30%{opacity:1;}100%{transform:translateY(-16px);opacity:0;}}
@keyframes wg-ring{0%{transform:scale(.7);opacity:.9;}100%{transform:scale(1.25);opacity:0;}}
.wg-bubble-wrap{position:absolute;bottom:calc(100% + 10px);right:8px;transform-origin:bottom right;transform:scale(var(--wg-bubble,1));pointer-events:none;max-width:calc(var(--wg-size) * 1.9);}
.wg-bubble{--wg-bubble-bg:var(--dsw-alias-bg-layer-2,#fdfeff);--wg-bubble-fg:var(--dsw-alias-fg-primary,#25304a);--wg-bubble-border:var(--dsw-alias-border-strong,#9db3d6);background:var(--wg-bubble-bg);color:var(--wg-bubble-fg);border:1.5px solid var(--wg-bubble-border);border-radius:14px;padding:7px 12px;font:12.5px/1.55 var(--dsw-alias-font-body,system-ui,sans-serif);box-shadow:0 4px 14px rgba(20,40,90,.18);animation:wg-pop .28s cubic-bezier(.2,1.4,.4,1);white-space:pre-wrap;word-break:break-word;position:relative;}
.wg-bubble::after{content:"";position:absolute;bottom:-6.5px;right:20px;width:11px;height:11px;background:var(--wg-bubble-bg);border-right:1.5px solid var(--wg-bubble-border);border-bottom:1.5px solid var(--wg-bubble-border);transform:rotate(45deg);}
.wg-bubble.wg-tool-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:12px;white-space:nowrap;}
.wg-bubble.wg-approval-chip{--wg-bubble-bg:#fff7e6;--wg-bubble-fg:#7a4d00;--wg-bubble-border:#e8a53c;}
.wg-dots{display:inline-flex;gap:4px;align-items:center;padding:9px 11px;}
.wg-dots i{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-fg-secondary,#6b7a99);animation:wg-dot 1.2s ease-in-out infinite;}
.wg-dots i:nth-child(2){animation-delay:.2s;}
.wg-dots i:nth-child(3){animation-delay:.4s;}
@keyframes wg-dot{0%,100%{transform:translateY(0);opacity:.4;}50%{transform:translateY(-5px);opacity:1;}}
@keyframes wg-pop{from{transform:scale(.6);opacity:0;}to{transform:scale(1);opacity:1;}}
.wg-card{position:absolute;bottom:calc(100% + 10px);right:0;width:230px;background:var(--dsw-alias-bg-layer-2,#fdfeff);color:var(--dsw-alias-fg-primary,#25304a);border:1px solid var(--dsw-alias-border-strong,#9db3d6);border-radius:12px;padding:10px 12px;font:12px/1.6 var(--dsw-alias-font-body,system-ui,sans-serif);box-shadow:0 6px 20px rgba(20,40,90,.22);animation:wg-pop .2s ease-out;pointer-events:none;}
.wg-card b{font-size:13px;}
.wg-card .wg-muted{color:var(--dsw-alias-fg-secondary,#6b7a99);font-size:11px;}
.wg-xp{height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-3,#e3e9f4);margin:6px 0 2px;overflow:hidden;}
.wg-xp i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#6ea8e8,#8fd0a8);transition:width .4s ease;}
.wg-menu-mask{position:fixed;inset:0;z-index:2147482100;}
.wg-menu{position:absolute;background:var(--dsw-alias-bg-layer-2,#fdfeff);color:var(--dsw-alias-fg-primary,#25304a);border:1px solid var(--dsw-alias-border-strong,#9db3d6);border-radius:10px;padding:4px;box-shadow:0 6px 20px rgba(20,40,90,.25);font:12.5px var(--dsw-alias-font-body,system-ui,sans-serif);min-width:136px;}
.wg-menu button{display:flex;width:100%;gap:8px;align-items:center;border:0;background:none;color:inherit;padding:7px 10px;border-radius:7px;cursor:pointer;text-align:left;font:inherit;}
.wg-menu button:hover{background:var(--dsw-alias-bg-layer-3,#e9eef7);}
.wg-restore{position:fixed;right:14px;bottom:14px;z-index:2147482000;width:34px;height:34px;border-radius:50%;border:1px solid var(--dsw-alias-border-strong,#9db3d6);background:var(--dsw-alias-bg-layer-2,#fdfeff);font-size:17px;cursor:pointer;box-shadow:0 3px 10px rgba(20,40,90,.25);animation:wg-pop .25s ease-out;transition:transform .15s ease;}
.wg-restore:hover{transform:scale(1.12);}
.wg-heart-float{position:absolute;left:20%;bottom:70%;font-size:15px;pointer-events:none;animation:wg-heart 1.4s ease-out forwards;}
@keyframes wg-heart{0%{transform:translateY(0);opacity:1;}100%{transform:translateY(-34px);opacity:0;}}
`;

		function ensureStyles() {
			if (document.getElementById("@zyfgood/dsh-whale-girl-styles") !== null) return;
			const tag = document.createElement("style");
			tag.id = "@zyfgood/dsh-whale-girl-styles";
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/* ── host routes (prefix-safe, desktop-shell aware) ───────────────── */

		function hostBase() {
			let base = document.baseURI || "/";
			if (!base.endsWith("/")) base += "/";
			return base;
		}
		function routeUrl(path) {
			return new URL(path.replace(/^\/+/, ""), hostBase());
		}

		/* ── tiny synth (no audio assets) ────────────────────────────────── */

		let audioCtx;
		function tone(freq, dur, type, gain, delay) {
			try {
				if (audioCtx === undefined) audioCtx = new AudioContext();
				if (audioCtx.state === "suspended") return;
				const osc = audioCtx.createOscillator();
				const vol = audioCtx.createGain();
				osc.type = type;
				osc.frequency.value = freq;
				vol.gain.setValueAtTime(gain, audioCtx.currentTime + delay);
				vol.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + dur);
				osc.connect(vol).connect(audioCtx.destination);
				osc.start(audioCtx.currentTime + delay);
				osc.stop(audioCtx.currentTime + delay + dur + 0.02);
			} catch { /* audio unavailable: silent */ }
		}
		function squeak() { tone(820, 0.07, "triangle", 0.05, 0); tone(1240, 0.06, "triangle", 0.03, 0.06); }
		function chime() { tone(660, 0.14, "sine", 0.04, 0); tone(880, 0.14, "sine", 0.04, 0.09); tone(1108, 0.2, "sine", 0.035, 0.18); }

		/* ── copy ─────────────────────────────────────────────────────────── */

		const POKE_LINES = ["咕噜？", "别戳啦～", "嘻嘻", "在的在的", "叫我什么事？", "鲸鱼也会害羞的"];
		const PET_LINES = ["咕噜咕噜…舒服 ♪", "再摸摸", "最喜欢你了", "好软好摸吧"];
		const PET_REJECT_LINES = ["摸太频繁啦，歇会儿～", "毛都要被摸秃了", "缓缓再摸"];
		const TOOL_LABELS = [
			[/pwsh|bash|shell|terminal/i, "敲命令"],
			[/^read$/i, "读文件"],
			[/edit|write|str[-_]replace/i, "改文件"],
			[/grep|glob|search|find/i, "找文件"],
			[/web_?search|web_?fetch/i, "查网络"],
			[/present/i, "整理交付"],
			[/subagent/i, "派小助手"],
			[/todo/i, "列清单"],
			[/skill/i, "加载技能"],
			[/ask|question/i, "问用户"],
			[/schedule|reminder/i, "定闹钟"],
		];
		function toolLabel(name) {
			for (const [re, label] of TOOL_LABELS) if (re.test(name)) return label;
			return name.length > 6 ? name.slice(0, 6) + "…" : name;
		}
		function pick(lines) { return lines[Math.floor(Math.random() * lines.length)]; }

		/* ── the whale (pure SVG) ─────────────────────────────────────────── */

		function WhaleSvg() {
			return h("svg", { className: "wg-whale", viewBox: "0 0 200 156", "aria-hidden": "true" },
				h("g", { className: "wg-tail" },
					h("path", { d: "M40 58 C18 40 6 44 4 58 C2 72 14 78 30 76 C18 78 10 88 16 99 C22 110 38 104 46 88 Z", fill: "#5b8dd9" }),
					h("path", { d: "M40 58 C18 40 6 44 4 58 C2 72 14 78 30 76 C24 77 18 82 17 88 C10 80 12 66 40 58 Z", fill: "#4a7cc4", opacity: ".7" })
				),
				h("path", { d: "M34 74 C34 40 78 22 118 28 C156 34 182 60 180 88 C178 116 142 134 102 134 C64 134 34 112 34 74 Z", fill: "#5b8dd9" }),
				h("path", { d: "M52 100 C68 118 104 126 130 120 C122 128 66 128 52 100 Z", fill: "#cfe3f7" }),
				h("ellipse", { className: "wg-flipper", cx: "120", cy: "108", rx: "17", ry: "8", fill: "#4a7cc4", transform: "rotate(18 120 108)" }),
				h("g", { className: "wg-eyes" },
					h("g", { className: "wg-eye" },
						h("ellipse", { cx: "128", cy: "66", rx: "9", ry: "10", fill: "#1d2740" }),
						h("circle", { cx: "131", cy: "62", r: "3.2", fill: "#ffffff" })
					),
					h("g", { className: "wg-eye" },
						h("ellipse", { cx: "156", cy: "66", rx: "9", ry: "10", fill: "#1d2740" }),
						h("circle", { cx: "159", cy: "62", r: "3.2", fill: "#ffffff" })
					)
				),
				h("g", { className: "wg-deadeyes", stroke: "#1d2740", strokeWidth: "3", strokeLinecap: "round" },
					h("path", { d: "M122 62 L134 70 M134 62 L122 70" }),
					h("path", { d: "M150 62 L162 70 M162 62 L150 70" })
				),
				h("path", { className: "wg-smile", d: "M136 86 Q146 94 156 86", stroke: "#1d2740", strokeWidth: "2.6", fill: "none", strokeLinecap: "round" }),
				h("path", { className: "wg-frown", d: "M136 92 Q146 84 156 92", stroke: "#1d2740", strokeWidth: "2.6", fill: "none", strokeLinecap: "round" }),
				h("ellipse", { cx: "120", cy: "82", rx: "7", ry: "4", fill: "#f2a1c0", opacity: ".75" }),
				h("ellipse", { cx: "164", cy: "82", rx: "7", ry: "4", fill: "#f2a1c0", opacity: ".75" }),
				h("g", { transform: "translate(96 26) rotate(-8)" },
					h("path", { d: "M0 0 L-16 -9 L-14 8 Z", fill: "#f2a1c0" }),
					h("path", { d: "M0 0 L16 -10 L15 8 Z", fill: "#ee8fb2" }),
					h("circle", { cx: "0", cy: "0", r: "5", fill: "#e27ba4" })
				),
				h("g", { className: "wg-spout", transform: "translate(120 24)" },
					h("path", { d: "M0 6 C-2 0 2 -2 0 -6", stroke: "#8fc3ee", strokeWidth: "3", fill: "none", strokeLinecap: "round" }),
					h("g", { className: "wg-drop", fill: "#8fc3ee" }, h("circle", { cx: "-8", cy: "2", r: "2.4" })),
					h("g", { className: "wg-drop", fill: "#8fc3ee" }, h("circle", { cx: "8", cy: "0", r: "2" })),
					h("g", { className: "wg-drop", fill: "#8fc3ee" }, h("circle", { cx: "1", cy: "-4", r: "1.8" }))
				),
				h("g", { className: "wg-z", fill: "#6b7a99", fontSize: "13", fontWeight: "700" },
					h("text", { x: "168", y: "40" }, "z"),
					h("text", { x: "176", y: "30" }, "z"),
					h("text", { x: "182", y: "20" }, "z")
				),
				h("g", { className: "wg-cap" },
					h("path", { d: "M96 26 C104 4 140 2 152 22 C136 14 112 16 96 26 Z", fill: "#7e6fd0" }),
					h("path", { d: "M90 28 C110 20 140 20 156 26 L154 32 C138 26 110 26 92 34 Z", fill: "#9b8ce6" }),
					h("circle", { cx: "153", cy: "20", r: "4.5", fill: "#f4f0d8" })
				)
			);
		}

		/* ── overlay component ────────────────────────────────────────────── */

		function WhaleGirlOverlay() {
			const [snap, setSnap] = useState(null);
			const [bubble, setBubble] = useState(null); // {text, kind, until}
			const [menu, setMenu] = useState(null); // {x, y}
			const [hovering, setHovering] = useState(false);
			const [hearts, setHearts] = useState([]); // floating heart ids
			const [flashHappy, setFlashHappy] = useState(false);
			const [dragging, setDragging] = useState(false);
			const drag = useRef({ moved: false, id: 0, startX: 0, startY: 0, right: 0, bottom: 0 });
			const shownSay = useRef(new Set());
			const lastNagAt = useRef(0);
			const bubbleTimer = useRef(undefined);
			const flashTimer = useRef(undefined);

			const showBubble = useCallback((text, kind = "say", ms = 6000) => {
				clearTimeout(bubbleTimer.current);
				setBubble({ text, kind, until: Date.now() + ms });
				bubbleTimer.current = setTimeout(() => setBubble(null), ms);
			}, []);

			const act = useCallback(async (kind, payload = {}) => {
				try {
					const res = await fetch(routeUrl("whale-girl/act"), {
						method: "POST",
						credentials: "same-origin",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ kind, ...payload }),
					});
					if (res.ok) {
						const body = await res.json();
						if (body !== null && typeof body === "object" && body.state) setSnap(body.state);
						return body;
					}
				} catch { /* transient: keep last snapshot */ }
				return null;
			}, []);

			// poll the host snapshot (paused while dragging so the drag position wins)
			useEffect(() => {
				let stop = false;
				let warnOnce = false;
				const tick = async () => {
					try {
						const res = await fetch(routeUrl("whale-girl/state"), { credentials: "same-origin" });
						if (res.ok) {
							const body = await res.json();
							if (!stop && body !== null && typeof body === "object" && drag.current.id === 0) setSnap(body);
						}
					} catch (error) {
						if (!warnOnce) { warnOnce = true; console.warn("[@zyfgood/dsh-whale-girl] state poll failed:", error?.message ?? error); }
					}
				};
				void tick();
				const timer = setInterval(() => { void tick(); }, 600);
				return () => { stop = true; clearInterval(timer); };
			}, []);

			// new say entries → bubble (+happy flash); idle nag
			useEffect(() => {
				if (snap === null || typeof snap !== "object") return;
				const petState = snap.pet;
				const speech = snap.config?.speechEnabled !== false;
				const pending = Array.isArray(petState?.say) ? petState.say.filter((entry) => !shownSay.current.has(entry.id)) : [];
				if (pending.length > 0) {
					for (const entry of petState.say) shownSay.current.add(entry.id);
					const latest = pending[pending.length - 1];
					if (speech && typeof latest.text === "string" && latest.text !== "") showBubble(latest.text, "say", 6500);
					if (latest.action === "happy") {
						setFlashHappy(true);
						clearTimeout(flashTimer.current);
						flashTimer.current = setTimeout(() => setFlashHappy(false), 2600);
					}
				}
				const idleMs = typeof petState?.lastActivityAt === "number" ? Date.now() - Math.min(petState.lastActivityAt, Date.now()) : 0;
				const idleNagMinutes = snap.config?.idleNagMinutes ?? 5;
				const mood = petState?.mood ?? "idle";
				if (mood === "idle" && idleMs > idleNagMinutes * 60000 && Date.now() - lastNagAt.current > 90000) {
					lastNagAt.current = Date.now();
					if (speech) showBubble("我闲着呢，有活吗？", "say", 5000);
				}
			}, [snap, showBubble]);

			// derive display state every render
			const now = Date.now();
			const petState = snap?.pet;
			const display = snap?.display ?? { visible: true, muted: false, right: 24, bottom: 16 };
			const config = snap?.config ?? { size: 160, bubbleScale: 1, speechEnabled: true, soundsEnabled: true, idleNagMinutes: 5, sleepAfterMinutes: 10 };
			const growth = snap?.growth ?? { level: 1, title: "初来乍到", xp: 0, nextLevelXp: 20, thisLevelXp: 0, hearts: 0 };
			const idleMs = typeof petState?.lastActivityAt === "number" ? now - Math.min(petState.lastActivityAt, now) : 0;
			let mood = petState?.mood ?? "idle";
			if (mood !== "approval" && idleMs > (config.sleepAfterMinutes ?? 10) * 60000) mood = "sleep";
			const night = new Date().getHours() < 6;
			const speech = config.speechEnabled !== false;
			const sounds = config.soundsEnabled !== false && display.muted !== true;

			const onPoke = () => {
				if (drag.current.moved) return;
				if (sounds) squeak();
				void act("poke");
				if (speech) showBubble(pick(POKE_LINES), "say", 3200);
			};
			const onPet = () => {
				if (drag.current.moved) return;
				void act("pet").then((body) => {
					const rejected = body?.rejected === true;
					if (speech) showBubble(rejected ? pick(PET_REJECT_LINES) : pick(PET_LINES), "say", 3600);
					if (!rejected) {
						setHearts((prev) => [...prev.slice(-4), Date.now()]);
						if (sounds) chime();
					}
				});
			};
			const onFeed = () => {
				void act("feed");
				if (sounds) chime();
			};
			const onHide = () => { setMenu(null); void act("hide"); };
			const onMute = () => { setMenu(null); void act("mute", { value: !display.muted }); };
			const onReset = () => { setMenu(null); void act("reset"); };
			const onShow = () => { void act("show"); };

			const onContextMenu = (event) => {
				event.preventDefault();
				event.stopPropagation();
				setMenu({ x: event.clientX, y: event.clientY });
			};

			// pointer drag (position = right/bottom offsets)
			const onPointerDown = (event) => {
				if (event.button !== 0) return;
				const root = event.currentTarget.closest(".wg-root");
				const rect = root?.getBoundingClientRect();
				if (!rect) return;
				drag.current = {
					moved: false, id: event.pointerId,
					startX: event.clientX, startY: event.clientY,
					right: Math.round(window.innerWidth - rect.right), bottom: Math.round(window.innerHeight - rect.bottom),
				};
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const onPointerMove = (event) => {
				if (drag.current.id !== event.pointerId) return;
				const dx = event.clientX - drag.current.startX;
				const dy = event.clientY - drag.current.startY;
				if (!drag.current.moved && Math.hypot(dx, dy) < 6) return;
				drag.current.moved = true;
				setDragging(true);
				setSnap((prev) => {
					if (prev === null) return prev;
					const size = prev.config?.size ?? 160;
					const d = { ...prev.display };
					d.right = Math.min(Math.max(0, Math.round(drag.current.right - dx)), Math.max(0, window.innerWidth - size - 8));
					d.bottom = Math.min(Math.max(0, Math.round(drag.current.bottom - dy)), Math.max(0, window.innerHeight - 40));
					return { ...prev, display: d };
				});
			};
			const onPointerUp = (event) => {
				if (drag.current.id !== event.pointerId) return;
				const moved = drag.current.moved;
				drag.current.id = 0;
				drag.current.moved = false;
				setDragging(false);
				if (moved) {
					const d = snap?.display;
					if (d) void act("move", { right: d.right, bottom: d.bottom });
				}
			};

			if (snap === null) return null;
			if (display.visible === false) {
				return h("button", { className: "wg-restore", title: "显示鲸鱼女孩", onClick: onShow, type: "button" }, "🐳");
			}

			const size = config.size ?? 160;
			const rootClass = `wg-root wg-${mood}${night ? " wg-night" : ""}${flashHappy ? " wg-flash-happy" : ""}`;

			let bubbleNode = null;
			if (bubble !== null && bubble.until > now) {
				bubbleNode = h("div", { className: "wg-bubble-wrap", style: { "--wg-bubble": String(config.bubbleScale ?? 1) }, key: "b" + bubble.until },
					h("div", { className: `wg-bubble${bubble.kind === "tool" ? " wg-tool-chip" : ""}` }, bubble.text)
				);
			} else if (mood === "tool" && petState?.currentTool) {
				bubbleNode = h("div", { className: "wg-bubble-wrap", style: { "--wg-bubble": String(config.bubbleScale ?? 1) }, key: "tool" + petState.currentTool },
					h("div", { className: "wg-bubble wg-tool-chip" }, `🔧 ${toolLabel(petState.currentTool)}`)
				);
			} else if (mood === "thinking") {
				bubbleNode = h("div", { className: "wg-bubble-wrap", style: { "--wg-bubble": String(config.bubbleScale ?? 1) }, key: "think" },
					h("div", { className: "wg-bubble wg-dots" }, h("i", null), h("i", null), h("i", null))
				);
			} else if (mood === "approval" && speech) {
				bubbleNode = h("div", { className: "wg-bubble-wrap", style: { "--wg-bubble": String(config.bubbleScale ?? 1) }, key: "appr" },
					h("div", { className: "wg-bubble wg-approval-chip" }, "🔔 在等你拍板呢！")
				);
			}

			const hoverCard = hovering
				? h("div", { className: "wg-card", key: "card" },
					h("div", null,
						h("b", null, "鲸鱼女孩"), " · Lv.", String(growth.level), " ",
						h("span", { className: "wg-muted" }, growth.title)
					),
					h("div", { className: "wg-xp" }, h("i", { style: { width: xpPercent(growth) } })),
					h("div", { className: "wg-muted" }, `经验 ${growth.xp} / ${growth.nextLevelXp}　${"❤".repeat(growth.hearts)}${"♡".repeat(Math.max(0, 5 - growth.hearts))}`),
					turnLine(petState, now)
				)
				: null;

			return h("div", {
				className: rootClass,
				style: { right: `${display.right}px`, bottom: `${display.bottom}px`, "--wg-size": `${size}px` },
			},
				h("div", {
					className: `wg-stage${dragging ? " wg-dragging" : ""}`,
					onClick: onPoke,
					onDoubleClick: onPet,
					onContextMenu: onContextMenu,
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
					onMouseEnter: () => setHovering(true),
					onMouseLeave: () => setHovering(false),
					title: "鲸鱼女孩（拖动移动 · 单击戳戳 · 双击摸摸 · 右键菜单）",
				},
					h("div", { className: "wg-ring" }),
					h(WhaleSvg),
					bubbleNode,
					hoverCard,
					hearts.map((id) => h("span", { className: "wg-heart-float", key: id }, "♥"))
				),
				menu !== null
					? h("div", {
						className: "wg-menu-mask",
						onClick: () => setMenu(null),
						onContextMenu: (event) => { event.preventDefault(); setMenu(null); },
					},
						h("div", { className: "wg-menu", style: { left: `${menu.x}px`, top: `${menu.y}px` } },
							h("button", { type: "button", onClick: () => { setMenu(null); onFeed(); } }, "🍤 喂食"),
							h("button", { type: "button", onClick: onMute }, display.muted ? "🔊 取消静音" : "🔇 静音"),
							h("button", { type: "button", onClick: onReset }, "↺ 回默认位置"),
							h("button", { type: "button", onClick: onHide }, "🙈 隐藏")
						)
					)
					: null
			);
		}

		function xpPercent(growth) {
			const span = Math.max(1, growth.nextLevelXp - growth.thisLevelXp);
			const within = Math.max(0, Math.min(span, growth.xp - growth.thisLevelXp));
			return `${Math.round((within / span) * 100)}%`;
		}

		function turnLine(petState, now) {
			if (petState === null || typeof petState !== "object") return null;
			if (petState.turnStartAt) {
				const seconds = Math.max(0, Math.round((now - petState.turnStartAt) / 1000));
				return h("div", { className: "wg-muted" }, `本轮 ${formatDur(seconds)} · ${petState.turnTools} 个工具`);
			}
			if (petState.lastTurn) {
				const t = petState.lastTurn;
				return h("div", { className: "wg-muted" }, `上轮 ${formatDur(Math.round(t.durationMs / 1000))} · ${t.tools} 个工具 ${t.ok ? "✓" : "✗"}`);
			}
			return null;
		}

		function formatDur(seconds) {
			if (seconds >= 60) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
			return `${seconds} 秒`;
		}

		/** Client plugin body: mount into the shell overlay slot. */
		function apply(ctx) {
			const fail = (phase, error) => {
				console.error(`[@zyfgood/dsh-whale-girl] ${phase} error:`, error);
			};
			try {
				ensureStyles();
				ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: "@zyfgood/dsh-whale-girl",
					order: 30,
					registrant: "@zyfgood/dsh-whale-girl",
					inject: () => ({}),
				}, WhaleGirlOverlay)), "@zyfgood/dsh-whale-girl: shell.overlay");
			} catch (error) {
				fail("load", error);
			}
		}

		exports.name = "@zyfgood/dsh-whale-girl";
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
