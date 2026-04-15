# Currency ID Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `state.currencies`를 name-keyed에서 ID-keyed 구조로 전환해 빈 이름·중복 이름 재화가 데이터 충돌 없이 공존하도록 리팩터한다.

**Architecture:** 각 currency에 `id: number`(양의 정수) 추가. `stage.drops`, `owned`, `shopItem.currencyId`가 숫자 ID를 키/참조로 사용. `logic.js`(순수 함수)를 먼저 테스트와 함께 전환한 뒤 `ui.js`(DOM 렌더)를 갱신한다. `renameCurrency` 연쇄 업데이트는 ID 키잉으로 불필요해져 삭제.

**Tech Stack:** Vanilla JS (브라우저 전용), `test.html`(브라우저에서 여는 테스트 러너), `build.js`(script 태그 인라인화하여 `index.html` 단일 파일 생성).

**Spec:** `docs/superpowers/specs/2026-04-15-currency-id-design.md`

**테스트 실행법:** `test.html`을 브라우저에서 열면 자동 실행되고 화면 하단에 `N passed, M failed` 요약이 뜬다. 탭 타이틀이 `✗ …`이면 실패. 각 태스크 후 이 방법으로 수동 확인한다.

**참고:** 이전 대화에서 만든 uncommitted 변경(`src/ui.js`의 `makeTextInput` blur→input 전환 + `renderCurrenciesSection` 중복 alert 제거 + `index.html` 재생성)이 working tree에 남아있다. Task 0에서 별개 커밋으로 정리한 뒤 본 리팩터에 들어간다.

---

## File Structure

- **`src/logic.js`** — 순수 함수. 변경: `buildModel`, `computeBalance`, `hasMinimumData`, `validateState`. 신규: `allocateCurrencyId`, `normalizeCurrencyIds`.
- **`src/ui.js`** — DOM 렌더·이벤트. 변경: `loadState`, `importJson`, `renderCurrenciesSection`, `renderResultSection`, `renderStagesSection`, `renderShopsSection`, `removeCurrency`, `renderSolvedResult`, `renderBalanceTable`, `makeShopAddCell`, `selectPresetItem`, `focusNextShopItemNameIn`, `makeItemNameInput`(간접). 삭제: `renameCurrency`. 신규: `currencyLabel` 헬퍼.
- **`test.html`** — 테스트 러너. 신규: `addCurrency` 헬퍼 + 빈 이름·중복·`allocateCurrencyId`·`normalizeCurrencyIds` 테스트. 변경: 기존 `buildModel`/`computeBalance`/`hasMinimumData`/`validateState` 테스트들을 ID-키 shape로 이관.
- **`index.html`** — `build.js`로 자동 재생성 (수동 편집 금지).

---

## Task 0: 이전 UI 핫픽스 커밋

이전 대화에서 만든 uncommitted 변경(input 이벤트 + alert 제거)은 본 리팩터와 개념적으로 독립적인 핫픽스다. 먼저 별도 커밋으로 분리한다.

**Files:**
- Modify: `src/ui.js` (이미 수정되어 있음)
- Modify: `index.html` (이미 수정되어 있음)

- [ ] **Step 1: 현재 diff 확인**

Run: `git diff --stat src/ui.js index.html`
Expected: 두 파일 모두 변경 표시. `src/ui.js`에서 약 8-10줄 변경 (makeTextInput의 blur→input, renderCurrenciesSection의 alert 제거).

구체적으로 diff에 들어있어야 할 변경:
- `makeTextInput`: `input.addEventListener('blur', ...)` → `input.addEventListener('input', ...)`
- `renderCurrenciesSection`의 `makeTextCell` 콜백: 중복 alert 분기 제거, `afterValueEdit()` → 부분 re-render

만약 diff가 비어있거나 예상과 다르면 이전 대화의 변경이 없는 상태이므로 이 태스크를 건너뛰고 Task 1로 진행.

- [ ] **Step 2: 커밋**

```bash
git add src/ui.js index.html
git commit -m "fix: commit currency name edits on input event, drop duplicate alert"
```

- [ ] **Step 3: 클린 상태 확인**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Task 1: `allocateCurrencyId` 추가 + 테스트 헬퍼

**Files:**
- Modify: `src/logic.js` (함수 추가 + export)
- Modify: `test.html` (`addCurrency` 헬퍼 + `allocateCurrencyId` 단위 테스트)

- [ ] **Step 1: `test.html`에 실패 테스트 + 헬퍼 추가**

`test.html`의 `// === TEST CASES (이후 태스크에서 추가) ===` 바로 아래, `test('disassemble: ...')` 블록들 **이전에** 헬퍼를 먼저 정의하고, `matchPresetItems` 관련 테스트 **마지막 바로 위** (약 505번 줄, `// === RENDER ===` 직전)에 아래 테스트들을 추가:

```js
// === Helpers for currency ID refactor ===
function addCurrency(state, name, bonus = 0) {
  const id = allocateCurrencyId(state.currencies);
  state.currencies.push({ id, name, bonus });
  return id;
}
```

(헬퍼는 `test('disassemble: ...')` 바로 위, `// === TEST CASES` 주석 바로 아래에 놓는다.)

그리고 테스트 블록:

```js
test('allocateCurrencyId: 빈 배열은 1 반환', () => {
  assertEqual(allocateCurrencyId([]), 1);
});

test('allocateCurrencyId: 연속 ID는 최대+1', () => {
  assertEqual(allocateCurrencyId([{ id: 1 }, { id: 2 }, { id: 3 }]), 4);
});

test('allocateCurrencyId: 중간 빈 자리를 채움', () => {
  assertEqual(allocateCurrencyId([{ id: 1 }, { id: 3 }]), 2);
});

test('allocateCurrencyId: 1이 비어있으면 1 반환', () => {
  assertEqual(allocateCurrencyId([{ id: 2 }]), 1);
});

test('allocateCurrencyId: 여러 빈 자리 중 가장 작은 것', () => {
  assertEqual(allocateCurrencyId([{ id: 2 }, { id: 4 }, { id: 5 }]), 1);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

`test.html`을 브라우저에서 열고 확인.
Expected: `allocateCurrencyId: 빈 배열은 1 반환` 등 5개 테스트가 실패(`allocateCurrencyId is not defined`).

- [ ] **Step 3: `src/logic.js`에 `allocateCurrencyId` 추가**

`parseSumExpr` 함수 **바로 뒤**에 추가 (기존 순수 함수들과 같은 구역):

```js
function allocateCurrencyId(currencies) {
  const used = new Set(currencies.map(c => c.id));
  for (let i = 1; ; i++) {
    if (!used.has(i)) return i;
  }
}
```

그리고 파일 맨 아래 `module.exports` 블록의 함수 목록에 `allocateCurrencyId`를 추가:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGE_AP, applyBonus, parseSumExpr, defaultState, buildModel, computeBalance, hasMinimumData, validateState, matchPresetItems, allocateCurrencyId };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

`test.html` 새로고침.
Expected: 5개 `allocateCurrencyId` 테스트 모두 PASS. 기존 테스트 개수·결과는 변화 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/logic.js test.html
git commit -m "feat: add allocateCurrencyId for currency ID allocation"
```

---

## Task 2: `normalizeCurrencyIds` 추가

**Files:**
- Modify: `src/logic.js`
- Modify: `test.html`

- [ ] **Step 1: 실패 테스트 추가**

`test.html`의 `allocateCurrencyId` 테스트 블록 바로 아래에 추가:

```js
test('normalizeCurrencyIds: id 누락된 currency에 id 부여', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 0 }];
  normalizeCurrencyIds(s);
  assertEqual(s.currencies[0].id, 1);
});

test('normalizeCurrencyIds: 중복 id 있으면 한쪽 재부여', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: 'a', bonus: 0 }, { id: 1, name: 'b', bonus: 0 }];
  normalizeCurrencyIds(s);
  assertTrue(s.currencies[0].id !== s.currencies[1].id);
});

test('normalizeCurrencyIds: dangling shopItem.currencyId 제거', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: '엔화', bonus: 0 }];
  s.shopItems = [
    { currencyId: 1, name: 'a', price: 10, buyCount: 1 },
    { currencyId: 99, name: 'orphan', price: 10, buyCount: 1 },
  ];
  normalizeCurrencyIds(s);
  assertEqual(s.shopItems.length, 1);
  assertEqual(s.shopItems[0].name, 'a');
});

test('normalizeCurrencyIds: dangling drops 키 제거', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: '엔화', bonus: 0 }];
  s.stages[0].drops = { 1: 5, 99: 10 };
  normalizeCurrencyIds(s);
  assertEqual(s.stages[0].drops, { 1: 5 });
});

test('normalizeCurrencyIds: dangling owned 키 제거', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: '엔화', bonus: 0 }];
  s.owned = { 1: 100, 99: 50 };
  normalizeCurrencyIds(s);
  assertEqual(s.owned, { 1: 100 });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Expected: 5개 `normalizeCurrencyIds` 테스트가 `normalizeCurrencyIds is not defined`로 실패.

- [ ] **Step 3: `src/logic.js`에 함수 추가**

`allocateCurrencyId` 바로 아래에 추가:

```js
function normalizeCurrencyIds(state) {
  const used = new Set();
  state.currencies.forEach(c => {
    if (typeof c.id !== 'number' || !Number.isInteger(c.id) || c.id < 1 || used.has(c.id)) {
      const temp = [];
      used.forEach(id => temp.push({ id }));
      c.id = allocateCurrencyId(temp);
    }
    used.add(c.id);
  });

  state.shopItems = state.shopItems.filter(it => used.has(it.currencyId));

  state.stages.forEach(stage => {
    Object.keys(stage.drops).forEach(key => {
      if (!used.has(Number(key))) delete stage.drops[key];
    });
  });

  Object.keys(state.owned).forEach(key => {
    if (!used.has(Number(key))) delete state.owned[key];
  });
}
```

`module.exports` 목록에 `normalizeCurrencyIds` 추가:

```js
module.exports = { STAGE_AP, applyBonus, parseSumExpr, defaultState, buildModel, computeBalance, hasMinimumData, validateState, matchPresetItems, allocateCurrencyId, normalizeCurrencyIds };
```

- [ ] **Step 4: 테스트 통과 확인**

Expected: 5개 `normalizeCurrencyIds` 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/logic.js test.html
git commit -m "feat: add normalizeCurrencyIds for load-time self-healing"
```

---

## Task 3: `validateState` ID-based로 전환 + 테스트 업데이트

**Files:**
- Modify: `src/logic.js` (`validateState`)
- Modify: `test.html` (`validateState` 관련 테스트)

- [ ] **Step 1: 실패 테스트 추가 + 기존 테스트 업데이트**

`test.html`의 기존 `validateState: currencies 내부 필드 타입 검증` 테스트(`test.html:381-385` 부근)를 다음으로 **교체**:

```js
test('validateState: currency.bonus가 숫자 아니면 거부', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: '엔화', bonus: 'oops' }];
  assertTrue(validateState(s) !== null);
});

test('validateState: currency.name이 문자열 아니면 거부', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: 123, bonus: 0 }];
  assertTrue(validateState(s) !== null);
});
```

그리고 기존 `validateState: shopItems 필드 누락 거부` 테스트(`test.html:365-369`)의 setup을 다음으로 교체:

```js
test('validateState: shopItems 필드 누락 거부', () => {
  const s = defaultState();
  s.shopItems = [{ currencyId: 1, name: 'x' }];  // price/buyCount 누락
  assertTrue(validateState(s) !== null);
});
```

그리고 신규 테스트 추가 (위 교체 테스트 아래에):

```js
test('validateState: shopItem.currencyId가 숫자 아니면 거부', () => {
  const s = defaultState();
  s.shopItems = [{ currencyId: '1', name: 'x', price: 10, buyCount: 1 }];
  assertTrue(validateState(s) !== null);
});

test('validateState: 빈 이름 currency 통과', () => {
  const s = defaultState();
  s.currencies = [{ id: 1, name: '', bonus: 0 }];
  assertEqual(validateState(s), null);
});

test('validateState: 중복 이름 currency 통과', () => {
  const s = defaultState();
  s.currencies = [
    { id: 1, name: '엔화', bonus: 0 },
    { id: 2, name: '엔화', bonus: 10 },
  ];
  assertEqual(validateState(s), null);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Expected: 위 신규/교체 테스트가 실패하거나 잘못된 결과. (기존 `validateState`는 `currencyId`를 모르고 `currency`를 요구하므로 "빈 이름 통과" 같은 테스트가 fail.)

- [ ] **Step 3: `src/logic.js`의 `validateState` 전환**

`validateState` 전체를 다음으로 교체:

```js
function validateState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'state must be an object';

  if (!Array.isArray(s.currencies)) return 'currencies must be an array';
  for (const c of s.currencies) {
    if (!c || typeof c !== 'object') return 'currency item must be object';
    if (typeof c.name !== 'string') return 'currency.name must be string';
    if (typeof c.bonus !== 'number') return 'currency.bonus must be number';
  }

  if (!Array.isArray(s.stages) || s.stages.length !== 12) return 'stages must have length 12';
  for (const st of s.stages) {
    if (!st || typeof st !== 'object') return 'stage must be object';
    if (!st.drops || typeof st.drops !== 'object' || Array.isArray(st.drops))
      return 'stage.drops must be object';
  }

  if (!Array.isArray(s.shopItems)) return 'shopItems must be an array';
  for (const it of s.shopItems) {
    if (!it || typeof it !== 'object') return 'shopItem must be object';
    if (typeof it.currencyId !== 'number') return 'shopItem.currencyId must be number';
    if (typeof it.name !== 'string') return 'shopItem.name must be string';
    if (typeof it.price !== 'number') return 'shopItem.price must be number';
    if (typeof it.buyCount !== 'number') return 'shopItem.buyCount must be number';
  }

  if (!s.owned || typeof s.owned !== 'object' || Array.isArray(s.owned))
    return 'owned must be object';

  if (!Array.isArray(s.groupsEnabled) || s.groupsEnabled.length !== 3)
    return 'groupsEnabled must have length 3';
  for (const g of s.groupsEnabled) {
    if (typeof g !== 'boolean') return 'groupsEnabled entries must be boolean';
  }

  if (!Array.isArray(s.presetItems)) return 'presetItems must be an array';
  for (const it of s.presetItems) {
    if (!it || typeof it !== 'object') return 'presetItem must be object';
    if (typeof it.name !== 'string') return 'presetItem.name must be string';
    if (typeof it.price !== 'number') return 'presetItem.price must be number';
    if (typeof it.buyCount !== 'number') return 'presetItem.buyCount must be number';
  }

  return null;  // valid
}
```

주요 변화:
- `currency.shopName` 체크 제거
- `shopItem.currency` 체크 → `shopItem.currencyId` 체크 (문자열 → 숫자)
- `currency.id` 체크 없음 (`normalizeCurrencyIds`가 치유)

- [ ] **Step 4: 테스트 통과 확인**

Expected: 이 태스크에서 추가·수정한 모든 `validateState` 테스트 PASS. 기존 buildModel/computeBalance/hasMinimumData 테스트는 여전히 구 shape를 쓰고 있으나 `validateState`를 호출하지 않으므로 영향 없음.

단, `defaultState().shopItems`는 `[]`라 새 shape에도 문제 없음. `defaultState: 빈 재화 배열` 등 `validateState(defaultState())` 호출 테스트도 PASS 유지.

- [ ] **Step 5: 커밋**

```bash
git add src/logic.js test.html
git commit -m "refactor: validateState checks currency by id-based shape"
```

---

## Task 4: `buildModel` ID-based로 전환 + 테스트 업데이트

**Files:**
- Modify: `src/logic.js` (`buildModel`)
- Modify: `test.html` (`buildModel` 관련 10개 테스트)

- [ ] **Step 1: `test.html`의 buildModel 테스트들을 ID-key shape로 교체**

`test.html:148-238` 범위의 모든 `buildModel: ...` 테스트 블록을 다음과 같이 교체. **10개 테스트 전체를 한 번에 교체** (`'buildModel: 기본 최소화 목표는 AP'`부터 `'buildModel: 빈 이름 재화는 무시'`까지).

```js
test('buildModel: 기본 최소화 목표는 AP', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[yen] = 5;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertEqual(m.optimize, 'AP');
  assertEqual(m.opType, 'min');
});

test('buildModel: 스테이지 변수에 AP와 재화 드랍 포함', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[yen] = 5;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertApprox(m.variables.s1.AP, 10, 1e-4);
  assertEqual(m.variables.s1['c' + yen], 5);
});

test('buildModel: 보너스가 드랍에 적용됨', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화', 50);
  s.stages[0].drops[yen] = 4;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertEqual(m.variables.s1['c' + yen], 6);  // ceil(4 * 1.5)
});

test('buildModel: AP는 인덱스별 고정값', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  for (let i = 0; i < 12; i++) s.stages[i].drops[yen] = 1;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertApprox(m.variables.s1.AP, 10, 1e-4);
  assertApprox(m.variables.s5.AP, 15, 1e-4);
  assertApprox(m.variables.s12.AP, 20, 1e-4);
});

test('buildModel: 비활성 그룹의 스테이지는 변수에서 제외', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  for (let i = 0; i < 12; i++) s.stages[i].drops[yen] = 1;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  s.groupsEnabled = [true, false, false];
  const m = buildModel(s);
  assertTrue(m.variables.s1, 's1 should exist');
  assertTrue(m.variables.s4, 's4 should exist');
  assertTrue(!m.variables.s5, 's5 should not exist');
  assertTrue(!m.variables.s12, 's12 should not exist');
});

test('buildModel: 제약은 필요량에서 보유량을 뺀 값', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[yen] = 1;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 300, buyCount: 2 }];
  s.owned[yen] = 200;
  const m = buildModel(s);
  assertEqual(m.constraints['c' + yen], { min: 400 });
});

test('buildModel: 보유량이 필요량 이상이면 제약 제외', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[yen] = 1;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  s.owned[yen] = 999;
  const m = buildModel(s);
  assertTrue(!(('c' + yen) in m.constraints));
});

test('buildModel: 모든 스테이지 변수는 ints에 표시', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  for (let i = 0; i < 12; i++) s.stages[i].drops[yen] = 1;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  for (let i = 1; i <= 12; i++) assertEqual(m.ints['s' + i], 1);
});

test('buildModel: 빈 이름 재화도 변수·제약에 포함', () => {
  const s = defaultState();
  const empty = addCurrency(s, '');
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[empty] = 3;
  s.stages[0].drops[yen] = 5;
  s.shopItems = [
    { currencyId: empty, name: 'a', price: 30, buyCount: 1 },
    { currencyId: yen, name: 'b', price: 50, buyCount: 1 },
  ];
  const m = buildModel(s);
  assertEqual(m.variables.s1['c' + empty], 3);
  assertEqual(m.variables.s1['c' + yen], 5);
});

test('buildModel: 중복 이름 재화도 독립적으로 모델링', () => {
  const s = defaultState();
  const a = addCurrency(s, '포인트');
  const b = addCurrency(s, '포인트');
  s.stages[0].drops[a] = 4;
  s.stages[0].drops[b] = 7;
  s.shopItems = [
    { currencyId: a, name: 'x', price: 20, buyCount: 1 },
    { currencyId: b, name: 'y', price: 14, buyCount: 1 },
  ];
  const m = buildModel(s);
  assertEqual(m.variables.s1['c' + a], 4);
  assertEqual(m.variables.s1['c' + b], 7);
});
```

기존 `buildModel: 빈 이름 재화는 무시` 테스트는 동작이 **정반대로 바뀜**(이제 빈 이름도 포함). 위 교체본은 `빈 이름 재화도 변수·제약에 포함`으로 치환하고, 중복 이름 케이스도 신규로 추가했다.

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Expected: 모든 `buildModel: ...` 테스트가 실패. 이유는 현재 구현이 `c.name`을 키로 쓰는데 테스트는 `'c' + id` 키를 기대하기 때문.

- [ ] **Step 3: `src/logic.js`의 `buildModel` 전환**

`buildModel` 전체를 다음으로 교체:

```js
function buildModel(state) {
  const variables = {};
  state.stages.forEach((stage, i) => {
    const group = Math.floor(i / 4);
    if (!state.groupsEnabled[group]) return;

    // Tiebreaker: higher stages get a micro discount in the objective
    // so that ties in true AP resolve toward the higher stage.
    const v = { AP: STAGE_AP[i] - TIE_EPSILON * (i + 1) };
    state.currencies.forEach(c => {
      const raw = stage.drops[c.id] ?? 0;
      v['c' + c.id] = applyBonus(raw, c.bonus);
    });
    variables['s' + (i + 1)] = v;
  });

  const constraints = {};
  state.currencies.forEach(c => {
    const need = state.shopItems
      .filter(it => it.currencyId === c.id)
      .reduce((sum, it) => sum + (it.price || 0) * (it.buyCount || 0), 0);
    const remaining = need - (state.owned[c.id] ?? 0);
    if (remaining > 0) constraints['c' + c.id] = { min: remaining };
  });

  const ints = {};
  Object.keys(variables).forEach(k => { ints[k] = 1; });

  return { optimize: 'AP', opType: 'min', variables, constraints, ints };
}
```

주요 변화:
- `if (!c.name) return;` 필터 제거 (빈 이름도 포함)
- 변수/제약 키 `c.name` → `'c' + c.id`
- `stage.drops[c.name]` → `stage.drops[c.id]`
- `it.currency === c.name` → `it.currencyId === c.id`
- `state.owned[c.name]` → `state.owned[c.id]`

- [ ] **Step 4: 테스트 통과 확인**

Expected: 위 10개 `buildModel` 테스트 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/logic.js test.html
git commit -m "refactor: buildModel keys variables and constraints by currency id"
```

---

## Task 5: `computeBalance` ID-based로 전환 + 테스트 업데이트

**Files:**
- Modify: `src/logic.js` (`computeBalance`)
- Modify: `test.html` (`computeBalance` 관련 5개 테스트)

- [ ] **Step 1: `test.html`의 `computeBalance` 테스트들을 교체**

`test.html:240-294` 범위의 5개 `computeBalance: ...` 테스트 블록 전체를 다음으로 교체:

```js
test('computeBalance: 단일 재화 단순 케이스', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[yen] = 5;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 2 }];
  s.owned[yen] = 50;
  const b = computeBalance(s, { s1: 40 });
  assertEqual(b[yen], { owned: 50, gained: 200, needed: 200, surplus: 50 });
});

test('computeBalance: 보너스 적용된 획득량', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화', 50);
  s.stages[0].drops[yen] = 4;  // ceil(4*1.5) = 6
  s.shopItems = [{ currencyId: yen, name: 'x', price: 12, buyCount: 1 }];
  const b = computeBalance(s, { s1: 2 });
  assertEqual(b[yen].gained, 12);  // 6 * 2
});

test('computeBalance: 여러 스테이지 합산', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[0].drops[yen] = 5;
  s.stages[4].drops[yen] = 8;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  const b = computeBalance(s, { s1: 3, s5: 10 });
  assertEqual(b[yen].gained, 95);  // 5*3 + 8*10
});

test('computeBalance: 여러 재화', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  const usd = addCurrency(s, '달러');
  s.stages[0].drops[yen] = 5;
  s.stages[0].drops[usd] = 2;
  s.shopItems = [
    { currencyId: yen, name: 'a', price: 50, buyCount: 1 },
    { currencyId: usd, name: 'b', price: 20, buyCount: 2 },
  ];
  const b = computeBalance(s, { s1: 10 });
  assertEqual(b[yen], { owned: 0, gained: 50, needed: 50, surplus: 0 });
  assertEqual(b[usd], { owned: 0, gained: 20, needed: 40, surplus: -20 });
});

test('computeBalance: 비활성 그룹은 획득량에 기여하지 않음', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.stages[4].drops[yen] = 10;
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  s.groupsEnabled = [true, false, true];
  const b = computeBalance(s, { s5: 3 });
  assertEqual(b[yen].gained, 0);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Expected: 5개 `computeBalance` 테스트 실패. 현재 구현이 `result[c.name]`을 반환하는데 테스트는 `b[yen]`(숫자 키)을 조회.

- [ ] **Step 3: `src/logic.js`의 `computeBalance` 전환**

`computeBalance` 전체를 다음으로 교체:

```js
function computeBalance(state, solverResult) {
  const result = {};
  state.currencies.forEach(c => {
    const owned = state.owned[c.id] ?? 0;
    const needed = state.shopItems
      .filter(it => it.currencyId === c.id)
      .reduce((sum, it) => sum + (it.price || 0) * (it.buyCount || 0), 0);
    let gained = 0;
    state.stages.forEach((stage, i) => {
      const group = Math.floor(i / 4);
      if (!state.groupsEnabled[group]) return;
      const runs = solverResult['s' + (i + 1)] ?? 0;
      if (!runs) return;
      const perRun = applyBonus(stage.drops[c.id] ?? 0, c.bonus);
      gained += perRun * runs;
    });
    result[c.id] = { owned, gained, needed, surplus: owned + gained - needed };
  });
  return result;
}
```

주요 변화:
- `if (!c.name) return;` 제거
- 결과 키 `c.name` → `c.id`
- `state.owned[c.name]` → `state.owned[c.id]`
- `it.currency === c.name` → `it.currencyId === c.id`
- `stage.drops[c.name]` → `stage.drops[c.id]`

- [ ] **Step 4: 테스트 통과 확인**

Expected: 5개 `computeBalance` 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/logic.js test.html
git commit -m "refactor: computeBalance returns balance map keyed by currency id"
```

---

## Task 6: `hasMinimumData` 완화 + 테스트 업데이트

**Files:**
- Modify: `src/logic.js` (`hasMinimumData`)
- Modify: `test.html` (`hasMinimumData` 관련 7개 테스트)

- [ ] **Step 1: `test.html`의 `hasMinimumData` 테스트 교체**

`test.html:296-340` 범위의 7개 테스트 전체를 다음으로 교체:

```js
test('hasMinimumData: 빈 state는 false', () => {
  assertEqual(hasMinimumData(defaultState()), false);
});

test('hasMinimumData: 재화만 있으면 false (상점 아이템 없음)', () => {
  const s = defaultState();
  addCurrency(s, '엔화');
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: 재화 + 유효 아이템 있으면 true', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  assertEqual(hasMinimumData(s), true);
});

test('hasMinimumData: buyCount=0 인 아이템만 있으면 false', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 0 }];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: price=0 인 아이템만 있으면 false', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.shopItems = [{ currencyId: yen, name: 'x', price: 0, buyCount: 1 }];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: 모든 그룹 비활성이면 false', () => {
  const s = defaultState();
  const yen = addCurrency(s, '엔화');
  s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
  s.groupsEnabled = [false, false, false];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: 빈 이름 재화도 카운트함', () => {
  const s = defaultState();
  const empty = addCurrency(s, '');
  s.shopItems = [{ currencyId: empty, name: 'x', price: 100, buyCount: 1 }];
  assertEqual(hasMinimumData(s), true);
});
```

주요 변화: 기존 `빈 이름 재화는 카운트하지 않음` 테스트가 **반대 동작**(`true`)으로 바뀜.

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Expected: 일부 테스트 실패 — 특히 `빈 이름 재화도 카운트함`은 현재 구현이 `c.name && c.name.length > 0` 필터를 적용하고 있어 `false` 반환.

- [ ] **Step 3: `src/logic.js`의 `hasMinimumData` 전환**

`hasMinimumData` 전체를 다음으로 교체:

```js
function hasMinimumData(state) {
  const hasCurrency = state.currencies.length > 0;
  const hasGroup = state.groupsEnabled.some(g => g);
  const hasItem = state.shopItems.some(it =>
    typeof it.currencyId === 'number' && (it.price || 0) > 0 && (it.buyCount || 0) > 0
  );
  return hasCurrency && hasGroup && hasItem;
}
```

주요 변화:
- `c.name && c.name.length > 0` → `state.currencies.length > 0`
- `it.currency` 문자열 체크 → `typeof it.currencyId === 'number'`

- [ ] **Step 4: 테스트 통과 확인**

Expected: 7개 `hasMinimumData` 테스트 모두 PASS.

또한 이 시점에서 `test.html` 전체 테스트도 실행해 **기존 `disassemble`, `getChoseong`, `applyBonus`, `defaultState`, `matchPresetItems`, `validateState`, `computeBalance`, `buildModel`, `allocateCurrencyId`, `normalizeCurrencyIds`** 테스트 전부 PASS 확인. 실패가 있으면 이전 태스크의 회귀.

- [ ] **Step 5: 커밋**

```bash
git add src/logic.js test.html
git commit -m "refactor: hasMinimumData counts currencies regardless of name"
```

---

## Task 7: `ui.js`의 `loadState`/`importJson`에 `normalizeCurrencyIds` 훅 추가

**Files:**
- Modify: `src/ui.js` (`loadState`, `importJson`)

이 태스크부터는 UI 변경. 자동 테스트 대신 **브라우저 수동 확인**. 각 태스크 후 `node build.js` 실행 후 `index.html`을 브라우저에서 열어 콘솔 에러 없는지 확인.

- [ ] **Step 1: `loadState`에 normalize 호출 추가**

`src/ui.js:10-36`의 `loadState` 함수를 다음으로 교체:

```js
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const s = defaultState();
    s.presetItems = cloneDefaultPresetItems();
    return s;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.presetItems === undefined) {
      parsed.presetItems = cloneDefaultPresetItems();
    }
    const err = validateState(parsed);
    if (err) {
      console.warn('Stored state invalid:', err);
      const s = defaultState();
      s.presetItems = cloneDefaultPresetItems();
      return s;
    }
    normalizeCurrencyIds(parsed);
    return parsed;
  } catch (e) {
    console.warn('Stored state parse failed:', e.message);
    const s = defaultState();
    s.presetItems = cloneDefaultPresetItems();
    return s;
  }
}
```

- [ ] **Step 2: `importJson`에 normalize 호출 추가**

`src/ui.js:690-715`의 `importJson` 함수를 다음으로 교체:

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
      normalizeCurrencyIds(parsed);
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

- [ ] **Step 3: 수동 확인**

이 시점에는 `ui.js`의 나머지 부분이 아직 name-key를 쓰고 있어 앱이 브라우저에서 정상 동작하지 않아도 OK. 콘솔에 `normalizeCurrencyIds is not defined` 같은 참조 에러만 없으면 됨. `normalizeCurrencyIds`는 `logic.js`에 정의되어 있고 ui.js는 전역으로 호출하므로 접근 가능.

Run: `node build.js`로 `index.html` 재생성 후 브라우저 열기.
Expected: `wrote C:\...\index.html (... KB)` 출력. `index.html`을 열었을 때 `ReferenceError: normalizeCurrencyIds is not defined`는 없어야 함.

기존 uncommitted 변경(makeTextInput input 이벤트) 때문에 `alert` 없이 동작하지만 `renameCurrency`가 아직 있어 기능은 중간 상태.

- [ ] **Step 4: 커밋**

```bash
git add src/ui.js
git commit -m "refactor: hook normalizeCurrencyIds into load and import paths"
```

---

## Task 8: `ui.js`에 `currencyLabel` 헬퍼 추가

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: 헬퍼 추가**

`src/ui.js:673`의 `escapeHtml` 함수 **바로 위**에 추가:

```js
function currencyLabel(c) {
  return c.name || '(이름 없음)';
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/ui.js
git commit -m "feat: add currencyLabel helper for empty-name fallback"
```

---

## Task 9: `renderCurrenciesSection` 재작성 + `renameCurrency` 삭제 + `removeCurrency` 시그니처 변경

**Files:**
- Modify: `src/ui.js`

이 태스크는 섹션 2(재화 테이블)의 UI를 완전히 재작성한다. 이전 대화의 uncommitted 수정(input 이벤트, alert 제거)도 이 안에 흡수된다.

- [ ] **Step 1: `renderCurrenciesSection` 교체**

`src/ui.js:78-116`의 `renderCurrenciesSection` 전체를 다음으로 교체:

```js
function renderCurrenciesSection() {
  const container = document.getElementById('currencies-container');
  container.innerHTML = '';

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>재화</th><th>보너스 % <span class="info-icon">ⓘ<span class="info-tip">여러 보너스를 합칠 때 <code>25+15+15+15+25+15</code>처럼 <code>+</code>로 이어서 입력할 수 있습니다.</span></span></th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');

  state.currencies.forEach((c) => {
    const tr = document.createElement('tr');
    tr.appendChild(makeTextCell(c.name, (v) => {
      if (v === c.name) return;
      c.name = v;
      saveState();
      renderResultSection();
      renderStagesSection();
      renderShopsSection();
      recompute();
    }, '이벤트 포인트, 벚꽃 찹쌀떡, etc...'));
    tr.appendChild(makeSumCell(c.bonus, v => { c.bonus = v; afterValueEdit(); }));
    tr.appendChild(makeDeleteCell(() => { removeCurrency(c.id); }));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 재화 추가';
  addBtn.addEventListener('click', () => {
    state.currencies.push({
      id: allocateCurrencyId(state.currencies),
      name: '',
      bonus: 0,
    });
    afterEdit();
  });
  const row = document.createElement('div');
  row.className = 'btn-row';
  row.appendChild(addBtn);
  container.appendChild(row);
}
```

주요 변화:
- 중복 이름 alert 제거 + 입력 검증 로직 제거
- 이름 변경 시 연쇄 rename 호출 없음 (`c.name = v` 한 줄)
- 이름 변경 시 섹션 1/3/4 + result만 partial re-render (섹션 2는 re-render 안 해서 포커스 유지)
- 삭제 버튼이 `c.id`를 넘김 (idx 아님)
- 추가 버튼이 `allocateCurrencyId`로 ID 부여

- [ ] **Step 2: `renameCurrency` 삭제**

`src/ui.js:531-548`의 `renameCurrency` 함수 블록 전체를 **삭제**. ID 키잉으로 더 이상 키 이사가 필요 없음.

- [ ] **Step 3: `removeCurrency` 시그니처 변경**

`src/ui.js:550-557`의 `removeCurrency` 함수를 다음으로 교체:

```js
function removeCurrency(id) {
  const i = state.currencies.findIndex(c => c.id === id);
  if (i < 0) return;
  state.currencies.splice(i, 1);
  state.stages.forEach(stage => { delete stage.drops[id]; });
  delete state.owned[id];
  state.shopItems = state.shopItems.filter(it => it.currencyId !== id);
  afterEdit();
}
```

- [ ] **Step 4: 수동 확인**

Run: `node build.js`, 브라우저 새로고침.
Expected: 섹션 2에서 `재화 추가` 클릭 즉시 빈 행 생성, 이름 타이핑 중 섹션 3/4/result가 오동작할 수 있음(아직 다른 섹션이 name-key 기반) — 콘솔 에러만 확인하고 기능은 다음 태스크에서 완성.

- [ ] **Step 5: 커밋**

```bash
git add src/ui.js
git commit -m "refactor: renderCurrenciesSection uses id, removes renameCurrency cascade"
```

---

## Task 10: `renderResultSection` 전환 (섹션 1)

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: `renderResultSection` 교체**

`src/ui.js:53-76`의 `renderResultSection` 전체를 다음으로 교체:

```js
function renderResultSection() {
  const ownedDiv = document.getElementById('owned-container');
  ownedDiv.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'owned-row';
  row.appendChild(document.createTextNode('보유량:'));
  state.currencies.forEach(c => {
    const label = document.createElement('label');
    label.textContent = currencyLabel(c);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = state.owned[c.id] ?? 0;
    input.addEventListener('blur', () => {
      const n = Number(input.value);
      state.owned[c.id] = Number.isFinite(n) && n >= 0 ? n : 0;
      afterValueEdit();
    });
    label.appendChild(input);
    row.appendChild(label);
  });
  ownedDiv.appendChild(row);
}
```

주요 변화:
- `state.currencies.filter(c => c.name)` → `state.currencies` (전부 표시)
- 라벨 `c.name` → `currencyLabel(c)` (빈 이름 폴백)
- `state.owned[c.name]` → `state.owned[c.id]`

- [ ] **Step 2: 수동 확인**

Run: `node build.js`, 브라우저 새로고침.
Expected: 섹션 1(보유량) 라벨이 이름 또는 `(이름 없음)`으로 표시. 빈 이름 재화도 입력 칸이 나타남. 콘솔 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/ui.js
git commit -m "refactor: renderResultSection uses id and shows empty-named currencies"
```

---

## Task 11: `renderStagesSection` 전환 (섹션 3)

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: `renderStagesSection` 교체**

`src/ui.js:118-182`의 `renderStagesSection` 전체를 다음으로 교체:

```js
function renderStagesSection() {
  const container = document.getElementById('stages-container');
  container.innerHTML = '';

  const currencyCols = state.currencies;

  // 그룹 체크박스 행
  const toggleRow = document.createElement('div');
  toggleRow.className = 'group-toggle-row';
  for (let g = 0; g < 3; g++) {
    const startIdx = g * 4;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.groupsEnabled[g];
    checkbox.id = 'group-' + g;
    checkbox.addEventListener('change', () => {
      state.groupsEnabled[g] = checkbox.checked;
      afterEdit();
    });
    const label = document.createElement('label');
    label.htmlFor = 'group-' + g;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${startIdx + 1}~${startIdx + 4}`));
    toggleRow.appendChild(label);
  }
  container.appendChild(toggleRow);

  // 12개 스테이지 통합 표
  const table = document.createElement('table');
  table.className = 'stages-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>#</th><th>AP</th>';
  currencyCols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = currencyLabel(c);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let i = 0; i < 12; i++) {
    const group = Math.floor(i / 4);
    const tr = document.createElement('tr');
    if (!state.groupsEnabled[group]) tr.className = 'group-disabled';
    const numTd = document.createElement('td');
    numTd.textContent = i + 1;
    tr.appendChild(numTd);
    const apTd = document.createElement('td');
    apTd.textContent = STAGE_AP[i];
    tr.appendChild(apTd);
    currencyCols.forEach(c => {
      const value = state.stages[i].drops[c.id] ?? 0;
      tr.appendChild(makeNumCell(value, v => {
        if (v) state.stages[i].drops[c.id] = v;
        else delete state.stages[i].drops[c.id];
        afterValueEdit();
      }));
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}
```

주요 변화:
- `state.currencies.filter(c => c.name)` → `state.currencies`
- 헤더 `c.name` → `currencyLabel(c)`
- drops 접근 `c.name` → `c.id`

- [ ] **Step 2: 수동 확인**

Run: `node build.js`, 브라우저 새로고침.
Expected: 섹션 3(스테이지 표) 컬럼 헤더가 이름 또는 `(이름 없음)`으로 표시. 빈 이름 재화에 드랍값 입력·저장 가능.

- [ ] **Step 3: 커밋**

```bash
git add src/ui.js
git commit -m "refactor: renderStagesSection uses id keys and shows all currencies"
```

---

## Task 12: `renderShopsSection` + shop item 핸들러 전환 (섹션 4)

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: `renderShopsSection` 교체**

`src/ui.js:184-224`의 `renderShopsSection` 전체를 다음으로 교체:

```js
function renderShopsSection() {
  const container = document.getElementById('shops-container');
  container.innerHTML = '';

  const currencies = state.currencies;
  if (currencies.length === 0) {
    container.innerHTML = '<div class="result-msg">재화를 먼저 추가하세요</div>';
    return;
  }

  currencies.forEach(c => {
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = `${currencyLabel(c)} 상점`;
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    let itemCount = 0;
    state.shopItems.forEach((it, idx) => {
      if (it.currencyId !== c.id) return;
      itemCount++;
      grid.appendChild(makeShopItemCell(it, idx));
    });

    grid.appendChild(makeShopAddCell(c.id));

    const used = itemCount + 1;
    const total = Math.ceil(used / 4) * 4;
    for (let i = used; i < total; i++) {
      const empty = document.createElement('div');
      empty.className = 'shop-cell shop-cell-empty';
      grid.appendChild(empty);
    }

    details.appendChild(grid);
    container.appendChild(details);
  });
}
```

- [ ] **Step 2: `makeShopAddCell` 교체**

`src/ui.js:433-444`의 `makeShopAddCell` 전체를 다음으로 교체:

```js
function makeShopAddCell(currencyId) {
  const cell = document.createElement('div');
  cell.className = 'shop-cell shop-cell-add';
  const btn = document.createElement('button');
  btn.textContent = '+ 아이템 추가';
  btn.addEventListener('click', () => {
    state.shopItems.push({ currencyId, name: '', price: 0, buyCount: 0 });
    afterEdit();
  });
  cell.appendChild(btn);
  return cell;
}
```

- [ ] **Step 3: `selectPresetItem` 교체**

`src/ui.js:407-418`의 `selectPresetItem` 전체를 다음으로 교체:

```js
function selectPresetItem(shopItemIdx, preset) {
  const it = state.shopItems[shopItemIdx];
  if (!it) return;
  it.name = preset.name;
  it.price = preset.price;
  it.buyCount = preset.buyCount;
  const currencyId = it.currencyId;
  closeAutocomplete();
  afterEdit();
  focusNextShopItemNameIn(currencyId, shopItemIdx);
}
```

- [ ] **Step 4: `focusNextShopItemNameIn` 교체**

`src/ui.js:420-431`의 `focusNextShopItemNameIn` 전체를 다음으로 교체:

```js
function focusNextShopItemNameIn(currencyId, currentIdx) {
  const nextIdx = state.shopItems.findIndex(
    (s, i) => i > currentIdx && s.currencyId === currencyId
  );
  if (nextIdx === -1) return;
  requestAnimationFrame(() => {
    const el = document.querySelector(
      '.item-name-input[data-shop-idx="' + nextIdx + '"]'
    );
    if (el) el.focus();
  });
}
```

- [ ] **Step 5: 수동 확인**

Run: `node build.js`, 브라우저 새로고침 + 기존 localStorage 삭제 (DevTools → Application → Local Storage → `eventPlannerState` 삭제 후 새로고침. 구버전 name-key 데이터가 남아있으면 `normalizeCurrencyIds`가 drops/owned를 잘라버려 빈 상태가 됨 — 의도대로).

Expected:
- `재화 추가` 즉시 빈 행 생성, 섹션 1/3/4에 `(이름 없음)`으로 컬럼·라벨·상점 섹션 표시
- 이름 타이핑 중 섹션 1/3/4 헤더/라벨이 즉시 업데이트 (포커스 유지)
- 같은 이름 재화 두 개 생성해도 각각 독립적인 drops·owned·shopItems 관리
- 이름 변경 시 해당 재화의 drops/보유량/상점 아이템이 그대로 유지
- 재화 삭제 시 관련 드랍·보유량·상점 아이템이 함께 제거
- 상점 섹션에서 아이템 추가/삭제/자동완성 선택 정상 동작

- [ ] **Step 6: 커밋**

```bash
git add src/ui.js
git commit -m "refactor: renderShopsSection and shop item handlers use currencyId"
```

---

## Task 13: `renderSolvedResult` + `renderBalanceTable` 전환 (결과 영역)

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: `renderSolvedResult` 교체**

`src/ui.js:594-645`의 `renderSolvedResult` 전체를 다음으로 교체:

```js
function renderSolvedResult(container, solved) {
  let totalAP = 0;
  for (let i = 0; i < 12; i++) {
    const runs = Math.round(solved['s' + (i + 1)] ?? 0);
    totalAP += runs * STAGE_AP[i];
  }

  // 권장 횟수 표
  const stageTitle = document.createElement('div');
  stageTitle.className = 'stage-rec-title';
  stageTitle.textContent = '스테이지 권장 횟수';
  container.appendChild(stageTitle);

  const activeCurrencies = state.currencies;
  const stageTable = document.createElement('table');
  stageTable.className = 'stage-rec-table';
  const stageHead = document.createElement('thead');
  const stageHeadRow = document.createElement('tr');
  stageHeadRow.innerHTML = '<th>#</th><th>AP</th><th>횟수</th>';
  activeCurrencies.forEach(c => {
    const th = document.createElement('th');
    th.textContent = '+' + currencyLabel(c);
    stageHeadRow.appendChild(th);
  });
  stageHead.appendChild(stageHeadRow);
  stageTable.appendChild(stageHead);

  const stageBody = document.createElement('tbody');
  for (let i = 0; i < 12; i++) {
    const runs = Math.round(solved['s' + (i + 1)] ?? 0);
    if (!runs) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>스테이지 ${i + 1}</td><td>${STAGE_AP[i]} ap</td><td>${runs} 번</td>`;
    activeCurrencies.forEach(c => {
      const perRun = applyBonus(state.stages[i].drops[c.id] ?? 0, c.bonus);
      const td = document.createElement('td');
      td.textContent = perRun * runs;
      tr.appendChild(td);
    });
    stageBody.appendChild(tr);
  }
  stageTable.appendChild(stageBody);
  container.appendChild(stageTable);

  const header = document.createElement('div');
  header.className = 'result-ok';
  header.textContent = '✅ 총 AP: ' + totalAP;
  container.appendChild(header);

  // 재화 수지 표
  renderBalanceTable(container, solved);
}
```

주요 변화:
- `state.currencies.filter(c => c.name)` → `state.currencies`
- 헤더 `'+' + c.name` → `'+' + currencyLabel(c)`
- drops 접근 `c.name` → `c.id`

- [ ] **Step 2: `renderBalanceTable` 교체**

`src/ui.js:647-671`의 `renderBalanceTable` 전체를 다음으로 교체:

```js
function renderBalanceTable(container, solved) {
  const balTitle = document.createElement('div');
  balTitle.textContent = '재화 수지';
  balTitle.style.marginTop = '12px';
  container.appendChild(balTitle);

  const balanceTable = document.createElement('table');
  balanceTable.innerHTML = '<thead><tr><th>재화</th><th>보유</th><th>필요</th><th>획득</th><th>잉여</th></tr></thead>';
  const balBody = document.createElement('tbody');
  const balance = computeBalance(state, solved);
  state.currencies.forEach(c => {
    const b = balance[c.id];
    if (!b) return;
    const tr = document.createElement('tr');
    const surplusColor = b.surplus < 0 ? 'color:#c33' : '';
    tr.innerHTML =
      `<td>${escapeHtml(currencyLabel(c))}</td>` +
      `<td>${b.owned}</td>` +
      `<td>${b.needed}</td>` +
      `<td>+${b.gained}</td>` +
      `<td style="${surplusColor}">${b.surplus >= 0 ? '+' : ''}${b.surplus}</td>`;
    balBody.appendChild(tr);
  });
  balanceTable.appendChild(balBody);
  container.appendChild(balanceTable);
}
```

주요 변화:
- `filter(c => c.name)` → 전체 순회
- `balance[c.name]` → `balance[c.id]`
- 표시용 이름 `c.name` → `currencyLabel(c)`

- [ ] **Step 3: 수동 확인**

Run: `node build.js`, 브라우저 새로고침.

시나리오:
1. 새 상태로 시작 (localStorage 비워둔 상태)
2. `재화 추가` 클릭 → 빈 행 생성
3. 이름 `엔화` 입력 → 섹션 1/3/4 헤더가 실시간으로 `엔화`로 바뀜
4. 섹션 3 스테이지 1의 `엔화` 컬럼에 `5` 입력
5. 섹션 4 엔화 상점에 아이템 `x`, price `100`, buyCount `1` 입력
6. 결과 영역에 권장 횟수 표와 수지표가 `엔화`로 표시
7. 이름을 `달러`로 변경 → 결과 영역이 `달러`로 즉시 갱신, 값 유지
8. 이름을 빈 문자열로 지움 → `(이름 없음)`으로 표시, 계산은 계속 동작
9. 두 번째 재화 추가하고 이름도 `(이름 없음)`으로 두고 독립 동작 확인
10. 같은 이름 재화 두 개(`포인트` × 2) 추가 → 헤더에 두 번 나타나지만 내부적으로 독립
11. 재화 삭제(×) → 관련 drops/owned/shopItems 사라짐
12. export JSON → 새 shape 확인 (`id`, `currencyId` 필드 존재, `shopName` 없음)

Expected: 모든 시나리오 정상 동작. 콘솔 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/ui.js
git commit -m "refactor: renderSolvedResult and renderBalanceTable use id"
```

---

## Task 14: 최종 빌드 + 검증 + 커밋

**Files:**
- Modify: `index.html` (자동 재생성)

- [ ] **Step 1: 최종 빌드**

Run: `node build.js`
Expected: `wrote .../index.html (... KB)` 출력.

- [ ] **Step 2: `test.html` 전체 테스트 재실행**

브라우저에서 `test.html` 열기.
Expected: `N passed, 0 failed` (N은 기존 테스트 + 신규 태스크 1~6에서 추가된 약 17개).

- [ ] **Step 3: `index.html` 전체 수동 회귀**

브라우저에서 `index.html` 열기. localStorage를 비운 상태에서 다음 시나리오 재확인:

1. 새 재화 추가 / 이름 입력 / 보너스 입력
2. 스테이지 드랍 입력
3. 상점 아이템 추가 / 자동완성 / 가격·개수 수정
4. 결과 영역의 권장 횟수·수지표
5. 재화 이름 변경 / 삭제
6. 빈 이름 재화 다중 생성
7. 중복 이름 재화 다중 생성
8. JSON export / import 왕복
9. 개발자 JSON 편집기 (toolbar의 JSON 버튼)
10. 프리셋 편집기 (toolbar)

Expected: 모든 기능 정상. 콘솔 에러 없음.

- [ ] **Step 4: `index.html` 커밋**

```bash
git add index.html
git commit -m "build: regenerate index.html after currency id refactor"
```

- [ ] **Step 5: 전체 브랜치 검토**

```bash
git log --oneline -20
```

Expected: Task 1~14에 해당하는 커밋들이 순서대로 쌓여 있음.

---

## 구현 완료 후 확인 체크리스트

- [ ] 모든 `test.html` 테스트 PASS
- [ ] 브라우저에서 `index.html` 정상 동작
- [ ] 빈 이름 재화가 섹션 1/3/4에 `(이름 없음)`으로 표시됨
- [ ] 이름 타이핑 시 섹션 1/3/4가 실시간 반영되고 포커스가 유지됨
- [ ] 중복 이름 재화가 내부적으로 독립
- [ ] 재화 이름 변경 시 drops/보유량/상점 아이템이 유지됨
- [ ] 재화 삭제 시 관련 데이터가 일괄 제거됨
- [ ] export된 JSON에 `id`/`currencyId` 필드가 있고 `shopName`은 없음
- [ ] 콘솔에 에러 없음
- [ ] 이전 대화의 uncommitted 변경이 Task 9에서 흡수되어 `git diff`에 더 이상 남아있지 않음
