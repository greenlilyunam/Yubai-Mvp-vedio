import json
import os
import re
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Flask, jsonify, request


app = Flask(__name__)

ALLOWED_ORIGINS = {
    "https://greenlilyunam.github.io",
}

AMAP_WEATHER_URL = "https://restapi.amap.com/v3/weather/weatherInfo"
AMAP_PLACE_TEXT_URL = "https://restapi.amap.com/v5/place/text"
AMAP_PLACE_AROUND_URL = "https://restapi.amap.com/v5/place/around"
AMAP_WALKING_URL = "https://restapi.amap.com/v5/direction/walking"
BAILIAN_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
BAILIAN_DEFAULT_MODEL = "qwen-flash"

DEFAULT_ADCODE = "440305"
DEFAULT_STATION_KEYWORD = "大学城地铁站-C口"
DEFAULT_SEARCH_RADIUS = 2000
PLACE_SEARCH_GROUPS = (
    ("nature", "公园|绿地|广场|花园"),
    ("culture", "图书馆|书店|美术馆|博物馆|文化馆|展览馆"),
    ("rest", "咖啡厅|咖啡|茶馆|茶室"),
)
EXCLUDED_NAME_PARTS = (
    "停车场",
    "卫生间",
    "充电站",
    "出入口",
    "售票处",
    "培训",
    "教育",
    "成长中心",
    "俱乐部",
    "路演大厅",
)
EXCLUDED_TYPE_PARTS = (
    "培训机构",
    "公司企业",
    "楼宇",
    "产业园区",
    "运动场馆",
)
CATEGORY_LIMITS = {
    "自然空间": 5,
    "阅读空间": 3,
    "文化空间": 3,
    "公共空间": 2,
    "停留空间": 3,
}
CATEGORY_PRIORITY = {
    "自然空间": 0,
    "阅读空间": 1,
    "文化空间": 2,
    "公共空间": 3,
    "停留空间": 4,
}
ROUTE_CATEGORY_STAY_MINUTES = {
    "自然空间": 10,
    "阅读空间": 12,
    "文化空间": 12,
    "公共空间": 8,
    "停留空间": 12,
}
ROUTE_ACTIONS = {
    "自然空间": "放慢脚步，观察一种正在变化的自然细节",
    "阅读空间": "挑一处安静位置，停留阅读或记录此刻感受",
    "文化空间": "只选择一个吸引你的细节，不要求完整参观",
    "公共空间": "在不妨碍他人的位置停留，感受空间与人流节奏",
    "停留空间": "把这里作为可跳过的休息点，不必为了路线而消费",
}


class AmapError(Exception):
    def __init__(self, code, message, http_status=502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


class BailianError(Exception):
    def __init__(self, code, message, http_status=502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


@app.after_request
def add_response_headers(response):
    origin = request.headers.get("Origin")

    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"

    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def env_value(name, default=""):
    return os.environ.get(name, default).strip()


def amap_key():
    key = env_value("AMAP_WEB_KEY")
    if not key:
        raise AmapError(
            "AMAP_KEY_MISSING",
            "服务器尚未配置高德Web服务Key",
            503,
        )
    return key


def amap_get(url, parameters, timeout=8):
    query = urlencode({"key": amap_key(), "output": "JSON", **parameters})
    amap_request = Request(
        url + "?" + query,
        headers={"User-Agent": "Yubai-MVP/1.0"},
    )

    try:
        with urlopen(amap_request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise AmapError(
            "AMAP_HTTP_ERROR",
            "高德服务返回HTTP错误",
            502,
        ) from error
    except (URLError, TimeoutError) as error:
        raise AmapError(
            "AMAP_NETWORK_ERROR",
            "暂时无法连接高德服务",
            504,
        ) from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AmapError(
            "AMAP_RESPONSE_ERROR",
            "高德返回的数据格式异常",
            502,
        ) from error

    if data.get("status") != "1":
        raise AmapError(
            "AMAP_API_ERROR",
            data.get("info", "高德接口调用失败"),
            502,
        )

    return data


def bailian_key():
    key = env_value("DASHSCOPE_API_KEY")
    if not key:
        raise BailianError(
            "BAILIAN_KEY_MISSING",
            "服务器尚未配置百炼 API Key",
            503,
        )
    return key


def bailian_http_error(error):
    upstream_code = ""
    try:
        upstream_data = json.loads(error.read().decode("utf-8"))
        raw_code = text_value(upstream_data.get("code") or upstream_data.get("error", {}).get("code"))
        upstream_code = re.sub(r"[^A-Za-z0-9_.-]", "", raw_code)[:60]
    except (AttributeError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        pass

    status = int(getattr(error, "code", 502) or 502)
    code_suffix = f"，{upstream_code}" if upstream_code else ""
    messages = {
        400: f"百炼请求参数错误（400{code_suffix}）：检查模型名称与参数兼容性",
        401: f"百炼拒绝了 API Key（401{code_suffix}）：检查 Key 是否完整并属于中国内地地域",
        403: f"百炼权限不足（403{code_suffix}）：确认模型服务已开通且 Key 有访问权限",
        404: f"百炼找不到模型或接口（404{code_suffix}）：检查 BAILIAN_MODEL 和 BAILIAN_BASE_URL",
        429: f"百炼额度或调用频率受限（429{code_suffix}）：检查免费额度、余额或稍后重试",
    }
    return BailianError(
        "BAILIAN_HTTP_ERROR",
        messages.get(status, f"百炼服务返回 HTTP {status}{code_suffix}，请检查函数日志"),
        502,
    )


def bailian_chat(messages, timeout=18):
    base_url = env_value("BAILIAN_BASE_URL", BAILIAN_DEFAULT_BASE_URL).rstrip("/")
    model = env_value("BAILIAN_MODEL", BAILIAN_DEFAULT_MODEL)
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_completion_tokens": 500,
        "enable_thinking": False,
        "response_format": {"type": "json_object"},
    }, ensure_ascii=False).encode("utf-8")
    model_request = Request(
        base_url + "/chat/completions",
        data=payload,
        method="POST",
        headers={
            "Authorization": "Bearer " + bailian_key(),
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "User-Agent": "Yubai-MVP/1.0",
        },
    )

    try:
        with urlopen(model_request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise bailian_http_error(error) from error
    except (URLError, TimeoutError) as error:
        raise BailianError(
            "BAILIAN_NETWORK_ERROR",
            "暂时无法连接百炼模型服务",
            504,
        ) from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BailianError(
            "BAILIAN_RESPONSE_ERROR",
            "百炼返回的数据格式异常",
            502,
        ) from error

    choices = data.get("choices", [])
    content = choices[0].get("message", {}).get("content") if choices else None
    if not isinstance(content, str) or not content.strip():
        raise BailianError(
            "BAILIAN_EMPTY_RESPONSE",
            "百炼没有返回可用的状态理解",
            502,
        )

    try:
        interpretation = json.loads(content)
    except json.JSONDecodeError as error:
        raise BailianError(
            "BAILIAN_JSON_ERROR",
            "百炼没有返回标准 JSON 状态理解",
            502,
        ) from error

    return interpretation, data, model


def text_value(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "、".join(str(item) for item in value if item)
    return "" if value is None else str(value)


def integer_value(value, default=0):
    try:
        return int(float(text_value(value) or default))
    except (TypeError, ValueError):
        return default


def split_location(location):
    try:
        longitude, latitude = location.split(",", 1)
        return {
            "longitude": float(longitude),
            "latitude": float(latitude),
        }
    except (AttributeError, TypeError, ValueError):
        return None


def normalized_name(name):
    return re.sub(r"[\s\-—_（）()·]", "", name or "").lower()


def choose_station(pois):
    if not pois:
        return None

    desired = normalized_name(DEFAULT_STATION_KEYWORD)
    ranked = sorted(
        pois,
        key=lambda poi: (
            0 if normalized_name(text_value(poi.get("name"))) == desired else 1,
            0 if "c口" in normalized_name(text_value(poi.get("name"))) else 1,
            0 if "大学城" in text_value(poi.get("name")) else 1,
        ),
    )
    return ranked[0]


def find_station(adcode):
    searches = (DEFAULT_STATION_KEYWORD, "大学城地铁站")

    for keyword in searches:
        data = amap_get(
            AMAP_PLACE_TEXT_URL,
            {
                "keywords": keyword,
                "region": adcode,
                "city_limit": "true",
                "show_fields": "business",
                "page_size": "10",
                "page_num": "1",
            },
        )
        station = choose_station(data.get("pois", []))
        if station and split_location(station.get("location")):
            return station

    raise AmapError(
        "STATION_NOT_FOUND",
        "没有找到大学城地铁站C口",
        404,
    )


def classify_place(name, type_name):
    if any(part in name for part in EXCLUDED_NAME_PARTS):
        return None
    if any(part in type_name for part in EXCLUDED_TYPE_PARTS):
        return None

    # “创客公园”“产业园”等名称并不等于自然公园。自然空间必须由
    # 高德地点类型明确标注为公园或城市广场，不能只凭名称推断。
    type_parts = {part.strip() for part in type_name.split(";") if part.strip()}
    if "公园广场" in type_parts and "公园" in type_parts:
        return "自然空间", ["地图类型：公园", "自然体验待实地核验"]
    if "公园广场" in type_parts and any("广场" in part for part in type_parts - {"公园广场"}):
        return "公共空间", ["地图类型：广场", "人流与座椅待实地核验"]
    if any(word in name for word in ("图书馆", "书店")):
        return "阅读空间", ["地图名称：阅读空间", "开放与安静度待核验"]
    if any(word in name for word in ("美术馆", "文化馆", "博物馆", "展览馆")):
        return "文化空间", ["地图名称：文化空间", "开放时间待核验"]
    if any(word in name for word in ("咖啡", "茶馆", "茶室")):
        return "停留空间", ["地图名称：咖啡或茶空间", "消费与座位待核验"]

    return None


def serialize_place(poi):
    name = text_value(poi.get("name"))
    type_name = text_value(poi.get("type"))
    location = split_location(poi.get("location"))

    if not name or not location:
        return None

    classification = classify_place(name, type_name)
    if not classification:
        return None

    try:
        distance = int(float(text_value(poi.get("distance")) or 0))
    except ValueError:
        distance = 0

    category, signals = classification

    return {
        "id": text_value(poi.get("id")),
        "name": name,
        "address": text_value(poi.get("address")),
        "type": type_name,
        "category": category,
        "signals": signals,
        "distanceMeters": distance,
        "location": location,
        "fieldVerified": False,
    }


def dedupe_key(place):
    name = normalized_name(place["name"])
    location = place["location"]
    return (
        name,
        round(location["longitude"], 4),
        round(location["latitude"], 4),
    )


def select_balanced_places(raw_places, maximum=12):
    unique = []
    seen_ids = set()
    seen_places = set()

    for poi in raw_places:
        place = serialize_place(poi)
        if not place:
            continue

        place_key = dedupe_key(place)
        place_id = place["id"]
        if (place_id and place_id in seen_ids) or place_key in seen_places:
            continue

        if place_id:
            seen_ids.add(place_id)
        seen_places.add(place_key)
        unique.append(place)

    unique.sort(
        key=lambda place: (
            CATEGORY_PRIORITY.get(place["category"], 99),
            place["distanceMeters"],
            place["name"],
        )
    )

    selected = []
    category_counts = {}
    for place in unique:
        category = place["category"]
        count = category_counts.get(category, 0)
        if count >= CATEGORY_LIMITS.get(category, 0):
            continue
        category_counts[category] = count + 1
        selected.append(place)
        if len(selected) == maximum:
            break

    # 最终展示按距离排序；类别优先级只用于控制候选结构。
    selected.sort(key=lambda place: (place["distanceMeters"], place["name"]))
    return selected, category_counts


def find_place_candidates(adcode):
    station = find_station(adcode)
    station_location = station.get("location")
    raw_places = []

    for _, keywords in PLACE_SEARCH_GROUPS:
        around = amap_get(
            AMAP_PLACE_AROUND_URL,
            {
                "location": station_location,
                "keywords": keywords,
                "radius": str(DEFAULT_SEARCH_RADIUS),
                "sortrule": "distance",
                "region": adcode,
                "show_fields": "business",
                "page_size": "25",
                "page_num": "1",
            },
            timeout=10,
        )
        raw_places.extend(around.get("pois", []))

    candidates, category_counts = select_balanced_places(raw_places)
    return station, candidates, category_counts


def integer_query(name, default, minimum, maximum):
    value = request.args.get(name, str(default))
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise AmapError(
            "INVALID_ROUTE_STATE",
            f"{name} 必须是数字",
            400,
        )
    if parsed < minimum or parsed > maximum:
        raise AmapError(
            "INVALID_ROUTE_STATE",
            f"{name} 必须在 {minimum} 到 {maximum} 之间",
            400,
        )
    return parsed


def choice_query(name, default, choices):
    value = request.args.get(name, default).strip().lower()
    if value not in choices:
        raise AmapError(
            "INVALID_ROUTE_STATE",
            f"{name} 只支持：{'、'.join(choices)}",
            400,
        )
    return value


def route_state():
    return {
        "energy": integer_query("energy", 30, 0, 100),
        "availableMinutes": integer_query("minutes", 40, 20, 90),
        "social": choice_query("social", "low", ("low", "medium", "high")),
        "preference": choice_query(
            "preference",
            "balanced",
            ("balanced", "calm", "sheltered", "inspiration", "social"),
        ),
    }


def live_weather(adcode):
    data = amap_get(
        AMAP_WEATHER_URL,
        {
            "city": adcode,
            "extensions": "base",
        },
    )
    lives = data.get("lives", [])
    if not lives:
        raise AmapError(
            "WEATHER_NOT_FOUND",
            "没有查询到南山区实时天气",
            404,
        )
    return lives[0]


def weather_requires_shelter(weather):
    description = text_value(weather.get("weather"))
    try:
        humidity = int(float(text_value(weather.get("humidity")) or 0))
        temperature = int(float(text_value(weather.get("temperature")) or 0))
    except ValueError:
        humidity = 0
        temperature = 0
    severe_words = ("雨", "雷", "雪", "雾", "沙", "霾")
    return any(word in description for word in severe_words) or humidity >= 85 or temperature >= 33


def category_order(state, shelter_needed):
    preference = state.get("preference", "balanced")
    if shelter_needed:
        order = ["阅读空间", "文化空间", "停留空间", "自然空间", "公共空间"]
    elif preference == "sheltered":
        order = ["阅读空间", "文化空间", "停留空间", "自然空间", "公共空间"]
    elif preference == "inspiration":
        order = ["文化空间", "自然空间", "阅读空间", "公共空间", "停留空间"]
    elif preference == "social":
        order = ["公共空间", "停留空间", "文化空间", "自然空间", "阅读空间"]
    elif preference == "calm":
        order = ["自然空间", "阅读空间", "文化空间", "公共空间", "停留空间"]
    elif state["energy"] <= 40:
        order = ["自然空间", "阅读空间", "文化空间", "公共空间", "停留空间"]
    else:
        order = ["自然空间", "文化空间", "阅读空间", "公共空间", "停留空间"]

    if state["social"] == "high":
        social_first = ["停留空间", "公共空间"] if shelter_needed else ["公共空间", "停留空间"]
        order = social_first + [category for category in order if category not in social_first]
    elif state["social"] == "low":
        order = [category for category in order if category != "停留空间"] + ["停留空间"]
    return order


def select_route_stops(candidates, state, shelter_needed):
    maximum_distance = 850 if state["energy"] <= 40 else 1400
    desired_count = 1 if state["availableMinutes"] <= 28 else 2
    order = category_order(state, shelter_needed)
    ranked = sorted(
        (place for place in candidates if place["distanceMeters"] <= maximum_distance),
        key=lambda place: (
            order.index(place["category"]) if place["category"] in order else 99,
            place["distanceMeters"],
        ),
    )

    selected = []
    selected_categories = set()
    for place in ranked:
        if place["category"] in selected_categories:
            continue
        selected.append(place)
        selected_categories.add(place["category"])
        if len(selected) == desired_count:
            break

    if not selected and candidates:
        selected = [min(candidates, key=lambda place: place["distanceMeters"])]

    # 先去离起点更近的地方，避免因类别排序产生明显折返。
    selected.sort(key=lambda place: place["distanceMeters"])
    return selected


def coordinate(location):
    return f'{location["longitude"]:.6f},{location["latitude"]:.6f}'


def walking_leg(origin, destination):
    parameters = {
        "origin": coordinate(origin["location"]),
        "destination": coordinate(destination["location"]),
        "isindoor": "0",
        "alternative_route": "1",
        "show_fields": "cost,navi,polyline",
    }
    if origin.get("id"):
        parameters["origin_id"] = origin["id"]
    if destination.get("id"):
        parameters["destination_id"] = destination["id"]

    data = amap_get(AMAP_WALKING_URL, parameters, timeout=10)
    paths = data.get("route", {}).get("paths", [])
    if not paths:
        raise AmapError(
            "WALKING_ROUTE_NOT_FOUND",
            f'没有找到前往“{destination["name"]}”的步行路线',
            404,
        )

    path = paths[0]
    cost = path.get("cost") if isinstance(path.get("cost"), dict) else {}
    distance = integer_value(path.get("distance"))
    duration = integer_value(cost.get("duration") or path.get("duration"))

    steps = []
    for step in path.get("steps", []):
        step_cost = step.get("cost") if isinstance(step.get("cost"), dict) else {}
        steps.append({
            "instruction": text_value(step.get("instruction")),
            "road": text_value(step.get("road_name")),
            "distanceMeters": integer_value(step.get("step_distance")),
            "durationSeconds": integer_value(step_cost.get("duration")),
            "polyline": text_value(step.get("polyline")),
        })

    return {
        "from": origin["name"],
        "to": destination["name"],
        "distanceMeters": distance,
        "durationSeconds": duration,
        "instructions": steps,
    }


def route_explanation(state, weather, shelter_needed, stops):
    reasons = [
        f'当前能量 {state["energy"]}%：限制步行半径和节点数量',
        f'可用 {state["availableMinutes"]} 分钟：为停留体验预留时间，而非全部用于赶路',
    ]
    if state["social"] == "low":
        reasons.append("社交意愿低：公共免费空间优先，消费场所降级为备选")
    preference_labels = {
        "calm": "状态协商结果：优先自然与安静阅读空间",
        "sheltered": "状态协商结果：优先室内或可遮蔽空间",
        "inspiration": "状态协商结果：优先文化与观察型空间",
        "social": "状态协商结果：优先可低压力接触他人的空间",
    }
    if state.get("preference") in preference_labels:
        reasons.append(preference_labels[state["preference"]])
    if shelter_needed:
        reasons.append(
            f'当前{weather.get("weather")}、湿度{weather.get("humidity")}%：提高室内或可遮蔽空间优先级'
        )
    reasons.append("地点只采用高德地图事实；安静度、座椅和开放情况仍需实地核验")
    if stops:
        reasons.append("本次节点：" + " → ".join(stop["name"] for stop in stops))
    return reasons


def limited_text(value, maximum=300):
    return text_value(value).strip()[:maximum]


def limited_text_list(value, maximum_items=4, maximum_length=80):
    if not isinstance(value, list):
        return []
    result = []
    for item in value[:maximum_items]:
        content = limited_text(item, maximum_length)
        if content:
            result.append(content)
    return result


def validate_interpretation(value):
    if not isinstance(value, dict):
        raise BailianError(
            "BAILIAN_SCHEMA_ERROR",
            "百炼状态理解缺少 JSON 对象",
            502,
        )
    preference = limited_text(value.get("routePreference"), 20)
    allowed_preferences = {"balanced", "calm", "sheltered", "inspiration", "social"}
    if preference not in allowed_preferences:
        preference = "balanced"
    summary = limited_text(value.get("summary"), 220)
    if not summary:
        raise BailianError(
            "BAILIAN_SCHEMA_ERROR",
            "百炼状态理解缺少 summary",
            502,
        )
    return {
        "summary": summary,
        "needs": limited_text_list(value.get("needs")),
        "avoid": limited_text_list(value.get("avoid")),
        "routePreference": preference,
        "confidence": limited_text(value.get("confidence"), 30) or "需要用户确认",
        "boundaryNotice": limited_text(value.get("boundaryNotice"), 160)
        or "这只是状态理解，不是心理诊断；最终路线由用户确认。",
    }


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "yubai-api",
        "message": "余白服务端运行正常",
        "endpoints": {
            "health": "/health",
            "weather": "/weather",
            "places": "/places",
            "interpret": "POST /interpret",
            "route": "/route?energy=30&minutes=40&social=low",
        },
    })


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return "", 204

    return jsonify({
        "ok": True,
        "service": "yubai-api",
        "region": "cn-shenzhen",
        "time": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/weather", methods=["GET", "OPTIONS"])
def weather():
    if request.method == "OPTIONS":
        return "", 204

    try:
        adcode = env_value("AMAP_DEFAULT_ADCODE", DEFAULT_ADCODE)
        live = live_weather(adcode)
        return jsonify({
            "ok": True,
            "source": "高德开放平台",
            "area": {
                "province": live.get("province"),
                "city": live.get("city"),
                "adcode": live.get("adcode"),
            },
            "weather": live.get("weather"),
            "temperature": live.get("temperature"),
            "humidity": live.get("humidity"),
            "windDirection": live.get("winddirection"),
            "windPower": live.get("windpower"),
            "reportTime": live.get("reporttime"),
        })
    except AmapError as error:
        return jsonify({
            "ok": False,
            "error": error.code,
            "message": error.message,
        }), error.http_status


@app.route("/places", methods=["GET", "OPTIONS"])
def places():
    if request.method == "OPTIONS":
        return "", 204

    try:
        adcode = env_value("AMAP_DEFAULT_ADCODE", DEFAULT_ADCODE)
        station, candidates, category_counts = find_place_candidates(adcode)
        station_location = station.get("location")

        return jsonify({
            "ok": True,
            "source": "高德开放平台",
            "origin": {
                "name": text_value(station.get("name")),
                "address": text_value(station.get("address")),
                "location": split_location(station_location),
            },
            "searchRadiusMeters": DEFAULT_SEARCH_RADIUS,
            "candidateStatus": "地图候选，需人工实地核验安静度、座椅、遮蔽与开放时间",
            "selectionPolicy": "以高德地点类型为主，过滤培训、楼栋、园区和活动场馆，并按类别限额去重",
            "categoryCounts": category_counts,
            "places": candidates,
        })
    except AmapError as error:
        return jsonify({
            "ok": False,
            "error": error.code,
            "message": error.message,
        }), error.http_status


@app.route("/interpret", methods=["POST", "OPTIONS"])
def interpret():
    if request.method == "OPTIONS":
        return "", 204

    try:
        if request.content_length and request.content_length > 4096:
            raise BailianError(
                "INTERPRETATION_INPUT_TOO_LARGE",
                "状态数据过长",
                413,
            )
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            try:
                payload = json.loads(request.get_data(cache=False, as_text=True))
            except (TypeError, ValueError, json.JSONDecodeError):
                payload = None
        if not isinstance(payload, dict):
            raise BailianError(
                "INVALID_INTERPRETATION_INPUT",
                "请提交 JSON 状态数据",
                400,
            )

        try:
            energy = int(payload.get("energy"))
            available_minutes = int(payload.get("minutes"))
        except (TypeError, ValueError) as error:
            raise BailianError(
                "INVALID_INTERPRETATION_INPUT",
                "energy 和 minutes 必须是数字",
                400,
            ) from error
        if not 0 <= energy <= 100 or not 20 <= available_minutes <= 90:
            raise BailianError(
                "INVALID_INTERPRETATION_INPUT",
                "energy 需为 0～100，minutes 需为 20～90",
                400,
            )

        social = limited_text(payload.get("social"), 20)
        action = limited_text(payload.get("action"), 20)
        allowed_social = {"独处", "轻微接触", "开放交流"}
        allowed_actions = {"散步", "坐一会", "寻找灵感"}
        if social not in allowed_social or action not in allowed_actions:
            raise BailianError(
                "INVALID_INTERPRETATION_INPUT",
                "social 或 action 不在允许范围内",
                400,
            )

        minimized_state = {
            "energy": energy,
            "minutes": available_minutes,
            "social": social,
            "action": action,
        }
        system_prompt = """你是“余白”城市精神漫游产品中的状态协商模块。
你的任务不是诊断心理状态，而是把四个最小化字段转化为可由用户确认的路线偏好。
不要声称知道用户未提供的感受，不要给医疗建议，不要虚构地点、天气或地图事实。
必须只输出一个 JSON 对象，字段严格如下：
summary: 一句克制、可修正的状态理解；
needs: 1到4个短语数组；
avoid: 1到4个短语数组；
routePreference: 只能是 balanced、calm、sheltered、inspiration、social 之一；
confidence: 使用“初步理解，等待确认”或类似措辞；
boundaryNotice: 明确这不是心理诊断，路线最终由用户确认。
偏好含义：calm=自然与安静阅读；sheltered=室内或遮蔽；inspiration=文化与观察；social=低压力接触；balanced=均衡。"""
        interpretation, raw_response, model = bailian_chat([
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "请根据以下最小化状态数据输出 JSON："
                + json.dumps(minimized_state, ensure_ascii=False),
            },
        ])
        validated = validate_interpretation(interpretation)
        usage = raw_response.get("usage", {})

        return jsonify({
            "ok": True,
            "source": "阿里云百炼",
            "model": model,
            "interpretation": validated,
            "privacy": {
                "sentFields": ["energy", "minutes", "social", "action"],
                "excludedFields": ["description", "name", "history", "location"],
                "storedByYubai": False,
            },
            "humanControl": "AI 仅生成可修正的路线偏好；是否采用及最终路线由用户确认",
            "usage": {
                "inputTokens": integer_value(usage.get("prompt_tokens")),
                "outputTokens": integer_value(usage.get("completion_tokens")),
                "totalTokens": integer_value(usage.get("total_tokens")),
            },
        })
    except BailianError as error:
        return jsonify({
            "ok": False,
            "error": error.code,
            "message": error.message,
        }), error.http_status


@app.route("/route", methods=["GET", "OPTIONS"])
def route():
    if request.method == "OPTIONS":
        return "", 204

    try:
        state = route_state()
        adcode = env_value("AMAP_DEFAULT_ADCODE", DEFAULT_ADCODE)
        weather = live_weather(adcode)
        shelter_needed = weather_requires_shelter(weather)
        station, candidates, _ = find_place_candidates(adcode)
        stops = select_route_stops(candidates, state, shelter_needed)
        if not stops:
            raise AmapError(
                "ROUTE_STOPS_NOT_FOUND",
                "当前没有符合状态与距离限制的地点",
                404,
            )

        origin_location = split_location(station.get("location"))
        route_points = [{
            "id": text_value(station.get("id")),
            "name": text_value(station.get("name")),
            "location": origin_location,
        }] + stops
        legs = [
            walking_leg(route_points[index], route_points[index + 1])
            for index in range(len(route_points) - 1)
        ]
        preliminary_walking_minutes = round(sum(leg["durationSeconds"] for leg in legs) / 60)
        preliminary_stay_minutes = sum(
            ROUTE_CATEGORY_STAY_MINUTES[stop["category"]] for stop in stops
        )
        if (
            len(stops) > 1
            and preliminary_walking_minutes + preliminary_stay_minutes
            > state["availableMinutes"] + 5
        ):
            stops = stops[:-1]
            legs = legs[:-1]

        walking_distance = sum(leg["distanceMeters"] for leg in legs)
        walking_seconds = sum(leg["durationSeconds"] for leg in legs)
        stay_minutes = sum(ROUTE_CATEGORY_STAY_MINUTES[stop["category"]] for stop in stops)
        walking_minutes = max(1, round(walking_seconds / 60)) if walking_seconds else 0
        flexible_pause_minutes = max(
            0,
            min(10, state["availableMinutes"] - walking_minutes - stay_minutes),
        )

        serialized_stops = []
        for index, stop in enumerate(stops, start=1):
            serialized_stops.append({
                **stop,
                "sequence": index,
                "suggestedStayMinutes": ROUTE_CATEGORY_STAY_MINUTES[stop["category"]],
                "suggestedAction": ROUTE_ACTIONS[stop["category"]],
            })

        return jsonify({
            "ok": True,
            "source": "高德开放平台",
            "routeStatus": "真实步行规划；地点体验属性仍需实地核验",
            "state": state,
            "weatherContext": {
                "weather": weather.get("weather"),
                "temperature": weather.get("temperature"),
                "humidity": weather.get("humidity"),
                "shelterPreferred": shelter_needed,
            },
            "origin": route_points[0],
            "stops": serialized_stops,
            "legs": legs,
            "summary": {
                "walkingDistanceMeters": walking_distance,
                "walkingDurationMinutes": walking_minutes,
                "suggestedStayMinutes": stay_minutes,
                "flexiblePauseMinutes": flexible_pause_minutes,
                "estimatedTotalMinutes": walking_minutes + stay_minutes + flexible_pause_minutes,
                "requestedMinutes": state["availableMinutes"],
            },
            "fitExplanation": route_explanation(
                state,
                weather,
                shelter_needed,
                serialized_stops,
            ),
        })
    except AmapError as error:
        return jsonify({
            "ok": False,
            "error": error.code,
            "message": error.message,
        }), error.http_status


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "ok": False,
        "error": "接口不存在",
    }), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9000)
