#!/usr/bin/env python3
"""data/raw/*.txt (결혼할지도 목록 복사본) → js/venues.js 생성

사용: python3 scripts/build_venues.py
- 좌표가 없는 홀은 시군구 중심 + 약간의 흩뿌림으로 배치(approx), 사이트에서 구글 장소검색으로 자동 보정
- KNOWN_COORDS 에 있는 이름은 그 좌표 사용
- EXTRAS 는 원본 목록에 없는 곳(공공예식장 등) 추가
"""
import json, re, hashlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "js" / "venues.js"

FILES = [("seoul.txt", "서울"), ("gyeonggi.txt", "경기"), ("ulsan.txt", "울산")]

TYPE_MAP = {"컨벤션": "convention", "전문홀": "hall", "호텔": "hotel", "하우스": "house", "공공": "public", "교회": "church"}

# 시군구 중심(구청·시청 부근) 근사 좌표
CENTROIDS = {
    "서울": {
        "강남구": (37.5172, 127.0473), "강동구": (37.5301, 127.1238), "강북구": (37.6396, 127.0257), "강서구": (37.5509, 126.8495),
        "관악구": (37.4781, 126.9515), "광진구": (37.5385, 127.0823), "구로구": (37.4954, 126.8874), "금천구": (37.4569, 126.8955),
        "노원구": (37.6542, 127.0568), "도봉구": (37.6688, 127.0471), "동대문구": (37.5744, 127.0400), "동작구": (37.5124, 126.9393),
        "마포구": (37.5663, 126.9019), "서대문구": (37.5791, 126.9368), "서초구": (37.4837, 127.0324), "성동구": (37.5634, 127.0369),
        "성북구": (37.5894, 127.0167), "송파구": (37.5145, 127.1059), "양천구": (37.5170, 126.8664), "영등포구": (37.5264, 126.8962),
        "용산구": (37.5324, 126.9906), "은평구": (37.6027, 126.9291), "종로구": (37.5735, 126.9790), "중구": (37.5641, 126.9979),
        "중랑구": (37.6063, 127.0925),
    },
    "경기": {
        "고양시": (37.6584, 126.8320), "고양시 덕양구": (37.6375, 126.8320), "고양시 일산동구": (37.6587, 126.7750), "고양시 일산서구": (37.6754, 126.7507),
        "과천시": (37.4292, 126.9876), "광명시": (37.4786, 126.8646), "광주시": (37.4295, 127.2550), "구리시": (37.5943, 127.1296),
        "군포시": (37.3617, 126.9352), "김포시": (37.6153, 126.7156), "남양주시": (37.6360, 127.2165), "동두천시": (37.9036, 127.0606),
        "부천시 소사구": (37.4835, 126.7953), "부천시 원미구": (37.5035, 126.7660), "성남시": (37.4200, 127.1265),
        "성남시 분당구": (37.3827, 127.1189), "성남시 수정구": (37.4504, 127.1456), "성남시 중원구": (37.4307, 127.1373),
        "수원시 권선구": (37.2580, 126.9718), "수원시 영통구": (37.2596, 127.0466), "수원시 장안구": (37.3039, 127.0101), "수원시 팔달구": (37.2827, 127.0198),
        "시흥시": (37.3800, 126.8029), "안산시 단원구": (37.3190, 126.8113), "안산시 상록구": (37.3009, 126.8466), "안성시": (37.0080, 127.2797),
        "안양시 동안구": (37.3925, 126.9516), "안양시 만안구": (37.3864, 126.9323), "양주시": (37.7853, 127.0458), "양평군": (37.4917, 127.4876),
        "여주시": (37.2983, 127.6374), "오산시": (37.1498, 127.0773), "용인시 기흥구": (37.2804, 127.1146), "용인시 수지구": (37.3221, 127.0975),
        "용인시 처인구": (37.2342, 127.2017), "의왕시": (37.3448, 126.9683), "의정부시": (37.7381, 127.0337), "이천시": (37.2721, 127.4350),
        "파주시": (37.7600, 126.7800), "평택시": (36.9921, 127.1129), "포천시": (37.8949, 127.2003), "하남시": (37.5393, 127.2148),
        "화성시": (37.1995, 126.8312), "화성시 동탄구": (37.2005, 127.0730), "화성시 병점구": (37.2070, 127.0330),
    },
    "울산": {"남구": (35.5439, 129.3301), "동구": (35.5050, 129.4167), "북구": (35.5826, 129.3614), "울주군": (35.5223, 129.2424)},
}

# 이미 위치를 아는 곳 (근사치라도 시군구 중심보단 정확)
KNOWN_COORDS = {
    "호텔신라": (37.5559, 127.0053), "그랜드하얏트서울": (37.5393, 126.9972), "롯데호텔서울(소공동)": (37.5651, 126.9810),
    "웨스틴조선호텔서울": (37.5644, 126.9800), "더플라자(26.9월까지 운영)": (37.5649, 126.9779), "포시즌스호텔서울": (37.5714, 126.9752),
    "반얀트리클럽앤스파서울": (37.5520, 127.0010), "시그니엘서울": (37.5126, 127.1025), "롯데호텔월드(잠실)": (37.5110, 127.0980),
    "JW 메리어트 호텔 서울": (37.5046, 127.0045), "JW Marriott 서울": (37.5046, 127.0045), "조선 팰리스 서울 강남": (37.5031, 127.0418),
    "그랜드인터컨티넨탈 서울 파르나스": (37.5089, 127.0607), "그랜드워커힐서울": (37.5550, 127.1080), "콘래드서울호텔": (37.5256, 126.9265),
    "페어몬트앰배서더서울": (37.5265, 126.9285), "메이필드호텔": (37.5603, 126.8105), "더채플앳청담": (37.5226, 127.0420),
    "더채플앳논현": (37.5072, 127.0339), "아펠가모 반포점": (37.5030, 127.0080), "아펠가모 선릉점": (37.5040, 127.0485),
    "아펠가모 광화문점": (37.5747, 126.9780), "강남마리아쥬스퀘어": (37.5110, 127.0300), "월드컵컨벤션": (37.5683, 126.8972),
    "엘타워(ELTOWER)": (37.4767, 127.0354), "플로팅아일랜드": (37.5115, 126.9960), "지타워컨벤션": (37.4840, 126.8960),
    "그래비티 조선 서울 판교": (37.3948, 127.1112), "더블트리바이힐튼서울판교": (37.3925, 127.1105), "가천컨벤션센터": (37.4510, 127.1270),
    "노보텔앰배서더수원": (37.2662, 127.0010), "파티움하우스수원": (37.2660, 127.0300), "퍼스트가든": (37.7765, 126.6935),
    "베뉴지1995(일산점)(27.10월 오픈예정)": (37.6588, 126.7700),
}

# 원본 목록에 없는 곳
EXTRAS = [
    {"name": "피움서울 (서울여성플라자)", "region": "서울", "area": "동작구", "type": "public", "lat": 37.5096, "lng": 126.9269, "note": "서울시 공공웨딩홀 · 대관료 무료 · 하객 200명", "cap": 200},
    {"name": "한남스카이 웨딩가든 (남산)", "region": "서울", "area": "용산구", "type": "public", "lat": 37.5420, "lng": 127.0025, "note": "서울시 공공 야외예식장", "approx": True},
    {"name": "서울숲 웨딩가든", "region": "서울", "area": "성동구", "type": "public", "lat": 37.5444, "lng": 127.0374, "note": "서울시 공공 야외예식장"},
    {"name": "서울식물원 보타닉 웨딩가든", "region": "서울", "area": "강서구", "type": "public", "lat": 37.5694, "lng": 126.8350, "note": "서울시 공공 야외예식장"},
    {"name": "63컨벤션센터", "region": "서울", "area": "영등포구", "type": "convention", "lat": 37.5198, "lng": 126.9402},
    {"name": "인터컨티넨탈 서울 코엑스", "region": "서울", "area": "강남구", "type": "hotel", "lat": 37.5126, "lng": 127.0565},
    {"name": "더케이호텔 서울", "region": "서울", "area": "서초구", "type": "hotel", "lat": 37.4686, "lng": 127.0373},
    {"name": "수원월드컵컨벤션", "region": "경기", "area": "수원시 팔달구", "type": "convention", "lat": 37.2865, "lng": 127.0368},
    {"name": "아델라한옥", "region": "경기", "area": "양평군", "type": "house", "lat": 37.4917, "lng": 127.4876, "note": "한옥 야외 예식", "approx": True},
]


def price(s):
    """'7.4만~13만' → [7.4, 13], '0원' → [0, 0], '-' → None (단위: 만원)"""
    s = s.strip()
    if not s or s == "-":
        return None
    parts = [p.strip() for p in s.split("~")]
    vals = []
    for p in parts:
        if p.endswith("원") and not p.endswith("만원"):
            vals.append(0.0 if p == "0원" else float(p[:-1].replace(",", "")) / 10000)
        else:
            vals.append(float(p.replace("만원", "").replace("만", "").replace(",", "")))
    if len(vals) == 1:
        vals.append(vals[0])
    return [round(vals[0], 3), round(vals[1], 3)]


def intval(s):
    s = s.strip()
    return int(s) if s.isdigit() else None


def jitter(name, scale=0.012):
    h = hashlib.md5(name.encode()).digest()
    return ((h[0] / 255 - .5) * 2 * scale, (h[1] / 255 - .5) * 2 * scale)


def parse(path, region):
    rows, on = [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("이름\t시군구"):
            on = True
            continue
        if not on:
            continue
        if line.startswith("이 지역 가격 통계") or not line.strip():
            break
        cols = [c.strip() for c in line.split("\t")]
        if len(cols) < 8:
            continue
        name, area, typ, meal, meal_off, rent, cap, guar = cols[:8]
        rows.append({
            "name": name, "region": region, "area": area, "type": TYPE_MAP.get(typ, "hall"),
            "meal": price(meal), "mealOff": price(meal_off), "rent": price(rent),
            "cap": intval(cap), "guar": intval(guar),
        })
    return rows


def main():
    venues, seen = [], set()
    for fname, region in FILES:
        for v in parse(RAW / fname, region):
            if v["name"] in seen:
                continue
            seen.add(v["name"])
            if v["name"] in KNOWN_COORDS:
                v["lat"], v["lng"] = KNOWN_COORDS[v["name"]]
            else:
                c = CENTROIDS[region].get(v["area"])
                if not c:
                    raise SystemExit(f"시군구 좌표 없음: {region} {v['area']} ({v['name']})")
                dy, dx = jitter(v["name"])
                v["lat"], v["lng"], v["approx"] = round(c[0] + dy, 5), round(c[1] + dx, 5), True
            if any(k in v["name"] for k in ("오픈예정", "운영)", "미정)")):
                v["note"] = "오픈/운영 일정 확인 필요"
            venues.append({k: val for k, val in v.items() if val is not None})
    for e in EXTRAS:
        if e["name"] not in seen:
            venues.append(e)

    lines = ",\n".join("  " + json.dumps(v, ensure_ascii=False, separators=(",", ":")) for v in venues)
    OUT.write_text(f"""// ⚠️ 자동 생성 파일 — scripts/build_venues.py 로 다시 만드세요.
// 가격 데이터 출처: 결혼할지도(weddingmap.seungjun.dev) — 한국소비자원 참가격(결혼서비스 가격공개),
//   아이웨딩·웨딩북·다이렉트 표기가 (페이지 갱신 2026-09-17). 실제 견적은 업체에 확인.
// 필드: meal=식대 표기가[min,max] / mealOff=참가격 공시가 / rent=대관료 (모두 만원), cap=수용, guar=보증인원
//       approx=true 면 시군구 중심 근사 좌표 (사이트에서 구글 장소검색으로 자동 보정)
window.VENUES = [
{lines}
];

window.VENUE_TYPES = {{
  hotel:      {{ label: "호텔",   color: "#B08D57" }},
  convention: {{ label: "컨벤션", color: "#C86B85" }},
  hall:       {{ label: "전문홀", color: "#7A6FB0" }},
  house:      {{ label: "하우스", color: "#D99A6C" }},
  public:     {{ label: "공공",   color: "#4A86B8" }},
  church:     {{ label: "교회",   color: "#5E9C76" }}
}};

// 내 체크 구분 — 바꾸면 firestore.rules 의 status 목록도 같이 수정
window.STATUSES = {{
  fav:   {{ label: "관심",     emoji: "⭐", color: "#E3A008" }},
  call:  {{ label: "상담예정", emoji: "📞", color: "#4A86B8" }},
  tour:  {{ label: "투어완료", emoji: "👀", color: "#7A6FB0" }},
  pick:  {{ label: "계약",     emoji: "💍", color: "#B5576F" }},
  nope:  {{ label: "제외",     emoji: "✕",  color: "#9A928C" }}
}};
""", encoding="utf-8")
    by = {}
    for v in venues:
        by[v["region"]] = by.get(v["region"], 0) + 1
    print(f"{len(venues)} venues → {OUT.relative_to(ROOT)}", by,
          "| approx:", sum(1 for v in venues if v.get("approx")),
          "| with rent:", sum(1 for v in venues if "rent" in v))


if __name__ == "__main__":
    main()
