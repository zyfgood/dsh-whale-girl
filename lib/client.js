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

/* ── 星级挂饰（桌宠本体，按 wg-h{hearts} 类点亮） ─────────────── */
.wg-hairclip{display:none;}
.wg-root.wg-h2 .wg-hairclip,.wg-root.wg-h3 .wg-hairclip,.wg-root.wg-h4 .wg-hairclip,.wg-root.wg-h5 .wg-hairclip{display:block;}
.wg-scarf{display:none;}
.wg-root.wg-h4 .wg-scarf,.wg-root.wg-h5 .wg-scarf{display:block;}
.wg-crown{display:none;}
.wg-root.wg-h5 .wg-crown{display:block;}
.wg-root.wg-sleep .wg-crown,.wg-root.wg-night .wg-crown{display:none;} /* 睡帽优先 */

/* ── 互动动作库（作用于 stage 层，与心情动画分层不冲突） ──────── */
.wg-stage.wg-acting{animation-name:var(--wg-act);animation-duration:var(--wg-act-dur,1.6s);animation-timing-function:ease-in-out;animation-iteration-count:1;animation-fill-mode:forwards;}
.wg-act-spin{--wg-act:wg-spin;--wg-act-dur:1.5s;}
.wg-act-roll{--wg-act:wg-roll;--wg-act-dur:1.8s;}
.wg-act-flap{--wg-act:wg-flap;--wg-act-dur:1.4s;}
.wg-act-nod{--wg-act:wg-nod;--wg-act-dur:1s;}
.wg-act-dance{--wg-act:wg-dance;--wg-act-dur:2.4s;}
.wg-act-kiss{--wg-act:wg-kisspose;--wg-act-dur:1.6s;}
.wg-act-hug{--wg-act:wg-hugpose;--wg-act-dur:1.8s;}
.wg-act-cuddle{--wg-act:wg-cuddlepose;--wg-act-dur:2.2s;}
@keyframes wg-spin{0%{transform:rotate(0) scale(1);}55%{transform:rotate(360deg) scale(.94);}100%{transform:rotate(360deg) scale(1);}}
@keyframes wg-roll{0%,100%{transform:rotate(0);}20%{transform:rotate(-18deg) translateY(4px);}40%{transform:rotate(16deg);}60%{transform:rotate(-14deg) translateY(4px);}80%{transform:rotate(10deg);}}
@keyframes wg-flap{0%,100%{transform:translateY(0) rotate(0);}15%{transform:translateY(-8px) rotate(-6deg);}30%{transform:translateY(0) rotate(4deg);}45%{transform:translateY(-6px) rotate(-5deg);}60%{transform:translateY(0) rotate(3deg);}75%{transform:translateY(-4px) rotate(-3deg);}}
@keyframes wg-nod{0%,100%{transform:translateY(0);}30%{transform:translateY(5px) rotate(3deg);}60%{transform:translateY(-2px);}}
@keyframes wg-dance{0%,100%{transform:rotate(0) translateY(0);}10%{transform:rotate(-7deg) translateY(-5px);}25%{transform:rotate(6deg) translateY(0);}40%{transform:rotate(-7deg) translateY(-5px);}55%{transform:rotate(6deg) translateY(0);}70%{transform:rotate(-5deg) translateY(-4px);}85%{transform:rotate(5deg) translateY(0);}}
@keyframes wg-kisspose{0%{transform:scale(1);}40%{transform:scale(1.1) translateY(-6px);}70%{transform:scale(1.12) translateY(-4px);}100%{transform:scale(1);}}
@keyframes wg-hugpose{0%{transform:scale(1);}45%{transform:scale(1.07) translateY(3px);}100%{transform:scale(1);}}
@keyframes wg-cuddlepose{0%{transform:scale(1) translateX(0);}50%{transform:scale(1.16) translateX(-6px);}100%{transform:scale(1);}}

/* ── 星级徽章（悬停卡片） ─────────────────────────────────── */
.wg-card .wg-badges{display:flex;gap:3px;align-items:center;margin:5px 0 1px;}
.wg-badges .wg-badge{width:17px;height:17px;display:inline-block;flex:none;}
.wg-badges .wg-badge svg{width:100%;height:100%;display:block;}
.wg-badges .wg-off svg{filter:grayscale(1);opacity:.3;}
.wg-badges .wg-on svg{animation:wg-badge-beat 2.8s ease-in-out infinite;}
.wg-badges .wg-on.wg-latest svg{animation-duration:1.6s;}
@keyframes wg-badge-beat{0%,100%{transform:scale(1);}12%{transform:scale(1.18);}24%{transform:scale(1);}}
.wg-card .wg-titlerow{display:flex;align-items:center;gap:5px;}
.wg-card .wg-bigbadge{width:24px;height:24px;flex:none;margin-left:auto;}
.wg-card .wg-bigbadge svg{width:100%;height:100%;display:block;}

/* ── 右键菜单：分组线 + 锁定态 ─────────────────────────────── */
.wg-menu hr{border:0;border-top:1px solid var(--dsw-alias-border-strong,#9db3d6);margin:4px 6px;opacity:.5;}
.wg-menu button[disabled]{opacity:.45;cursor:not-allowed;}
.wg-menu button[disabled]:hover{background:none;}
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

		/* 台词库：base 永远可用，warm ★2+ / dear ★3+ / family ★5 逐档混入。 */
		const POKE_BANK = {
			base: ["咕噜？", "别戳啦～", "嘻嘻", "在的在的", "叫我什么事？", "鲸鱼也会害羞的"],
			warm: ["嗯？我在听～", "戳我也不生气哦", "想我啦？", "这就来！"],
			dear: ["跟你呆着最开心了", "又戳我，知道啦知道啦", "嘿嘿，被发现了"],
			family: ["家人在就不慌", "一直都在哦 ♪"],
		};
		const PET_BANK = {
			base: ["咕噜咕噜…舒服 ♪", "再摸摸", "好软好摸吧"],
			warm: ["摸摸头，元气满满！", "最喜欢这样了"],
			dear: ["你一摸我就想蹭蹭", "再多摸一会儿嘛"],
			family: ["最喜欢你了 ♡", "家人的手最暖了"],
		};
		const PET_REJECT_LINES = ["摸太频繁啦，歇会儿～", "毛都要被摸秃了", "缓缓再摸"];
		const FEED_BANK = { base: ["好吃！还想再吃一只 🍤", "谢谢投喂～", "元气满满！"] };
		const HIGHFIVE_BANK = { base: ["啪！✋", "击掌！", "配合默契～", "耶！"] };
		const HUG_BANK = {
			base: ["抱抱最治愈了 ♪", "再抱一会儿…", "暖乎乎的"],
			family: ["家人抱抱，充电完成 ♡"],
		};
		const HUG_REJECT_LINES = ["刚抱过啦，缓缓～", "先松开再抱嘛"];
		const CUDDLE_BANK = { base: ["贴贴～最亲了 ♡", "黏着你啦", "家人的温度 ♡"] };
		const CUDDLE_REJECT_LINES = ["贴太久会化掉的～", "歇会儿再贴"];
		const TICKLE_BANK = { base: ["哈哈哈别挠了！", "痒痒痒！哈哈哈哈", "肚子要笑破了"] };
		const BEDTIME_BANK = { base: ["呼哇…好困…", "那我先睡啦，晚安 ♪"] };
		const IDLE_LOOK_LINES = ["在看我吗？", "嘿嘿～", "就一直陪着你哦"];
		const LOCKED_HINT = "好感星级不够，再亲一点就解锁啦";
		/** 按当前星级把台词池拼起来。 */
		function linesFor(bank, hearts) {
			const pool = Array.isArray(bank) ? [...bank] : [...(bank.base ?? [])];
			if (!Array.isArray(bank)) {
				if (hearts >= 2 && bank.warm) pool.push(...bank.warm);
				if (hearts >= 3 && bank.dear) pool.push(...bank.dear);
				if (hearts >= 5 && bank.family) pool.push(...bank.family);
			}
			return pool.length > 0 ? pool : ["…"];
		}
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

		/** Four-point sparkle path centered at (cx, cy). */
		function sparkPath(cx, cy, r) {
			const s = r * 0.32;
			return `M${cx} ${cy - r} L${cx + s} ${cy - s} L${cx + r} ${cy} L${cx + s} ${cy + s} L${cx} ${cy + r} L${cx - s} ${cy + s} L${cx - r} ${cy} L${cx - s} ${cy - s} Z`;
		}

		/* ── 表情库：眼睛变体（normal 之外按交互临时切换） ─────────────────── */
		function WhaleEyes({ face }) {
			switch (face) {
				case "happy":
				case "laugh":
					return h("g", { className: "wg-face-eyes", stroke: "#1d2740", strokeWidth: "3", strokeLinecap: "round", fill: "none" },
						h("path", { d: "M119 64 Q128 55 137 64" }),
						h("path", { d: "M147 64 Q156 55 165 64" }));
				case "shy":
					return h("g", { className: "wg-face-eyes" },
						h("ellipse", { cx: "129", cy: "67", rx: "7.5", ry: "8.5", fill: "#1d2740" }),
						h("circle", { cx: "126", cy: "69", r: "2.4", fill: "#ffffff" }),
						h("ellipse", { cx: "155", cy: "67", rx: "7.5", ry: "8.5", fill: "#1d2740" }),
						h("circle", { cx: "152", cy: "69", r: "2.4", fill: "#ffffff" }));
				case "surprise":
					return h("g", { className: "wg-face-eyes" },
						h("ellipse", { cx: "128", cy: "66", rx: "10.5", ry: "12", fill: "#1d2740" }),
						h("circle", { cx: "131", cy: "61", r: "3.6", fill: "#ffffff" }),
						h("ellipse", { cx: "156", cy: "66", rx: "10.5", ry: "12", fill: "#1d2740" }),
						h("circle", { cx: "159", cy: "61", r: "3.6", fill: "#ffffff" }));
				case "sad":
					return h("g", { className: "wg-face-eyes" },
						h("path", { d: "M120 63 Q128 58 136 63", stroke: "#1d2740", strokeWidth: "3", strokeLinecap: "round", fill: "none" }),
						h("path", { d: "M148 63 Q156 58 164 63", stroke: "#1d2740", strokeWidth: "3", strokeLinecap: "round", fill: "none" }),
						h("ellipse", { cx: "122", cy: "77", rx: "3", ry: "4.6", fill: "#8fc3ee" }));
				case "stars":
					return h("g", { className: "wg-face-eyes", fill: "#f4c95d" },
						h("path", { d: sparkPath(128, 66, 7.5) }),
						h("path", { d: sparkPath(156, 66, 7.5) }),
						h("circle", { cx: "128", cy: "66", r: "1.6", fill: "#1d2740" }),
						h("circle", { cx: "156", cy: "66", r: "1.6", fill: "#1d2740" }));
				case "wink":
					return h("g", { className: "wg-face-eyes" },
						h("ellipse", { cx: "128", cy: "66", rx: "9", ry: "10", fill: "#1d2740" }),
						h("circle", { cx: "131", cy: "62", r: "3.2", fill: "#ffffff" }),
						h("path", { d: "M148 67 Q156 60 164 67", stroke: "#1d2740", strokeWidth: "3", strokeLinecap: "round", fill: "none" }));
				case "sleepy":
					return h("g", { className: "wg-face-eyes", stroke: "#1d2740", strokeWidth: "3.4", strokeLinecap: "round" },
						h("path", { d: "M120 67 L136 65" }),
						h("path", { d: "M148 65 L164 67" }));
				default:
					return h("g", { className: "wg-eyes" },
						h("g", { className: "wg-eye" },
							h("ellipse", { cx: "128", cy: "66", rx: "9", ry: "10", fill: "#1d2740" }),
							h("circle", { cx: "131", cy: "62", r: "3.2", fill: "#ffffff" })
						),
						h("g", { className: "wg-eye" },
							h("ellipse", { cx: "156", cy: "66", rx: "9", ry: "10", fill: "#1d2740" }),
							h("circle", { cx: "159", cy: "62", r: "3.2", fill: "#ffffff" })
						)
					);
			}
		}

		/* ── 表情库：嘴巴变体 ─────────────────────────────────────────── */
		function WhaleMouth({ face }) {
			switch (face) {
				case "surprise":
					return h("circle", { cx: "146", cy: "89", r: "4.6", fill: "#1d2740", opacity: ".85" });
				case "sad":
					return h("path", { d: "M136 92 Q146 84 156 92", stroke: "#1d2740", strokeWidth: "2.6", fill: "none", strokeLinecap: "round" });
				case "shy":
					return h("path", { d: "M139 88 q3.5 -3 7 0 q3.5 3 7 0", stroke: "#1d2740", strokeWidth: "2.4", fill: "none", strokeLinecap: "round" });
				case "laugh":
					return h("path", { d: "M136 84 Q146 100 156 84 Z", fill: "#1d2740" });
				default:
					return h(React.Fragment, null,
						h("path", { className: face === "normal" ? "wg-smile" : undefined, d: "M136 86 Q146 94 156 86", stroke: "#1d2740", strokeWidth: "2.6", fill: "none", strokeLinecap: "round" }),
						face === "normal"
							? h("path", { className: "wg-frown", d: "M136 92 Q146 84 156 92", stroke: "#1d2740", strokeWidth: "2.6", fill: "none", strokeLinecap: "round" })
							: null
					);
			}
		}

		/* ── the whale (pure SVG; face = 表情变体，挂饰由 root 星级类控制显隐) ─ */
		function WhaleSvg({ face = "normal" }) {
			const shy = face === "shy";
			const blush = shy
				? { rx: "8.5", ry: "5", opacity: ".95", fill: "#f27ba4" }
				: { rx: "7", ry: "4", opacity: ".75", fill: "#f2a1c0" };
			return h("svg", { className: "wg-whale", viewBox: "0 0 200 156", "aria-hidden": "true" },
				h("g", { className: "wg-tail" },
					h("path", { d: "M40 58 C18 40 6 44 4 58 C2 72 14 78 30 76 C18 78 10 88 16 99 C22 110 38 104 46 88 Z", fill: "#5b8dd9" }),
					h("path", { d: "M40 58 C18 40 6 44 4 58 C2 72 14 78 30 76 C24 77 18 82 17 88 C10 80 12 66 40 58 Z", fill: "#4a7cc4", opacity: ".7" })
				),
				h("path", { d: "M34 74 C34 40 78 22 118 28 C156 34 182 60 180 88 C178 116 142 134 102 134 C64 134 34 112 34 74 Z", fill: "#5b8dd9" }),
				h("path", { d: "M52 100 C68 118 104 126 130 120 C122 128 66 128 52 100 Z", fill: "#cfe3f7" }),
				h("ellipse", { className: "wg-flipper", cx: "120", cy: "108", rx: "17", ry: "8", fill: "#4a7cc4", transform: "rotate(18 120 108)" }),
				h(WhaleEyes, { face: face }),
				h("g", { className: "wg-deadeyes", stroke: "#1d2740", strokeWidth: "3", strokeLinecap: "round" },
					h("path", { d: "M122 62 L134 70 M134 62 L122 70" }),
					h("path", { d: "M150 62 L162 70 M162 62 L150 70" })
				),
				h(WhaleMouth, { face: face }),
				h("ellipse", { cx: "120", cy: "82", rx: blush.rx, ry: blush.ry, fill: blush.fill, opacity: blush.opacity }),
				h("ellipse", { cx: "164", cy: "82", rx: blush.rx, ry: blush.ry, fill: blush.fill, opacity: blush.opacity }),
				h("g", { transform: "translate(96 26) rotate(-8)" },
					h("path", { d: "M0 0 L-16 -9 L-14 8 Z", fill: "#f2a1c0" }),
					h("path", { d: "M0 0 L16 -10 L15 8 Z", fill: "#ee8fb2" }),
					h("circle", { cx: "0", cy: "0", r: "5", fill: "#e27ba4" })
				),
				h("g", { className: "wg-hairclip", transform: "translate(166 38) rotate(15)" },
					h("path", { d: sparkPath(0, 0, 7), fill: "#f4c95d" }),
					h("circle", { cx: "0", cy: "0", r: "1.8", fill: "#e27ba4" })
				),
				h("g", { className: "wg-scarf" },
					h("path", { d: "M46 106 C82 126 132 128 172 112 L176 122 C134 140 80 138 40 118 Z", fill: "#ef9a8a" }),
					h("path", { d: "M150 124 L158 142 L172 136 L164 120 Z", fill: "#dd7f66" }),
					h("path", { d: "M48 110 C84 129 130 131 170 116", stroke: "#dd7f66", strokeWidth: "2", fill: "none", opacity: ".6" })
				),
				h("g", { className: "wg-crown", transform: "translate(128 4)" },
					h("path", { d: "M0 12 L1.5 3 L6 7.5 L12 0 L18 7.5 L22.5 3 L24 12 Z", fill: "#f4c95d", stroke: "#d9a83e", strokeWidth: "1.2" }),
					h("circle", { cx: "12", cy: "15", r: "2", fill: "#e27ba4" }),
					h("circle", { cx: "2", cy: "14.5", r: "1.3", fill: "#e8927c" }),
					h("circle", { cx: "22", cy: "14.5", r: "1.3", fill: "#e8927c" })
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

		/* ── 星级徽章：每颗 ❤ 一个专属图案，越高级越亲昵 ─────────────────── */
		const HEART_D = "M12 20.5 C4.5 14.5 2.5 9 6.5 6 C9.5 4 12 6.2 12 8.8 C12 6.2 14.5 4 17.5 6 C21.5 9 19.5 14.5 12 20.5 Z";

		function TierBadge({ tier }) {
			switch (tier) {
				case 1: // 小粉心：有点熟了
					return h("svg", { viewBox: "0 0 24 24" }, h("path", { d: HEART_D, fill: "#f27ba4" }));
				case 2: // 双心相依：开始亲近
					return h("svg", { viewBox: "0 0 24 24" },
						h("path", { d: HEART_D, fill: "#ef6f9f", transform: "translate(-1.5 2) scale(.82)" }),
						h("path", { d: HEART_D, fill: "#f8a7c5", transform: "translate(6.5 -2.5) scale(.5)" }));
				case 3: // 心心相扣 + 中星：默契建立
					return h("svg", { viewBox: "0 0 24 24" },
						h("path", { d: HEART_D, fill: "#ef6f9f", opacity: ".9", transform: "translate(-3 1) scale(.78)" }),
						h("path", { d: HEART_D, fill: "#f27ba4", opacity: ".9", transform: "translate(3 1) scale(.78)" }),
						h("path", { d: sparkPath(12, 12, 4), fill: "#f4c95d" }));
				case 4: // 闪光心：挚友 sparkle
					return h("svg", { viewBox: "0 0 24 24" },
						h("circle", { cx: "12", cy: "12", r: "10", fill: "none", stroke: "#f8d3a8", strokeWidth: "1.2", opacity: ".8" }),
						h("path", { d: HEART_D, fill: "#f2608f" }),
						h("path", { d: sparkPath(12, 3.5, 2.6), fill: "#f4c95d" }),
						h("path", { d: sparkPath(2.8, 8, 2), fill: "#f4c95d" }),
						h("path", { d: sparkPath(21.2, 15, 2), fill: "#f4c95d" }));
				default: // 5：双心 + 小翅膀：家人
					return h("svg", { viewBox: "0 0 24 24" },
						h("path", { d: "M6 12 C3 9 2 5.5 3.5 3.5 C5.5 5.5 8 6 10 5.5 C8.5 7.5 8.5 10 9.5 12 Z", fill: "#a8d8f0" }),
						h("path", { d: "M18 12 C21 9 22 5.5 20.5 3.5 C18.5 5.5 16 6 14 5.5 C15.5 7.5 15.5 10 14.5 12 Z", fill: "#a8d8f0" }),
						h("path", { d: HEART_D, fill: "#e84f86" }),
						h("path", { d: HEART_D, fill: "#ffb3cf", transform: "translate(7.5 7.5) scale(.35)" }),
						h("path", { d: sparkPath(12, 1.8, 2), fill: "#f4c95d" }));
			}
		}

		/** ★0（还没点亮任何心）的大徽章：一颗小水泡。 */
		function BubbleBadge() {
			return h("svg", { viewBox: "0 0 24 24" },
				h("circle", { cx: "12", cy: "13", r: "8", fill: "none", stroke: "#9cc7ea", strokeWidth: "1.6" }),
				h("path", { d: "M8.5 10 Q10 8 12.5 8", stroke: "#d7ecfa", strokeWidth: "1.8", fill: "none", strokeLinecap: "round" }),
				h("circle", { cx: "18.5", cy: "6", r: "2.2", fill: "none", stroke: "#9cc7ea", strokeWidth: "1.2" }),
				h("circle", { cx: "4.5", cy: "19", r: "1.5", fill: "none", stroke: "#9cc7ea", strokeWidth: "1" }));
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
			const [face, setFace] = useState(null); // {name, until} 临时表情（1-3 秒）
			const [actAnim, setActAnim] = useState(null); // {name} 互动动作演出
			const drag = useRef({ moved: false, id: 0, startX: 0, startY: 0, right: 0, bottom: 0 });
			const shownSay = useRef(new Set());
			const lastNagAt = useRef(0);
			const lastSkitsAt = useRef(0);
			const snapRef = useRef(null);
			const bubbleTimer = useRef(undefined);
			const flashTimer = useRef(undefined);
			const faceTimer = useRef(undefined);
			const actTimer = useRef(undefined);
			snapRef.current = snap;

			const showBubble = useCallback((text, kind = "say", ms = 6000) => {
				clearTimeout(bubbleTimer.current);
				setBubble({ text, kind, until: Date.now() + ms });
				bubbleTimer.current = setTimeout(() => setBubble(null), ms);
			}, []);

			// 临时表情：N 秒后自动回落到 normal
			const playFace = useCallback((name, ms = 2200) => {
				clearTimeout(faceTimer.current);
				setFace({ name, until: Date.now() + ms });
				faceTimer.current = setTimeout(() => setFace(null), ms);
			}, []);
			// 互动动作演出（stage 层动画），dur 需与该动作的 CSS 时长一致
			const playAct = useCallback((name, dur = 1600) => {
				clearTimeout(actTimer.current);
				setActAnim({ name });
				actTimer.current = setTimeout(() => setActAnim(null), dur + 80);
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

			// new say entries → bubble (+face/act mapping); idle nag
			useEffect(() => {
				if (snap === null || typeof snap !== "object") return;
				const petState = snap.pet;
				const speech = snap.config?.speechEnabled !== false;
				const pending = Array.isArray(petState?.say) ? petState.say.filter((entry) => !shownSay.current.has(entry.id)) : [];
				if (pending.length > 0) {
					for (const entry of petState.say) shownSay.current.add(entry.id);
					const latest = pending[pending.length - 1];
					if (speech && typeof latest.text === "string" && latest.text !== "") showBubble(latest.text, "say", 6500);
					switch (latest.action) {
						case "happy":
							setFlashHappy(true);
							clearTimeout(flashTimer.current);
							flashTimer.current = setTimeout(() => setFlashHappy(false), 2600);
							playFace("happy", 2200);
							break;
						case "sad": playFace("sad", 2400); break;
						case "surprise": playFace("surprise", 2000); break;
						case "sleep": playFace("sleepy", 3000); break;
						case "kiss": playAct("kiss", 1600); playFace("happy", 2200); break;
						case "hug": playAct("hug", 1800); playFace("shy", 2400); break;
						case "dance": playAct("dance", 2400); playFace("happy", 2600); break;
					}
				}
				const idleMs = typeof petState?.lastActivityAt === "number" ? Date.now() - Math.min(petState.lastActivityAt, Date.now()) : 0;
				const idleNagMinutes = snap.config?.idleNagMinutes ?? 5;
				const mood = petState?.mood ?? "idle";
				if (mood === "idle" && idleMs > idleNagMinutes * 60000 && Date.now() - lastNagAt.current > 90000) {
					lastNagAt.current = Date.now();
					if (speech) showBubble("我闲着呢，有活吗？", "say", 5000);
				}
			}, [snap, showBubble, playAct, playFace]);

			// 闲置小剧场：★2+ 闲置时偷看/wink，★4+ 偶尔自己跳一段
			useEffect(() => {
				const timer = setInterval(() => {
					const s = snapRef.current;
					if (s === null || typeof s !== "object" || document.hidden) return;
					if (s.display?.visible === false) return;
					const stars = s.growth?.hearts ?? 0;
					if (stars < 2) return;
					const pet = s.pet;
					const mood = pet?.mood ?? "idle";
					const idleMs = typeof pet?.lastActivityAt === "number" ? Date.now() - Math.min(pet.lastActivityAt, Date.now()) : 0;
					if (mood !== "idle" || idleMs < 60000) return;
					const t = Date.now();
					if (t - lastSkitsAt.current < 45000) return;
					const r = Math.random();
					if (r < 0.45) return; // 多数时候安静待着
					lastSkitsAt.current = t;
					if (stars >= 4 && r > 0.8) {
						playAct("dance", 2400);
						playFace("happy", 2600);
					} else {
						playFace("wink", 2000);
						if (r > 0.66 && s.config?.speechEnabled !== false) showBubble(pick(IDLE_LOOK_LINES), "say", 3000);
					}
				}, 15000);
				return () => clearInterval(timer);
			}, [playAct, playFace, showBubble]);

			// derive display state every render
			const now = Date.now();
			const petState = snap?.pet;
			const display = snap?.display ?? { visible: true, muted: false, right: 24, bottom: 16 };
			const config = snap?.config ?? { size: 160, bubbleScale: 1, speechEnabled: true, soundsEnabled: true, idleNagMinutes: 5, sleepAfterMinutes: 10 };
			const growth = snap?.growth ?? { level: 1, title: "初来乍到", xp: 0, nextLevelXp: 20, thisLevelXp: 0, hearts: 0, nextHeartAt: 60 };
			const stats = snap?.stats;
			const starHearts = growth.hearts ?? 0; // 好感星级（0-5），解锁互动与挂饰
			const faceName = face !== null && face.until > now ? face.name : "normal";
			const idleMs = typeof petState?.lastActivityAt === "number" ? now - Math.min(petState.lastActivityAt, now) : 0;
			let mood = petState?.mood ?? "idle";
			if (mood !== "approval" && idleMs > (config.sleepAfterMinutes ?? 10) * 60000) mood = "sleep";
			const night = new Date().getHours() < 6;
			const speech = config.speechEnabled !== false;
			const sounds = config.soundsEnabled !== false && display.muted !== true;

			// 星级互动一条龙：上报 → 表情/动作演出 → 台词 →（成功时）爱心特效
			const interact = (kind, opt) => {
				void act(kind).then((body) => {
					const rejected = body?.rejected === true;
					const locked = body?.locked === true;
					if (locked) {
						if (speech) showBubble(LOCKED_HINT, "say", 2600);
						return;
					}
					if (!rejected && opt.act) playAct(opt.act[0], opt.act[1]);
					playFace(rejected ? (opt.rejectFace ?? "sad") : opt.face, rejected ? 1800 : (opt.faceMs ?? 2200));
					if (speech) {
						const lines = rejected && opt.rejectLines ? opt.rejectLines : linesFor(opt.lines, starHearts);
						showBubble(pick(lines), "say", opt.bubbleMs ?? 3400);
					}
					if (!rejected) {
						if (opt.floatHearts) setHearts((prev) => [...prev.slice(-5), Date.now()]);
						if (sounds && opt.chime) chime();
					}
				});
			};

			const onPoke = () => {
				if (drag.current.moved) return;
				if (sounds) squeak();
				void act("poke");
				const r = Math.random();
				if (starHearts >= 2 && r < 0.3) playFace("wink", 1800);
				else if (r < 0.5) playFace("happy", 1600);
				if (speech) showBubble(pick(linesFor(POKE_BANK, starHearts)), "say", 3200);
			};
			const onPet = () => {
				if (drag.current.moved) return;
				void act("pet").then((body) => {
					const rejected = body?.rejected === true;
					if (speech) showBubble(pick(rejected ? PET_REJECT_LINES : linesFor(PET_BANK, starHearts)), "say", 3600);
					playFace(rejected ? "sad" : (starHearts >= 1 ? "shy" : "happy"), rejected ? 1600 : 2400);
					if (!rejected) {
						setHearts((prev) => [...prev.slice(-4), Date.now()]);
						if (sounds) chime();
					}
				});
			};
			const onFeed = () => {
				void act("feed");
				playFace(Math.random() < 0.5 ? "stars" : "happy", 2400);
				if (sounds) chime();
			};
			// 星级解锁的新互动（菜单入口按星级点亮，宿主侧再校验数值门槛）
			const onTickle = () => interact("tickle", { lines: TICKLE_BANK, face: "laugh", act: ["roll", 1800] });
			const onHighfive = () => interact("highfive", { lines: HIGHFIVE_BANK, face: "happy", act: ["nod", 1000], bubbleMs: 2600 });
			const onHug = () => interact("hug", { lines: HUG_BANK, rejectLines: HUG_REJECT_LINES, face: "shy", rejectFace: "sad", faceMs: 2600, act: ["hug", 1800], floatHearts: true, chime: true });
			const onCuddle = () => interact("cuddle", { lines: CUDDLE_BANK, rejectLines: CUDDLE_REJECT_LINES, face: "stars", rejectFace: "sleepy", faceMs: 2800, act: ["cuddle", 2200], floatHearts: true, chime: true, bubbleMs: 3800 });
			const onBedtime = () => interact("bedtime", { lines: BEDTIME_BANK, face: "sleepy", faceMs: 3200 });
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
					// 被拖走松手：惊慌扑腾一下
					playFace("surprise", 1800);
					playAct("flap", 1400);
					const d = snap?.display;
					if (d) void act("move", { right: d.right, bottom: d.bottom });
				}
			};

			if (snap === null) return null;
			if (display.visible === false) {
				return h("button", { className: "wg-restore", title: "显示鲸鱼女孩", onClick: onShow, type: "button" }, "🐳");
			}

			const size = config.size ?? 160;
			const rootClass = `wg-root wg-${mood} wg-h${starHearts}${night ? " wg-night" : ""}${flashHappy ? " wg-flash-happy" : ""}`;

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
					h("div", { className: "wg-titlerow" },
						h("div", null,
							h("b", null, "鲸鱼女孩"), " · Lv.", String(growth.level), " ",
							h("span", { className: "wg-muted" }, growth.title)
						),
						h("span", { className: "wg-bigbadge", title: starHearts >= 1 ? `好感 ★${starHearts}` : "还没点亮好感" },
							starHearts >= 1 ? h(TierBadge, { tier: starHearts }) : h(BubbleBadge)
						)
					),
					h("div", { className: "wg-xp" }, h("i", { style: { width: xpPercent(growth) } })),
					h("div", { className: "wg-muted" }, `经验 ${growth.xp} / ${growth.nextLevelXp}`),
					h("div", { className: "wg-badges" },
						[1, 2, 3, 4, 5].map((tier) => h("span", {
							key: tier,
							className: `wg-badge ${tier <= starHearts ? "wg-on" : "wg-off"}${tier === starHearts ? " wg-latest" : ""}`,
							title: `好感 ★${tier}`,
						}, h(TierBadge, { tier: tier })))
					),
					h("div", { className: "wg-muted" },
						typeof growth.nextHeartAt === "number" ? `好感 ${stats?.affinity ?? 0} / ${growth.nextHeartAt}　下一颗 ❤` : `好感满格 · ${stats?.affinity ?? 0}`),
					turnLine(petState, now)
				)
				: null;

			return h("div", {
				className: rootClass,
				style: { right: `${display.right}px`, bottom: `${display.bottom}px`, "--wg-size": `${size}px` },
			},
				h("div", {
					className: `wg-stage${dragging ? " wg-dragging" : ""}${actAnim !== null ? ` wg-acting wg-act-${actAnim.name}` : ""}`,
					onClick: onPoke,
					onDoubleClick: onPet,
					onContextMenu: onContextMenu,
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
					onMouseEnter: () => setHovering(true),
					onMouseLeave: () => setHovering(false),
					title: "鲸鱼女孩（拖动移动 · 单击戳戳 · 双击摸摸 · 右键互动菜单）",
				},
					h("div", { className: "wg-ring" }),
					h(WhaleSvg, { face: faceName }),
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
							h("button", { type: "button", disabled: starHearts < 1, title: starHearts < 1 ? "好感 ★1 解锁" : undefined, onClick: () => { setMenu(null); onTickle(); } }, "😆 挠痒痒"),
							h("button", { type: "button", disabled: starHearts < 2, title: starHearts < 2 ? "好感 ★2 解锁" : undefined, onClick: () => { setMenu(null); onHighfive(); } }, "🙌 击掌"),
							h("button", { type: "button", disabled: starHearts < 3, title: starHearts < 3 ? "好感 ★3 解锁" : undefined, onClick: () => { setMenu(null); onHug(); } }, "🤗 抱抱"),
							h("button", { type: "button", disabled: starHearts < 5, title: starHearts < 5 ? "好感 ★5 解锁" : undefined, onClick: () => { setMenu(null); onCuddle(); } }, "🫂 贴贴"),
							h("button", { type: "button", onClick: () => { setMenu(null); onBedtime(); } }, "😴 哄睡"),
							h("hr", null),
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
