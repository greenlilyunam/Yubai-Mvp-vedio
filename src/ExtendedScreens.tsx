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

export function HomeScreen({ start, readWorld, navigate }: { start: (action: HomeAction) => void; readWorld: () => void; navigate: (tab: HubTab) => void }) {
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
      <section className="history-section"><h2>上一次漫游记录</h2><button onClick={() => navigate("map")}><img src={homeHistory} alt="夜晚便利店的漫游记录" /><span><b>树影、风声、便利店的暖光</b><small>2天前</small></span></button></section>
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

export function ResultCardScreen({ saveToMap, sendToPool, navigate }: { saveToMap: () => void; sendToPool: () => void; navigate: (tab: HubTab) => void }) {
  return <section className="screen hub-screen result-card-screen"><BrandHeader />
    <main className="hub-scroll">
      <h1>今天，你被这些瞬间<br />温柔地捕获了</h1>
      <article className="yubai-result-card"><div className="result-photo"><img src={yubaiCard} alt="灯下安静的门面" /></div>
        <div className="result-tags"><span><Lightbulb />灯光</span><span><BookOpen />话语</span><span><Wind />微风</span><span><Trees />光影</span></div>
        <section><small>状态松动</small><div><span>⌛<em>空转</em></span><i /><span>♨<em>松弛</em></span></div></section>
        <blockquote>“真正的生活不必在远方，<br />只需要重新打开感官。”</blockquote>
        <p><Sparkles />余白 · 我们共同生成了这张卡</p>
      </article>
      <div className="result-actions"><button onClick={saveToMap}><Map />保存到余白地图</button><button onClick={sendToPool}><Waves />投递至匿名共鸣池</button></div>
    </main>
    <BottomNav current="resonance" navigate={navigate} />
  </section>;
}

export function MapScreen({ navigate, add, openEntry, saved }: { navigate: (tab: HubTab) => void; add: () => void; openEntry: () => void; saved: boolean }) {
  const filters = [[Trees, "静谧之所"], [Lightbulb, "令我好奇之地"], [BookOpen, "适合书写之地"], [Bookmark, "值得重访之地"]] as const;
  return <section className="screen hub-screen map-screen"><div className="map-background"><img src={mapStylized} alt="抽象城市地图" /></div>
    <header><b>Yu Bai</b><button onClick={() => navigate("home")}><X /></button></header>
    <main className="map-panel"><h1>我的余白地图</h1><p>漫游的个人存档</p>
      <div>{filters.map(([Icon, label]) => <button key={label} onClick={openEntry}><i><Icon /></i><b>{label}</b><small>查看</small></button>)}</div>
      <aside><i /><span><b>余白 AI</b>{saved ? "新的“灯下停留”已经沉淀在地图里。" : "正在沉淀你的灵感..."}</span></aside>
      <button className="map-add-button" onClick={add}><Plus />添加一处余白</button>
    </main>
    <div className="map-pin map-pin-one" /><div className="map-pin map-pin-two" />
    <BottomNav current="map" navigate={navigate} />
  </section>;
}

export function MapAddScreen({ back, save }: { back: () => void; save: () => void }) {
  const [kind, setKind] = useState(0);
  const [name, setName] = useState("灯下停留");
  const kinds = ["🔑", "🔖", "✚", "📁", "🏠", "👩", "🔭", "✏️"];
  return <section className="screen map-add-screen"><BrandHeader close={back} />
    <div className="map-add-canvas"><img src={mapDetail} alt="城市地图" /><label><Search /><input aria-label="搜索地点" placeholder="搜索这里" /></label><i className="pin-a" /><i className="pin-b" /></div>
    <section className="map-editor"><i className="sheet-grip" /><div className="map-kinds">{kinds.map((item, index) => <button key={item} className={kind === index ? "selected" : ""} onClick={() => setKind(index)}>{item}</button>)}</div><label><MapPin /><input value={name} onChange={event => setName(event.target.value)} placeholder="给这里一个名字" /></label><button onClick={save}>添加到余白地图</button></section>
  </section>;
}

export function MapEntryScreen({ back }: { back: () => void }) {
  return <section className="screen scroll-screen map-entry-screen"><header><button onClick={back}><ChevronLeft /></button><b>静谧之所</b><span /></header>
    <main><img src={yubaiCard} alt="灯下的安静空间" /><div className="map-entry-title"><small>深圳 · 南山区</small><h1>灯下停留</h1><p>那天没有发生特别的事，只是光落在门前，让我愿意慢下来。</p></div>
      <section><h2>被保留下来的感知</h2><div><span>低人流</span><span>暖光</span><span>微风</span><span>可停留</span></div></section>
      <aside><Sparkles /><p><b>余白 AI 观察</b>你在光线柔和、没有明确任务的空间里停留得更久。</p></aside>
      <button className="primary-button" onClick={back}><span>回到我的余白地图</span><ChevronRight /></button>
    </main>
  </section>;
}

export function ProfileScreen({ navigate }: { navigate: (tab: HubTab) => void }) {
  return <section className="screen hub-screen profile-screen"><BrandHeader />
    <main className="hub-scroll">
      <header><div className="profile-orb"><CircleUserRound /></div><h1>内在之海</h1><p>你的感知如何慢慢形成自己的潮汐</p></header>
      <section className="profile-stats"><div><b>12</b><small>次漫游</small></div><div><b>36</b><small>处余白</small></div><div><b>8</b><small>个关键词</small></div></section>
      <section className="inner-sea"><header><span><Waves />最近的内在潮汐</span><small>近 30 天</small></header><div className="sea-chart"><i /><i /><i /><span>松动</span><span>好奇</span><span>安静</span></div><p>你的感知正在从“空转”缓慢转向“愿意停留”。</p></section>
      <section className="portrait-keywords"><h2>正在形成的自画像</h2><div><span>需要低刺激恢复</span><span>被光影触发</span><span>偏爱可退出的连接</span><span>在傍晚更敏感</span></div></section>
      <section className="memory-control"><ShieldCheck /><div><b>记忆与控制权</b><p>你可以随时修改、删除 AI 推断，或关闭长期记忆。</p></div><ChevronRight /></section>
      <section className="profile-records"><h2>最近留下的余白</h2><button><Camera /><span><b>灯下停留</b><small>关键词 · 松动</small></span><ChevronRight /></button><button><Wind /><span><b>树影经过墙面</b><small>关键词 · 呼吸感</small></span><ChevronRight /></button></section>
    </main>
    <BottomNav current="profile" navigate={navigate} />
  </section>;
}
