// 구글지도 API 키 — 비워두면 OpenStreetMap으로 자동 대체
// 키 제한: HTTP 리퍼러 https://wotjd4305.github.io/* + API는 Maps JavaScript API만
window.APP_CONFIG = {
  GOOGLE_MAPS_API_KEY: "AIzaSyDn0UBKdl-DsNNlJdxgD9shoqTDn022dQk",

  // 다같이 체크·메모 공유용 Firebase 설정 (Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성)
  // null이면 체크·메모가 이 브라우저에만 저장돼요.
  FIREBASE_CONFIG: null
  // 예시)
  // FIREBASE_CONFIG: {
  //   apiKey: "...",
  //   authDomain: "xxx.firebaseapp.com",
  //   projectId: "xxx",
  //   storageBucket: "xxx.appspot.com",
  //   messagingSenderId: "...",
  //   appId: "..."
  // }
};
