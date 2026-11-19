// 구글지도 API 키 — 비워두면 OpenStreetMap으로 자동 대체
// 키 제한: HTTP 리퍼러 https://wotjd4305.github.io/* + API는 Maps JavaScript API만
window.APP_CONFIG = {
  GOOGLE_MAPS_API_KEY: "AIzaSyDn0UBKdl-DsNNlJdxgD9shoqTDn022dQk",

  // 다같이 체크·메모 공유용 Firebase 설정 (Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성)
  // null이면 체크·메모가 이 브라우저에만 저장돼요.
  // true로 바꾸면 구글 Places API(New)로 웨딩홀 정확한 위치를 자동 보정 (Cloud Console에서 Places API (New) 켜야 함)
  AUTO_GEOCODE: false,

  // true로 바꾸면 전화번호 없는 곳들을 Places API(New)로 한 번씩 자동 조회해서 채워줌 (직접 입력한 전화번호가 항상 우선)
  // 연락처 정보(전화번호)는 위치 검색보다 비싼 요금제(Contact Data)로 청구되고, 찾은 뒤엔 공유 DB에 캐싱돼서 그 다음부턴 다시 조회 안 함.
  // Cloud Console에서 Places API (New) 켜져 있어야 하고, 512곳이면 실제 비용이 발생하니 단가는 구글 클라우드 가격표에서 미리 확인할 것.
  AUTO_PHONE: true,

  FIREBASE_CONFIG: {
    apiKey: "AIzaSyBuPVCEHgwr3XbiBLwT6ll_UJrjptc2ozg",
    authDomain: "wedding-57d95.firebaseapp.com",
    projectId: "wedding-57d95",
    storageBucket: "wedding-57d95.firebasestorage.app",
    messagingSenderId: "206271014289",
    appId: "1:206271014289:web:477675f293d0628e302630"
  }
};
