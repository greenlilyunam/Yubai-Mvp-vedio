import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BatteryMedium, Camera, Check, ChevronDown, Clock3,
  Cloud, Compass, Footprints, Leaf, Lightbulb, Map, MessageCircleMore, Minus,
  Mic, Pencil, Plus, Route, ShieldCheck, Sparkles, Trash2, Upload,
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
type JourneyMoment = { stopId: string; stopName: string; photo: string; audio: string; note: string };
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
  location: { longitude: number; latitude: number };
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
type RoutePreference = "balanced" | "calm" | "sheltered" | "inspiration" | "social";
type InterpretationData = {
  ok: true;
  source: string;
  model: string;
  interpretation: {
    summary: string;
    needs: string[];
    avoid: string[];
    routePreference: RoutePreference;
    confidence: string;
    boundaryNotice: string;
  };
  privacy: {
    sentFields: string[];
    excludedFields: string[];
    storedByYubai: boolean;
  };
  humanControl: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};

const YUBAI_API_BASE = (import.meta.env.VITE_YUBAI_API_BASE || "https://yubai-api-nuoztsegcf.cn-shenzhen.fcapp.run").replace(/\/$/, "");

function requestInterpretation(input: InputState, signal: AbortSignal) {
  return fetch(`${YUBAI_API_BASE}/interpret`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // text/plain is CORS-safelisted and avoids an unreliable FC preflight.
      // The payload remains JSON and the server validates the same four fields.
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify({
      energy: input.energy,
      minutes: input.time,
      social: input.social,
      action: input.action,
    }),
    signal,
  }).then(async response => {
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.message || `百炼接口请求失败（HTTP ${response.status}）`);
    }
    return data as InterpretationData;
  });
}

function requestRoute(input: InputState, signal: AbortSignal, preference: RoutePreference = "balanced") {
  const social = input.social === "独处" ? "low" : input.social === "轻微接触" ? "medium" : "high";
  const query = new URLSearchParams({
    energy: String(input.energy),
    minutes: String(input.time),
    social,
    preference,
  });
  return fetch(`${YUBAI_API_BASE}/route?${query}`, {
    headers: { Accept: "application/json" },
    signal,
  }).then(async response => {
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error("route unavailable");
    return data as RouteData;
  });
}

function amapNavigationUrl(route: RouteData, stopIndex: number) {
  const from = stopIndex === 0 ? route.origin : route.stops[stopIndex - 1];
  const to = route.stops[stopIndex];
  const query = new URLSearchParams({
    from: `${from.location.longitude},${from.location.latitude},${from.name}`,
    to: `${to.location.longitude},${to.location.latitude},${to.name}`,
    mode: "walk",
    src: "yubai-mvp",
    callnative: "0",
  });
  return `https://uri.amap.com/navigation?${query}`;
}

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

function preferenceFromNegotiation(selected: string): RoutePreference | null {
  if (selected === "我想再安静一些") return "calm";
  if (selected === "我其实想接触一点人") return "social";
  if (selected === "更需要获得灵感") return "inspiration";
  return null;
}

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

function NegotiationScreen({ input, selected, setSelected, custom, setCustom, next, back, interpretation, interpretationStatus, interpretationError }: { input: InputState; selected: string; setSelected: (v: string) => void; custom: string; setCustom: (v: string) => void; next: () => void; back: () => void; interpretation: InterpretationData | null; interpretationStatus: "loading" | "live" | "fallback"; interpretationError: string }) {
  const negotiation = useMemo(() => {
    if (selected === "我想再安静一些") return { text: "极低刺激、短时间离开室内，以及几乎不需要交流的自然接触。", tags: ["极低刺激", "避开主路", "轻微移动", "无需交流"], avoid: "我会避开主路、商业场所、突然出现的声音和需要完成任务的地点。" };
    if (selected === "我其实想接触一点人") return { text: "低压力的轻微移动，以及能看见他人、但不必主动交流的环境。", tags: ["轻微接触", "可随时退出", "缓慢移动", "保持距离"], avoid: "我会避开必须社交、持续对话和过度拥挤的场所。" };
    if (selected === "不想走太远") return { text: "在很短的移动半径里换一口气，并保留随时返回室内的余地。", tags: ["近距离", "容易返回", "低强度", "短暂停留"], avoid: "我会避开远距离路线、复杂转向和需要赶时间的节点。" };
    if (selected === "更需要获得灵感") return { text: "低压力地离开室内，同时接触一点光影、颜色和城市细节。", tags: ["温和刺激", "观察细节", "寻找灵感", "无需产出"], avoid: "我会避开强迫产出、打卡和需要立刻形成结论的任务。" };
    if (interpretationStatus === "live" && interpretation) return { text: interpretation.interpretation.summary, tags: interpretation.interpretation.needs, avoid: interpretation.interpretation.avoid.length ? `我会尽量避开：${interpretation.interpretation.avoid.join("、")}。` : interpretation.interpretation.boundaryNotice };
    return { text: `${input.energy <= 40 ? "低刺激" : "适度刺激"}、短时间离开室内、轻微移动，以及${input.social === "独处" ? "不需要交流" : "低压力接触"}的自然体验。`, tags: [input.energy <= 40 ? "低刺激" : "适度刺激", `${input.time} 分钟内`, input.action, input.social], avoid: "我会避开拥挤、消费和需要完成任务的场所。" };
  }, [input, interpretation, interpretationStatus, selected]);
  const negotiatedText = custom.trim() ? `${negotiation.text} 同时优先考虑：${custom.trim()}` : negotiation.text;
  return <section className="screen scroll-screen"><Header title="状态协商" back={back} /><main className="page negotiate-page"><div className="step-label"><b>01</b>先对齐，再出发</div><h1>我先试着理解你</h1><p className="lead">你可以修正我，这里没有“绝对性的正确”。</p>
    <section className="ai-quote" aria-live="polite"><div><Sparkles /><span>{interpretationStatus === "live" && interpretation ? `百炼 ${interpretation.model} · 初步理解` : interpretationStatus === "loading" ? "百炼正在理解 · 可先修正" : "本地安全理解"}{interpretationStatus === "fallback" && <small className="ai-error-reason">{interpretationError || "百炼暂不可用"}</small>}</span></div><p>我理解你今天需要的是：</p><h2>{negotiatedText}</h2><div className="need-tags">{negotiation.tags.map(tag => <span key={tag}>{tag}</span>)}</div><small><X />{negotiation.avoid}</small></section>
    <section className="negotiation-options"><h3>这个理解离你有多近？</h3>{negotiationOptions.map(x => <button key={x} className={selected === x ? "selected" : ""} aria-pressed={selected === x} onClick={() => setSelected(x)}><span>{x}</span>{selected === x ? <Check /> : <ArrowRight />}</button>)}<label className={custom.trim() ? "has-value" : ""}><input value={custom} onChange={e => setCustom(e.target.value)} placeholder="自定义补充……" /><Pencil /></label>{custom.trim() && <small className="live-correction"><Check />已加入本次状态理解</small>}</section>
    <div className="coedit-note"><ShieldCheck />百炼只接收能量、时间、社交和行动；自定义文字不发送。预设修正会在本地改变路线偏好。</div><PrimaryButton onClick={next}>这个理解可以继续</PrimaryButton>
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

function displayPlaceName(name: string) {
  if (name.includes("平山公园")) return "平山公园";
  return name.replace("(桃源分馆)", "·桃源分馆");
}

function PlanScreen({ input, next, back, onRouteLoaded, initialInterpretation, selectedNegotiation }: { input: InputState; next: () => void; back: () => void; onRouteLoaded: (route: RouteData) => void; initialInterpretation: InterpretationData | null; selectedNegotiation: string }) {
  const [open, setOpen] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeStatus, setRouteStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [interpretation, setInterpretation] = useState<InterpretationData | null>(initialInterpretation);
  const [interpretationStatus, setInterpretationStatus] = useState<"loading" | "live" | "fallback">(initialInterpretation ? "live" : "loading");

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
    const timeout = window.setTimeout(() => controller.abort(), 35000);
    setRouteStatus("loading");
    setInterpretationStatus("loading");
    const interpretationRequest = initialInterpretation
      ? Promise.resolve(initialInterpretation)
      : requestInterpretation(input, controller.signal);
    interpretationRequest
      .then(data => {
        setInterpretation(data);
        setInterpretationStatus("live");
        return preferenceFromNegotiation(selectedNegotiation) || data.interpretation.routePreference;
      })
      .catch(() => {
        setInterpretation(null);
        setInterpretationStatus("fallback");
        return preferenceFromNegotiation(selectedNegotiation) || "balanced";
      })
      .then(preference => requestRoute(input, controller.signal, preference))
      .then(data => {
        setRoute(data);
        onRouteLoaded(data);
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
  }, [initialInterpretation, input, onRouteLoaded, selectedNegotiation]);

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
        title: displayPlaceName(stop.name),
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
    <section className="reason-card"><button aria-expanded={open} onClick={() => setOpen(!open)}><span><Sparkles />AI 为什么生成这条路线</span><ChevronDown className={open ? "open" : ""} /></button>{open && <div>{interpretationStatus === "live" && interpretation ? <><p>{interpretation.interpretation.summary}</p>{interpretation.interpretation.needs.length > 0 && <div className="ai-route-needs">{interpretation.interpretation.needs.map(need => <span key={need}>{need}</span>)}</div>}<p className="ai-privacy-proof"><ShieldCheck />百炼 {interpretation.model} · 仅发送能量、时间、社交、行动 · 余白不存储</p></> : <p>基于你 <b>{input.energy}% 的能量</b>、<b>{input.time} 分钟</b>可用时间和今天“{input.social}”的边界，我优先考虑恢复呼吸感，而不是追求新刺激。{interpretationStatus === "fallback" ? " 百炼暂不可用，已切换为本地安全规则。" : ""}</p>}<ul>{routeStatus === "live" && route ? route.fitExplanation.map(reason => <li key={reason}>{reason}</li>) : <><li>能量状态：控制步行距离和任务数量</li><li>社交边界：避开商业街与高人流区域</li><li>行动倾向：以“{input.action}”作为路线节奏</li><li>城市环境：{weatherGuidance}</li></>}</ul></div>}</section>
    <section className="route-list"><header><span>{routeStatus === "live" ? `${planNodes.length} 个真实地点节点` : `${planNodes.length} 个漫游节点`}</span><small>约 {duration} 分钟</small></header>{planNodes.map(({ time, title, text, Icon, evidence }, i) => <article key={`${title}-${i}`} style={{ "--delay": `${i * 70}ms` } as React.CSSProperties}><i><Icon /></i><div><small>0{i + 1} · {time}</small><h3>{title}</h3><p>{text}</p><em>{evidence}</em></div></article>)}</section><div className="safety-note"><ShieldCheck />地点体验仍需实地核验；你可以随时跳过节点或提前结束。</div><PrimaryButton onClick={next}>准备好，一起出发</PrimaryButton>
  </main></section>;
}

function MomentCapture({ stop, moment, save, clear }: { stop: RouteStop; moment?: JourneyMoment; save: (moment: JourneyMoment) => void; clear: () => void }) {
  const [open, setOpen] = useState(Boolean(moment));
  const [photo, setPhoto] = useState(moment?.photo || "");
  const [audio, setAudio] = useState(moment?.audio || "");
  const [note, setNote] = useState(moment?.note || "");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioError, setAudioError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setPhoto(moment?.photo || "");
    setAudio(moment?.audio || "");
    setNote(moment?.note || "");
  }, [moment, stop.id]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  };

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopStream();
  }, []);

  const capturePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopStream();
    setRecording(false);
  };

  const startRecording = async () => {
    setAudioError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAudioError("当前浏览器暂不支持网页录音，可改用文字记录。 ");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = event => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => setAudio(String(reader.result));
        reader.readAsDataURL(blob);
        stopStream();
        setRecording(false);
      };
      recorder.start();
      setSeconds(0);
      setRecording(true);
      intervalRef.current = window.setInterval(() => setSeconds(value => Math.min(20, value + 1)), 1000);
      timeoutRef.current = window.setTimeout(stopRecording, 20000);
    } catch {
      stopStream();
      setRecording(false);
      setAudioError("没有获得麦克风权限；你可以跳过录音或改写一句话。");
    }
  };

  const hasDraft = Boolean(photo || audio || note.trim());
  const hasSaved = Boolean(moment?.photo || moment?.audio || moment?.note);
  const skip = () => {
    stopRecording();
    setPhoto("");
    setAudio("");
    setNote("");
    setAudioError("");
    clear();
    setOpen(false);
  };

  if (!open) return <button className={`moment-entry ${hasSaved ? "has-moment" : ""}`} onClick={() => setOpen(true)}><Camera /><span><b>{hasSaved ? "已记录这一刻" : "记录这一刻"}</b><small>{hasSaved ? "可继续修改或删除" : "照片、20 秒声音或一句话，均可跳过"}</small></span><Pencil /></button>;

  return <section className="moment-capture" aria-label={`记录${displayPlaceName(stop.name)}的这一刻`}>
    <header><span><Sparkles />记录这一刻</span><button onClick={() => setOpen(false)} aria-label="收起记录"><ChevronDown /></button></header>
    <p>只保留在当前浏览器会话，未经你的选择不会发送或长期保存。</p>
    <div className="moment-tools">
      <button className={photo ? "selected" : ""} onClick={() => photoRef.current?.click()}><Camera /><span>{photo ? "更换照片" : "拍一张照片"}</span><input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={event => capturePhoto(event.target.files?.[0])} hidden /></button>
      <button className={recording || audio ? "selected" : ""} onClick={recording ? stopRecording : startRecording}><Mic /><span>{recording ? `停止录音 ${seconds}/20s` : audio ? "重新录音" : "录一段声音"}</span></button>
    </div>
    {photo && <div className="moment-photo"><img src={photo} alt={`${displayPlaceName(stop.name)}的现场记录`} /><button onClick={() => setPhoto("")} aria-label="删除照片"><Trash2 /></button></div>}
    {audio && <div className="moment-audio"><audio controls src={audio} preload="metadata" /><button onClick={() => setAudio("")} aria-label="删除录音"><Trash2 /></button></div>}
    {audioError && <small className="moment-error">{audioError}</small>}
    <label className="moment-note"><span>写下一句话 <small>{note.length}/80</small></span><textarea maxLength={80} value={note} onChange={event => setNote(event.target.value)} placeholder="例如：风穿过树叶时，这里突然安静了一点。" /></label>
    <div className="moment-actions"><button className="moment-skip" onClick={skip}>跳过，不留下记录</button><button className="moment-save" disabled={!hasDraft || recording} onClick={() => { save({ stopId: stop.id, stopName: displayPlaceName(stop.name), photo, audio, note: note.trim() }); setOpen(false); }}><Check />保存这一刻</button></div>
  </section>;
}

function JourneyScreen({ feedback, finish, notice, node, advance, route, moments, saveMoment, clearMoment }: { feedback: () => void; finish: () => void; notice: string; node: number; advance: () => void; route: RouteData | null; moments: Record<string, JourneyMoment>; saveMoment: (moment: JourneyMoment) => void; clearMoment: (stopId: string) => void }) {
  const hasLiveRoute = Boolean(route?.stops.length);
  const total = hasLiveRoute ? route!.stops.length : 3;
  const currentNode = Math.min(node, total);
  const currentStop = hasLiveRoute ? route!.stops[currentNode - 1] : null;
  const currentLeg = hasLiveRoute ? route!.legs[currentNode - 1] : null;
  const stateClass = (index: number) => index < currentNode ? "done" : index === currentNode ? "active" : "";
  const currentWalkingMinutes = currentLeg ? Math.max(1, Math.round(currentLeg.durationSeconds / 60)) : currentNode === 2 ? 12 : 8;
  const originName = currentNode === 1 ? route?.origin.name : route?.stops[currentNode - 2]?.name;

  return <section className="screen scroll-screen journey-screen"><Header title="感知路径" /><main className="page journey-page"><div className="journey-status"><i /><span>{hasLiveRoute ? "正在跟随真实地点路线" : "正在载入地点路线"}</span><b>{currentNode}/{total} · 步行 {currentWalkingMinutes} 分钟</b></div>{notice && <div className="journey-notice" role="status"><Check />{notice}</div>}<h1>{currentStop ? <>去往{displayPlaceName(currentStop.name)}，<br />让感知发生在真实地点。</> : <>跟随这些节点，<br />重新连接环境的纹理。</>}</h1><p className="lead">{currentStop && currentLeg ? `从${originName ? displayPlaceName(originName) : "上一节点"}出发，本段约 ${currentLeg.distanceMeters} 米。抵达后停留 ${currentStop.suggestedStayMinutes} 分钟。` : "真实路线载入前先保持低强度；任何节点都可以跳过。"}</p>
    {hasLiveRoute && route ? <section className="journey-timeline journey-live">{route.stops.map((stop, index) => {
      const itemNode = index + 1;
      const leg = route.legs[index];
      const Icon = routeIcon(stop.category);
      const walkingMinutes = Math.max(1, Math.round((leg?.durationSeconds || 0) / 60));
      return <article key={stop.id} className={stateClass(itemNode)}><i>{itemNode < currentNode ? <Check /> : itemNode}</i><div><small>{itemNode < currentNode ? "已完成" : itemNode === currentNode ? "现在前往" : "下一地点"} · 步行 {walkingMinutes} 分钟</small><h3>{displayPlaceName(stop.name)}</h3><p>{stop.suggestedAction}</p><aside className="journey-place-meta"><span><Icon />{stop.category}</span><span><Footprints />{leg?.distanceMeters || 0} 米</span><span><Clock3 />停留 {stop.suggestedStayMinutes} 分钟</span></aside><a className="amap-link" href={amapNavigationUrl(route, index)} target="_blank" rel="noreferrer"><Route />在高德查看本段步行路线</a>{itemNode === currentNode && <><span className="journey-place-note"><Sparkles />任务来自这个地点的空间类型，不是随机文案</span><MomentCapture stop={stop} moment={moments[stop.id]} save={saveMoment} clear={() => clearMoment(stop.id)} /></>}</div></article>;
    })}</section> : <section className="journey-timeline"><article className={stateClass(1)}><i>{currentNode > 1 ? <Check /> : 1}</i><div><small>{currentNode > 1 ? "完成" : "现在"}</small><h3>断开屏幕</h3><p>走出住所，让眼睛重新适应远处。</p></div></article><article className={stateClass(2)}><i>{currentNode > 2 ? <Check /> : 2}</i><div><small>{currentNode > 2 ? "完成" : currentNode === 2 ? "现在" : "下一步"}</small><h3>触碰自然</h3><p>听风的声音，观察地面上的光。</p></div></article><article className={stateClass(3)}><i>3</i><div><small>{currentNode === 3 ? "现在" : "下一步"}</small><h3>留下一处空间</h3><p>拍下一处让你感觉有呼吸感的空间。</p></div></article></section>}<div className="journey-location-boundary"><ShieldCheck />到达与完成由你手动确认，余白不会持续上传实时位置。</div><button className="finish-button" onClick={currentNode < total ? advance : finish}>{currentNode < total ? `完成“${currentStop ? displayPlaceName(currentStop.name) : "当前节点"}”` : "完成本次感知"}</button><button className="feedback-button" onClick={feedback}><Sparkles />此刻感觉怎么样？</button>
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

function ReflectionScreen({ done, moments, removeMoment }: { done: (saved: boolean, keyword: string) => void; moments: Record<string, JourneyMoment>; removeMoment: (stopId: string) => void }) {
  const [image, setImage] = useState(""); const [caption, setCaption] = useState(""); const [keyword, setKeyword] = useState("松动"); const [inference, setInference] = useState(true); const [summary, setSummary] = useState("今天你选择了一条低刺激的路径，让密集的思绪在脚步与光影之间慢慢松开。"); const [location, setLocation] = useState(false); const [map, setMap] = useState(true); const [memory, setMemory] = useState(false); const ref = useRef<HTMLInputElement>(null);
  const upload = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); };
  const momentList = Object.values(moments);
  return <section className="screen scroll-screen"><Header title="今日余白" /><main className="page reflection-page"><div className="step-label"><b>06</b>与 AI 一起整理，而不是被总结</div><h1>留下你愿意留下的</h1><p className="lead">所有内容都可以修改、删除，或不保存。</p>{momentList.length > 0 && <section className="moment-review"><header><span><Sparkles />沿途留下的瞬间</span><small>{momentList.length} 个地点</small></header>{momentList.map(moment => <article key={moment.stopId}>{moment.photo && <img src={moment.photo} alt={`${moment.stopName}的现场记录`} />}<div><small>{moment.stopName}</small>{moment.note && <p>{moment.note}</p>}{moment.audio && <audio controls src={moment.audio} preload="metadata" />}</div><button onClick={() => removeMoment(moment.stopId)} aria-label={`删除${moment.stopName}的记录`}><Trash2 /></button></article>)}<p><ShieldCheck />这些内容仍只在当前会话中；你可以逐条删除。</p></section>}<button className="photo-upload" onClick={() => ref.current?.click()}>{image ? <img src={image} alt="上传的漫游照片" /> : <><div className="blur-photo" /><Upload /><b>{momentList.length ? "再补充一张漫游照片" : "上传一张漫游照片"}</b><span>点击选择，也可以跳过</span></>}<input ref={ref} type="file" accept="image/*" capture="environment" onChange={e => upload(e.target.files?.[0])} hidden /></button>{image && <div className="photo-insight"><Sparkles /><span><b>AI 建议保留</b>这张照片与你停留最久的感知节点有关；你仍可移除它。</span></div>}<label className="field-label">你想说的一句话 <small>可选</small><textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="这面墙上的树影让我停了一会儿。" /></label><div className="ai-draft"><Sparkles />AI 草稿 · 等待你共同编辑</div><section className="coedit-card"><div><small>今日关键词</small><input aria-label="今日关键词" value={keyword} onChange={e => setKeyword(e.target.value)} /></div><Pencil /></section>{inference && <section className="coedit-card inference"><div><small>AI 观察 <i>推断</i></small><p>你在低人流空间停留得更久。</p></div><button onClick={() => setInference(false)}><Trash2 />删除推断</button></section>}<section className="summary-card"><header><span>今日总结</span><small><Pencil />可编辑</small></header><textarea aria-label="今日总结" value={summary} onChange={e => setSummary(e.target.value)} placeholder="写下你愿意保留的部分……" /></section><div className="coedit-control"><ShieldCheck />AI 只提供草稿，最终版本和保存范围始终由你决定。</div><section className="privacy"><h3><ShieldCheck />由你决定保存范围</h3><Toggle label="保存具体位置" detail="默认关闭，不记录路线坐标" value={location} change={() => setLocation(!location)} /><Toggle label="加入个人精神地图" detail="只保存这次共创的内容" value={map} change={() => setMap(!map)} /><Toggle label="进入长期记忆" detail="用于未来漫游建议，默认关闭" value={memory} change={() => setMemory(!memory)} /></section><PrimaryButton onClick={() => done(true, keyword || "未命名")}>按我的选择保存</PrimaryButton><button className="text-button" onClick={() => done(false, keyword || "未命名")}>不保存，直接结束</button></main></section>;
}

function DoneScreen({ restart, viewCard, saved, keyword }: { restart: () => void; viewCard: () => void; saved: boolean; keyword: string }) {
  return <section className="screen done-screen"><button className="done-close" onClick={restart} aria-label="返回首页"><X /></button><div className="done-orbit"><i /><i /><span>{saved ? <Leaf /> : <Check />}</span></div><main><div className="eyebrow"><Sparkles />{saved ? "今日关键词" : "本次漫游已完成"}</div><h1>{saved ? keyword : "已放下"}</h1><p>{saved ? "你和城市之间，多出了一点可以呼吸的距离。" : "内容没有被保存，但此刻的感受仍然属于你。"}</p><span><Check />{saved ? "已按照你的选择保存" : "未写入位置、精神地图或长期记忆"}</span></main><div className="done-actions"><PrimaryButton onClick={viewCard}>查看今日余白卡</PrimaryButton><button className="text-button" onClick={restart}>返回首页</button></div></section>;
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []); const requested = params.get("screen");
  const valid: Step[] = ["splash", "home", "world", "resonance", "map", "mapAdd", "mapEntry", "profile", "card", "input", "thinking", "negotiate", "plan", "journey", "adjust", "reflection", "done"];
  const initialStep: Step = requested === "feedback" ? "journey" : valid.includes(requested as Step) ? requested as Step : "splash";
  const [step, setStep] = useState<Step>(initialStep); const [sheet, setSheet] = useState(requested === "feedback"); const [branch, setBranch] = useState<Branch>("noise"); const [notice, setNotice] = useState(""); const [journeyNode, setJourneyNode] = useState(1); const [result, setResult] = useState({ saved: true, keyword: "松动" }); const [mapSaved, setMapSaved] = useState(false); const [liveRoute, setLiveRoute] = useState<RouteData | null>(null); const [aiInterpretation, setAiInterpretation] = useState<InterpretationData | null>(null); const [aiInterpretationStatus, setAiInterpretationStatus] = useState<"loading" | "live" | "fallback">("loading"); const [aiInterpretationError, setAiInterpretationError] = useState("");
  const [input, setInput] = useState<InputState>({ energy: 30, time: 40, social: "独处", action: "散步", description: "脑子很乱，一直待在宿舍更难受" }); const [selected, setSelected] = useState("理解得很准确"); const [custom, setCustom] = useState("");
  const [moments, setMoments] = useState<Record<string, JourneyMoment>>({});
  const shouldInterpret = step === "thinking" || step === "negotiate";
  useEffect(() => {
    if (!shouldInterpret) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 22000);
    setAiInterpretationStatus("loading");
    setAiInterpretationError("");
    requestInterpretation(input, controller.signal)
      .then(data => {
        setAiInterpretation(data);
        setAiInterpretationStatus("live");
      })
      .catch(error => {
        setAiInterpretation(null);
        setAiInterpretationStatus("fallback");
        setAiInterpretationError(error instanceof Error ? error.message : "百炼暂不可用");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [input, shouldInterpret]);
  useEffect(() => {
    if (step !== "journey" || liveRoute) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    requestRoute(input, controller.signal)
      .then(setLiveRoute)
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [input, liveRoute, step]);
  const choose = (b: Branch) => { setBranch(b); setSheet(false); setStep("adjust"); };
  const restart = () => { setStep("home"); setSheet(false); setNotice(""); setJourneyNode(1); setLiveRoute(null); setAiInterpretation(null); setAiInterpretationStatus("loading"); setAiInterpretationError(""); setSelected("理解得很准确"); setCustom(""); setMoments({}); };
  const saveMoment = (moment: JourneyMoment) => setMoments(current => ({ ...current, [moment.stopId]: moment }));
  const clearMoment = (stopId: string) => setMoments(current => { const next = { ...current }; delete next[stopId]; return next; });
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
    {step === "input" && <InputScreen value={input} setValue={setInput} next={() => setStep("thinking")} />}{step === "thinking" && <ThinkingScreen input={input} next={() => setStep("negotiate")} />}{step === "negotiate" && <NegotiationScreen input={input} selected={selected} setSelected={setSelected} custom={custom} setCustom={setCustom} next={() => setStep("plan")} back={() => setStep("input")} interpretation={aiInterpretation} interpretationStatus={aiInterpretationStatus} interpretationError={aiInterpretationError} />}{step === "plan" && <PlanScreen input={input} next={() => { setJourneyNode(1); setMoments({}); setStep("journey"); }} back={() => setStep("negotiate")} onRouteLoaded={setLiveRoute} initialInterpretation={aiInterpretation} selectedNegotiation={selected} />}{step === "journey" && <JourneyScreen feedback={() => setSheet(true)} finish={() => setStep("reflection")} notice={notice} node={journeyNode} advance={() => setJourneyNode(Math.min(liveRoute?.stops.length || 3, journeyNode + 1))} route={liveRoute} moments={moments} saveMoment={saveMoment} clearMoment={clearMoment} />}{step === "adjust" && <AdjustmentScreen branch={branch} accept={() => { setNotice(adjustments[branch].notice); setStep("journey"); }} modify={() => { setStep("journey"); window.setTimeout(() => setSheet(true), 0); }} />}{step === "reflection" && <ReflectionScreen moments={moments} removeMoment={clearMoment} done={(saved, keyword) => { setResult({ saved, keyword }); setStep("done"); }} />}{step === "done" && <DoneScreen restart={restart} viewCard={() => setStep("card")} saved={result.saved} keyword={result.keyword} />}{sheet && <FeedbackSheet close={() => setSheet(false)} choose={choose} finish={() => { setSheet(false); setStep("reflection"); }} />}
  </div><span className="device-home" aria-hidden="true" /></div></div>;
}
