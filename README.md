# 💍 서울·경기 웨딩홀 지도

웨딩홀 512곳(서울 320 · 경기 184 · 울산 8) — 식대·대관료·수용·보증인원 포함.
가격 데이터 출처: [결혼할지도](https://weddingmap.seungjun.dev/) (한국소비자원 참가격 · 아이웨딩·웨딩북·다이렉트 표기가, 2026-09-17 기준). 실제 견적은 업체에 확인.

서울·경기권 웨딩홀을 지도 위에서 한눈에 보는 정적 웹사이트. GitHub Pages에 그대로 올리면 바로 동작함.

## 기능
- 지역(서울/경기) · 유형(호텔/컨벤션/채플/하우스/가든·야외/공공) 필터
- 이름·동네·역 검색
- **내 체크**: 관심 ⭐ / 상담예정 📞 / 투어완료 👀 / 계약 💍 / 제외 ✕ — 지도 핀에도 표시, 구분별 필터
- **메모 + 식대·대관료·보증인원·꽃값·주차대수** 직접 입력 → 대관+꽃 합계, 예상 총액(대관+꽃+식대×보증) 자동 계산
- **실시간 공유**: Firebase 설정 시 공유 링크(`#r=방ID`)를 가진 사람끼리 체크·메모 같이 보고 수정 (미설정 시 브라우저에만 저장)
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

## 다같이 수정 (Firebase)
1. [Firebase 콘솔](https://console.firebase.google.com/) → 프로젝트 추가 (애널리틱스 꺼도 됨)
2. **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)` → 프로덕션 모드
3. Firestore **규칙** 탭에 이 repo의 `firestore.rules` 내용 붙여넣고 게시
4. 프로젝트 설정(⚙️) → 내 앱 → **웹 앱(</>) 추가** → 나오는 `firebaseConfig` 값을 `js/config.js`의 `FIREBASE_CONFIG`에 넣기
5. 사이트 열고 **🔗 공유 링크 복사** → 같이 볼 사람한테 전달

- 링크(방 ID)가 곧 열쇠라서, 링크 가진 사람은 누구나 수정 가능. 아는 사람한테만 공유.
- 처음 연결될 때 이 기기에 있던 체크·메모는 자동으로 공유 방에 올라감.
- `STATUSES` 구분을 바꾸면 `firestore.rules`의 status 목록도 같이 바꿔야 함.

## 접속자 표시
공유 방에 지금 접속한 사람 수와 이름이 보임 (30초 하트비트). 내 이름 칩을 누르면 이름 변경. 메모·체크는 마지막 수정자 이름이 같이 저장됨.

## 위치 자동 보정 (Places API)
`js/config.js`의 `AUTO_GEOCODE: true` 일 때만 동작. 원본 데이터엔 주소가 없어서 처음엔 시군구 중심 근처에 점선 핀으로 찍힘. 구글지도 모드에서 **Places API (New)**가 켜져 있으면
첫 방문 때 장소검색으로 정확한 좌표·주소를 찾아 Firestore `geo` 컬렉션에 캐시 → 이후엔 모두가 캐시 사용.
- Cloud Console에서 **Places API (New)** 사용 설정 + API 키의 API 제한에 추가

## 데이터 갱신
`data/raw/*.txt` (결혼할지도 목록 복사본) 수정 후:
```bash
python3 scripts/build_venues.py   # → js/venues.js 재생성
```

## 웨딩홀 추가
`scripts/build_venues.py`의 `EXTRAS`에 추가 후 빌드 (또는 `js/venues.js` 직접 수정):
```js
{ name: "웨딩홀 이름", region: "경기", area: "성남시 분당구", type: "convention", station: "서현역", lat: 37.38, lng: 127.12, note: "메모" }
```
좌표는 구글지도에서 장소 우클릭 → 맨 위 숫자 클릭하면 복사됨.

## 주의
- 좌표는 근사치. 정확한 위치·가격·운영 여부는 각 웨딩홀에 확인.
- 가격 정보는 변동이 커서 넣지 않음.
