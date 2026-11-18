// 서울·경기 웨딩홀 데이터
// - 좌표(lat/lng)는 지도 표시용 근사치예요. 정확한 위치는 각 카드의 "구글지도에서 열기"로 확인하세요.
// - type: hotel | convention | chapel | house | garden | public
// - 새 웨딩홀은 아래 배열에 한 줄씩 추가하면 끝.
window.VENUES = [
  // ── 서울 · 호텔 ─────────────────────────────
  { name: "서울신라호텔", region: "서울", area: "중구 장충동", type: "hotel", station: "동대입구역", lat: 37.5559, lng: 127.0053 },
  { name: "그랜드 하얏트 서울", region: "서울", area: "용산구 한남동", type: "hotel", station: "한강진역", lat: 37.5393, lng: 126.9972 },
  { name: "롯데호텔 서울", region: "서울", area: "중구 소공동", type: "hotel", station: "을지로입구역", lat: 37.5651, lng: 126.9810 },
  { name: "웨스틴 조선 서울", region: "서울", area: "중구 소공동", type: "hotel", station: "시청역", lat: 37.5644, lng: 126.9800 },
  { name: "더 플라자 호텔", region: "서울", area: "중구 태평로", type: "hotel", station: "시청역", lat: 37.5649, lng: 126.9779 },
  { name: "포시즌스 호텔 서울", region: "서울", area: "종로구 당주동", type: "hotel", station: "광화문역", lat: 37.5714, lng: 126.9752 },
  { name: "반얀트리 클럽 앤 스파 서울", region: "서울", area: "중구 장충동", type: "hotel", station: "동대입구역", lat: 37.5520, lng: 127.0010 },
  { name: "시그니엘 서울", region: "서울", area: "송파구 신천동", type: "hotel", station: "잠실역", lat: 37.5126, lng: 127.1025 },
  { name: "롯데호텔 월드", region: "서울", area: "송파구 잠실동", type: "hotel", station: "잠실역", lat: 37.5110, lng: 127.0980 },
  { name: "JW 메리어트 호텔 서울", region: "서울", area: "서초구 반포동", type: "hotel", station: "고속터미널역", lat: 37.5046, lng: 127.0045 },
  { name: "조선 팰리스 서울 강남", region: "서울", area: "강남구 역삼동", type: "hotel", station: "역삼역", lat: 37.5031, lng: 127.0418 },
  { name: "인터컨티넨탈 서울 코엑스", region: "서울", area: "강남구 삼성동", type: "hotel", station: "삼성역", lat: 37.5126, lng: 127.0565 },
  { name: "그랜드 인터컨티넨탈 서울 파르나스", region: "서울", area: "강남구 삼성동", type: "hotel", station: "삼성역", lat: 37.5089, lng: 127.0607 },
  { name: "그랜드 워커힐 서울", region: "서울", area: "광진구 광장동", type: "hotel", station: "광나루역", lat: 37.5550, lng: 127.1080 },
  { name: "콘래드 서울", region: "서울", area: "영등포구 여의도동", type: "hotel", station: "여의도역", lat: 37.5256, lng: 126.9265 },
  { name: "페어몬트 앰배서더 서울", region: "서울", area: "영등포구 여의도동", type: "hotel", station: "여의나루역", lat: 37.5265, lng: 126.9285 },
  { name: "더케이호텔 서울", region: "서울", area: "서초구 양재동", type: "hotel", station: "양재시민의숲역", lat: 37.4686, lng: 127.0373 },
  { name: "메이필드호텔 서울", region: "서울", area: "강서구 외발산동", type: "garden", station: "송정역", lat: 37.5603, lng: 126.8105, note: "호텔 + 가든 예식" },

  // ── 서울 · 채플/컨벤션 ───────────────────────
  { name: "더채플앳청담", region: "서울", area: "강남구 청담동", type: "chapel", station: "강남구청역", lat: 37.5226, lng: 127.0420 },
  { name: "더채플앳논현", region: "서울", area: "강남구 논현로 549", type: "chapel", station: "언주역", lat: 37.5072, lng: 127.0339 },
  { name: "아펠가모 반포", region: "서울", area: "서초구 반포대로 235", type: "convention", station: "", lat: 37.5030, lng: 127.0080, note: "뷔페 맛집으로 유명" },
  { name: "아펠가모 선릉", region: "서울", area: "강남구 대치동", type: "convention", station: "선릉역", lat: 37.5040, lng: 127.0485 },
  { name: "아펠가모 광화문", region: "서울", area: "종로구 중학동", type: "convention", station: "광화문역", lat: 37.5747, lng: 126.9780 },
  { name: "마리아쥬스퀘어", region: "서울", area: "강남구 논현동", type: "convention", station: "", lat: 37.5110, lng: 127.0300, note: "한상 차림 피로연" },
  { name: "상암 월드컵컨벤션", region: "서울", area: "마포구 성산동", type: "convention", station: "월드컵경기장역", lat: 37.5683, lng: 126.8972, note: "뷔페 맛집으로 유명" },
  { name: "63컨벤션센터", region: "서울", area: "영등포구 여의도동", type: "convention", station: "여의나루역", lat: 37.5198, lng: 126.9402 },
  { name: "엘타워", region: "서울", area: "서초구 양재동", type: "convention", station: "양재역", lat: 37.4767, lng: 127.0354 },
  { name: "세빛섬", region: "서울", area: "서초구 반포동", type: "convention", station: "고속터미널역", lat: 37.5115, lng: 126.9960, note: "한강 위 플로팅 컨벤션" },
  { name: "지타워컨벤션", region: "서울", area: "구로구", type: "convention", station: "구로디지털단지역 (셔틀)", lat: 37.4840, lng: 126.8960 },

  // ── 서울 · 공공예식장 ────────────────────────
  { name: "피움서울 (서울여성플라자)", region: "서울", area: "동작구 대방동", type: "public", station: "대방역", lat: 37.5096, lng: 126.9269, note: "서울시 공공웨딩홀 · 대관료 무료 · 하객 200명" },
  { name: "한남스카이 웨딩가든 (남산)", region: "서울", area: "용산구 한남동", type: "public", station: "", lat: 37.5420, lng: 127.0025, note: "서울시 공공 야외예식장" },
  { name: "서울숲 웨딩가든", region: "서울", area: "성동구 성수동", type: "public", station: "서울숲역", lat: 37.5444, lng: 127.0374, note: "서울시 공공 야외예식장" },
  { name: "서울식물원 보타닉 웨딩가든", region: "서울", area: "강서구 마곡동", type: "public", station: "마곡나루역", lat: 37.5694, lng: 126.8350, note: "서울시 공공 야외예식장" },

  // ── 경기 ────────────────────────────────────
  { name: "그래비티 조선 서울 판교", region: "경기", area: "성남시 분당구 백현동", type: "hotel", station: "판교역", lat: 37.3948, lng: 127.1112, note: "최대 200명" },
  { name: "더블트리 바이 힐튼 서울 판교", region: "경기", area: "성남시 분당구 백현동", type: "hotel", station: "판교역", lat: 37.3925, lng: 127.1105 },
  { name: "가천컨벤션센터", region: "경기", area: "성남시 수정구 복정동", type: "convention", station: "가천대역", lat: 37.4510, lng: 127.1270 },
  { name: "노보텔 앰배서더 수원", region: "경기", area: "수원시 팔달구 매산로", type: "hotel", station: "수원역", lat: 37.2662, lng: 127.0010 },
  { name: "수원월드컵컨벤션", region: "경기", area: "수원시 팔달구 우만동", type: "convention", station: "", lat: 37.2865, lng: 127.0368 },
  { name: "파티움하우스", region: "경기", area: "수원시 팔달구 인계동", type: "house", station: "", lat: 37.2660, lng: 127.0300, note: "밝은 홀 · 단독 연회장" },
  { name: "퍼스트가든", region: "경기", area: "파주시 탄현면", type: "garden", station: "", lat: 37.7765, lng: 126.6935, note: "단독 대관 야외 정원 + 실내홀" },
  { name: "아델라한옥", region: "경기", area: "양평군", type: "garden", station: "", lat: 37.4917, lng: 127.4876, note: "한옥 야외 예식" },
  { name: "베뉴지1995", region: "경기", area: "고양시 일산 (구 그랜드백화점)", type: "convention", station: "", lat: 37.6588, lng: 126.7700, note: "2027년 10월 첫 예식 예정" }
];

// estMeal: 직접 입력 전 쓰는 유형별 1인 식대 추정치(만원). 홀마다 편차 크니 참고용.
window.VENUE_TYPES = {
  hotel:      { label: "호텔",     color: "#B08D57", estMeal: 10 },
  convention: { label: "컨벤션",   color: "#C86B85", estMeal: 5.5 },
  chapel:     { label: "채플",     color: "#7A6FB0", estMeal: 6.5 },
  house:      { label: "하우스",   color: "#D99A6C", estMeal: 7 },
  garden:     { label: "가든·야외", color: "#5E9C76", estMeal: 8 },
  public:     { label: "공공",     color: "#4A86B8", estMeal: 5 }
};

// 내 체크 구분 — 이름/이모지/색 자유롭게 바꿔도 됨
window.STATUSES = {
  fav:   { label: "관심",     emoji: "⭐", color: "#E3A008" },
  call:  { label: "상담예정", emoji: "📞", color: "#4A86B8" },
  tour:  { label: "투어완료", emoji: "👀", color: "#7A6FB0" },
  pick:  { label: "계약",     emoji: "💍", color: "#B5576F" },
  nope:  { label: "제외",     emoji: "✕",  color: "#9A928C" }
};
