// =============================================================================
//  Firebase 연결 정보
//  - idrcc-scoring 과 같은 Firebase 프로젝트(idrcc-d9cb5)의 Realtime Database 를 사용합니다.
//  - 드론 추격전 기록은 config.js 의 DB_PATH('drone_chase_2026') 아래에만 저장되므로
//    IDRCC 기록(scores)과 섞이지 않습니다.
//  - 웹용 Firebase 키는 원래 공개되는 값입니다. 데이터 보호는 Firebase 콘솔의
//    '보안 규칙(Rules)'이 담당합니다. (README '보안' 항목 참고)
//  - 다른 Firebase 프로젝트를 쓰려면 아래 값을 그 프로젝트의 값으로 바꾸면 됩니다.
// =============================================================================

export const firebaseConfig = {
  apiKey: 'AIzaSyCRYeoh01XG4-c4wopyH-5IUUoiVWvMd28',
  authDomain: 'idrcc-d9cb5.firebaseapp.com',
  databaseURL: 'https://idrcc-d9cb5-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'idrcc-d9cb5',
  storageBucket: 'idrcc-d9cb5.firebasestorage.app',
  messagingSenderId: '320566419768',
  appId: '1:320566419768:web:887aa5fc5a634aaede21cd',
};
