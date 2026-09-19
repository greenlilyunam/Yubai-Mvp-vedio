import { useEffect, useState } from "react";
import {
  AudioLines, Binoculars, Bookmark, BookOpen, Camera, Check, ChevronLeft,
  ChevronRight, CircleUserRound, Compass, Flower2, Heart, Leaf, Lightbulb,
  Map, MapPin, Palette, Plus, Radio, Search, ShieldCheck, Sparkles, Trees,
  UserRound, Waves, Wind, VolumeX, X,
} from "lucide-react";
import homeHistory from "./assets/home-history.jpg";
import worldContours from "./assets/world-contours.png";
import yubaiCard from "./assets/yubai-card.jpg";
import mapStylized from "./assets/map-stylized.png";
import mapDetail from "./assets/map-detail.png";

export type HubTab = "home" | "resonance" | "map" | "profile";

export type JourneyMemory = {
  id: string;
  createdAt: string;
  keyword: string;
  summary: string;
  caption: string;
  photo: string;
  beforeEnergy: number;
  routeSource: string;
  distanceMeters: number;
  durationMinutes: number;
  savedToMap: boolean;
  saveLocation: boolean;
  places: MapMemory[];
};

export type MapMemory = {
  id: string;
  name: string;
  category: string;
  address: string;
  note: string;
  photo: string;
  audio: string;
  keyword: string;
  createdAt: string;
  source: string;
  fieldVerified: boolean;
};

function BrandHeader({ close }: { close?: () => void }) {
  return <header className="brand-header">
    <Waves />
    <b>YU BAI</b>
    {close ? <button onClick={close} aria-label="关闭"><X /></button> : <Radio />}
  </header>;
}

export function BottomNav({ current, navigate }: { current: HubTab; navigate: (tab: HubTab) => void }) {
  const items = [
    ["home", Leaf, "余白"],
    ["resonance", Compass, "漫游"],
    ["map", Map, "地图"],
    ["profile", UserRound, "自画像"],
  ] as const;
  return <nav className="app-bottom-nav" aria-label="主导航">
    {items.map(([id, Icon, label]) => <button key={id} className={current === id ? "active" : ""} aria-current={current === id ? "page" : undefined} onClick={() => navigate(id)}>
      <Icon /><span>{label}</span>
    </button>)}
  </nav>;
}

export function SplashScreen({ start }: { start: () => void }) {
  return <section className="screen splash-screen">
    <div className="splash-glow splash-glow-one" /><div className="splash-glow splash-glow-two" />
    <main><h1>余白</h1><h2>Yu Bai</h2><i /><p>精神舒缓 &amp; 社会感知</p></main>
    <footer><button onClick={start}>开始感知 <ChevronRight /></button><small><Sparkles />POWERED BY AI COMPANION</small></footer>
  </section>;
}

type HomeAction = "散步" | "坐一会" | "寻找灵感";

export function HomeScreen({ start, readWorld, navigate, latestMemory }: { start: (action: HomeAction) => void; readWorld: () => void; navigate: (tab: HubTab) => void; latestMemory: JourneyMemory | null }) {
  const actions = [
    [Wind, "去听风", () => start("散步")],
    [Binoculars, "找回好奇", () => start("寻找灵感")],
    [VolumeX, "放下噪音", () => start("坐一会")],
    [AudioLines, "感受城市脉搏", readWorld],
    [Lightbulb, "捕捉灵感", () => start("寻找灵感")],
  ] as const;
  return <section className="screen hub-screen home-screen"><BrandHeader />
    <main className="hub-scroll">
      <div className="ai-presence"><i />余白 AI · 陪伴中</div>
      <h1>今天，想从生活里找回一点什么？</h1>
      <button className="mental-orb" onClick={() => start("散步")} aria-label="开始本次状态输入"><i /><i /><div><b>38%</b><span>MENTAL BATTERY</span></div></button>
      <section className="home-actions">{actions.map(([Icon, label, action]) => <button key={label} onClick={action}><i><Icon /></i><b>{label}</b><ChevronRight /></button>)}</section>
      <section className="history-section"><h2>上一次漫游记录</h2><button onClick={() => navigate("map")}>{latestMemory ? latestMemory.photo || latestMemory.places.find(place => place.photo)?.photo ? <img src={latestMemory.photo || latestMemory.places.find(place => place.photo)?.photo} alt={`${latestMemory.keyword}的漫游记录`} /> : <div className="history-placeholder"><MapPin /><span>{latestMemory.places.map(place => place.name).join(" → ") || "本次漫游"}</span></div> : <img src={homeHistory} alt="夜晚便利店的漫游记录示例" />}<span><b>{latestMemory ? latestMemory.caption || latestMemory.summary : "树影、风声、便利店的暖光"}</b><small>{latestMemory ? `${latestMemory.places.length} 个地点 · ${latestMemory.durationMinutes} 分钟` : "体验示例"}</small></span></button></section>
    </main>
    <BottomNav current="home" navigate={navigate} />
  </section>;
}

export function WorldReadingScreen({ next }: { next: () => void }) {
  useEffect(() => { const timer = window.setTimeout(next, 2600); return () => window.clearTimeout(timer); }, [next]);
  return <section className="screen world-screen" onClick={next}>
    <img src={worldContours} alt="" />
    <div className="world-scan" />
    <div className="world-orbit"><i /><i /><i /><span>∞</span><em>个人能量 · 平静</em><em>附近绿荫</em><em>人群密度</em></div>
    <main><h1>AI 正在读取你与城市的距离</h1><p>正在解析当前光感、天气、城市声音及匿名碎片</p></main>
    <aside><small>建议</small><p>今天适合：避开人群、步入树影、短暂停留、微小连接。</p></aside>
    <footer><i><span /><span /><span /></i>余白 · 正在读取城市信号</footer>
  </section>;
}

export function ResonanceScreen({ navigate }: { navigate: (tab: HubTab) => void }) {
  const [joined, setJoined] = useState(false);
  const [collected, setCollected] = useState(false);
  return <section className="screen hub-screen resonance-screen"><BrandHeader />
    <main className="hub-scroll">
      <header><h1>城市余白共鸣池</h1><p>在同城，遇见陌生人的生活感知</p></header>
      <section className="resonance-card resonance-stat"><UserRound /><p>今天，还有 18 人也选择了「静谧」</p><small>Synchronized</small><button className={joined ? "selected" : ""} onClick={() => setJoined(!joined)}>{joined ? <><Check />已加入</> : "我也在那里"}</button></section>
      <section className="resonance-card resonance-quote"><MapPin /><blockquote>南山区的一位漫游者留下：我只需要一个不会催促我的地方。</blockquote><div><button className={collected ? "selected" : ""} onClick={() => setCollected(!collected)}><Heart />{collected ? "已采撷" : "采撷共鸣"}</button><button><Palette />送出颜色</button></div></section>
      <section className="resonance-card resonance-sense"><i><Wind /></i><small>感官采集</small><p>有人采集了：<br />风、蓝灰色、一段安静的停留。</p><div><span>微风</span><span>蓝灰色</span></div></section>
      <section className="resonance-card resonance-thanks"><Flower2 /><div><p>有人向城市致谢：谢谢你，今天没有催促我。</p><small>傍晚时分的匿名耳语。</small></div></section>
      <div className="resonance-ai"><AudioLines /><span><b>余白 AI · 正在为你寻找共鸣</b><i><em /></i></span><button>•••</button></div>
    </main>
    <BottomNav current="resonance" navigate={navigate} />
  </section>;
}

export function ResultCardScreen({ memory, saveToMap, sendToPool, navigate }: { memory: JourneyMemory | null; saveToMap: () => void; sendToPool: () => void; navigate: (tab: HubTab) => void }) {
  const tags = memory
    ? Array.from(new Set([memory.keyword, ...memory.places.map(place => place.category), memory.places.some(place => place.photo) ? "照片" : "感知"])).slice(0, 4)
    : ["灯光", "话语", "微风", "光影"];
  return <section className="screen hub-screen result-card-screen"><BrandHeader />
    <main className="hub-scroll">
      <h1>今天，你被这些瞬间<br />温柔地捕获了</h1>
      <article className="yubai-result-card"><div className="result-photo">{memory ? memory.photo || memory.places.find(place => place.photo)?.photo ? <img src={memory.photo || memory.places.find(place => place.photo)?.photo} alt={`${memory.keyword}的余白卡`} /> : <div className="result-photo-placeholder"><Map /><small>{memory.distanceMeters ? "本次真实路线" : "本次漫游记录"}</small><b>{memory.places.map(place => place.name).join(" → ") || "一段未命名的漫游"}</b><span>{memory.durationMinutes} 分钟 · {memory.distanceMeters ? `${(memory.distanceMeters / 1000).toFixed(2)} 公里` : "未记录距离"}</span></div> : <img src={yubaiCard} alt="余白卡体验示例" />}</div>
        <div className="result-tags">{tags.map((tag, index) => <span key={tag}>{index === 0 ? <Lightbulb /> : index === 1 ? <BookOpen /> : index === 2 ? <Wind /> : <Trees />}{tag}</span>)}</div>
        <section><small>本次状态变化</small><div><span>{memory?.beforeEnergy ?? 30}%<em>出发能量</em></span><i /><span>{memory?.keyword || "松弛"}<em>今日关键词</em></span></div></section>
        <blockquote>“{memory?.summary || "真正的生活不必在远方，只需要重新打开感官。"}”</blockquote>
        <p><Sparkles />余白 · {memory ? `${memory.places.length} 个真实地点共同生成` : "我们共同生成了这张卡"}</p>
      </article>
      <div className="result-actions"><button onClick={saveToMap} disabled={Boolean(memory?.savedToMap)}><Map />{memory?.savedToMap ? "已保存到余白地图" : "保存到余白地图"}</button><button onClick={sendToPool}><Waves />投递至匿名共鸣池</button></div>
    </main>
    <BottomNav current="resonance" navigate={navigate} />
  </section>;
}

export function MapScreen({ navigate, add, openEntry, entries }: { navigate: (tab: HubTab) => void; add: () => void; openEntry: (id: string) => void; entries: MapMemory[] }) {
  const icons = [Trees, Lightbulb, BookOpen, Bookmark] as const;
  return <section className="screen hub-screen map-screen"><div className="map-background"><img src={mapStylized} alt="抽象城市地图" /></div>
    <header><b>Yu Bai</b><button onClick={() => navigate("home")}><X /></button></header>
    <main className="map-panel"><h1>我的余白地图</h1><p>漫游的个人存档</p><small className="map-data-boundary"><ShieldCheck />地点来自真实路线；仅保存你主动选择的记录</small>
      {entries.length > 0 ? <div>{entries.slice(0, 4).map((entry, index) => { const Icon = icons[index % icons.length]; return <button key={entry.id} onClick={() => openEntry(entry.id)}><i><Icon /></i><span><b>{entry.name}</b><small>{entry.category} · {entry.keyword}</small></span><ChevronRight /></button>; })}</div> : <section className="map-empty"><MapPin /><b>地图还是空的</b><p>完成一次漫游，并在结束时选择“加入个人精神地图”。</p></section>}
      <aside><i /><span><b>余白 AI</b>{entries.length ? `已经留下 ${entries.length} 处与你真实经历对应的余白。` : "这里不会自动生成虚构地点，只收纳你选择保留的经历。"}</span></aside>
      <button className="map-add-button" onClick={add}><Plus />添加一处余白</button>
    </main>
    {entries.length > 0 && <div className="map-pin map-pin-one" />}{entries.length > 1 && <div className="map-pin map-pin-two" />}
    <BottomNav current="map" navigate={navigate} />
  </section>;
}

export function MapAddScreen({ back, save }: { back: () => void; save: (name: string, category: string) => void }) {
  const [kind, setKind] = useState(0);
  const [name, setName] = useState("灯下停留");
  const kinds = ["🔑", "🔖", "✚", "📁", "🏠", "👩", "🔭", "✏️"];
  return <section className="screen map-add-screen"><BrandHeader close={back} />
    <div className="map-add-canvas"><img src={mapDetail} alt="城市地图" /><label><Search /><input aria-label="搜索地点" placeholder="搜索这里" /></label><i className="pin-a" /><i className="pin-b" /></div>
    <section className="map-editor"><i className="sheet-grip" /><div className="map-kinds">{kinds.map((item, index) => <button key={item} className={kind === index ? "selected" : ""} onClick={() => setKind(index)}>{item}</button>)}</div><label><MapPin /><input value={name} onChange={event => setName(event.target.value)} placeholder="给这里一个名字" /></label><button disabled={!name.trim()} onClick={() => save(name.trim(), ["静谧之所", "值得重访", "临时停留", "灵感地点"][kind % 4])}>添加到余白地图</button></section>
  </section>;
}

export function MapEntryScreen({ back, entry }: { back: () => void; entry: MapMemory | null }) {
  return <section className="screen scroll-screen map-entry-screen"><header><button onClick={back}><ChevronLeft /></button><b>{entry?.category || "余白地点"}</b><span /></header>
    <main>{entry?.photo ? <img src={entry.photo} alt={`${entry.name}的现场记录`} /> : entry ? <div className="map-entry-placeholder"><MapPin /><small>没有留下照片</small><b>{entry.name}</b><span>{entry.category} · {entry.keyword}</span></div> : <img src={yubaiCard} alt="余白地点体验示例" />}<div className="map-entry-title"><small>{entry?.address || "深圳 · 南山区"}</small><h1>{entry?.name || "还没有选择地点"}</h1><p>{entry?.note || "从余白地图中选择一处真实经历，即可查看当时留下的感知。"}</p></div>
      <section><h2>被保留下来的感知</h2><div><span>{entry?.keyword || "未命名"}</span><span>{entry?.category || "个人地点"}</span>{entry?.audio && <span>声音记录</span>}<span>{entry?.fieldVerified ? "地点信息已核验" : "体验条件待核验"}</span></div></section>
      <aside><Sparkles /><p><b>来源与边界</b>{entry ? `${entry.source}。这段文字来自你的记录或本次地点任务，不是AI虚构的地点评价。` : "这里不会展示未保存的路线或虚构地点。"}</p></aside>
      {entry?.audio && <audio className="map-entry-audio" controls src={entry.audio} preload="metadata" />}
      <button className="primary-button" onClick={back}><span>回到我的余白地图</span><ChevronRight /></button>
    </main>
  </section>;
}

export function ProfileScreen({ navigate, memories, entries, openEntry }: { navigate: (tab: HubTab) => void; memories: JourneyMemory[]; entries: MapMemory[]; openEntry: (id: string) => void }) {
  const keywords = Array.from(new Set(memories.map(memory => memory.keyword).filter(Boolean)));
  const recentEntries = entries.slice(0, 2);
  return <section className="screen hub-screen profile-screen"><BrandHeader />
    <main className="hub-scroll">
      <header><div className="profile-orb"><CircleUserRound /></div><h1>内在之海</h1><p>你的感知如何慢慢形成自己的潮汐</p></header>
      <section className="profile-stats"><div><b>{memories.length}</b><small>次漫游</small></div><div><b>{entries.length}</b><small>处余白</small></div><div><b>{keywords.length}</b><small>个关键词</small></div></section>
      <section className="inner-sea"><header><span><Waves />最近的内在潮汐</span><small>近 30 天</small></header><div className="sea-chart"><i /><i /><i /><span>松动</span><span>好奇</span><span>安静</span></div><p>你的感知正在从“空转”缓慢转向“愿意停留”。</p></section>
      <section className="portrait-keywords"><h2>正在形成的自画像</h2><div>{keywords.length ? keywords.map(keyword => <span key={keyword}>{keyword}</span>) : <span>完成并保存一次漫游后开始形成</span>}</div></section>
      <section className="memory-control"><ShieldCheck /><div><b>记忆与控制权</b><p>你可以随时修改、删除 AI 推断，或关闭长期记忆。</p></div><ChevronRight /></section>
      <section className="profile-records"><h2>最近留下的余白</h2>{recentEntries.length ? recentEntries.map((entry, index) => <button key={entry.id} onClick={() => openEntry(entry.id)}>{index === 0 ? <Camera /> : <Wind />}<span><b>{entry.name}</b><small>关键词 · {entry.keyword}</small></span><ChevronRight /></button>) : <p className="profile-empty">尚未保存记录。完成一次漫游后，这里只呈现你主动留下的内容。</p>}</section>
    </main>
    <BottomNav current="profile" navigate={navigate} />
  </section>;
}
