# 💍 서울·경기 웨딩홀 지도

서울·경기권 웨딩홀을 지도 위에서 한눈에 보는 정적 웹사이트. GitHub Pages에 그대로 올리면 바로 동작함.

## 기능
- 지역(서울/경기) · 유형(호텔/컨벤션/채플/하우스/가든·야외/공공) 필터
- 이름·동네·역 검색
- **내 체크**: 관심 ⭐ / 상담예정 📞 / 투어완료 👀 / 계약 💍 / 제외 ✕ — 지도 핀에도 표시, 구분별 필터
- **메모 + 식대·대관료·보증인원** 직접 입력 (브라우저 localStorage에 저장)
- **식대 슬라이더 필터** · 식대 낮은 순 정렬 (입력 전엔 유형별 추정치 사용, "직접 입력한 가격만" 옵션)
- 체크·메모 **JSON 내보내기/가져오기** → 예비신부/신랑이랑 공유하거나 폰↔PC 옮길 때
- 내 위치 기준 가까운 순 정렬
- 마커 클릭 → 구글지도 / 네이버지도 바로가기
- 체크 구분 이름·이모지는 `js/venues.js`의 `STATUSES`에서 바꿀 수 있음
- 모바일 바텀시트 UI
- 구글지도 API 키가 있으면 Google Maps, 없으면 OpenStreetMap으로 자동 대체

## 구조
```
index.html
css/style.css
js/config.js   ← 구글지도 API 키
js/venues.js   ← 웨딩홀 데이터 (여기에 추가/수정)
js/app.js
```

## GitHub Pages 배포
```bash
# 1) GitHub에서 빈 repo 생성 (예: wedding-hall-map)
git remote add origin https://github.com/<아이디>/wedding-hall-map.git
git push -u origin main

# 2) repo → Settings → Pages → Source: "Deploy from a branch", Branch: main / (root) → Save
# 3) 1~2분 뒤 https://<아이디>.github.io/wedding-hall-map/ 접속
```
gh CLI 쓰면 한 번에:
```bash
gh repo create wedding-hall-map --public --source=. --push
gh api -X POST repos/{owner}/wedding-hall-map/pages -f "source[branch]=main" -f "source[path]=/"
```

## 구글지도 붙이기
1. [Google Cloud Console](https://console.cloud.google.com/) → **Maps JavaScript API** 사용 설정
2. 사용자 인증 정보 → API 키 생성
3. **키 제한 → HTTP 리퍼러**에 `https://<아이디>.github.io/*` 추가 (공개 repo라 필수)
4. `js/config.js`의 `GOOGLE_MAPS_API_KEY`에 붙여넣고 push

## 웨딩홀 추가
`js/venues.js` 배열에 한 줄 추가:
```js
{ name: "웨딩홀 이름", region: "경기", area: "성남시 분당구", type: "convention", station: "서현역", lat: 37.38, lng: 127.12, note: "메모" }
```
좌표는 구글지도에서 장소 우클릭 → 맨 위 숫자 클릭하면 복사됨.

## 주의
- 좌표는 근사치. 정확한 위치·가격·운영 여부는 각 웨딩홀에 확인.
- 가격 정보는 변동이 커서 넣지 않음.
