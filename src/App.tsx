import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BatteryMedium, Camera, Check, ChevronDown, Clock3,
  Cloud, Compass, Footprints, Leaf, Lightbulb, Map, MessageCircleMore, Minus,
  Pencil, Plus, Route, ShieldCheck, Sparkles, Trash2, Upload,
  Users, Volume2, Wind, X,
} from "lucide-react";
import {
  HomeScreen, MapAddScreen, MapEntryScreen, MapScreen, ProfileScreen,
  ResonanceScreen, ResultCardScreen, SplashScreen, WorldReadingScreen,
} from "./ExtendedScreens";
import type { HubTab } from "./ExtendedScreens";

type Step = "splash" | "home" | "world" | "resonance" | "map" | "mapAdd" | "mapEntry" | "profile" | "card" | "input" | "thinking" | "negotiate" | "plan" | "journey" | "adjust" | "reflection" | "done";
type Branch = "noise" | "tired" | "continue";
type InputState = { energy: number; time: number; social: "独处" | "轻微接触" | "开放交流"; action: "散步" | "坐一会" | "寻找灵感"; description: string };
type WeatherData = {
  ok: true;
  area: { province: string; city: string; adcode: string };
  humidity: string;
  reportTime: string;
  source: string;
  temperature: string;
  weather: string;
  windDirection: string;
  windPower: string;
};
type RouteStop = {
  id: string;
  name: string;
  address: string;
  category: string;
  sequence: number;
  distanceMeters: number;
  suggestedAction: string;
  suggestedStayMinutes: number;
  fieldVerified: boolean;
};
type RouteData = {
  ok: true;
  routeStatus: string;
  source: string;
  origin: { id: string; name: string; location: { longitude: number; latitude: number } };
  stops: RouteStop[];
  legs: Array<{
    from: string;
    to: string;
    distanceMeters: number;
    durationSeconds: number;
    instructions: Array<{ instruction: string; road: string; distanceMeters: number }>;
  }>;
  summary: {
    walkingDistanceMeters: number;
    walkingDurationMinutes: number;
    suggestedStayMinutes: number;
    flexiblePauseMinutes: number;
    estimatedTotalMinutes: number;
    requestedMinutes: number;
  };
  fitExplanation: string[];
};

const YUBAI_API_BASE = (import.meta.env.VITE_YUBAI_API_BASE || "https://yubai-api-nuoztsegcf.cn-shenzhen.fcapp.run").replace(/\/$/, "");

const adjustments = {
  noise: {
    title: "为你换一条更安静的路",
    body: "已跳过前方商业街。接下来改走人流较少的住宅背街，预计增加 4 分钟。",
    notice: "已避开商业街，感知任务调整为观察光影",
    rows: [["路线", "商业街", "住宅背街"], ["环境", "中高人流", "低人流"], ["感知任务", "收集城市声音", "观察缓慢变化的光影"], ["时长", "32 分钟", "36 分钟"]],
  },
  tired: {
    title: "让余下的路轻一点",
    body: "已移除最远的街角节点，下一站改为附近可以坐下的树荫处。",
    notice: "已缩短路线，下一站可以坐下休息",
    rows: [["路线", "继续步行 12 分钟", "就近停留"], ["环境", "持续移动", "有座位的树荫"], ["感知任务", "拍下一处空间", "安静坐一会儿"], ["时长", "32 分钟", "23 分钟"]],
  },
  continue: {
    title: "在余白里再多走一点",
    body: "前方林荫路段状态平稳，已增加一个 7 分钟的可选节点。",
    notice: "已加入一段可选的林荫路探索",
    rows: [["路线", "在街角折返", "继续进入林荫路"], ["环境", "住宅背街", "低人流林荫路"], ["感知任务", "观察光影", "寻找两种自然颜色"], ["时长", "32 分钟", "39 分钟"]],
  },
} satisfies Record<Branch, { title: string; body: string; notice: string; rows: string[][] }>;

const negotiationOptions = ["理解得很准确", "我想再安静一些", "我其实想接触一点人", "不想走太远", "更需要获得灵感"];

const stepProgress: Record<Step, { value: number; label: string }> = {
  splash: { value: 0, label: "启动" },
  home: { value: 0, label: "首页" },
  world: { value: 18, label: "AI 读取城市" },
  resonance: { value: 0, label: "城市共鸣池" },
  map: { value: 0, label: "余白地图" },
  mapAdd: { value: 0, label: "添加余白地点" },
  mapEntry: { value: 0, label: "余白地点详情" },
  profile: { value: 0, label: "内在之海" },
  card: { value: 100, label: "今日余白卡" },
  input: { value: 12, label: "描述此刻" },
  thinking: { value: 20, label: "AI 正在理解" },
  negotiate: { value: 30, label: "状态协商" },
  plan: { value: 46, label: "生成漫游" },
  journey: { value: 62, label: "途中感知" },
  adjust: { value: 72, label: "动态调整" },
  reflection: { value: 88, label: "结束共创" },
  done: { value: 100, label: "完成" },
};

function Header({ title = "余白", back }: { title?: string; back?: () => void }) {
  return <header className="topbar"><button onClick={back} aria-label={back ? "返回" : "余白"} disabled={!back}>{back ? <ArrowLeft /> : <Leaf />}</button><span>{title}</span><i className="topbar-spacer" aria-hidden="true" /></header>;
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button className="primary-button" onClick={onClick}><span>{children}</span><ArrowRight /></button>;
}

function InputScreen({ value, setValue, next }: { value: InputState; setValue: (v: InputState) => void; next: () => void }) {
  const actions = [["散步", "想走一走，但不太累", Footprints], ["坐一会", "更想找个地方停留", Wind], ["寻找灵感", "想被城市轻轻触发", Lightbulb]] as const;
  return <section className="screen scroll-screen"><Header /><main className="page input-page">
    <div className="eyebrow"><Sparkles />出发前的轻轻一问</div><h1>此刻的你，<br />需要怎样的余白？</h1><p className="lead">没有正确答案，只要尽量接近此刻。</p>
    <section className="form-card energy-card"><div className="form-row"><span><BatteryMedium />当前能量</span><b>{value.energy}%</b></div><input aria-label="当前能量" type="range" min="10" max="100" step="10" value={value.energy} onChange={e => setValue({ ...value, energy: +e.target.value })} /><small><span>需要照顾</span><span>很有余力</span></small></section>
    <section className="form-card time-card"><div className="form-row"><span><Clock3 />可用时间</span><div className="stepper"><button onClick={() => setValue({ ...value, time: Math.max(20, value.time - 5) })}><Minus /></button><b>{value.time}</b><button onClick={() => setValue({ ...value, time: Math.min(90, value.time + 5) })}><Plus /></button></div></div></section>
    <section className="form-card"><label><Users />今天的社交边界</label><div className="pill-row">{(["独处", "轻微接触", "开放交流"] as const).map(x => <button key={x} className={value.social === x ? "active" : ""} onClick={() => setValue({ ...value, social: x })}>{value.social === x && <Check />}{x}</button>)}</div></section>
    <section className="form-card"><label><Footprints />行动倾向</label><div className="choice-list">{actions.map(([name, text, Icon]) => <button key={name} className={value.action === name ? "selected" : ""} onClick={() => setValue({ ...value, action: name })}><Icon /><span><b>{name}</b><small>{text}</small></span><i>{value.action === name && <Check />}</i></button>)}</div></section>
    <section className="form-card"><label><MessageCircleMore />还有什么想告诉我？</label><textarea value={value.description} onChange={e => setValue({ ...value, description: e.target.value })} placeholder="比如：脑子很乱，一直待在宿舍更难受……" /></section>
    <div className="input-privacy"><ShieldCheck />这些状态只用于生成本次漫游，你仍可在下一步修正。</div>
    <PrimaryButton onClick={next}>让“余白”理解我</PrimaryButton>
  </main></section>;
}

function ThinkingScreen({ input, next }: { input: InputState; next: () => void }) {
  useEffect(() => { const t = window.setTimeout(next, 1500); return () => clearTimeout(t); }, [next]);
  return <section className="screen thinking-screen" aria-live="polite"><div className="thinking-orbit"><i /><i /><span><Sparkles /></span><em>能量 · {input.energy}%</em><em>{input.social}边界</em><em>{input.time} 分钟</em></div><main><h2>正在整理此刻的你</h2><p>把能量、时间、社交边界和行动倾向放在一起理解</p><div><span /><span /><span /></div></main></section>;
}

function NegotiationScreen({ input, selected, setSelected, custom, setCustom, next, back }: { input: InputState; selected: string; setSelected: (v: string) => void; custom: string; setCustom: (v: string) => void; next: () => void; back: () => void }) {
  const negotiation = useMemo(() => {
    if (selected === "我想再安静一些") return { text: "极低刺激、短时间离开室内，以及几乎不需要交流的自然接触。", tags: ["极低刺激", "避开主路", "轻微移动", "无需交流"], avoid: "我会避开主路、商业场所、突然出现的声音和需要完成任务的地点。" };
    if (selected === "我其实想接触一点人") return { text: "低压力的轻微移动，以及能看见他人、但不必主动交流的环境。", tags: ["轻微接触", "可随时退出", "缓慢移动", "保持距离"], avoid: "我会避开必须社交、持续对话和过度拥挤的场所。" };
    if (selected === "不想走太远") return { text: "在很短的移动半径里换一口气，并保留随时返回室内的余地。", tags: ["近距离", "容易返回", "低强度", "短暂停留"], avoid: "我会避开远距离路线、复杂转向和需要赶时间的节点。" };
    if (selected === "更需要获得灵感") return { text: "低压力地离开室内，同时接触一点光影、颜色和城市细节。", tags: ["温和刺激", "观察细节", "寻找灵感", "无需产出"], avoid: "我会避开强迫产出、打卡和需要立刻形成结论的任务。" };
    return { text: `${input.energy <= 40 ? "低刺激" : "适度刺激"}、短时间离开室内、轻微移动，以及${input.social === "独处" ? "不需要交流" : "低压力接触"}的自然体验。`, tags: [input.energy <= 40 ? "低刺激" : "适度刺激", `${input.time} 分钟内`, input.action, input.social], avoid: "我会避开拥挤、消费和需要完成任务的场所。" };
  }, [input, selected]);
  const negotiatedText = custom.trim() ? `${negotiation.text} 同时优先考虑：${custom.trim()}` : negotiation.text;
  return <section className="screen scroll-screen"><Header title="状态协商" back={back} /><main className="page negotiate-page"><div className="step-label"><b>01</b>先对齐，再出发</div><h1>我先试着理解你</h1><p className="lead">你可以修正我，这里没有“绝对性的正确”。</p>
    <section className="ai-quote" aria-live="polite"><div><Sparkles />余白 AI 的理解</div><p>我理解你今天需要的是：</p><h2>{negotiatedText}</h2><div className="need-tags">{negotiation.tags.map(tag => <span key={tag}>{tag}</span>)}</div><small><X />{negotiation.avoid}</small></section>
    <section className="negotiation-options"><h3>这个理解离你有多近？</h3>{negotiationOptions.map(x => <button key={x} className={selected === x ? "selected" : ""} aria-pressed={selected === x} onClick={() => setSelected(x)}><span>{x}</span>{selected === x ? <Check /> : <ArrowRight />}</button>)}<label className={custom.trim() ? "has-value" : ""}><input value={custom} onChange={e => setCustom(e.target.value)} placeholder="自定义补充……" /><Pencil /></label>{custom.trim() && <small className="live-correction"><Check />已加入本次状态理解</small>}</section>
    <div className="coedit-note"><Sparkles />你的修正只作用于本次漫游，除非你在结束时选择保留。</div><PrimaryButton onClick={next}>这个理解可以继续</PrimaryButton>
  </main></section>;
}

const fallbackRouteNodes = [["8 分钟", "沿安静街道慢慢走", "不必抵达哪里，只关注脚步从室内节奏里松开。", Footprints], ["10 分钟", "找一处正在变化的东西", "可能是风吹过的叶片，也可能是墙面移动的光。", Wind], ["12 分钟", "留下“有呼吸感”的空间", "拍下来，或只用眼睛记住它，都可以。", Camera]] as const;

function routeIcon(category: string) {
  if (category === "自然空间") return Leaf;
  if (category === "阅读空间") return Map;
  if (category === "公共空间") return Compass;
  if (category === "停留空间") return Wind;
  return Sparkles;
}

function PlanScreen({ input, next, back }: { input: InputState; next: () => void; back: () => void }) {
  const [open, setOpen] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeStatus, setRouteStatus] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    fetch(`${YUBAI_API_BASE}/weather`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || data.ok !== true) throw new Error("weather unavailable");
        return data as WeatherData;
      })
      .then(data => {
        setWeather(data);
        setWeatherStatus("live");
      })
      .catch(() => setWeatherStatus("fallback"))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    const social = input.social === "独处" ? "low" : input.social === "轻微接触" ? "medium" : "high";
    const query = new URLSearchParams({
      energy: String(input.energy),
      minutes: String(input.time),
      social,
    });

    setRouteStatus("loading");
    fetch(`${YUBAI_API_BASE}/route?${query}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || data.ok !== true) throw new Error("route unavailable");
        return data as RouteData;
      })
      .then(data => {
        setRoute(data);
        setRouteStatus("live");
      })
      .catch(() => {
        setRoute(null);
        setRouteStatus("fallback");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [input.energy, input.social, input.time]);

  const duration = routeStatus === "live" && route ? route.summary.estimatedTotalMinutes : Math.min(32, Math.max(18, input.time - 5));
  const intensity = input.energy <= 40 ? "低强度" : input.energy <= 70 ? "中低强度" : "适度探索";
  const temperature = Number(weather?.temperature);
  const humidity = Number(weather?.humidity);
  const hasRain = Boolean(weather && /雨|雪|雷/.test(weather.weather));
  const weatherGuidance = weatherStatus === "live"
    ? hasRain
      ? "当前可能有降水，优先选择有遮蔽、容易返回的节点"
      : temperature >= 32
        ? "当前气温较高，优先选择树荫并减少连续步行"
        : humidity >= 85
          ? "当前湿度较高，降低步速并保留随时停下的余地"
          : "当前环境适合短时、低强度的户外停留"
    : "天气暂未连通，路线仍按低强度与容易返回生成";
  const reportTime = weather?.reportTime?.split(" ")[1]?.slice(0, 5);
  const socialExposure = input.social === "独处" ? "很低" : input.social === "轻微接触" ? "较低" : "可接触";
  const planNodes = routeStatus === "live" && route
    ? route.stops.map((stop, index) => {
      const leg = route.legs[index];
      const walkingMinutes = Math.max(1, Math.round((leg?.durationSeconds || 0) / 60));
      return {
        time: `步行 ${walkingMinutes} 分钟 · 停留 ${stop.suggestedStayMinutes} 分钟`,
        title: stop.name,
        text: stop.suggestedAction,
        Icon: routeIcon(stop.category),
        evidence: `${stop.category} · 高德真实地点${stop.fieldVerified ? " · 已实地核验" : " · 待实地核验"}`,
      };
    })
    : fallbackRouteNodes.map(([time, title, text, Icon]) => ({ time, title, text, Icon, evidence: "演示节点" }));
  const routeEvidence = routeStatus === "live" && route
    ? `高德步行规划 · ${(route.summary.walkingDistanceMeters / 1000).toFixed(2)} 公里 · 步行 ${route.summary.walkingDurationMinutes} 分钟`
    : routeStatus === "loading"
      ? "正在计算真实步行路线…"
      : "路线接口暂不可用，当前展示安全演示方案";
  return <section className="screen scroll-screen"><Header title="今日漫游" back={back} /><main className="page plan-page"><div className={`weather weather-${weatherStatus}`}><span><Cloud />{weatherStatus === "loading" ? "正在感知城市环境…" : weatherStatus === "live" ? `${weather?.weather} · ${weather?.temperature}℃` : "环境数据暂不可用"}</span><span><Map />{weatherStatus === "live" ? `高德实时数据${reportTime ? ` · ${reportTime}` : ""}` : weatherStatus === "loading" ? "南山区" : "已启用安全回退"}</span></div>{weatherStatus === "live" && weather && <div className="weather-context" aria-label="实时环境信息"><span>湿度 {weather.humidity}%</span><span>{weather.windDirection}风 {weather.windPower}级</span><span>{weather.area.city}</span></div>}<div className="eyebrow"><Sparkles />AI 生成漫游主题</div><h1>让密集的思绪<br />出现一点间隙</h1><p className="lead">今天不需要去很多地方，只需要一个不会催促你的外界。</p><div className="theme-tags"><span>{input.social}</span><span>{input.action}</span><span>真实步行路线</span><span>可随时跳过</span></div>
    <section className="plan-summary" aria-label="路线概览"><div><small>预计时长</small><b>{duration} 分钟</b></div><div><small>移动强度</small><b>{intensity}</b></div><div><small>社交暴露</small><b>{socialExposure}</b></div></section>
    <div className={`route-evidence route-evidence-${routeStatus}`} role="status"><Route />{routeEvidence}</div>
    <section className="reason-card"><button aria-expanded={open} onClick={() => setOpen(!open)}><span><Sparkles />AI 为什么生成这条路线</span><ChevronDown className={open ? "open" : ""} /></button>{open && <div><p>基于你 <b>{input.energy}% 的能量</b>、<b>{input.time} 分钟</b>可用时间和今天“{input.social}”的边界，我优先考虑恢复呼吸感，而不是追求新刺激。</p><ul>{routeStatus === "live" && route ? route.fitExplanation.map(reason => <li key={reason}>{reason}</li>) : <><li>能量状态：控制步行距离和任务数量</li><li>社交边界：避开商业街与高人流区域</li><li>行动倾向：以“{input.action}”作为路线节奏</li><li>城市环境：{weatherGuidance}</li></>}</ul></div>}</section>
    <section className="route-list"><header><span>{routeStatus === "live" ? `${planNodes.length} 个真实地点节点` : `${planNodes.length} 个漫游节点`}</span><small>约 {duration} 分钟</small></header>{planNodes.map(({ time, title, text, Icon, evidence }, i) => <article key={`${title}-${i}`} style={{ "--delay": `${i * 70}ms` } as React.CSSProperties}><i><Icon /></i><div><small>0{i + 1} · {time}</small><h3>{title}</h3><p>{text}</p><em>{evidence}</em></div></article>)}</section><div className="safety-note"><ShieldCheck />地点体验仍需实地核验；你可以随时跳过节点或提前结束。</div><PrimaryButton onClick={next}>准备好，一起出发</PrimaryButton>
  </main></section>;
}

function JourneyScreen({ feedback, finish, notice, node, advance }: { feedback: () => void; finish: () => void; notice: string; node: number; advance: () => void }) {
  const stateClass = (index: number) => index < node ? "done" : index === node ? "active" : "";
  return <section className="screen scroll-screen journey-screen"><Header title="感知路径" /><main className="page journey-page"><div className="journey-status"><i /><span>余白正在陪你漫游</span><b>{node}/3 · {node === 2 ? "12" : "24"} 分钟</b></div>{notice && <div className="journey-notice" role="status"><Check />{notice}</div>}<h1>跟随这些节点，<br />重新连接环境的纹理。</h1><p className="lead">没有完成度，也没有标准答案；任何节点都可以跳过。</p>
    <section className="journey-timeline"><article className={stateClass(1)}><i>{node > 1 ? <Check /> : 1}</i><div><small>{node > 1 ? "完成" : "现在"}</small><h3>断开屏幕</h3><p>走出住所，让眼睛重新适应远处。</p></div></article><article className={stateClass(2)}><i>{node > 2 ? <Check /> : 2}</i><div><small>{node > 2 ? "完成" : node === 2 ? "现在" : "下一步"}</small><h3>触碰自然</h3><p>{notice.includes("光影") ? "观察一处缓慢变化的光影。" : notice.includes("休息") ? "在附近有座位的树荫下停留。" : "听风的声音，观察地面上的光。"}</p>{node === 2 && <span><Sparkles />此节点保持低刺激，不要求与人互动</span>}</div></article><article className={stateClass(3)}><i>3</i><div><small>{node === 3 ? "现在" : "下一步"}</small><h3>{notice.includes("林荫") ? "继续进入林荫路" : "留下一处空间"}</h3><p>{notice.includes("林荫") ? "寻找两种同时出现的自然颜色。" : "拍下一处让你感觉有呼吸感的空间。"}</p>{node === 3 && <span><Sparkles />可以拍下来，也可以只记住它</span>}</div></article></section><button className="finish-button" onClick={node < 3 ? advance : finish}>{node < 3 ? "完成当前节点" : "完成本次感知"}</button><button className="feedback-button" onClick={feedback}><Sparkles />此刻感觉怎么样？</button>
  </main></section>;
}

function FeedbackSheet({ close, choose, finish }: { close: () => void; choose: (b: Branch) => void; finish: () => void }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && close(); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [close]);
  return <div className="sheet-mask" onClick={close}><section className="feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onClick={e => e.stopPropagation()}><i className="handle" /><button className="sheet-close" onClick={close} aria-label="关闭反馈"><X /></button><h2 id="feedback-title">此刻感觉怎么样？</h2><p>你的反馈会立刻改变接下来的路线。</p><div>{([[Volume2, "这里太吵", "调整路线与任务", "noise", true], [BatteryMedium, "有点累了", "缩短剩余路程", "tired", true], [Minus, "没什么感觉", "即将开放", "static", false], [Compass, "想继续探索", "增加可选节点", "continue", true], [Users, "想接触一点人", "即将开放", "static", false], [X, "提前结束", "进入结束共创", "finish", true]] as const).map(([Icon, title, sub, action, enabled]) => <button key={title} disabled={!enabled} className={!enabled ? "option-disabled" : ""} onClick={() => action === "finish" ? finish() : choose(action as Branch)}><Icon /><b>{title}</b><span>{sub}</span></button>)}</div></section></div>;
}

function AdjustmentScreen({ branch, accept, modify }: { branch: Branch; accept: () => void; modify: () => void }) {
  const data = adjustments[branch];
  return <section className="screen scroll-screen adjustment-screen"><Header title="动态调整" back={modify} /><main className="page adjustment-page"><div className="adjust-route"><i><Route /></i><span /><i><Leaf /></i></div><div className="eyebrow"><Sparkles />已根据你的反馈重新计算</div><h1>{data.title}</h1><p>{data.body}</p><section className="comparison"><header><span>调整内容</span><span>原方案</span><span>新方案</span></header>{data.rows.map(r => <div key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><strong>{r[2]}</strong></div>)}</section><aside><Sparkles /><div><b>AI 调整依据</b><p>你的即时感受优先于原计划。新路线更符合此刻的能量、社交边界与可用时间。</p></div></aside><PrimaryButton onClick={accept}>继续漫游</PrimaryButton><button className="text-button" onClick={modify}>继续修改</button></main></section>;
}

function Toggle({ label, detail, value, change }: { label: string; detail: string; value: boolean; change: () => void }) {
  return <button className="toggle-row" onClick={change}><span><b>{label}</b><small>{detail}</small></span><i className={value ? "on" : ""}><em /></i></button>;
}

function ReflectionScreen({ done }: { done: (saved: boolean, keyword: string) => void }) {
  const [image, setImage] = useState(""); const [caption, setCaption] = useState(""); const [keyword, setKeyword] = useState("松动"); const [inference, setInference] = useState(true); const [summary, setSummary] = useState("今天你选择了一条低刺激的路径，让密集的思绪在脚步与光影之间慢慢松开。"); const [location, setLocation] = useState(false); const [map, setMap] = useState(true); const [memory, setMemory] = useState(false); const ref = useRef<HTMLInputElement>(null);
  const upload = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); };
  return <section className="screen scroll-screen"><Header title="今日余白" /><main className="page reflection-page"><div className="step-label"><b>06</b>与 AI 一起整理，而不是被总结</div><h1>留下你愿意留下的</h1><p className="lead">所有内容都可以修改、删除，或不保存。</p><button className="photo-upload" onClick={() => ref.current?.click()}>{image ? <img src={image} alt="上传的漫游照片" /> : <><div className="blur-photo" /><Upload /><b>上传一张漫游照片</b><span>点击选择，也可以跳过</span></>}<input ref={ref} type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} hidden /></button>{image && <div className="photo-insight"><Sparkles /><span><b>AI 建议保留</b>这张照片与你停留最久的感知节点有关；你仍可移除它。</span></div>}<label className="field-label">你想说的一句话 <small>可选</small><textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="这面墙上的树影让我停了一会儿。" /></label><div className="ai-draft"><Sparkles />AI 草稿 · 等待你共同编辑</div><section className="coedit-card"><div><small>今日关键词</small><input aria-label="今日关键词" value={keyword} onChange={e => setKeyword(e.target.value)} /></div><Pencil /></section>{inference && <section className="coedit-card inference"><div><small>AI 观察 <i>推断</i></small><p>你在低人流空间停留得更久。</p></div><button onClick={() => setInference(false)}><Trash2 />删除推断</button></section>}<section className="summary-card"><header><span>今日总结</span><small><Pencil />可编辑</small></header><textarea aria-label="今日总结" value={summary} onChange={e => setSummary(e.target.value)} placeholder="写下你愿意保留的部分……" /></section><div className="coedit-control"><ShieldCheck />AI 只提供草稿，最终版本和保存范围始终由你决定。</div><section className="privacy"><h3><ShieldCheck />由你决定保存范围</h3><Toggle label="保存具体位置" detail="默认关闭，不记录路线坐标" value={location} change={() => setLocation(!location)} /><Toggle label="加入个人精神地图" detail="只保存这次共创的内容" value={map} change={() => setMap(!map)} /><Toggle label="进入长期记忆" detail="用于未来漫游建议，默认关闭" value={memory} change={() => setMemory(!memory)} /></section><PrimaryButton onClick={() => done(true, keyword || "未命名")}>按我的选择保存</PrimaryButton><button className="text-button" onClick={() => done(false, keyword || "未命名")}>不保存，直接结束</button></main></section>;
}

function DoneScreen({ restart, viewCard, saved, keyword }: { restart: () => void; viewCard: () => void; saved: boolean; keyword: string }) {
  return <section className="screen done-screen"><button className="done-close" onClick={restart} aria-label="返回首页"><X /></button><div className="done-orbit"><i /><i /><span>{saved ? <Leaf /> : <Check />}</span></div><main><div className="eyebrow"><Sparkles />{saved ? "今日关键词" : "本次漫游已完成"}</div><h1>{saved ? keyword : "已放下"}</h1><p>{saved ? "你和城市之间，多出了一点可以呼吸的距离。" : "内容没有被保存，但此刻的感受仍然属于你。"}</p><span><Check />{saved ? "已按照你的选择保存" : "未写入位置、精神地图或长期记忆"}</span></main><div className="done-actions"><PrimaryButton onClick={viewCard}>查看今日余白卡</PrimaryButton><button className="text-button" onClick={restart}>返回首页</button></div></section>;
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []); const requested = params.get("screen");
  const valid: Step[] = ["splash", "home", "world", "resonance", "map", "mapAdd", "mapEntry", "profile", "card", "input", "thinking", "negotiate", "plan", "journey", "adjust", "reflection", "done"];
  const initialStep: Step = requested === "feedback" ? "journey" : valid.includes(requested as Step) ? requested as Step : "splash";
  const [step, setStep] = useState<Step>(initialStep); const [sheet, setSheet] = useState(requested === "feedback"); const [branch, setBranch] = useState<Branch>("noise"); const [notice, setNotice] = useState(""); const [journeyNode, setJourneyNode] = useState(2); const [result, setResult] = useState({ saved: true, keyword: "松动" }); const [mapSaved, setMapSaved] = useState(false);
  const [input, setInput] = useState<InputState>({ energy: 30, time: 40, social: "独处", action: "散步", description: "脑子很乱，一直待在宿舍更难受" }); const [selected, setSelected] = useState("理解得很准确"); const [custom, setCustom] = useState("");
  const choose = (b: Branch) => { setBranch(b); setSheet(false); setStep("adjust"); };
  const restart = () => { setStep("home"); setSheet(false); setNotice(""); setJourneyNode(2); setSelected("理解得很准确"); setCustom(""); };
  const navigateHub = (tab: HubTab) => setStep(tab);
  const beginJourney = (action: InputState["action"]) => { setInput({ ...input, action }); setStep("input"); };
  const progress = stepProgress[step];
  return <div className="app-stage"><div className="desktop-caption"><Leaf /><span>余白 · 完整交互演示</span></div><div className="device-frame" aria-label="手机交互演示框架"><span className="device-speaker" aria-hidden="true"><i /></span><i className="device-button device-button-silent" aria-hidden="true" /><i className="device-button device-button-volume-up" aria-hidden="true" /><i className="device-button device-button-volume-down" aria-hidden="true" /><i className="device-button device-button-power" aria-hidden="true" /><div className="phone-shell"><div className={`progress-line ${progress.value === 0 ? "is-hidden" : ""}`} role="progressbar" aria-label={`当前进度：${progress.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value}><i style={{ width: `${progress.value}%` }} /></div>
    {step === "splash" && <SplashScreen start={() => setStep("home")} />}
    {step === "home" && <HomeScreen start={beginJourney} readWorld={() => setStep("world")} navigate={navigateHub} />}
    {step === "world" && <WorldReadingScreen next={() => setStep("resonance")} />}
    {step === "resonance" && <ResonanceScreen navigate={navigateHub} />}
    {step === "map" && <MapScreen navigate={navigateHub} add={() => setStep("mapAdd")} openEntry={() => setStep("mapEntry")} saved={mapSaved} />}
    {step === "mapAdd" && <MapAddScreen back={() => setStep("map")} save={() => { setMapSaved(true); setStep("map"); }} />}
    {step === "mapEntry" && <MapEntryScreen back={() => setStep("map")} />}
    {step === "profile" && <ProfileScreen navigate={navigateHub} />}
    {step === "card" && <ResultCardScreen saveToMap={() => { setMapSaved(true); setStep("map"); }} sendToPool={() => setStep("resonance")} navigate={navigateHub} />}
    {step === "input" && <InputScreen value={input} setValue={setInput} next={() => setStep("thinking")} />}{step === "thinking" && <ThinkingScreen input={input} next={() => setStep("negotiate")} />}{step === "negotiate" && <NegotiationScreen input={input} selected={selected} setSelected={setSelected} custom={custom} setCustom={setCustom} next={() => setStep("plan")} back={() => setStep("input")} />}{step === "plan" && <PlanScreen input={input} next={() => setStep("journey")} back={() => setStep("negotiate")} />}{step === "journey" && <JourneyScreen feedback={() => setSheet(true)} finish={() => setStep("reflection")} notice={notice} node={journeyNode} advance={() => setJourneyNode(Math.min(3, journeyNode + 1))} />}{step === "adjust" && <AdjustmentScreen branch={branch} accept={() => { setNotice(adjustments[branch].notice); setStep("journey"); }} modify={() => { setStep("journey"); window.setTimeout(() => setSheet(true), 0); }} />}{step === "reflection" && <ReflectionScreen done={(saved, keyword) => { setResult({ saved, keyword }); setStep("done"); }} />}{step === "done" && <DoneScreen restart={restart} viewCard={() => setStep("card")} saved={result.saved} keyword={result.keyword} />}{sheet && <FeedbackSheet close={() => setSheet(false)} choose={choose} finish={() => { setSheet(false); setStep("reflection"); }} />}
  </div><span className="device-home" aria-hidden="true" /></div></div>;
}
