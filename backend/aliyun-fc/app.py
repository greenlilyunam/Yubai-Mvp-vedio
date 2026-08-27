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


class AmapError(Exception):
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


def text_value(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "、".join(str(item) for item in value if item)
    return "" if value is None else str(value)


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


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "yubai-api",
        "message": "余白服务端运行正常",
        "endpoints": {
            "health": "/health",
            "weather": "/weather",
            "places": "/places",
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
        live = lives[0]
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


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "ok": False,
        "error": "接口不存在",
    }), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9000)
