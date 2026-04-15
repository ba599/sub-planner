# 상점 아이템 프리셋 & 한글 자동완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상점 아이템 입력 시 프리셋 기반 한글 자동완성(자모/초성 부분일치)을 추가해 반복 입력을 없앤다.

**Architecture:** `state`에 `presetItems` 필드를 추가하고 기존 JSON 보기/저장/불러오기 흐름에 편승. 한글 매칭은 es-hangul에서 `disassemble`/`getChoseong`만 순수 JS 파일(`hangul.js`)로 추출. 아이템 이름 인풋에 드롭다운 UI를 붙이고 선택 시 `name`/`price`/`buyCount`를 채운 뒤 같은 상점의 다음 셀로 포커스 이동.

**Tech Stack:** 브라우저 전용 vanilla JS, `<script>` 단일 페이지. 기존 테스트 프레임은 `test.html` (자체 assertEqual/assertTrue). 패키지 매니저·빌드 없음. 저장소는 git이 아니므로 커밋 단계는 생략한다.

**참고 문서:** `docs/superpowers/specs/2026-04-14-shop-item-preset-design.md`

---

## 파일 구조

**신규**
- `hangul.js` — es-hangul의 `disassemble`, `getChoseong`과 그 의존성을 인라인으로 복사한 단일 파일. `window.disassemble`, `window.getChoseong`로 전역 노출.

**수정**
- `logic.js` — `defaultState.presetItems` / `validateState` / 순수 매칭 함수 `matchPresetItems`
- `ui.js` — 하위호환 주입, 프리셋 수정 버튼 핸들러, 이름 인풋 전용 컴포넌트(자동완성 포함), 다음 셀 포커스 헬퍼, 아이템 추가 기본값 변경
- `event-planner.html` — `<script src="hangul.js">` 추가, 프리셋 수정 버튼 markup, CSS
- `test.html` — `<script src="hangul.js">` 추가, 신규 테스트 케이스

---

## Task 1: `hangul.js` 추출 및 테스트

**Files:**
- Create: `hangul.js`
- Modify: `test.html` (script 추가 + 테스트 추가)
- Modify: `event-planner.html` (script 추가)

- [ ] **Step 1.1: 실패하는 한글 유틸 테스트 작성**

`test.html`에서 `<!-- === TEST CASES (이후 태스크에서 추가) === -->` 주석 아래에 다음 테스트를 추가한다:

```js
test('disassemble: 완성형 문자열 자모 분해', () => {
  assertEqual(disassemble('가방'), 'ㄱㅏㅂㅏㅇ');
});

test('disassemble: 종성이 있는 단일 문자', () => {
  assertEqual(disassemble('갑'), 'ㄱㅏㅂ');
});

test('disassemble: 종성 없는 단일 문자', () => {
  assertEqual(disassemble('가'), 'ㄱㅏ');
});

test('disassemble: 복합 자모가 종성에 있는 경우', () => {
  // 값 = ㄱ + ㅏ + ㅄ(=ㅂㅅ)
  assertEqual(disassemble('값'), 'ㄱㅏㅂㅅ');
});

test('disassemble: 복합 중성', () => {
  // 과 = ㄱ + ㅘ(=ㅗㅏ)
  assertEqual(disassemble('과'), 'ㄱㅗㅏ');
});

test('disassemble: 한글 아닌 문자는 그대로', () => {
  assertEqual(disassemble('abc'), 'abc');
});

test('disassemble: 빈 문자열', () => {
  assertEqual(disassemble(''), '');
});

test('disassemble: 접두사 매칭용 기본 케이스 (갑 ⊂ 가방)', () => {
  // "갑"의 자모는 "가방"의 자모 접두사여야 함
  assertTrue(disassemble('가방').startsWith(disassemble('갑')));
});

test('getChoseong: 기본', () => {
  assertEqual(getChoseong('가방'), 'ㄱㅂ');
});

test('getChoseong: 공백 보존', () => {
  assertEqual(getChoseong('띄어 쓰기'), 'ㄸㅇ ㅆㄱ');
});

test('getChoseong: 여러 글자', () => {
  assertEqual(getChoseong('기술노트'), 'ㄱㅅㄴㅌ');
});

test('getChoseong: 비한글 문자는 제거', () => {
  assertEqual(getChoseong('가a나b'), 'ㄱㄴ');
});

test('getChoseong: 빈 문자열', () => {
  assertEqual(getChoseong(''), '');
});
```

- [ ] **Step 1.2: test.html에 hangul.js 스크립트 태그 추가**

`test.html`의 `<script src="solver.js"></script>` 아래에 추가:

```html
<script src="solver.js"></script>
<script src="hangul.js"></script>
<script src="logic.js"></script>
```

- [ ] **Step 1.3: 테스트가 실패하는지 확인**

브라우저에서 `test.html` 열기. 제목 탭에 `✗`가 뜨고 "disassemble is not defined" / "getChoseong is not defined" 오류로 신규 13개 테스트가 모두 실패해야 한다.

- [ ] **Step 1.4: `hangul.js` 작성**

Create `hangul.js`:

```js
// Extracted from es-hangul (MIT License). https://github.com/toss/es-hangul
// Only `disassemble` and `getChoseong` are exposed as globals;
// internal helpers are file-scoped inside the IIFE.
(function (global) {
  'use strict';

  // ---- Constants (from es-hangul _internal/constants.ts) ----

  const _JASO_HANGUL_NFD = [...'각힣'.normalize('NFD')].map(c => c.charCodeAt(0));

  const COMPLETE_HANGUL_START_CHARCODE = '가'.charCodeAt(0);
  const COMPLETE_HANGUL_END_CHARCODE = '힣'.charCodeAt(0);

  const NUMBER_OF_JONGSEONG = 28;
  const NUMBER_OF_JUNGSEONG = 21;

  const DISASSEMBLED_CONSONANTS_BY_CONSONANT = {
    '':   '',
    'ㄱ': 'ㄱ', 'ㄲ': 'ㄲ', 'ㄳ': 'ㄱㅅ',
    'ㄴ': 'ㄴ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
    'ㄷ': 'ㄷ', 'ㄸ': 'ㄸ',
    'ㄹ': 'ㄹ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
    'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ',
    'ㅁ': 'ㅁ', 'ㅂ': 'ㅂ', 'ㅃ': 'ㅃ', 'ㅄ': 'ㅂㅅ',
    'ㅅ': 'ㅅ', 'ㅆ': 'ㅆ',
    'ㅇ': 'ㅇ', 'ㅈ': 'ㅈ', 'ㅉ': 'ㅉ',
    'ㅊ': 'ㅊ', 'ㅋ': 'ㅋ', 'ㅌ': 'ㅌ', 'ㅍ': 'ㅍ', 'ㅎ': 'ㅎ',
  };

  const DISASSEMBLED_VOWELS_BY_VOWEL = {
    'ㅏ': 'ㅏ', 'ㅐ': 'ㅐ', 'ㅑ': 'ㅑ', 'ㅒ': 'ㅒ',
    'ㅓ': 'ㅓ', 'ㅔ': 'ㅔ', 'ㅕ': 'ㅕ', 'ㅖ': 'ㅖ',
    'ㅗ': 'ㅗ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅛ': 'ㅛ',
    'ㅜ': 'ㅜ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅠ': 'ㅠ',
    'ㅡ': 'ㅡ', 'ㅢ': 'ㅡㅣ', 'ㅣ': 'ㅣ',
  };

  const CHOSEONGS = [
    'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
    'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
  ];

  const JUNGSEONGS = Object.values(DISASSEMBLED_VOWELS_BY_VOWEL);

  const JONGSEONGS = [
    '', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ',
    'ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ',
    'ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ',
    'ㅋ','ㅌ','ㅍ','ㅎ',
  ].map(c => DISASSEMBLED_CONSONANTS_BY_CONSONANT[c]);

  const JASO_HANGUL_NFD = {
    START_CHOSEONG: _JASO_HANGUL_NFD[0],
    END_CHOSEONG:   _JASO_HANGUL_NFD[3],
  };

  // ---- Helpers (file-scoped) ----

  function hasProperty(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function disassembleCompleteCharacter(letter) {
    const charCode = letter.charCodeAt(0);
    if (charCode < COMPLETE_HANGUL_START_CHARCODE || charCode > COMPLETE_HANGUL_END_CHARCODE) {
      return undefined;
    }
    const hangulCode = charCode - COMPLETE_HANGUL_START_CHARCODE;
    const jongseongIndex = hangulCode % NUMBER_OF_JONGSEONG;
    const jungseongIndex = ((hangulCode - jongseongIndex) / NUMBER_OF_JONGSEONG) % NUMBER_OF_JUNGSEONG;
    const choseongIndex  = Math.floor((hangulCode - jongseongIndex) / NUMBER_OF_JONGSEONG / NUMBER_OF_JUNGSEONG);
    return {
      choseong:  CHOSEONGS[choseongIndex],
      jungseong: JUNGSEONGS[jungseongIndex],
      jongseong: JONGSEONGS[jongseongIndex],
    };
  }

  function disassembleToGroups(str) {
    const result = [];
    for (const letter of str) {
      const dc = disassembleCompleteCharacter(letter);
      if (dc != null) {
        result.push([...dc.choseong, ...dc.jungseong, ...dc.jongseong]);
        continue;
      }
      if (hasProperty(DISASSEMBLED_CONSONANTS_BY_CONSONANT, letter)) {
        result.push([...DISASSEMBLED_CONSONANTS_BY_CONSONANT[letter]]);
        continue;
      }
      if (hasProperty(DISASSEMBLED_VOWELS_BY_VOWEL, letter)) {
        result.push([...DISASSEMBLED_VOWELS_BY_VOWEL[letter]]);
        continue;
      }
      result.push([letter]);
    }
    return result;
  }

  // ---- Public: disassemble ----

  function disassemble(str) {
    return disassembleToGroups(str).reduce(
      (acc, group) => acc + group.join(''),
      ''
    );
  }

  // ---- Public: getChoseong ----

  const EXTRACT_CHOSEONG_REGEX = new RegExp(
    '[^\\u' + JASO_HANGUL_NFD.START_CHOSEONG.toString(16) +
    '-\\u' + JASO_HANGUL_NFD.END_CHOSEONG.toString(16) +
    'ㄱ-ㅎ\\s]+',
    'ug'
  );
  const CHOOSE_NFD_CHOSEONG_REGEX = new RegExp(
    '[\\u' + JASO_HANGUL_NFD.START_CHOSEONG.toString(16) +
    '-\\u' + JASO_HANGUL_NFD.END_CHOSEONG.toString(16) + ']',
    'g'
  );

  function getChoseong(word) {
    return word
      .normalize('NFD')
      .replace(EXTRACT_CHOSEONG_REGEX, '')
      .replace(CHOOSE_NFD_CHOSEONG_REGEX, $0 => CHOSEONGS[$0.charCodeAt(0) - 0x1100]);
  }

  // ---- Export ----
  global.disassemble = disassemble;
  global.getChoseong = getChoseong;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 1.5: 테스트 통과 확인**

브라우저에서 `test.html` 새로고침. 제목 탭에 `✓`가 뜨고, 신규 13개 테스트 전부 초록색(`✓`)이어야 한다. 기존 테스트가 깨지지 않았는지도 확인.

- [ ] **Step 1.6: `event-planner.html`에 hangul.js 스크립트 태그 추가**

`<script src="solver.js"></script>` 아래에:

```html
<script src="solver.js"></script>
<script src="hangul.js"></script>
<script src="logic.js"></script>
<script src="ui.js"></script>
```

- [ ] **Step 1.7: 페이지 로드 무오류 확인**

브라우저에서 `event-planner.html` 열고 DevTools 콘솔 확인. 에러가 없어야 한다. 콘솔에서 `disassemble('가방')` 실행 → `'ㄱㅏㅂㅏㅇ'` 반환.

---

## Task 2: `presetItems` 데이터 모델 및 매칭 함수

**Files:**
- Modify: `logic.js`
- Modify: `test.html`

- [ ] **Step 2.1: `defaultState`와 `validateState`에 대한 실패 테스트 작성**

`test.html`의 기존 validateState 테스트 블록 아래에 추가:

```js
test('defaultState: 빈 presetItems', () => {
  assertEqual(defaultState().presetItems, []);
});

test('validateState: presetItems 배열 아님 거부', () => {
  const s = defaultState();
  s.presetItems = {};
  assertTrue(validateState(s) !== null);
});

test('validateState: presetItems 항목에 필드 누락 거부', () => {
  const s = defaultState();
  s.presetItems = [{ name: 'x' }];  // price/buyCount 누락
  assertTrue(validateState(s) !== null);
});

test('validateState: presetItems 항목 타입 검증', () => {
  const s = defaultState();
  s.presetItems = [{ name: 'x', price: '100', buyCount: 1 }];
  assertTrue(validateState(s) !== null);
});

test('validateState: 정상 presetItems 통과', () => {
  const s = defaultState();
  s.presetItems = [{ name: '기술노트', price: 100, buyCount: 5 }];
  assertEqual(validateState(s), null);
});
```

- [ ] **Step 2.2: 테스트 실패 확인**

`test.html` 새로고침. 신규 5개 테스트가 실패해야 한다 (`defaultState().presetItems`가 `undefined`; 나머지는 추가 필드 없어서 통과해버림 → 일부는 `s.presetItems`를 validate에서 검사하지 않아 실패할 것). 실제로 실패하는 것은 첫 번째("빈 presetItems") 한 건일 수 있다. 그래도 아래에서 기대 동작을 만족시키도록 구현한다.

- [ ] **Step 2.3: `logic.js`의 `defaultState` 수정**

`logic.js`의 `defaultState`를 다음으로 교체:

```js
function defaultState() {
  return {
    currencies: [],
    stages: Array.from({ length: 12 }, () => ({ drops: {} })),
    shopItems: [],
    owned: {},
    groupsEnabled: [true, true, true],
    presetItems: [],
  };
}
```

- [ ] **Step 2.4: `logic.js`의 `validateState`에 검증 추가**

`validateState` 함수의 `groupsEnabled` 검증 뒤, `return null;` 직전에 삽입:

```js
  if (!Array.isArray(s.presetItems)) return 'presetItems must be an array';
  for (const it of s.presetItems) {
    if (!it || typeof it !== 'object') return 'presetItem must be object';
    if (typeof it.name !== 'string') return 'presetItem.name must be string';
    if (typeof it.price !== 'number') return 'presetItem.price must be number';
    if (typeof it.buyCount !== 'number') return 'presetItem.buyCount must be number';
  }
```

- [ ] **Step 2.5: 테스트 통과 확인**

`test.html` 새로고침. 신규 5개 테스트 전부 초록이어야 한다. 기존 테스트도 깨지지 않아야 함.

- [ ] **Step 2.6: `matchPresetItems`에 대한 실패 테스트 작성**

`test.html`에 추가:

```js
test('matchPresetItems: 빈 쿼리는 전체를 등록 순서대로 반환', () => {
  const items = [
    { name: '가방', price: 50, buyCount: 10 },
    { name: '기술노트', price: 100, buyCount: 5 },
    { name: '일반 기술노트', price: 200, buyCount: 3 },
  ];
  const r = matchPresetItems('', items);
  assertEqual(r.map(i => i.name), ['가방', '기술노트', '일반 기술노트']);
});

test('matchPresetItems: 빈 쿼리는 원본 배열을 변형하지 않음 (slice)', () => {
  const items = [{ name: '가방', price: 50, buyCount: 10 }];
  const r = matchPresetItems('', items);
  r.push({ name: 'bad', price: 0, buyCount: 0 });
  assertEqual(items.length, 1);
});

test('matchPresetItems: 자모 접두사 매칭 — "가" → "가방"', () => {
  const items = [
    { name: '가방', price: 50, buyCount: 10 },
    { name: '열쇠', price: 20, buyCount: 3 },
  ];
  assertEqual(matchPresetItems('가', items).map(i => i.name), ['가방']);
});

test('matchPresetItems: 미완성 자모 접두사 — "갑" → "가방"', () => {
  const items = [
    { name: '가방', price: 50, buyCount: 10 },
    { name: '열쇠', price: 20, buyCount: 3 },
  ];
  assertEqual(matchPresetItems('갑', items).map(i => i.name), ['가방']);
});

test('matchPresetItems: 초성 접두사 — "ㄱㅂ" → "가방"', () => {
  const items = [
    { name: '가방', price: 50, buyCount: 10 },
    { name: '열쇠', price: 20, buyCount: 3 },
  ];
  assertEqual(matchPresetItems('ㄱㅂ', items).map(i => i.name), ['가방']);
});

test('matchPresetItems: 중간 부분일치 — "기술노트" → 4개', () => {
  const items = [
    { name: '기술노트', price: 100, buyCount: 5 },
    { name: '일반 기술노트', price: 200, buyCount: 3 },
    { name: '상급 기술노트', price: 400, buyCount: 2 },
    { name: '최고급 기술노트', price: 800, buyCount: 1 },
    { name: '가방', price: 50, buyCount: 10 },
  ];
  assertEqual(
    matchPresetItems('기술노트', items).map(i => i.name),
    ['기술노트', '일반 기술노트', '상급 기술노트', '최고급 기술노트']
  );
});

test('matchPresetItems: 초성 중간 부분일치 — "ㄱㅅㄴㅌ" → 기술노트 계열 4개', () => {
  const items = [
    { name: '기술노트', price: 100, buyCount: 5 },
    { name: '일반 기술노트', price: 200, buyCount: 3 },
    { name: '상급 기술노트', price: 400, buyCount: 2 },
    { name: '최고급 기술노트', price: 800, buyCount: 1 },
    { name: '가방', price: 50, buyCount: 10 },
  ];
  assertEqual(
    matchPresetItems('ㄱㅅㄴㅌ', items).map(i => i.name),
    ['기술노트', '일반 기술노트', '상급 기술노트', '최고급 기술노트']
  );
});

test('matchPresetItems: 등록 순서 보존 (정렬 없음)', () => {
  const items = [
    { name: '최고급 기술노트', price: 800, buyCount: 1 },
    { name: '일반 기술노트', price: 200, buyCount: 3 },
    { name: '기술노트', price: 100, buyCount: 5 },
  ];
  assertEqual(
    matchPresetItems('기술노트', items).map(i => i.name),
    ['최고급 기술노트', '일반 기술노트', '기술노트']
  );
});

test('matchPresetItems: 매칭 없음', () => {
  const items = [{ name: '가방', price: 50, buyCount: 10 }];
  assertEqual(matchPresetItems('zzz', items), []);
});

test('matchPresetItems: "일반" → "일반 기술노트"만', () => {
  const items = [
    { name: '기술노트', price: 100, buyCount: 5 },
    { name: '일반 기술노트', price: 200, buyCount: 3 },
    { name: '상급 기술노트', price: 400, buyCount: 2 },
  ];
  assertEqual(matchPresetItems('일반', items).map(i => i.name), ['일반 기술노트']);
});
```

- [ ] **Step 2.7: 테스트 실패 확인**

`test.html` 새로고침. 신규 10개 테스트 전부 "matchPresetItems is not defined" 오류로 실패해야 한다.

- [ ] **Step 2.8: `logic.js`에 `matchPresetItems` 구현 추가**

`logic.js`의 `hasMinimumData` 바로 아래에 추가 (순수 함수이므로 logic.js에 위치):

```js
function matchPresetItems(query, presetItems) {
  if (!query) return presetItems.slice();
  const qDis = disassemble(query);
  const qCho = getChoseong(query);
  return presetItems.filter(p => {
    const nameDis = disassemble(p.name);
    if (nameDis.includes(qDis)) return true;
    if (qCho) {
      const nameCho = getChoseong(p.name);
      if (nameCho.includes(qCho)) return true;
    }
    return false;
  });
}
```

> `qCho` 가드 이유: `getChoseong('zzz') === ''`이고 `includes('')`는 항상 `true`이므로, 가드가 없으면 비-한글 쿼리가 모든 아이템을 매칭해버린다. 테스트 `matchPresetItems: 매칭 없음`이 이 버그를 잡는다.

그리고 파일 맨 아래 `module.exports` 라인에 `matchPresetItems`를 추가:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGE_AP, applyBonus, parseSumExpr, defaultState, buildModel, computeBalance, hasMinimumData, validateState, matchPresetItems };
}
```

- [ ] **Step 2.9: 테스트 통과 확인**

`test.html` 새로고침. 모든 신규 테스트 초록. 기존 테스트 그대로 초록 유지.

---

## Task 3: 하위호환 (`ui.js`의 `loadState` / `importJson`)

**Files:**
- Modify: `ui.js:7-22` (loadState), `ui.js:508-530` (importJson)

기존 localStorage 또는 JSON 파일에 `presetItems`가 없는 state가 저장돼 있을 수 있다. `validateState`가 신규 필드를 요구하게 되었으므로, 파싱 직후 기본값 `[]`를 주입해 오류를 방지한다.

- [ ] **Step 3.1: `loadState`에 `presetItems` 기본값 주입**

`ui.js`의 `loadState` 함수를 다음으로 교체:

```js
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.presetItems === undefined) {
      parsed.presetItems = [];
    }
    const err = validateState(parsed);
    if (err) {
      console.warn('Stored state invalid:', err);
      return defaultState();
    }
    return parsed;
  } catch (e) {
    console.warn('Stored state parse failed:', e.message);
    return defaultState();
  }
}
```

- [ ] **Step 3.2: `importJson`에도 동일 주입 추가**

`ui.js`의 `importJson` 함수에서 `JSON.parse(reader.result)` 직후에 주입 라인을 추가:

```js
function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed && typeof parsed === 'object' && parsed.presetItems === undefined) {
        parsed.presetItems = [];
      }
      const err = validateState(parsed);
      if (err) {
        alert('유효하지 않은 파일입니다: ' + err);
        return;
      }
      state = parsed;
      saveState();
      render();
      recompute();
    } catch (err) {
      alert('JSON 파싱 실패: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}
```

(주의: `applyJsonView`는 **하위호환 주입을 하지 않는다**. 이 진입점은 개발자가 직접 편집한 JSON이므로 사용자가 `presetItems`를 의도적으로 `[]`로 쓰든 명시해야 한다. `presetItems` 필드를 아예 지우면 validate가 거부하는데, 이건 의도한 동작.)

- [ ] **Step 3.3: 수동 하위호환 확인**

브라우저 DevTools → Application → Local Storage에서 `eventPlannerState`를 다음과 같이 수동 편집(기존 state에서 `presetItems` 키 제거):

```json
{"currencies":[],"stages":[{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}},{"drops":{}}],"shopItems":[],"owned":{},"groupsEnabled":[true,true,true]}
```

페이지 새로고침. 콘솔 경고 없이 로드되어야 하고, "JSON 보기"를 열었을 때 `presetItems: []`가 보여야 한다.

---

## Task 4: 프리셋 수정 버튼

**Files:**
- Modify: `event-planner.html` (HTML + CSS)
- Modify: `ui.js` (초기화 핸들러)

- [ ] **Step 4.1: CSS 추가**

`event-planner.html`의 `<style>` 블록, `#json-view textarea` 라인 바로 위에 추가:

```css
    #sec-shops { position: relative; }
    .preset-edit-btn {
      position: absolute;
      top: 6px;
      right: 10px;
      font-size: 0.8em;
      cursor: pointer;
    }
```

- [ ] **Step 4.2: 버튼 마크업 추가**

`<details id="sec-shops" open>` 블록을 다음으로 교체:

```html
    <details id="sec-shops" open>
      <summary>4. 상점</summary>
      <button id="btn-preset-edit" class="preset-edit-btn">프리셋 수정</button>
      <div id="shops-container"></div>
    </details>
```

- [ ] **Step 4.3: 클릭 핸들러 연결**

`ui.js` 맨 아래 `DOMContentLoaded` 리스너 안의 `document.getElementById('btn-json-cancel')` 바로 아래에 추가:

```js
  document.getElementById('btn-preset-edit').addEventListener('click', openJsonView);
```

- [ ] **Step 4.4: 수동 확인 — 버튼 동작**

브라우저에서 `event-planner.html` 새로고침:
1. "4. 상점" details의 우상단에 "프리셋 수정" 버튼이 보여야 한다.
2. 버튼 클릭 → JSON 뷰가 열리고 textarea에 `presetItems: []` 포함된 전체 state가 보여야 한다.
3. "취소" → 메인 뷰로 복귀.
4. details를 닫아도 버튼은 우상단(summary 행 옆)에 계속 보여야 한다. (absolute 포지셔닝 확인)
5. 버튼 클릭해도 details가 접히지 않아야 한다.

---

## Task 5: 아이템 추가 시 빈 이름 + placeholder

**Files:**
- Modify: `ui.js` (`makeShopAddCell`, `makeShopItemCell`)

- [ ] **Step 5.1: `makeShopAddCell`의 기본값 변경**

`ui.js:252-263`의 `makeShopAddCell` 내부:

```js
  btn.addEventListener('click', () => {
    state.shopItems.push({ currency: currencyName, name: '', price: 0, buyCount: 0 });
    afterEdit();
  });
```

(변경점: `name: '새 아이템'` → `name: ''`)

- [ ] **Step 5.2: 이름 인풋 placeholder 추가**

Task 6에서 이름 인풋을 전용 함수로 분리하므로, **여기서는 기존 `makeShopItemCell` 내의 `makeTextInput` 라인만 임시로 수정**한다. `ui.js:218`의 `row1.appendChild(makeTextInput(it.name, v => { it.name = v; afterValueEdit(); }));` 직후에 placeholder 설정을 끼워넣는다. 가장 간단한 방법은 해당 라인을 3줄로 풀어 쓰는 것:

```js
  const nameInput = makeTextInput(it.name, v => { it.name = v; afterValueEdit(); });
  nameInput.placeholder = '보고서, 선물 etc...';
  row1.appendChild(nameInput);
```

(Task 6에서 이 블록이 전용 `makeItemNameInput` 호출로 다시 교체된다. placeholder 설정은 그 때 전용 함수 안으로 이동.)

- [ ] **Step 5.3: 수동 확인**

브라우저에서 `event-planner.html` 새로고침. 재화가 없으면 먼저 하나 추가. 상점에서 `+ 아이템 추가` 클릭:
1. 새 셀의 이름 인풋이 **빈 상태**로 생성된다.
2. placeholder로 "보고서, 선물 etc..."가 회색으로 보인다.
3. 가격/구매는 0.

---

## Task 6: 자동완성 드롭다운

**Files:**
- Modify: `event-planner.html` (CSS)
- Modify: `ui.js` (`makeShopItemCell` 분해, `makeItemNameInput` 추가, `focusNextShopItemNameIn` 헬퍼)

> 비고: 이 Task는 DOM·이벤트 상호작용이 많아 자동 테스트하기 어렵다. `test.html`이 아닌 수동 브라우저 테스트에 의존한다. 프리셋 데이터는 사전에 JSON 보기로 주입해둔다.

- [ ] **Step 6.1: 자동완성 드롭다운 CSS 추가**

`event-planner.html`의 `<style>` 블록, `.preset-edit-btn` 아래에 추가:

```css
    .shop-cell .item-name-row { position: relative; }
    .autocomplete-dropdown {
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      z-index: 10;
      background: Canvas;
      border: 1px solid #8884;
      max-height: 240px;
      overflow-y: auto;
      box-shadow: 0 2px 6px #0002;
    }
    .autocomplete-item {
      padding: 4px 8px;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .autocomplete-item.selected,
    .autocomplete-item:hover { background: #8883; }
```

- [ ] **Step 6.2: `makeShopItemCell`의 이름 행을 전용 함수로 분리**

`ui.js`의 `makeShopItemCell` 함수(파일의 `// --- 셀 / 인풋 헬퍼 ---` 주석 바로 위)를 다음으로 교체. 기존 첫 행(이름 인풋 + 삭제 버튼)을 `makeItemNameRow(it, idx)`로 빼낸다:

```js
function makeShopItemCell(it, idx) {
  const cell = document.createElement('div');
  cell.className = 'shop-cell';

  cell.appendChild(makeItemNameRow(it, idx));

  const row2 = document.createElement('div');
  row2.className = 'shop-cell-row';
  const lbl2 = document.createElement('span');
  lbl2.className = 'shop-cell-label';
  lbl2.textContent = '구매';
  row2.appendChild(lbl2);
  row2.appendChild(makeNumInput(it.buyCount, v => { it.buyCount = v; afterValueEdit(); }));
  cell.appendChild(row2);

  const row3 = document.createElement('div');
  row3.className = 'shop-cell-row';
  const lbl3 = document.createElement('span');
  lbl3.className = 'shop-cell-label';
  lbl3.textContent = '가격';
  row3.appendChild(lbl3);
  row3.appendChild(makeNumInput(it.price, v => { it.price = v; afterValueEdit(); }));
  cell.appendChild(row3);

  return cell;
}

function makeItemNameRow(it, idx) {
  const row = document.createElement('div');
  row.className = 'shop-cell-row item-name-row';

  const input = makeItemNameInput(it, idx);
  row.appendChild(input);

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-del';
  delBtn.tabIndex = -1;
  delBtn.textContent = '×';
  delBtn.title = '삭제';
  delBtn.addEventListener('click', () => {
    state.shopItems.splice(idx, 1);
    afterEdit();
  });
  row.appendChild(delBtn);

  return row;
}
```

(Step 5.2에서 임시로 넣은 `const nameInput = ...; nameInput.placeholder = ...;` 블록은 `makeShopItemCell`에서 자연히 제거된다.)

- [ ] **Step 6.3: 자동완성 상태 추적 변수 선언**

`ui.js` 파일 최상단(`let state = loadState();` 아래)에 추가:

```js
let activeAutocomplete = null;
// { input, dropdown, row, shopItemIdx, shopItem, results, selectedIdx }
```

- [ ] **Step 6.4: `makeItemNameInput` 및 자동완성 헬퍼 함수 추가**

`ui.js`의 `makeItemNameRow` 바로 아래에 추가:

```js
function makeItemNameInput(it, idx) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-name-input';
  input.value = it.name ?? '';
  input.placeholder = '보고서, 선물 etc...';
  input.dataset.shopIdx = String(idx);

  input.addEventListener('focus', () => openAutocomplete(input, it, idx));
  input.addEventListener('input', () => updateAutocomplete(input.value));
  input.addEventListener('keydown', e => handleAutocompleteKey(e, input, it));
  input.addEventListener('focusout', () => {
    // mousedown preventDefault가 걸린 경우(드롭다운 클릭)에는 이 경로가 실행되어도
    // selectPresetItem이 afterEdit으로 덮어씀. 일반 blur는 여기서 커밋.
    setTimeout(() => {
      if (document.activeElement !== input) {
        closeAutocomplete();
        if (it.name !== input.value) {
          it.name = input.value;
          afterValueEdit();
        }
      }
    }, 0);
  });

  return input;
}

function openAutocomplete(input, shopItem, shopItemIdx) {
  closeAutocomplete();

  const row = input.parentElement;
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  row.appendChild(dropdown);

  activeAutocomplete = {
    input,
    dropdown,
    row,
    shopItemIdx,
    shopItem,
    results: [],
    selectedIdx: 0,
  };
  updateAutocomplete(input.value);
}

function updateAutocomplete(query) {
  if (!activeAutocomplete) return;
  const results = matchPresetItems(query, state.presetItems);
  activeAutocomplete.results = results;
  activeAutocomplete.selectedIdx = 0;
  renderAutocomplete();
}

function renderAutocomplete() {
  const a = activeAutocomplete;
  if (!a) return;
  a.dropdown.innerHTML = '';
  if (a.results.length === 0) {
    a.dropdown.style.display = 'none';
    return;
  }
  a.dropdown.style.display = '';
  a.results.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item' + (i === a.selectedIdx ? ' selected' : '');
    el.textContent = `${p.name} — ${p.price} × ${p.buyCount}`;
    el.addEventListener('mousedown', e => {
      e.preventDefault();  // focusout 방지
    });
    el.addEventListener('click', () => {
      selectPresetItem(a.shopItemIdx, p);
    });
    a.dropdown.appendChild(el);
  });
}

function handleAutocompleteKey(e, input, shopItem) {
  const a = activeAutocomplete;
  if (!a) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (a.results.length === 0) return;
    a.selectedIdx = Math.min(a.selectedIdx + 1, a.results.length - 1);
    renderAutocomplete();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (a.results.length === 0) return;
    a.selectedIdx = Math.max(a.selectedIdx - 1, 0);
    renderAutocomplete();
  } else if (e.key === 'Enter') {
    if (a.results.length === 0) return;
    e.preventDefault();
    const preset = a.results[a.selectedIdx];
    selectPresetItem(a.shopItemIdx, preset);
  } else if (e.key === 'Escape') {
    closeAutocomplete();
  }
}

function closeAutocomplete() {
  if (!activeAutocomplete) return;
  if (activeAutocomplete.dropdown.parentElement) {
    activeAutocomplete.dropdown.parentElement.removeChild(activeAutocomplete.dropdown);
  }
  activeAutocomplete = null;
}

function selectPresetItem(shopItemIdx, preset) {
  const it = state.shopItems[shopItemIdx];
  it.name = preset.name;
  it.price = preset.price;
  it.buyCount = preset.buyCount;
  const currency = it.currency;
  closeAutocomplete();
  afterEdit();  // render 후 다음 셀 포커스
  focusNextShopItemNameIn(currency, shopItemIdx);
}

function focusNextShopItemNameIn(currency, currentIdx) {
  const nextIdx = state.shopItems.findIndex(
    (s, i) => i > currentIdx && s.currency === currency
  );
  if (nextIdx === -1) return;
  requestAnimationFrame(() => {
    const el = document.querySelector(
      '.item-name-input[data-shop-idx="' + nextIdx + '"]'
    );
    if (el) el.focus();  // 기존 focusin 핸들러가 select() 처리
  });
}
```

- [ ] **Step 6.5: 수동 테스트 — 프리셋 주입**

`event-planner.html` 새로고침 후 "JSON 보기" → textarea의 `"presetItems": []`를 다음으로 교체 → "적용":

```json
"presetItems": [
  {"name":"기술노트","price":100,"buyCount":5},
  {"name":"일반 기술노트","price":200,"buyCount":3},
  {"name":"상급 기술노트","price":400,"buyCount":2},
  {"name":"최고급 기술노트","price":800,"buyCount":1},
  {"name":"가방","price":50,"buyCount":10}
]
```

최소 재화 하나(예: "엔화") 추가한 뒤, 상점에서 `+ 아이템 추가`를 3번 눌러 빈 셀 3개 확보.

- [ ] **Step 6.6: 수동 테스트 — 포커스 시 전체 목록**

첫 번째 빈 아이템 이름 인풋 클릭(또는 Tab으로 포커스).
- 인풋 바로 아래 드롭다운이 뜨고 5개 프리셋이 **등록 순서**대로 표시된다: 기술노트 → 일반 기술노트 → 상급 기술노트 → 최고급 기술노트 → 가방.
- 첫 항목이 `selected` 스타일(배경 강조).

- [ ] **Step 6.7: 수동 테스트 — 자모 부분일치**

인풋에 "가" 입력 → 드롭다운에 "가방"만 표시.
"갑" 입력 → "가방"만 표시.
"기술노트" 입력 → 기술노트 계열 4개가 등록 순서대로 표시.
"일반" 입력 → "일반 기술노트"만 표시.

- [ ] **Step 6.8: 수동 테스트 — 초성 부분일치**

인풋을 비우고 "ㄱㅂ" 입력 → "가방"만 표시.
"ㄱㅅㄴㅌ" 입력 → 기술노트 계열 4개 표시.
"zzz" 입력 → 드롭다운 사라짐.

- [ ] **Step 6.9: 수동 테스트 — 선택 + 다음 셀 포커스**

인풋에 "기술" 입력 → 첫 번째 드롭다운 항목 "기술노트" 클릭.
- 현재 셀의 이름/구매/가격이 `기술노트 / 5 / 100`으로 자동 채워짐.
- 같은 상점의 **두 번째 빈 셀**의 이름 인풋에 포커스가 이동하고 전체선택되어 있음(빈 값이라 시각적으로는 placeholder가 다시 보임).
- 두 번째 셀의 드롭다운이 자동으로 열려 있어야 함.

- [ ] **Step 6.10: 수동 테스트 — 키보드 네비게이션**

세 번째 빈 셀에 포커스. "기술" 입력 → `ArrowDown` 두 번 눌러 "상급 기술노트" 선택 → `Enter`.
- 해당 셀이 `상급 기술노트 / 2 / 400`으로 채워짐.
- 세 번째가 마지막이라면 포커스 이동 없음(`focusNextShopItemNameIn`이 -1 반환).

- [ ] **Step 6.11: 수동 테스트 — Escape와 blur**

빈 셀 추가 후 포커스 → "xyz" 입력 → `Escape`. 드롭다운만 닫히고 인풋 값 "xyz" 유지.
다른 곳 클릭(blur) → 드롭다운 닫히고 "xyz"가 `it.name`으로 커밋됨. 새로고침 후에도 "xyz" 유지(localStorage 저장 확인).

- [ ] **Step 6.12: 수동 테스트 — 상점 간 점프 없음**

두 재화가 있고 각각 상점 아이템이 하나씩 있는 상태를 만든다. 첫 번째 재화의 유일한 셀에서 프리셋을 선택 → 두 번째 재화의 셀로 포커스가 **넘어가지 않아야** 한다(같은 currency 안에서만 탐색).

- [ ] **Step 6.13: 수동 테스트 — 여러 인풋 간 전환**

한 인풋에 포커스 후 드롭다운 열린 상태에서 다른 아이템 이름 인풋 클릭. 이전 드롭다운은 닫히고 새 인풋에 드롭다운이 뜸. (동시에 여러 드롭다운이 보이면 안 됨 — `closeAutocomplete`가 `openAutocomplete` 앞에서 호출됨으로 보장.)

- [ ] **Step 6.14: 수동 테스트 — 하위호환 한 번 더**

DevTools → Application → Local Storage에서 `eventPlannerState`의 `presetItems` 키를 삭제 후 페이지 새로고침. 콘솔 경고 없이 로드, 이름 인풋 포커스 시 드롭다운이 "결과 없음" 상태(안 뜨거나 비어있음)여야 함. 프리셋이 비어있으므로 매칭이 없는 것.

- [ ] **Step 6.15: 전체 스모크 테스트**

`test.html` 새로고침해서 모든 기존/신규 단위 테스트가 초록인지 재확인.

---

## 자체 리뷰 체크

- **Spec 커버리지**
  - § 1 데이터 모델 → Task 2
  - § 2 프리셋 수정 버튼 → Task 4
  - § 3 자동완성 (빈 쿼리 전체 표시, 키보드, 선택 후 포커스 이동, placeholder) → Task 5 + Task 6
  - § 4 hangul.js 추출 → Task 1
  - § 5 파일 변경 요약 → Task 1-6에 분산
  - § 6 수동 테스트 시나리오 → Step 6.5-6.14, Step 4.4, Step 3.3에 매핑
  - § 1 하위호환 → Task 3

- **순서 의존성**: Task 1은 Task 2의 `matchPresetItems` 가 `disassemble`/`getChoseong`을 필요로 하므로 먼저. Task 2는 Task 3보다 먼저 (validateState가 새 필드를 요구해야 Task 3의 주입이 의미 있음). Task 5는 Task 6의 임시 선행 단계 — 두 Task를 분리한 이유는 "빈 이름 + placeholder"만 먼저 검증 가능하게 해서 중간 커밋 가능성을 남겨두기 위함. Task 4는 독립적 (언제든 가능).

- **타입/이름 일관성**
  - `matchPresetItems(query, presetItems)` — Task 2, 6 전부 동일 시그니처
  - `focusNextShopItemNameIn(currency, currentIdx)` — Task 6 내부에서만 사용, 시그니처 일관
  - `activeAutocomplete.shopItemIdx` — Task 6 내부에서만 사용, 일관
  - `data-shop-idx` — `makeItemNameInput`에서 세팅, `focusNextShopItemNameIn`에서 쿼리. 일관.

- **플레이스홀더 없음**: "TBD", "TODO", "handle edge cases" 등의 표현 없음. 각 코드 스텝에 실제 코드 제공.

---

## 실행 체크포인트

Task 1, 2가 끝난 뒤 한 번, Task 6이 끝난 뒤 마지막에 `test.html` 전체를 재확인. 수동 UI 테스트는 Task 4, 5, 6의 각 Step 끝에서.
