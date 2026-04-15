# Event Planner (자작 버전) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임 이벤트의 스테이지 드랍·상점 데이터를 사용자가 직접 입력해 ILP로 최소 AP를 계산하는 단일 HTML 도구를 제작한다.

**Architecture:** 개발 중엔 `logic.js` (순수 함수) + `ui.js` (DOM) + `solver.js` (라이브러리) + `event-planner.html` (뼈대) 로 분리. 테스트는 브라우저에서 여는 `test.html`(자체 assert) 로 TDD. 마지막 태스크에서 모든 리소스를 인라인하여 단일 `event-planner.release.html` 를 생성한다.

**Tech Stack:** vanilla JS (no framework, no build tools) · `javascript-lp-solver` (로컬 사본) · HTML `<details>` · localStorage · 브라우저만 필요 (Node.js 불필요)

**Spec:** `docs/superpowers/specs/2026-04-13-event-planner-design.md`

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `solver.js` | `javascript-lp-solver` UMD 번들 (이미 루트에 존재) |
| `logic.js` | 순수 함수들: `applyBonus`, `buildModel`, `computeBalance`, `hasMinimumData`, `validateState`, `defaultState` |
| `ui.js` | DOM 렌더링, 이벤트 바인딩, `recompute`, localStorage, JSON import/export, JSON 편집 토글 |
| `event-planner.html` | 개발용 HTML. `<style>` 인라인 + `<script src="...">` 로 solver/logic/ui 로드 |
| `test.html` | 브라우저 기반 테스트 러너. `logic.js` 로드 후 테스트 케이스 실행, 결과 화면 표시 |
| `event-planner.release.html` | 최종 단일 파일 산출물 (마지막 태스크에서 생성) |

---

## Task 1: 프로젝트 초기화 (git + 뼈대 파일)

**Files:**
- Create: `.gitignore`
- Create: `logic.js`
- Create: `ui.js`
- Create: `test.html`
- Create: `event-planner.html`

- [ ] **Step 1: git 저장소 초기화 및 기존 파일 확인**

```bash
cd "C:/Users/admin/Documents/workspace/test/justin163"
git init
git status
```

Expected: `solver.js`, `Event Planner.html`, `Event Planner_files/`, `docs/` 등이 Untracked로 나열됨.

- [ ] **Step 2: `.gitignore` 생성**

```
# 원본 참고 자료 (이미 있고 수정 안 함)
Event Planner.html
Event Planner_files/

# OS/에디터
.DS_Store
Thumbs.db
.vscode/
.idea/
```

- [ ] **Step 3: 빈 `logic.js` 생성**

```js
// Event Planner — 순수 로직 함수들. 브라우저·Node 모두에서 require/로드 가능.

const STAGE_AP = [10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20];

// 함수들은 이후 태스크에서 추가됨.

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGE_AP };
}
```

- [ ] **Step 4: 빈 `ui.js` 생성**

```js
// Event Planner — DOM 렌더링 및 이벤트 바인딩. 브라우저 전용.

// 이후 태스크에서 내용 추가됨.
```

- [ ] **Step 5: `test.html` 테스트 러너 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Logic Tests</title>
  <style>
    body { font: 14px/1.5 monospace; padding: 20px; }
    pre { white-space: pre-wrap; }
    .pass { color: #2a7; }
    .fail { color: #c33; }
    .summary { font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Logic Tests</h1>
  <pre id="out">(running...)</pre>

  <script src="solver.js"></script>
  <script src="logic.js"></script>
  <script>
    const results = [];

    function test(name, fn) {
      try { fn(); results.push({ name, pass: true }); }
      catch (e) { results.push({ name, pass: false, err: e.message, stack: e.stack }); }
    }

    function assertEqual(actual, expected, msg) {
      const a = JSON.stringify(actual), b = JSON.stringify(expected);
      if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + b + ' got ' + a);
    }

    function assertTrue(cond, msg) {
      if (!cond) throw new Error(msg || 'assertion failed');
    }

    function assertApprox(actual, expected, tol, msg) {
      if (Math.abs(actual - expected) > (tol ?? 1e-9))
        throw new Error((msg ? msg + ': ' : '') + 'expected ~' + expected + ' got ' + actual);
    }

    // === TEST CASES (이후 태스크에서 추가) ===


    // === RENDER ===
    const out = document.getElementById('out');
    let passed = 0, failed = 0;
    const lines = results.map(r => {
      if (r.pass) { passed++; return '<span class="pass">✓ ' + r.name + '</span>'; }
      failed++;
      return '<span class="fail">✗ ' + r.name + '\n    ' + r.err + '</span>';
    });
    lines.push('<div class="summary">' + passed + ' passed, ' + failed + ' failed</div>');
    out.innerHTML = lines.join('\n');
    document.title = (failed === 0 ? '✓' : '✗') + ' ' + passed + '/' + (passed + failed);
  </script>
</body>
</html>
```

- [ ] **Step 6: `event-planner.html` 개발용 뼈대 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>이벤트 플래너</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 20px auto; padding: 0 16px; }
    h1 { font-size: 1.4em; display: flex; justify-content: space-between; align-items: center; }
    h1 .toolbar button { margin-left: 6px; font-size: 0.7em; }
    details { border: 1px solid #8884; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
    details > summary { font-weight: bold; cursor: pointer; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #8884; padding: 4px 8px; text-align: center; }
    th { background: #8881; }
    input[type="text"], input[type="number"] { width: 100%; box-sizing: border-box; padding: 2px 4px; font: inherit; }
    input[readonly] { background: #8881; color: #888; }
    .btn-row { margin-top: 8px; }
    .btn-del { color: #c33; background: none; border: none; cursor: pointer; font-size: 1.1em; }
    .group-disabled { opacity: 0.4; }
    .result-ok { color: #2a7; font-size: 1.8em; font-weight: bold; text-align: center; margin: 12px 0; }
    .result-msg { padding: 12px; text-align: center; color: #888; }
    .result-err { padding: 12px; text-align: center; color: #c33; background: #c331; border-radius: 6px; }
    .owned-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
    .owned-row label { display: inline-flex; gap: 4px; align-items: center; }
    .owned-row input { width: 80px; }
    #json-view { display: none; }
    #json-view textarea { width: 100%; height: 400px; font: 12px/1.4 monospace; }
  </style>
</head>
<body>
  <h1>
    이벤트 플래너
    <span class="toolbar">
      <button id="btn-json">JSON 보기</button>
      <button id="btn-export">내보내기</button>
      <button id="btn-import">불러오기</button>
      <input type="file" id="file-import" accept=".json" style="display:none">
    </span>
  </h1>

  <div id="main-view">
    <details id="sec-result" open>
      <summary>1. 보유량 &amp; 결과</summary>
      <div id="owned-container"></div>
      <div id="result-container"></div>
    </details>

    <details id="sec-currencies" open>
      <summary>2. 재화 / 상점</summary>
      <div id="currencies-container"></div>
    </details>

    <details id="sec-stages" open>
      <summary>3. 스테이지 (12개 고정)</summary>
      <div id="stages-container"></div>
    </details>

    <details id="sec-shops">
      <summary>4. 상점</summary>
      <div id="shops-container"></div>
    </details>
  </div>

  <div id="json-view">
    <textarea id="json-textarea"></textarea>
    <div class="btn-row">
      <button id="btn-json-apply">적용</button>
      <button id="btn-json-cancel">취소</button>
    </div>
  </div>

  <script src="solver.js"></script>
  <script src="logic.js"></script>
  <script src="ui.js"></script>
</body>
</html>
```

- [ ] **Step 7: 브라우저에서 파일 두 개 모두 열어 확인**

1. `event-planner.html` 더블클릭 → 제목 "이벤트 플래너" + 4개 빈 섹션이 보임. 콘솔에 빨간 에러 없음.
2. `test.html` 더블클릭 → "0 passed, 0 failed" 표시. 탭 제목이 `✓ 0/0`.

- [ ] **Step 8: Commit**

```bash
git add .gitignore logic.js ui.js test.html event-planner.html solver.js docs/
git commit -m "chore: scaffold event planner project"
```

---

## Task 2: `applyBonus` 함수 (TDD)

**Files:**
- Modify: `test.html` (테스트 블록에 케이스 추가)
- Modify: `logic.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`test.html`의 `// === TEST CASES ===` 아래에 추가:

```js
test('applyBonus: 보너스 100이면 원본 그대로', () => {
  assertEqual(applyBonus(10, 100), 10);
});

test('applyBonus: 보너스 105이면 10 → 11 (ceil)', () => {
  assertEqual(applyBonus(10, 105), 11);  // 10.5 → 11
});

test('applyBonus: 보너스 95이면 10 → 10 (ceil of 9.5)', () => {
  assertEqual(applyBonus(10, 95), 10);
});

test('applyBonus: 보너스 200이면 두 배', () => {
  assertEqual(applyBonus(7, 200), 14);
});

test('applyBonus: 원본 0은 항상 0', () => {
  assertEqual(applyBonus(0, 150), 0);
});

test('applyBonus: 부동소수점 안정성 (0.1+0.2)', () => {
  // 3 * 110 / 100 = 3.3 이지만 부동소수점 오차로 3.3000000000000003 일 수 있음
  assertEqual(applyBonus(3, 110), 4);  // ceil(3.3) = 4
});
```

- [ ] **Step 2: 브라우저에서 `test.html` 새로고침하여 실패 확인**

Expected: 6개 모두 `✗` 로 표시. 에러 메시지: `applyBonus is not defined`.

- [ ] **Step 3: `logic.js`에 `applyBonus` 구현**

`STAGE_AP` 상수 아래, `if (typeof module` 위에 추가:

```js
function applyBonus(raw, bonus) {
  return Math.ceil(+(raw * bonus / 100).toFixed(5));
}
```

`module.exports` 도 업데이트:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGE_AP, applyBonus };
}
```

- [ ] **Step 4: 브라우저에서 `test.html` 새로고침하여 통과 확인**

Expected: 6개 모두 `✓`. 탭 제목 `✓ 6/6`.

- [ ] **Step 5: Commit**

```bash
git add logic.js test.html
git commit -m "feat: add applyBonus with ceil + floating-point guard"
```

---

## Task 3: `defaultState` 함수 (TDD)

**Files:**
- Modify: `test.html`
- Modify: `logic.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('defaultState: 빈 재화 배열', () => {
  const s = defaultState();
  assertEqual(s.currencies, []);
});

test('defaultState: 12개 스테이지 고정', () => {
  const s = defaultState();
  assertEqual(s.stages.length, 12);
  s.stages.forEach(stage => assertEqual(stage.drops, {}));
});

test('defaultState: 빈 shopItems', () => {
  assertEqual(defaultState().shopItems, []);
});

test('defaultState: 빈 owned', () => {
  assertEqual(defaultState().owned, {});
});

test('defaultState: 모든 그룹 활성', () => {
  assertEqual(defaultState().groupsEnabled, [true, true, true]);
});
```

- [ ] **Step 2: 새로고침하여 실패 확인**

Expected: 5개 추가 실패. `defaultState is not defined`.

- [ ] **Step 3: `logic.js`에 구현**

```js
function defaultState() {
  return {
    currencies: [],
    stages: Array.from({ length: 12 }, () => ({ drops: {} })),
    shopItems: [],
    owned: {},
    groupsEnabled: [true, true, true],
  };
}
```

`module.exports` 업데이트:

```js
module.exports = { STAGE_AP, applyBonus, defaultState };
```

- [ ] **Step 4: 새로고침하여 통과 확인**

Expected: 11/11 passed.

- [ ] **Step 5: Commit**

```bash
git add logic.js test.html
git commit -m "feat: add defaultState with 12 fixed stages"
```

---

## Task 4: `buildModel` 함수 (TDD)

**Files:**
- Modify: `test.html`
- Modify: `logic.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('buildModel: 기본 최소화 목표는 AP', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 5;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertEqual(m.optimize, 'AP');
  assertEqual(m.opType, 'min');
});

test('buildModel: 스테이지 변수에 AP와 재화 드랍 포함', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 5;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertEqual(m.variables.s1, { AP: 10, '엔화': 5 });
});

test('buildModel: 보너스가 드랍에 적용됨', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 150, shopName: '' }];
  s.stages[0].drops['엔화'] = 4;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertEqual(m.variables.s1['엔화'], 6);  // ceil(4*1.5)
});

test('buildModel: AP는 인덱스별 고정값', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  for (let i = 0; i < 12; i++) s.stages[i].drops['엔화'] = 1;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  assertEqual(m.variables.s1.AP, 10);
  assertEqual(m.variables.s5.AP, 15);
  assertEqual(m.variables.s12.AP, 20);
});

test('buildModel: 비활성 그룹의 스테이지는 변수에서 제외', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  for (let i = 0; i < 12; i++) s.stages[i].drops['엔화'] = 1;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  s.groupsEnabled = [true, false, false];
  const m = buildModel(s);
  assertTrue(m.variables.s1, 's1 should exist');
  assertTrue(m.variables.s4, 's4 should exist');
  assertTrue(!m.variables.s5, 's5 should not exist');
  assertTrue(!m.variables.s12, 's12 should not exist');
});

test('buildModel: 제약은 필요량에서 보유량을 뺀 값', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 1;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 300, buyCount: 2 }];  // need=600
  s.owned['엔화'] = 200;
  const m = buildModel(s);
  assertEqual(m.constraints['엔화'], { min: 400 });
});

test('buildModel: 보유량이 필요량 이상이면 제약 제외', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 1;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  s.owned['엔화'] = 999;
  const m = buildModel(s);
  assertTrue(!('엔화' in m.constraints));
});

test('buildModel: 모든 스테이지 변수는 ints에 표시', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  for (let i = 0; i < 12; i++) s.stages[i].drops['엔화'] = 1;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  const m = buildModel(s);
  for (let i = 1; i <= 12; i++) assertEqual(m.ints['s' + i], 1);
});

test('buildModel: 빈 이름 재화는 무시', () => {
  const s = defaultState();
  s.currencies = [{ name: '', bonus: 100, shopName: '' }, { name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 5;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 50, buyCount: 1 }];
  const m = buildModel(s);
  assertTrue(!('' in m.variables.s1));
  assertEqual(m.variables.s1['엔화'], 5);
});
```

- [ ] **Step 2: 새로고침하여 실패 확인**

Expected: 위 9개 모두 `✗` (`buildModel is not defined`).

- [ ] **Step 3: `logic.js`에 `buildModel` 구현**

```js
function buildModel(state) {
  const variables = {};
  state.stages.forEach((stage, i) => {
    const group = Math.floor(i / 4);
    if (!state.groupsEnabled[group]) return;

    const v = { AP: STAGE_AP[i] };
    state.currencies.forEach(c => {
      if (!c.name) return;
      const raw = stage.drops[c.name] ?? 0;
      v[c.name] = applyBonus(raw, c.bonus);
    });
    variables['s' + (i + 1)] = v;
  });

  const constraints = {};
  state.currencies.forEach(c => {
    if (!c.name) return;
    const need = state.shopItems
      .filter(it => it.currency === c.name)
      .reduce((sum, it) => sum + (it.price || 0) * (it.buyCount || 0), 0);
    const remaining = need - (state.owned[c.name] ?? 0);
    if (remaining > 0) constraints[c.name] = { min: remaining };
  });

  const ints = {};
  Object.keys(variables).forEach(k => { ints[k] = 1; });

  return { optimize: 'AP', opType: 'min', variables, constraints, ints };
}
```

`module.exports` 업데이트:

```js
module.exports = { STAGE_AP, applyBonus, defaultState, buildModel };
```

- [ ] **Step 4: 새로고침하여 통과 확인**

Expected: 20/20 passed.

- [ ] **Step 5: Commit**

```bash
git add logic.js test.html
git commit -m "feat: add buildModel (ILP model builder)"
```

---

## Task 5: `computeBalance` 함수 (TDD)

**Files:**
- Modify: `test.html`
- Modify: `logic.js`

재화 수지 (보유/획득/필요/잉여)를 한꺼번에 계산.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('computeBalance: 단일 재화 단순 케이스', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 5;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 2 }];
  s.owned['엔화'] = 50;
  // solver 결과 대신 { s1: 40 } 직접 전달
  const b = computeBalance(s, { s1: 40 });
  assertEqual(b['엔화'], { owned: 50, gained: 200, needed: 200, surplus: 50 });
});

test('computeBalance: 보너스 적용된 획득량', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 150, shopName: '' }];
  s.stages[0].drops['엔화'] = 4;  // ceil(4*1.5) = 6
  s.shopItems = [{ currency: '엔화', name: 'x', price: 12, buyCount: 1 }];
  const b = computeBalance(s, { s1: 2 });
  assertEqual(b['엔화'].gained, 12);  // 6 * 2
});

test('computeBalance: 여러 스테이지 합산', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[0].drops['엔화'] = 5;
  s.stages[4].drops['엔화'] = 8;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  const b = computeBalance(s, { s1: 3, s5: 10 });
  assertEqual(b['엔화'].gained, 95);  // 5*3 + 8*10
});

test('computeBalance: 여러 재화', () => {
  const s = defaultState();
  s.currencies = [
    { name: '엔화', bonus: 100, shopName: '' },
    { name: '달러', bonus: 100, shopName: '' },
  ];
  s.stages[0].drops['엔화'] = 5;
  s.stages[0].drops['달러'] = 2;
  s.shopItems = [
    { currency: '엔화', name: 'a', price: 50, buyCount: 1 },
    { currency: '달러', name: 'b', price: 20, buyCount: 2 },
  ];
  const b = computeBalance(s, { s1: 10 });
  assertEqual(b['엔화'], { owned: 0, gained: 50, needed: 50, surplus: 0 });
  assertEqual(b['달러'], { owned: 0, gained: 20, needed: 40, surplus: -20 });
});

test('computeBalance: 비활성 그룹은 획득량에 기여하지 않음', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.stages[4].drops['엔화'] = 10;
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  s.groupsEnabled = [true, false, true];
  const b = computeBalance(s, { s5: 3 });  // solver에서 올 수 없지만 방어적 처리 확인
  assertEqual(b['엔화'].gained, 0);
});
```

- [ ] **Step 2: 새로고침하여 실패 확인**

Expected: 5개 추가 실패. `computeBalance is not defined`.

- [ ] **Step 3: `logic.js`에 구현**

```js
function computeBalance(state, solverResult) {
  const result = {};
  state.currencies.forEach(c => {
    if (!c.name) return;
    const owned = state.owned[c.name] ?? 0;
    const needed = state.shopItems
      .filter(it => it.currency === c.name)
      .reduce((sum, it) => sum + (it.price || 0) * (it.buyCount || 0), 0);
    let gained = 0;
    state.stages.forEach((stage, i) => {
      const group = Math.floor(i / 4);
      if (!state.groupsEnabled[group]) return;
      const runs = solverResult['s' + (i + 1)] ?? 0;
      if (!runs) return;
      const perRun = applyBonus(stage.drops[c.name] ?? 0, c.bonus);
      gained += perRun * runs;
    });
    result[c.name] = { owned, gained, needed, surplus: owned + gained - needed };
  });
  return result;
}
```

`module.exports` 업데이트:

```js
module.exports = { STAGE_AP, applyBonus, defaultState, buildModel, computeBalance };
```

- [ ] **Step 4: 새로고침하여 통과 확인**

Expected: 25/25 passed.

- [ ] **Step 5: Commit**

```bash
git add logic.js test.html
git commit -m "feat: add computeBalance for currency summary"
```

---

## Task 6: `hasMinimumData` 함수 (TDD)

**Files:**
- Modify: `test.html`
- Modify: `logic.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('hasMinimumData: 빈 state는 false', () => {
  assertEqual(hasMinimumData(defaultState()), false);
});

test('hasMinimumData: 재화만 있으면 false (상점 아이템 없음)', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: 재화 + 유효 아이템 있으면 true', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  assertEqual(hasMinimumData(s), true);
});

test('hasMinimumData: buyCount=0 인 아이템만 있으면 false', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 0 }];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: price=0 인 아이템만 있으면 false', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.shopItems = [{ currency: '엔화', name: 'x', price: 0, buyCount: 1 }];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: 모든 그룹 비활성이면 false', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 100, shopName: '' }];
  s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
  s.groupsEnabled = [false, false, false];
  assertEqual(hasMinimumData(s), false);
});

test('hasMinimumData: 빈 이름 재화는 카운트하지 않음', () => {
  const s = defaultState();
  s.currencies = [{ name: '', bonus: 100, shopName: '' }];
  s.shopItems = [{ currency: '', name: 'x', price: 100, buyCount: 1 }];
  assertEqual(hasMinimumData(s), false);
});
```

- [ ] **Step 2: 새로고침하여 실패 확인**

Expected: 7개 추가 실패.

- [ ] **Step 3: `logic.js`에 구현**

```js
function hasMinimumData(state) {
  const hasCurrency = state.currencies.some(c => c.name && c.name.length > 0);
  const hasGroup = state.groupsEnabled.some(g => g);
  const hasItem = state.shopItems.some(it =>
    it.currency && (it.price || 0) > 0 && (it.buyCount || 0) > 0
  );
  return hasCurrency && hasGroup && hasItem;
}
```

`module.exports` 업데이트:

```js
module.exports = { STAGE_AP, applyBonus, defaultState, buildModel, computeBalance, hasMinimumData };
```

- [ ] **Step 4: 새로고침하여 통과 확인**

Expected: 32/32 passed.

- [ ] **Step 5: Commit**

```bash
git add logic.js test.html
git commit -m "feat: add hasMinimumData gate"
```

---

## Task 7: `validateState` 함수 (TDD)

**Files:**
- Modify: `test.html`
- Modify: `logic.js`

JSON 불러오기/적용 시 검증용.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('validateState: 유효한 기본 state', () => {
  assertEqual(validateState(defaultState()), null);
});

test('validateState: null 거부', () => {
  assertTrue(validateState(null) !== null);
});

test('validateState: currencies 배열 아님 거부', () => {
  const s = defaultState(); s.currencies = {};
  assertTrue(validateState(s) !== null);
});

test('validateState: stages 길이 12 아니면 거부', () => {
  const s = defaultState(); s.stages = s.stages.slice(0, 11);
  assertTrue(validateState(s) !== null);
});

test('validateState: stages[i].drops 없으면 거부', () => {
  const s = defaultState(); delete s.stages[0].drops;
  assertTrue(validateState(s) !== null);
});

test('validateState: shopItems 필드 누락 거부', () => {
  const s = defaultState();
  s.shopItems = [{ currency: '엔화', name: 'x' }];  // price/buyCount 누락
  assertTrue(validateState(s) !== null);
});

test('validateState: groupsEnabled 길이 3 아니면 거부', () => {
  const s = defaultState(); s.groupsEnabled = [true, true];
  assertTrue(validateState(s) !== null);
});

test('validateState: owned가 객체 아니면 거부', () => {
  const s = defaultState(); s.owned = [];
  assertTrue(validateState(s) !== null);
});

test('validateState: currencies 내부 필드 타입 검증', () => {
  const s = defaultState();
  s.currencies = [{ name: '엔화', bonus: 'oops', shopName: '' }];
  assertTrue(validateState(s) !== null);
});
```

- [ ] **Step 2: 새로고침하여 실패 확인**

Expected: 9개 추가 실패.

- [ ] **Step 3: `logic.js`에 구현**

```js
function validateState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'state must be an object';

  if (!Array.isArray(s.currencies)) return 'currencies must be an array';
  for (const c of s.currencies) {
    if (!c || typeof c !== 'object') return 'currency item must be object';
    if (typeof c.name !== 'string') return 'currency.name must be string';
    if (typeof c.bonus !== 'number') return 'currency.bonus must be number';
    if (typeof c.shopName !== 'string') return 'currency.shopName must be string';
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
    if (typeof it.currency !== 'string') return 'shopItem.currency must be string';
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

  return null;  // valid
}
```

`module.exports` 업데이트:

```js
module.exports = {
  STAGE_AP, applyBonus, defaultState, buildModel,
  computeBalance, hasMinimumData, validateState,
};
```

- [ ] **Step 4: 새로고침하여 통과 확인**

Expected: 41/41 passed.

- [ ] **Step 5: Commit**

```bash
git add logic.js test.html
git commit -m "feat: add validateState for JSON import"
```

---

## Task 8: `ui.js` — state 초기화 + localStorage 로드/저장

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: `ui.js` 초기 구조 작성**

```js
// Event Planner — DOM 렌더링 및 이벤트 바인딩. 브라우저 전용.

const STORAGE_KEY = 'eventPlannerState';

let state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
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

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('saveState failed:', e.message);
  }
}

function render() {
  // 이후 태스크에서 구현
}

// 초기 렌더
document.addEventListener('DOMContentLoaded', () => {
  render();
});
```

- [ ] **Step 2: 브라우저에서 `event-planner.html` 열기**

1. 더블클릭으로 열고 F12 → Application → Local Storage 에서 `eventPlannerState` 가 없는 상태 확인.
2. 콘솔에 에러 없어야 함. (render는 빈 함수라서 섹션 내용은 여전히 비어있음)
3. 콘솔에 직접 입력: `console.log(state)` → `{ currencies: [], stages: [...], shopItems: [], owned: {}, groupsEnabled: [true, true, true] }` 출력.
4. 콘솔에서 `state.currencies.push({name:'엔화', bonus:100, shopName:''}); saveState();` 실행 후 페이지 새로고침 → 다시 `console.log(state)` 가 해당 재화를 기억해야 함.
5. 검증 후 `localStorage.clear()` 로 정리.

- [ ] **Step 3: Commit**

```bash
git add ui.js
git commit -m "feat: wire state, loadState, saveState with validation"
```

---

## Task 9: `ui.js` — `render()` 뼈대 + 섹션 디스패치

**Files:**
- Modify: `ui.js`

`render()`가 4개 섹션을 각각 그리는 헬퍼들을 호출하도록 구조만 먼저 잡음.

- [ ] **Step 1: `render()` 구조 확장**

`ui.js`의 `render` 함수를 다음으로 교체:

```js
function render() {
  renderResultSection();
  renderCurrenciesSection();
  renderStagesSection();
  renderShopsSection();
}

function renderResultSection() {
  const owned = document.getElementById('owned-container');
  const result = document.getElementById('result-container');
  owned.innerHTML = '';
  result.innerHTML = '<div class="result-msg">(아직 구현되지 않음)</div>';
}

function renderCurrenciesSection() {
  document.getElementById('currencies-container').innerHTML = '<div class="result-msg">(아직 구현되지 않음)</div>';
}

function renderStagesSection() {
  document.getElementById('stages-container').innerHTML = '<div class="result-msg">(아직 구현되지 않음)</div>';
}

function renderShopsSection() {
  document.getElementById('shops-container').innerHTML = '<div class="result-msg">(아직 구현되지 않음)</div>';
}
```

- [ ] **Step 2: 브라우저에서 열고 확인**

Expected: 4개 섹션에 모두 "(아직 구현되지 않음)" 회색 안내. 콘솔 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add ui.js
git commit -m "feat: scaffold render() with section dispatch"
```

---

## Task 10: 재화/상점 섹션 렌더링 + 이벤트

**Files:**
- Modify: `ui.js`

재화 표: 이름 / 보너스% / 상점 이름 / 삭제. "+ 재화 추가" 버튼.

- [ ] **Step 1: `renderCurrenciesSection` 구현**

```js
function renderCurrenciesSection() {
  const container = document.getElementById('currencies-container');
  container.innerHTML = '';

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>재화</th><th>보너스 %</th><th>상점 이름</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');

  state.currencies.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.appendChild(makeTextCell(c.name, v => renameCurrency(idx, v)));
    tr.appendChild(makeNumCell(c.bonus, v => { c.bonus = v; afterEdit(); }, { emptyValue: 100 }));
    tr.appendChild(makeTextCell(c.shopName, v => { c.shopName = v; afterEdit(); }));
    tr.appendChild(makeDeleteCell(() => { removeCurrency(idx); }));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 재화 추가';
  addBtn.addEventListener('click', () => {
    state.currencies.push({ name: '새 재화', bonus: 100, shopName: '새 재화 상점' });
    afterEdit();
  });
  const row = document.createElement('div');
  row.className = 'btn-row';
  row.appendChild(addBtn);
  container.appendChild(row);
}

// --- 셀 헬퍼 (파일 하단에 별도 유틸 섹션) ---
function makeTextCell(value, onCommit) {
  const td = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value ?? '';
  input.addEventListener('blur', () => onCommit(input.value));
  td.appendChild(input);
  return td;
}

function makeNumCell(value, onCommit, opts = {}) {
  const td = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value ?? (opts.emptyValue ?? 0);
  if (opts.readonly) input.readOnly = true;
  input.addEventListener('blur', () => {
    const raw = input.value.trim();
    const fallback = opts.emptyValue ?? 0;
    if (raw === '') { onCommit(fallback); return; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) { onCommit(fallback); return; }
    onCommit(n);
  });
  td.appendChild(input);
  return td;
}

function makeDeleteCell(onClick) {
  const td = document.createElement('td');
  const btn = document.createElement('button');
  btn.className = 'btn-del';
  btn.textContent = '×';
  btn.title = '삭제';
  btn.addEventListener('click', onClick);
  td.appendChild(btn);
  return td;
}

function afterEdit() {
  saveState();
  render();
  recompute();
}
```

- [ ] **Step 2: `renameCurrency` / `removeCurrency` 헬퍼 추가**

```js
function renameCurrency(idx, newName) {
  const old = state.currencies[idx].name;
  if (newName === old) return;
  state.currencies[idx].name = newName;
  // 기존 키를 따라 움직이는 관련 구조 업데이트
  state.stages.forEach(stage => {
    if (old in stage.drops) {
      stage.drops[newName] = stage.drops[old];
      delete stage.drops[old];
    }
  });
  if (old in state.owned) {
    state.owned[newName] = state.owned[old];
    delete state.owned[old];
  }
  state.shopItems.forEach(it => {
    if (it.currency === old) it.currency = newName;
  });
  afterEdit();
}

function removeCurrency(idx) {
  const name = state.currencies[idx].name;
  state.currencies.splice(idx, 1);
  state.stages.forEach(stage => { delete stage.drops[name]; });
  delete state.owned[name];
  state.shopItems = state.shopItems.filter(it => it.currency !== name);
  afterEdit();
}
```

- [ ] **Step 3: 임시 `recompute` 스텁 추가** (다음 태스크에서 구현)

```js
function recompute() {
  // 이후 태스크에서 구현
}
```

- [ ] **Step 4: 브라우저 검증**

1. `localStorage.clear()` 후 새로고침.
2. "+ 재화 추가" 클릭 → "새 재화" 행 생김.
3. 이름을 "엔화"로 변경 → 포커스를 뺄 때 반영되고 새로고침해도 유지 (localStorage).
4. 보너스·상점 이름 편집 동작.
5. 삭제 버튼 동작.
6. 콘솔 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add ui.js
git commit -m "feat: render currencies section with add/rename/delete"
```

---

## Task 11: 스테이지 섹션 렌더링 + 그룹 토글

**Files:**
- Modify: `ui.js`

12 스테이지를 3개 그룹으로 나누어 표 3개. 그룹 헤더에 체크박스.

- [ ] **Step 1: `renderStagesSection` 구현**

```js
function renderStagesSection() {
  const container = document.getElementById('stages-container');
  container.innerHTML = '';

  const currencyCols = state.currencies.filter(c => c.name);

  for (let g = 0; g < 3; g++) {
    const startIdx = g * 4;
    const ap = STAGE_AP[startIdx];
    const wrapper = document.createElement('div');
    if (!state.groupsEnabled[g]) wrapper.className = 'group-disabled';

    // 헤더 + 체크박스
    const header = document.createElement('div');
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
    label.textContent = ` 그룹 ${g + 1} (${startIdx + 1}~${startIdx + 4}, ${ap} AP)`;
    header.appendChild(checkbox);
    header.appendChild(label);
    wrapper.appendChild(header);

    // 표
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th>#</th><th>AP</th>';
    currencyCols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c.name;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = startIdx; i < startIdx + 4; i++) {
      const tr = document.createElement('tr');
      const numTd = document.createElement('td');
      numTd.textContent = i + 1;
      tr.appendChild(numTd);
      const apTd = document.createElement('td');
      apTd.textContent = STAGE_AP[i];
      tr.appendChild(apTd);
      currencyCols.forEach(c => {
        const value = state.stages[i].drops[c.name] ?? 0;
        tr.appendChild(makeNumCell(value, v => {
          if (v) state.stages[i].drops[c.name] = v;
          else delete state.stages[i].drops[c.name];
          afterEdit();
        }));
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }
}
```

- [ ] **Step 2: 브라우저 검증**

1. 재화 두 개(엔화, 달러) 입력.
2. 스테이지 섹션에 3개 그룹, 각 4행, 각 행에 `#`, AP, 엔화, 달러 칸.
3. 드랍 값 입력 → 새로고침 후 유지.
4. 그룹 1 체크 해제 → 해당 4행이 회색 처리(opacity).
5. 콘솔 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add ui.js
git commit -m "feat: render stages section with group toggles"
```

---

## Task 12: 상점 아이템 섹션 렌더링

**Files:**
- Modify: `ui.js`

재화별로 상점 섹션 1개씩. 각 섹션에 아이템 표 + "+ 아이템 추가" 버튼.

- [ ] **Step 1: `renderShopsSection` 구현**

```js
function renderShopsSection() {
  const container = document.getElementById('shops-container');
  container.innerHTML = '';

  const currencies = state.currencies.filter(c => c.name);
  if (currencies.length === 0) {
    container.innerHTML = '<div class="result-msg">재화를 먼저 추가하세요</div>';
    return;
  }

  currencies.forEach(c => {
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = `${c.shopName || c.name + ' 상점'} (${c.name}로 결제)`;
    details.appendChild(summary);

    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>아이템</th><th>가격</th><th>구매수량</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    state.shopItems.forEach((it, idx) => {
      if (it.currency !== c.name) return;
      const tr = document.createElement('tr');
      tr.appendChild(makeTextCell(it.name, v => { it.name = v; afterEdit(); }));
      tr.appendChild(makeNumCell(it.price, v => { it.price = v; afterEdit(); }));
      tr.appendChild(makeNumCell(it.buyCount, v => { it.buyCount = v; afterEdit(); }));
      tr.appendChild(makeDeleteCell(() => {
        state.shopItems.splice(idx, 1);
        afterEdit();
      }));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    details.appendChild(table);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ 아이템 추가';
    addBtn.addEventListener('click', () => {
      state.shopItems.push({ currency: c.name, name: '새 아이템', price: 0, buyCount: 0 });
      afterEdit();
    });
    const row = document.createElement('div');
    row.className = 'btn-row';
    row.appendChild(addBtn);
    details.appendChild(row);

    container.appendChild(details);
  });
}
```

- [ ] **Step 2: 브라우저 검증**

1. 재화 추가 → 상점 섹션에 그 재화용 서브 섹션이 자동 생김.
2. 상점 이름 필드를 수정 → 상점 섹션 헤더에 반영.
3. "+ 아이템 추가" → 새 행. 이름/가격/구매수량 편집, 삭제 동작.
4. 재화 삭제 → 그 재화의 상점 섹션도 같이 사라지고 아이템도 사라짐.

- [ ] **Step 3: Commit**

```bash
git add ui.js
git commit -m "feat: render shop sections per currency"
```

---

## Task 13: `recompute()` + 결과 섹션 렌더링

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: `renderResultSection` 구현**

```js
function renderResultSection() {
  const ownedDiv = document.getElementById('owned-container');
  ownedDiv.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'owned-row';
  row.appendChild(document.createTextNode('보유량:'));
  state.currencies.filter(c => c.name).forEach(c => {
    const label = document.createElement('label');
    label.textContent = c.name;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = state.owned[c.name] ?? 0;
    input.addEventListener('blur', () => {
      const n = Number(input.value);
      state.owned[c.name] = Number.isFinite(n) ? n : 0;
      afterEdit();
    });
    label.appendChild(input);
    row.appendChild(label);
  });
  ownedDiv.appendChild(row);
}
```

- [ ] **Step 2: `recompute` 실제 구현**

```js
function recompute() {
  const result = document.getElementById('result-container');
  result.innerHTML = '';

  if (!hasMinimumData(state)) {
    result.innerHTML = '<div class="result-msg">재화·스테이지 드랍·상점 아이템을 먼저 입력하세요</div>';
    return;
  }

  const model = buildModel(state);
  if (Object.keys(model.constraints).length === 0) {
    result.innerHTML = '<div class="result-ok">이미 충분합니다 ✅</div>';
    return;
  }

  let solved;
  try {
    solved = solver.Solve(model);
  } catch (e) {
    console.error(e);
    result.innerHTML = '<div class="result-err">솔버 오류: ' + escapeHtml(e.message) + '</div>';
    return;
  }

  if (!solved.feasible) {
    result.innerHTML = '<div class="result-err">현재 입력으로는 목표 달성 불가능 (드랍이 부족하거나 모순)</div>';
    return;
  }

  renderSolvedResult(result, solved);
}

function renderSolvedResult(container, solved) {
  const totalAP = Math.round(solved.result);

  const header = document.createElement('div');
  header.className = 'result-ok';
  header.textContent = '✅ 총 AP: ' + totalAP;
  container.appendChild(header);

  // 권장 횟수 표
  const stageTitle = document.createElement('div');
  stageTitle.textContent = '스테이지 권장 횟수';
  container.appendChild(stageTitle);

  const activeCurrencies = state.currencies.filter(c => c.name);
  const stageTable = document.createElement('table');
  const stageHead = document.createElement('thead');
  const stageHeadRow = document.createElement('tr');
  stageHeadRow.innerHTML = '<th>#</th><th>AP</th><th>횟수</th>';
  activeCurrencies.forEach(c => {
    const th = document.createElement('th');
    th.textContent = '+' + c.name;
    stageHeadRow.appendChild(th);
  });
  stageHead.appendChild(stageHeadRow);
  stageTable.appendChild(stageHead);

  const stageBody = document.createElement('tbody');
  for (let i = 0; i < 12; i++) {
    const runs = Math.round(solved['s' + (i + 1)] ?? 0);
    if (!runs) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${STAGE_AP[i]}</td><td>${runs}</td>`;
    activeCurrencies.forEach(c => {
      const perRun = applyBonus(state.stages[i].drops[c.name] ?? 0, c.bonus);
      const td = document.createElement('td');
      td.textContent = perRun * runs;
      tr.appendChild(td);
    });
    stageBody.appendChild(tr);
  }
  stageTable.appendChild(stageBody);
  container.appendChild(stageTable);

  // 재화 수지 표
  const balTitle = document.createElement('div');
  balTitle.textContent = '재화 수지';
  balTitle.style.marginTop = '12px';
  container.appendChild(balTitle);

  const balanceTable = document.createElement('table');
  balanceTable.innerHTML = '<thead><tr><th>재화</th><th>보유</th><th>획득</th><th>필요</th><th>잉여</th></tr></thead>';
  const balBody = document.createElement('tbody');
  const balance = computeBalance(state, solved);
  activeCurrencies.forEach(c => {
    const b = balance[c.name];
    const tr = document.createElement('tr');
    const surplusColor = b.surplus < 0 ? 'color:#c33' : '';
    tr.innerHTML =
      `<td>${escapeHtml(c.name)}</td>` +
      `<td>${b.owned}</td>` +
      `<td>+${b.gained}</td>` +
      `<td>${b.needed}</td>` +
      `<td style="${surplusColor}">${b.surplus >= 0 ? '+' : ''}${b.surplus}</td>`;
    balBody.appendChild(tr);
  });
  balanceTable.appendChild(balBody);
  container.appendChild(balanceTable);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
```

- [ ] **Step 3: 브라우저 수동 시나리오 테스트**

1. `localStorage.clear()` → 새로고침.
2. "엔화"(보너스 100) 재화 추가.
3. 스테이지 1-1에 엔화 드랍 `10` 입력 후 포커스 빼기.
4. 상점 아이템 "가챠권" 가격 `200`, 구매수량 `3` 입력 (총 필요 600).
5. 결과 섹션에 총 AP 와 권장 횟수 표가 나옴.
   - 스테이지 1만 `ceil(600/10) = 60회` → 총 AP `600`.
6. 보유량 `400` 입력 → 필요량 200 차감 → 총 AP `200`.
7. 재화 추가 / 스테이지 드랍 조정으로 여러 케이스 시도.

- [ ] **Step 4: Commit**

```bash
git add ui.js
git commit -m "feat: implement recompute and result rendering"
```

---

## Task 14: JSON 내보내기 / 불러오기

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: 버튼 핸들러 바인딩**

`ui.js`의 `document.addEventListener('DOMContentLoaded', ...)` 콜백을 다음으로 교체:

```js
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-export').addEventListener('click', exportJson);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', importJson);
  render();
  recompute();
});

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'event-planner-' + date + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
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
  e.target.value = '';  // 같은 파일 재선택 가능하도록
}
```

- [ ] **Step 2: 브라우저 검증**

1. 몇 개 입력 채워넣은 뒤 "내보내기" → `event-planner-YYYY-MM-DD.json` 다운로드.
2. `localStorage.clear()` → 새로고침 → 빈 상태 확인.
3. "불러오기" → 방금 받은 파일 선택 → 원래 입력이 복원되고 결과도 다시 계산됨.
4. 손상된 JSON (일부 필드 삭제) 을 불러오기 → alert 메시지 뜨고 기존 상태 유지.

- [ ] **Step 3: Commit**

```bash
git add ui.js
git commit -m "feat: add JSON export and import with validation"
```

---

## Task 15: JSON 보기/편집 토글

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: 토글 핸들러 추가**

`DOMContentLoaded` 콜백에 버튼 바인딩 추가:

```js
document.getElementById('btn-json').addEventListener('click', openJsonView);
document.getElementById('btn-json-apply').addEventListener('click', applyJsonView);
document.getElementById('btn-json-cancel').addEventListener('click', closeJsonView);
```

함수 구현:

```js
function openJsonView() {
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('json-view').style.display = 'block';
  document.getElementById('json-textarea').value = JSON.stringify(state, null, 2);
}

function closeJsonView() {
  document.getElementById('main-view').style.display = '';
  document.getElementById('json-view').style.display = 'none';
}

function applyJsonView() {
  const text = document.getElementById('json-textarea').value;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    alert('JSON 파싱 실패: ' + e.message);
    return;
  }
  const err = validateState(parsed);
  if (err) {
    alert('유효하지 않은 데이터: ' + err);
    return;
  }
  state = parsed;
  saveState();
  closeJsonView();
  render();
  recompute();
}
```

- [ ] **Step 2: 브라우저 검증**

1. "JSON 보기" → 본문이 숨고 textarea에 현재 state가 나타남.
2. textarea에서 재화의 보너스 값을 수정 → "적용" → 표 UI로 돌아오고 반영됨.
3. 일부러 잘못된 JSON 입력 → alert 뜨고 그대로 머무름.
4. "JSON 보기" 다시 열고 "취소" → 본문으로 복귀 (상태 유지).

- [ ] **Step 3: Commit**

```bash
git add ui.js
git commit -m "feat: add raw JSON view/edit toggle"
```

---

## Task 16: 단일 HTML 산출물로 인라인 병합

**Files:**
- Create: `event-planner.release.html`

Node 없이도 가능하도록 수동/브라우저 기반 절차로 기술. 간단하므로 5분이면 끝.

- [ ] **Step 1: `event-planner.html` 을 기반으로 `event-planner.release.html` 초안 생성**

```bash
cp event-planner.html event-planner.release.html
```

- [ ] **Step 2: `event-planner.release.html` 에서 `<script src="solver.js"></script>` 를 solver 내용으로 대체**

에디터로 파일을 열고 `<script src="solver.js"></script>` 줄을 찾아 `<script>` + 개행 + `solver.js` 전체 내용 + 개행 + `</script>` 로 교체.

참고 명령 (PowerShell 또는 bash):

```bash
# bash (git bash)
python - <<'EOF'
import re
with open('event-planner.release.html', encoding='utf-8') as f:
    html = f.read()
for name in ['solver.js', 'logic.js', 'ui.js']:
    with open(name, encoding='utf-8') as g:
        body = g.read()
    # logic.js의 Node용 export 제거
    if name == 'logic.js':
        body = re.sub(r"\nif \(typeof module[\s\S]*?\n\}\s*$", "", body).rstrip() + "\n"
    html = html.replace(f'<script src="{name}"></script>', f'<script>\n{body}\n</script>')
with open('event-planner.release.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('done')
EOF
```

Python이 없다면 에디터로 직접 세 번 찾아바꾸기로 동일 처리. `logic.js` 내용을 붙여넣을 때는 아래 `if (typeof module ...)` 블록은 제거한다.

- [ ] **Step 3: `event-planner.release.html` 을 브라우저에서 더블클릭으로 열기**

1. 제목 "이벤트 플래너" 확인.
2. `localStorage.clear()` 후 새로고침.
3. 재화 1개, 스테이지 드랍 1개, 상점 아이템 1개 입력 → 결과가 정상 계산.
4. F12 → Network 탭에서 외부 요청이 `solver.js`, `logic.js`, `ui.js` 어느 것도 없어야 함 (모두 인라인).
5. 파일을 다른 폴더로 복사한 뒤 열어도 똑같이 동작하는지 확인 (의존성 없음).

- [ ] **Step 4: Commit**

```bash
git add event-planner.release.html
git commit -m "build: produce single-file release bundle"
```

---

## Task 17: 최종 수동 검증 체크리스트

**Files:** (없음)

- [ ] **Step 1: 시나리오 A — 최소 케이스**

1. `localStorage.clear()`.
2. 재화 "엔화" (보너스 100), "달러" (보너스 100) 추가.
3. 스테이지 1에 엔화 10, 달러 2 드랍 입력.
4. 스테이지 5에 엔화 3, 달러 8 드랍 입력.
5. 상점에 엔화 아이템 (가격 100, 수량 4) + 달러 아이템 (가격 50, 수량 5) 추가.
6. 결과: 총 AP 양수, 두 재화 모두 잉여 ≥ 0 확인.

- [ ] **Step 2: 시나리오 B — 보너스 영향**

1. 시나리오 A 상태에서 엔화 보너스를 200으로 변경.
2. 포커스 뺀 직후 결과 즉시 재계산되는지 확인.
3. 엔화 획득량이 두 배로 뛰었는지, 총 AP가 줄어드는지 확인.

- [ ] **Step 3: 시나리오 C — 그룹 토글**

1. 시나리오 A 상태로 되돌림 (JSON 보기에서 직접 복구하거나 처음부터).
2. 그룹 3 (9~12, 20 AP) 활성화 + 스테이지 9에 엔화 15, 달러 15 입력.
3. 결과가 그룹 3 스테이지를 선호하는지 확인.
4. 그룹 3 체크 해제 → 즉시 재계산되고 그룹 3 스테이지는 결과 표에서 사라짐.

- [ ] **Step 4: 시나리오 D — 보유량 차감**

1. 엔화 보유량에 필요량 이상 입력 → "이미 충분합니다 ✅".
2. 일부만 입력 → 필요량에서 차감된 만큼 총 AP가 줄어듦.

- [ ] **Step 5: 시나리오 E — 불가능 케이스**

1. 모든 스테이지의 달러 드랍을 0으로 → 달러가 필요한 상점 아이템이 있으면 빨간 박스 "달성 불가능".

- [ ] **Step 6: 시나리오 F — 저장/복원/파일**

1. localStorage 검증: 새로고침해도 그대로.
2. 내보내기 → 파일 다운로드.
3. `localStorage.clear()` + 새로고침 → 빈 상태.
4. 불러오기 → 파일 선택 → 완전 복원.
5. JSON 보기 토글에서 수동 편집 후 적용 → 반영.

- [ ] **Step 7: 정수 최적성 확인 (원본 대비 강점 검증)**

1. 다음 시나리오: 재화 1개(엔화, 보너스 100), 스테이지 1 드랍 엔화 3, 상점 가격 10 × 수량 1 = 필요 10.
2. 예상 결과: `ceil(10/3) = 4` 회, 총 AP `40`, 잉여 엔화 `+2`.
3. 원본 사이트였다면 LP 풀이(3.33회) 후 `Math.ceil`로 4회. 자작 버전도 정수 4회지만 ILP라 진짜 최적임.

- [ ] **Step 8: 체크리스트 완료 후 release 커밋 검증**

```bash
git log --oneline
```

모든 태스크 커밋이 기록되어 있는지 확인.
