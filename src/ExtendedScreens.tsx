import { useEffect, useRef, useState } from "react";
import {
  AudioLines, Binoculars, Bookmark, BookOpen, Camera, Check, ChevronLeft,
  ChevronRight, CircleUserRound, Compass, Eye, Flower2, Heart, Leaf, Lightbulb,
  LocateFixed, LockKeyhole, Map, MapPin, MoreHorizontal, Navigation, Palette,
  Plus, Radio, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trees,
  UserRound, Waves, Wind, VolumeX, X,
} from "lucide-react";
import homeHistory from "./assets/home-history.jpg";
import worldContours from "./assets/world-contours.png";
import yubaiCard from "./assets/yubai-card.jpg";
import mapStylized from "./assets/map-stylized.png";
import mapDetail from "./assets/map-detail.png";
import { AmapCanvas, reverseGeocode } from "./AmapCanvas";
import type { AmapCanvasHandle, GeoPoint } from "./AmapCanvas";

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
  location?: { longitude: number; latitude: number };
  checkInStatus?: "device" | "manual" | "route";
  accuracyMeters?: number;
  arrivalDistanceMeters?: number;
  checkedInAt?: string;
};

export type MapCheckInDraft = {
  name: string;
  category: string;
  address: string;
  note: string;
  location: GeoPoint;
  fieldVerified: boolean;
  checkInStatus: "device" | "manual";
  accuracyMeters?: number;
};

function pointDistance(a: GeoPoint, b: GeoPoint) {
  const radians = (value: number) => value * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function coordinateLabel(point: GeoPoint) {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

function BrandHeader({ close, readWorld }: { close?: () => void; readWorld?: () => void }) {
  const [panel, setPanel] = useState<HomeHeaderPanel | null>(null);
  const interactive = !close;
  return <>
    <header className="brand-header">
      {interactive ? <button className="brand-icon-button" onClick={() => setPanel("signals")} aria-label="打开城市信号"><Waves /></button> : <Waves />}
      <b>YU BAI</b>
      {close ? <button className="brand-close-button" onClick={close} aria-label="关闭"><X /></button> : <button className="brand-icon-button" onClick={() => setPanel("companion")} aria-label="打开余白 AI 陪伴状态"><Radio /></button>}
    </header>
    {panel && <HomeHeaderDetail panel={panel} close={() => setPanel(null)} readWorld={readWorld} />}
  </>;
}

type HomeHeaderPanel = "signals" | "companion";

function HomeHeaderDetail({ panel, close, readWorld }: { panel: HomeHeaderPanel; close: () => void; readWorld?: () => void }) {
  const isSignals = panel === "signals";
  return <section className={`home-header-detail ${isSignals ? "signals-detail" : "companion-detail"}`}>
    <header><button onClick={close} aria-label="返回首页"><ChevronLeft /></button><b>{isSignals ? "城市信号" : "余白 AI"}</b><span /></header>
    <main>
      <div className="detail-kicker">{isSignals ? <><Waves /> CITY SENSING</> : <><Radio /> COMPANION STATUS</>}</div>
      <h1>{isSignals ? <>听见城市，<br />但不过度打扰你。</> : <>陪伴在场，<br />控制权仍然属于你。</>}</h1>
      <p>{isSignals ? "余白会把天气、光感与城市节奏整理成低压力提示。开始漫游后才读取实时数据。" : "AI 只在你需要时参与理解与规划，不替你判断情绪，也不要求持续在线。"}</p>
      {isSignals ? <>
        <div className="signal-landscape" aria-hidden="true"><i /><i /><i /><span><em /><em /><em /></span></div>
        <section className="signal-list">
          <article><Wind /><span><b>风与天气</b><small>路线生成时读取高德实时数据</small></span><em>按需</em></article>
          <article><Eye /><span><b>光线与开放感</b><small>转译为可感知的漫游提示</small></span><em>轻量</em></article>
          <article><AudioLines /><span><b>城市声音</b><small>由你主动感受，不开启后台监听</small></span><em>本地</em></article>
        </section>
        <button className="detail-primary" onClick={() => { if (readWorld) readWorld(); else close(); }}>{readWorld ? "读取此刻的城市" : "回到当前页面"} <ChevronRight /></button>
      </> : <>
        <div className="companion-orbit" aria-hidden="true"><i /><i /><span><Sparkles /></span><em>陪伴中</em></div>
        <section className="companion-boundaries">
          <article><ShieldCheck /><span><b>本次状态理解</b><small>能量、时间、社交边界与行动倾向</small></span><em>开启</em></article>
          <article><LockKeyhole /><span><b>长期记忆</b><small>只保留你主动保存的漫游记录</small></span><em>由你决定</em></article>
          <article><Eye /><span><b>摄像头与麦克风</b><small>仅在“记录这一刻”时临时调用</small></span><em>默认关闭</em></article>
        </section>
        <button className="detail-primary" onClick={close}>保持这样的陪伴 <ChevronRight /></button>
      </>}
    </main>
  </section>;
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
  return <section className="screen hub-screen home-screen"><BrandHeader readWorld={readWorld} />
    <main className="hub-scroll">
      <div className="ai-presence"><i />余白 AI · 陪伴中</div>
      <h1>今天，想从生活里找回一点什么？</h1>
      <button className="mental-orb" onClick={() => start("散步")} aria-label="开始本次状态输入"><i /><i /><div className="mental-orb-core"><div className="mental-liquid" aria-hidden="true"><i /><i /></div><b>38%</b><span>MENTAL BATTERY</span></div></button>
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
      <div className="resonance-ai"><AudioLines /><span><b>余白 AI · 正在为你寻找共鸣</b><i><em /></i></span><button type="button" aria-label="共鸣匹配详情"><MoreHorizontal /></button></div>
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
  const filters = ["全部", "自然", "阅读", "停留"] as const;
  const [filter, setFilter] = useState<(typeof filters)[number]>("全部");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(entries[0]?.id || "");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const dragStart = useRef<number | null>(null);
  const mapRef = useRef<AmapCanvasHandle | null>(null);
  const filteredEntries = entries.filter(entry => {
    const matchesFilter = filter === "全部" || entry.category.includes(filter);
    const haystack = `${entry.name}${entry.category}${entry.address}${entry.keyword}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });
  const activeEntry = filteredEntries.find(entry => entry.id === activeId) || filteredEntries[0] || null;
  useEffect(() => {
    if (filteredEntries.length && !filteredEntries.some(entry => entry.id === activeId)) setActiveId(filteredEntries[0].id);
  }, [activeId, filteredEntries]);
  const mappedEntries = filteredEntries.filter((entry): entry is MapMemory & { location: GeoPoint } => Boolean(entry.location));
  const mapPoints = mappedEntries.map(entry => ({ id: entry.id, label: entry.name, location: entry.location, verified: entry.checkInStatus === "device" }));
  return <section className="screen hub-screen map-screen">
    <AmapCanvas ref={mapRef} className="map-background map-real-background" fallbackImage={mapStylized} points={mapPoints} activeId={activeEntry?.id} onMarkerClick={setActiveId} onStatusChange={setMapStatus} />
    <header className="map-explore-header"><div><small>MY YU BAI MAP</small><b>余白地图</b></div><span className={mapStatus === "ready" ? "is-live" : ""}><Compass />{mapStatus === "ready" ? "真实地图" : mapStatus === "missing-key" ? "待启用" : mapStatus === "error" ? "暂时离线" : "地图准备中"}</span></header>
    <main className="map-explorer">
      <label className="map-search"><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索地点或感知关键词" aria-label="搜索余白地点" /><SlidersHorizontal /></label>
      <div className="map-filters" aria-label="地点筛选">{filters.map(item => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <div className="map-explore-boundary"><ShieldCheck />{mappedEntries.length ? `${mappedEntries.length} 个真实坐标标记` : "保存坐标后会在地图上出现"}</div>
      <div className="map-controls"><button onClick={() => mapRef.current?.zoomIn()} aria-label="放大地图">＋</button><button onClick={() => mapRef.current?.zoomOut()} aria-label="缩小地图">−</button><button onClick={() => { setFilter("全部"); setQuery(""); mapRef.current?.fitPoints(); }} aria-label="查看全部地点"><LocateFixed /></button></div>
    </main>
    <section className={`map-explore-sheet ${sheetExpanded ? "expanded" : "collapsed"}`}>
      <button className="map-sheet-handle" aria-label={sheetExpanded ? "收起地点列表" : "展开地点列表"} aria-expanded={sheetExpanded}
        onPointerDown={event => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => { const distance = dragStart.current === null ? 0 : event.clientY - dragStart.current; if (distance < -35) setSheetExpanded(true); else if (distance > 35) setSheetExpanded(false); else setSheetExpanded(value => !value); dragStart.current = null; }}
        onPointerCancel={() => { dragStart.current = null; }}><i /><span>{sheetExpanded ? "下滑回到地图" : "上滑查看全部地点"}</span></button>
      <header><div><small>我的余白地点</small><h1>{filteredEntries.length ? `${filteredEntries.length} 处记录` : "还没有记录"}</h1></div><Navigation /></header>
      {!sheetExpanded && (activeEntry ? <button className="map-active-place" onClick={() => openEntry(activeEntry.id)}><i><MapPin /></i><span><b>{activeEntry.name}</b><small>{activeEntry.category} · {activeEntry.keyword}</small>{activeEntry.checkInStatus === "device" && <em>设备定位打卡</em>}</span><ChevronRight /></button> : <div className="map-explore-empty"><span>换一个筛选条件，或亲自留下第一处地点。</span></div>)}
      {sheetExpanded && <div className="map-expanded-list">{filteredEntries.length ? filteredEntries.map((entry, index) => { const Icon = icons[index % icons.length]; return <button key={entry.id} onClick={() => openEntry(entry.id)}><i><Icon /></i><span><b>{entry.name}</b><small>{entry.category} · {entry.keyword}</small></span><ChevronRight /></button>; }) : <div className="map-explore-empty"><span>这里还没有符合条件的地点。</span></div>}</div>}
      <div className="map-sheet-actions"><button onClick={add}><Plus />添加一处余白</button><small><ShieldCheck />只展示你主动保存的地点</small></div>
    </section>
    <BottomNav current="map" navigate={navigate} />
  </section>;
}

export function MapAddScreen({ back, save }: { back: () => void; save: (draft: MapCheckInDraft) => void }) {
  const [kind, setKind] = useState(0);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<GeoPoint | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<GeoPoint | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [address, setAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "located" | "denied">("idle");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const mapRef = useRef<AmapCanvasHandle | null>(null);
  const kinds = ["🌿", "📖", "☕", "✨"];
  const categories = ["静谧之所", "值得重访", "临时停留", "灵感地点"];
  const locate = () => {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(position => {
      const point = { longitude: position.coords.longitude, latitude: position.coords.latitude };
      setDeviceLocation(point);
      setSelectedLocation(point);
      setAccuracy(position.coords.accuracy);
      setLocationStatus("located");
      mapRef.current?.centerOn(point);
      reverseGeocode(point).then(setAddress).catch(() => setAddress(coordinateLabel(point)));
    }, () => setLocationStatus("denied"), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  };
  const selectOnMap = (point: GeoPoint) => {
    setSelectedLocation(point);
    reverseGeocode(point).then(setAddress).catch(() => setAddress(coordinateLabel(point)));
  };
  const distanceFromDevice = selectedLocation && deviceLocation ? pointDistance(selectedLocation, deviceLocation) : Number.POSITIVE_INFINITY;
  const deviceVerified = Boolean(deviceLocation && selectedLocation && distanceFromDevice <= Math.max(200, accuracy || 0));
  const submit = () => {
    if (!name.trim() || !selectedLocation) return;
    save({
      name: name.trim(),
      category: categories[kind % categories.length],
      address: address || coordinateLabel(selectedLocation),
      note: note.trim() || "在这里停留了一会儿，把此刻留在自己的余白地图里。",
      location: selectedLocation,
      fieldVerified: deviceVerified,
      checkInStatus: deviceVerified ? "device" : "manual",
      accuracyMeters: deviceVerified ? Math.round(accuracy || distanceFromDevice) : undefined,
    });
  };
  return <section className="screen map-add-screen"><BrandHeader close={back} />
    <div className="map-add-canvas"><AmapCanvas ref={mapRef} fallbackImage={mapDetail} selectedLocation={selectedLocation} onSelectLocation={selectOnMap} onStatusChange={setMapStatus} />
      <div className="map-add-map-hint"><MapPin /><span><b>{selectedLocation ? "地点已选定" : "点地图选择一处地点"}</b><small>{selectedLocation ? address || coordinateLabel(selectedLocation) : mapStatus === "ready" ? "也可以使用设备当前位置" : "地图未启用时仍可使用设备定位"}</small></span></div>
    </div>
    <section className="map-editor real-checkin-editor"><i className="sheet-grip" />
      <header><div><small>REAL PLACE CHECK-IN</small><b>记录真实的一处余白</b></div><button className={locationStatus === "located" ? "located" : ""} onClick={locate} disabled={locationStatus === "locating"}><LocateFixed />{locationStatus === "locating" ? "定位中…" : locationStatus === "located" ? "重新定位" : "使用当前位置"}</button></header>
      <p className={`checkin-status ${deviceVerified ? "verified" : ""}`}>{deviceVerified ? <><ShieldCheck />设备定位已核验{accuracy ? ` · 精度约 ${Math.round(accuracy)} 米` : ""}</> : selectedLocation ? <><MapPin />手动选点 · 将标记为待实地核验</> : locationStatus === "denied" ? <><LockKeyhole />未获得定位权限，可在地图上手动选点</> : <><ShieldCheck />只在你主动打卡时读取一次位置</>}</p>
      <div className="map-kinds">{kinds.map((item, index) => <button key={item} className={kind === index ? "selected" : ""} onClick={() => setKind(index)} aria-label={categories[index % categories.length]}>{item}</button>)}</div>
      <label><MapPin /><input value={name} onChange={event => setName(event.target.value)} placeholder="给这里一个名字" /></label>
      <label className="map-note-input"><Sparkles /><input value={note} onChange={event => setNote(event.target.value)} placeholder="写下一句此刻的感受（可选）" /></label>
      <button disabled={!name.trim() || !selectedLocation} onClick={submit}>保存这处真实地点</button>
    </section>
  </section>;
}

export function MapEntryScreen({ back, entry }: { back: () => void; entry: MapMemory | null }) {
  return <section className="screen scroll-screen map-entry-screen"><header><button onClick={back}><ChevronLeft /></button><b>{entry?.category || "余白地点"}</b><span /></header>
    <main>{entry?.photo ? <img src={entry.photo} alt={`${entry.name}的现场记录`} /> : entry ? <div className="map-entry-placeholder"><MapPin /><small>没有留下照片</small><b>{entry.name}</b><span>{entry.category} · {entry.keyword}</span></div> : <img src={yubaiCard} alt="余白地点体验示例" />}<div className="map-entry-title"><small>{entry?.address || "深圳 · 南山区"}</small><h1>{entry?.name || "还没有选择地点"}</h1><p>{entry?.note || "从余白地图中选择一处真实经历，即可查看当时留下的感知。"}</p></div>
      <section><h2>被保留下来的感知</h2><div><span>{entry?.keyword || "未命名"}</span><span>{entry?.category || "个人地点"}</span>{entry?.audio && <span>声音记录</span>}<span>{entry?.checkInStatus === "device" ? "设备定位打卡" : entry?.checkInStatus === "manual" ? "地图手动选点" : entry?.fieldVerified ? "地点信息已核验" : "体验条件待核验"}</span>{entry?.accuracyMeters && <span>定位精度约 {entry.accuracyMeters} 米</span>}{entry?.arrivalDistanceMeters !== undefined && <span>抵达时距节点约 {entry.arrivalDistanceMeters} 米</span>}</div></section>
      {entry?.location && <section className="map-entry-coordinate"><h2>真实坐标记录</h2><div><span>北纬 {entry.location.latitude.toFixed(6)}</span><span>东经 {entry.location.longitude.toFixed(6)}</span></div>{entry.checkedInAt && <small>{new Date(entry.checkedInAt).toLocaleString("zh-CN", { hour12: false })}</small>}</section>}
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
      <header><div className="profile-orb"><i /><i /><CircleUserRound /></div><h1>内在之海</h1><p>你的感知如何慢慢形成自己的潮汐</p></header>
      <section className="profile-stats"><div><b>{memories.length}</b><small>次漫游</small></div><div><b>{entries.length}</b><small>处余白</small></div><div><b>{keywords.length}</b><small>个关键词</small></div></section>
      <section className="inner-sea"><header><span><Waves />最近的内在潮汐</span><small>近 30 天</small></header><div className="sea-chart"><i /><i /><i /><span>松动</span><span>好奇</span><span>安静</span></div><p>你的感知正在从“空转”缓慢转向“愿意停留”。</p></section>
      <section className="portrait-keywords"><h2>正在形成的自画像</h2><div>{keywords.length ? keywords.map(keyword => <span key={keyword}>{keyword}</span>) : <span>完成并保存一次漫游后开始形成</span>}</div></section>
      <section className="memory-control"><ShieldCheck /><div><b>记忆与控制权</b><p>你可以随时修改、删除 AI 推断，或关闭长期记忆。</p></div><ChevronRight /></section>
      <section className="profile-records"><h2>最近留下的余白</h2>{recentEntries.length ? recentEntries.map((entry, index) => <button key={entry.id} onClick={() => openEntry(entry.id)}>{index === 0 ? <Camera /> : <Wind />}<span><b>{entry.name}</b><small>关键词 · {entry.keyword}</small></span><ChevronRight /></button>) : <p className="profile-empty">尚未保存记录。完成一次漫游后，这里只呈现你主动留下的内容。</p>}</section>
    </main>
    <BottomNav current="profile" navigate={navigate} />
  </section>;
}
