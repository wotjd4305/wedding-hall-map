// 구글지도 API 키를 넣으면 구글지도로 표시돼요.
// 비워두면 OpenStreetMap(Leaflet)으로 자동 대체돼서 키 없이도 바로 동작해요.
//
// 키 발급: Google Cloud Console → "Maps JavaScript API" 사용 설정 → 사용자 인증 정보 → API 키
// 보안: 키 제한 → "HTTP 리퍼러"에 https://<깃허브아이디>.github.io/* 추가 (필수!)
window.APP_CONFIG = {
  GOOGLE_MAPS_API_KEY: "AIzaSyDn0UBKdl-DsNNlJdxgD9shoqTDn022dQk"
};
