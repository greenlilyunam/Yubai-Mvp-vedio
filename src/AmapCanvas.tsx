import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type GeoPoint = { longitude: number; latitude: number };

export type AmapPoint = {
  id: string;
  label: string;
  location: GeoPoint;
  verified?: boolean;
};

export type AmapCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitPoints: () => void;
  centerOn: (point: GeoPoint) => void;
};

type AmapStatus = "loading" | "ready" | "missing-key" | "error";

type AmapCanvasProps = {
  points?: AmapPoint[];
  activeId?: string;
  selectedLocation?: GeoPoint | null;
  fallbackImage: string;
  className?: string;
  onMarkerClick?: (id: string) => void;
  onSelectLocation?: (point: GeoPoint) => void;
  onStatusChange?: (status: AmapStatus) => void;
};

declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

const DEFAULT_CENTER: [number, number] = [113.965511, 22.582908];
let amapLoader: Promise<any> | null = null;

function loadAmap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  const key = String(import.meta.env.VITE_AMAP_JS_KEY || "").trim();
  if (!key) return Promise.reject(new Error("AMAP_JS_KEY_MISSING"));
  if (amapLoader) return amapLoader;
  const securityCode = String(import.meta.env.VITE_AMAP_SECURITY_CODE || "").trim();
  if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
  amapLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-yubai-amap]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.AMap), { once: true });
      existing.addEventListener("error", () => reject(new Error("AMAP_JS_LOAD_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.yubaiAmap = "true";
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Geocoder`;
    script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error("AMAP_JS_UNAVAILABLE"));
    script.onerror = () => reject(new Error("AMAP_JS_LOAD_FAILED"));
    document.head.appendChild(script);
  });
  return amapLoader;
}

export async function reverseGeocode(point: GeoPoint): Promise<string> {
  const AMap = await loadAmap();
  return new Promise((resolve, reject) => {
    const geocoder = new AMap.Geocoder({ radius: 300, extensions: "base" });
    geocoder.getAddress([point.longitude, point.latitude], (status: string, result: any) => {
      const address = result?.regeocode?.formattedAddress;
      if (status === "complete" && address) resolve(address);
      else reject(new Error("REVERSE_GEOCODE_FAILED"));
    });
  });
}

function markerContent(index: number, active: boolean, verified: boolean) {
  return `<div class="amap-memory-marker${active ? " active" : ""}${verified ? " verified" : ""}" aria-hidden="true"><span>${index + 1}</span></div>`;
}

export const AmapCanvas = forwardRef<AmapCanvasHandle, AmapCanvasProps>(function AmapCanvas({
  points = [], activeId = "", selectedLocation = null, fallbackImage, className = "",
  onMarkerClick, onSelectLocation, onStatusChange,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const selectionMarkerRef = useRef<any>(null);
  const pointsRef = useRef(points);
  const markerClickRef = useRef(onMarkerClick);
  const selectLocationRef = useRef(onSelectLocation);
  const [status, setStatus] = useState<AmapStatus>("loading");

  pointsRef.current = points;
  markerClickRef.current = onMarkerClick;
  selectLocationRef.current = onSelectLocation;

  const reportStatus = (next: AmapStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    fitPoints: () => {
      const markers = [...markerRefs.current, selectionMarkerRef.current].filter(Boolean);
      if (markers.length) mapRef.current?.setFitView(markers, false, [100, 45, 250, 45], 16);
      else mapRef.current?.setZoomAndCenter(13, DEFAULT_CENTER);
    },
    centerOn: point => mapRef.current?.setZoomAndCenter(16, [point.longitude, point.latitude]),
  }), []);

  useEffect(() => {
    let disposed = false;
    reportStatus("loading");
    loadAmap().then(AMap => {
      if (disposed || !hostRef.current) return;
      const firstPoint = pointsRef.current.find(point => point.location)?.location;
      const map = new AMap.Map(hostRef.current, {
        center: firstPoint ? [firstPoint.longitude, firstPoint.latitude] : DEFAULT_CENTER,
        zoom: firstPoint ? 15 : 13,
        viewMode: "2D",
        resizeEnable: true,
        mapStyle: "amap://styles/whitesmoke",
        showLabel: true,
      });
      map.on("click", (event: any) => {
        if (!selectLocationRef.current || !event?.lnglat) return;
        selectLocationRef.current({ longitude: event.lnglat.getLng(), latitude: event.lnglat.getLat() });
      });
      mapRef.current = map;
      reportStatus("ready");
    }).catch(error => {
      if (disposed) return;
      reportStatus(error instanceof Error && error.message === "AMAP_JS_KEY_MISSING" ? "missing-key" : "error");
    });
    return () => {
      disposed = true;
      markerRefs.current = [];
      selectionMarkerRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const AMap = window.AMap;
    const map = mapRef.current;
    if (!AMap || !map || status !== "ready") return;
    markerRefs.current.forEach(marker => marker.setMap(null));
    markerRefs.current = points.map((point, index) => {
      const marker = new AMap.Marker({
        position: [point.location.longitude, point.location.latitude],
        anchor: "bottom-center",
        content: markerContent(index, point.id === activeId, Boolean(point.verified)),
        title: point.label,
        zIndex: point.id === activeId ? 130 : 100,
      });
      marker.on("click", () => markerClickRef.current?.(point.id));
      marker.setMap(map);
      return marker;
    });
    if (points.length && !activeId) map.setFitView(markerRefs.current, false, [125, 50, 260, 50], 16);
  }, [activeId, points, status]);

  useEffect(() => {
    const AMap = window.AMap;
    const map = mapRef.current;
    if (!AMap || !map || status !== "ready") return;
    if (selectionMarkerRef.current) selectionMarkerRef.current.setMap(null);
    selectionMarkerRef.current = null;
    if (!selectedLocation) return;
    const marker = new AMap.Marker({
      position: [selectedLocation.longitude, selectedLocation.latitude],
      anchor: "bottom-center",
      content: '<div class="amap-checkin-marker"><i></i><span>此刻</span></div>',
      zIndex: 160,
    });
    marker.setMap(map);
    selectionMarkerRef.current = marker;
    map.setZoomAndCenter(16, [selectedLocation.longitude, selectedLocation.latitude]);
  }, [selectedLocation, status]);

  return <div className={`amap-surface ${className} ${status !== "ready" ? "is-fallback" : ""}`}>
    <img className="amap-fallback-image" src={fallbackImage} alt="余白地点地图背景" />
    <div ref={hostRef} className="amap-host" aria-label="可缩放的真实高德地图" />
    {status === "loading" && <div className="amap-load-state">正在载入真实地图…</div>}
    {status === "missing-key" && <div className="amap-load-state"><b>真实地图待启用</b><span>定位记录仍可保存，配置网页地图 Key 后显示底图。</span></div>}
    {status === "error" && <div className="amap-load-state"><b>地图暂时没有连上</b><span>可先保存坐标，网络恢复后会显示标记。</span></div>}
  </div>;
});
