// 최초 오픈 및 "프리셋 초기화" 버튼이 참조하는 기본 프리셋 목록.
// 사용자 커스텀은 localStorage의 state.presetItems로 덮어써진다.

const DEFAULT_PRESET_ITEMS = [
  { name: '기초 활동 보고서', price: 1, buyCount: 90 },
  { name: '일반 활동 보고서', price: 3, buyCount: 95 },
  { name: '상급 활동 보고서', price: 12, buyCount: 30 },
  { name: '최상급 활동 보고서', price: 60, buyCount: 12 },
  { name: '기초 전술교육 BD', price: 10, buyCount: 30 },
  { name: '일반 전술교육 BD', price: 30, buyCount: 18 },
  { name: '상급 전술교육 BD', price: 100, buyCount: 12 },
  { name: '최상급 전술교육 BD', price: 300, buyCount: 4 },
  { name: '하얀 오파츠', price: 5, buyCount: 45 },
  { name: '파랑 오파츠', price: 15, buyCount: 55 },
  { name: '노랑 오파츠', price: 50, buyCount: 12 },
  { name: '보라 오파츠', price: 200, buyCount: 6 },
  { name: '일반 선물', price: 200, buyCount: 10 },
  { name: '고급 선물', price: 300, buyCount: 1 },
  { name: '하급 강화석', price: 1, buyCount: 180 },
  { name: '일반 강화석', price: 4, buyCount: 95 },
  { name: '상급 강화석', price: 15, buyCount: 30 },
  { name: '최상급 강화석', price: 60, buyCount: 12 },
  { name: '기초 기술노트', price: 5, buyCount: 50 },
  { name: '일반 기술노트', price: 15, buyCount: 38 },
  { name: '상급 기술노트', price: 50, buyCount: 25 },
  { name: '최상급 기술노트', price: 200, buyCount: 15 },
  { name: '가구 2000', price: 2000, buyCount: 1 },
  { name: '가구 1000', price: 1000, buyCount: 1 },
  { name: '이벤트 포인트', price: 15000, buyCount: 1 },
];

function cloneDefaultPresetItems() {
  return DEFAULT_PRESET_ITEMS.map(p => ({ name: p.name, price: p.price, buyCount: p.buyCount }));
}

if (typeof window !== 'undefined') {
  window.DEFAULT_PRESET_ITEMS = DEFAULT_PRESET_ITEMS;
  window.cloneDefaultPresetItems = cloneDefaultPresetItems;
}
