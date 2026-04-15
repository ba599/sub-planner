# Currency ID 기반 키잉 리팩터

**작성일**: 2026-04-15
**대상**: `src/logic.js`, `src/ui.js`, `test.html`

## 배경

현재 `state.currencies`는 `{ name, bonus }` 형태로, 이름(`name`)이 `state.stages[i].drops`, `state.owned`, `state.shopItems[].currency`의 키/참조로 사용되고 있다. 이 구조 때문에:

- 빈 이름(`""`) 재화를 허용하면 여러 재화가 같은 빈 키를 공유해 데이터가 충돌한다.
- 중복 이름 재화를 허용할 수 없다 (같은 이유).
- 이름 변경 시 `drops`, `owned`, `shopItems`의 키/참조를 수동으로 옮기는 `renameCurrency` 연쇄 업데이트가 필요하다.
- 실시간 이름 타이핑 업데이트가 기존 validation(중복 검사 alert)과 충돌한다.

사용자가 빈 이름·중복 이름의 재화도 즉시 추가·편집할 수 있도록, 재화를 **고유 정수 ID**로 식별하도록 리팩터한다.

## 목표

1. 빈 이름 재화 허용
2. 중복 이름 재화 허용
3. 이름 변경이 데이터 키에 영향을 주지 않도록 ID 기반 키잉
4. 섹션 1/3/4가 이름과 관계없이 모든 재화를 표시 (빈 이름 폴백: `(이름 없음)`)
5. 사용자 UX 보존: 이름 변경 시 해당 재화의 drops/보유량/상점 아이템 유지

## 비목표

- 구버전 localStorage 마이그레이션 (개발 단계라 불필요)
- 재화 이름 중복일 때 UI 상 디스엠비귀에이션 suffix (사용자 책임)
- `src/preset-defaults.js` 변경 (presetItems는 재화와 무관한 상점 아이템 제안 리스트)

## 상태 shape 변경

### Before

```js
state = {
  currencies: [{ name: '이벤트 포인트', bonus: 25 }, ...],
  stages: [{ drops: { '이벤트 포인트': 5 } }, ...],
  owned: { '이벤트 포인트': 100 },
  shopItems: [{ currency: '이벤트 포인트', name: '...', price: 60, buyCount: 12 }],
  ...
}
```

### After

```js
state = {
  currencies: [
    { id: 1, name: '이벤트 포인트', bonus: 25 },
    { id: 2, name: '',              bonus: 0  },   // 빈 이름 허용
    { id: 3, name: '이벤트 포인트', bonus: 15 },   // 중복 이름 허용
  ],
  stages: [
    { drops: { 1: 5, 3: 2 } },                      // 숫자 ID가 키
    ...
  ],
  owned: { 1: 100, 3: 50 },                         // 숫자 ID가 키
  shopItems: [
    { currencyId: 1, name: '...', price: 60, buyCount: 12 },
    ...
  ],
  groupsEnabled: [...],
  presetItems: [...],                               // 변경 없음
}
```

### 필드 변경 요약

| 위치 | Before | After |
|---|---|---|
| `currency` | `{ name, bonus, shopName? }` | `{ id, name, bonus }` |
| `stage.drops` key | string (name) | number (id) |
| `owned` key | string (name) | number (id) |
| `shopItem.currency` | string (name) | — (삭제) |
| `shopItem.currencyId` | — | number (id) (신규) |

`currency.shopName`은 `validateState`에만 선언되어 있고 실사용이 없으므로 이 기회에 제거한다.

## ID 할당

### `allocateCurrencyId(currencies)` (신규, `logic.js`)

가장 작은 미사용 양의 정수를 반환한다.

```js
function allocateCurrencyId(currencies) {
  const used = new Set(currencies.map(c => c.id));
  for (let i = 1; ; i++) {
    if (!used.has(i)) return i;
  }
}
```

**동작 예시**
- `[]` → `1`
- `[{id:1},{id:2},{id:3}]` → `4`
- `[{id:1},{id:3}]` → `2`
- `[{id:2}]` → `1`

재화 수는 사실상 한 자릿수라 선형 탐색으로 충분하다.

### 사용처

- `renderCurrenciesSection`의 `재화 추가` 버튼 핸들러
- `test.html`의 `addCurrency` 헬퍼
- `normalizeCurrencyIds`에서 id 누락/중복 복구 시

## `normalizeCurrencyIds(state)` (신규, `logic.js`)

`loadState` 직후에 호출되어 localStorage에서 읽어온 상태를 자가 치유한다.

**동작**
1. `state.currencies`를 순회하며 `id`가 없거나 숫자가 아니거나 이미 사용된 경우 `allocateCurrencyId`로 새 ID를 부여
2. 존재하는 currency ID 집합을 수집
3. `state.shopItems`에서 집합에 없는 `currencyId`를 참조하는 아이템 제거
4. `state.stages[i].drops`에서 집합에 없는 키 제거
5. `state.owned`에서 집합에 없는 키 제거

이 함수는 구버전 이름-키 데이터를 완벽히 변환하려 시도하지 않는다. ID 누락/중복과 dangling 참조만 치유한다. 구버전 데이터 손실은 허용한다 (개발 단계).

## `logic.js` 변경

### `defaultState`

shape 유지, 변경 없음.

### `buildModel`

`c.name` 필터 제거, ID로 조회한다. solver 변수명/제약명은 `'c' + c.id` 형태로 ID 기반으로 통일한다 (빈 이름·중복 이름에서 키 충돌 방지).

```js
state.currencies.forEach(c => {
  const raw = stage.drops[c.id] ?? 0;
  v['c' + c.id] = applyBonus(raw, c.bonus);
});

state.currencies.forEach(c => {
  const need = state.shopItems
    .filter(it => it.currencyId === c.id)
    .reduce((sum, it) => sum + (it.price || 0) * (it.buyCount || 0), 0);
  const remaining = need - (state.owned[c.id] ?? 0);
  if (remaining > 0) constraints['c' + c.id] = { min: remaining };
});
```

### `computeBalance`

반환 객체 키를 ID로 변경: `result[c.id] = { owned, gained, needed, surplus }`.

### `hasMinimumData`

```js
const hasCurrency = state.currencies.length > 0;   // 이름 무관
const hasItem = state.shopItems.some(it =>
  typeof it.currencyId === 'number' && (it.price || 0) > 0 && (it.buyCount || 0) > 0
);
```

### `validateState`

- `currency.id` 관련 체크 **없음** (ID는 내부 생성, 로드 시 `normalizeCurrencyIds`가 치유)
- `currency.shopName` 관련 체크 **제거** (필드 자체를 삭제)
- `shopItem.currency` 체크 **제거**
- `shopItem.currencyId`가 숫자인지 체크 **추가** (import JSON 방어선)

### 신규 export

```js
module.exports = {
  ...,
  allocateCurrencyId,
  normalizeCurrencyIds,
};
```

브라우저 전역으로도 노출 (테스트에서 사용).

## `ui.js` 변경

### `loadState` / `importJson`

상태가 외부 소스에서 로드되는 두 경로에서 validation 통과 직후 `normalizeCurrencyIds(state)` 호출:

1. `loadState` (localStorage) — 파싱·검증 후
2. `importJson` (파일 업로드) — 파싱·검증 후 `state = parsed` 대입 전

`applyJsonView`(개발자 JSON 편집기)는 현재 주석에서 "하위호환 주입 의도적 생략"이라고 밝히고 있으므로 normalize도 생략. 개발자가 직접 수정한 그대로 검증만 통과하면 적용.

### `renderCurrenciesSection` (섹션 2)

- 중복 이름 alert 제거
- 이름 변경 시 단순 `c.name = v` 대입 (연쇄 업데이트 불필요)
- 실시간 타이핑 반영: 섹션 2는 re-render하지 않고 섹션 1/3/4와 result만 부분 re-render (포커스 유지)
- `재화 추가` 버튼이 `allocateCurrencyId`로 ID 부여 후 `push`

```js
addBtn.addEventListener('click', () => {
  state.currencies.push({
    id: allocateCurrencyId(state.currencies),
    name: '',
    bonus: 0,
  });
  afterEdit();
});
```

`renameCurrency` 함수는 **삭제** (ID 키잉으로 불필요).

### `removeCurrency`

시그니처를 `(idx)` → `(id)`로 변경.

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

### `renderResultSection` (섹션 1)

- `state.currencies.filter(c => c.name)` → `state.currencies` (모두 표시)
- 라벨: `c.name || '(이름 없음)'`
- 보유량 키: `state.owned[c.id]`

### `renderStagesSection` (섹션 3)

- `currencyCols = state.currencies.filter(c => c.name)` → `state.currencies` (모두 표시)
- 헤더: `c.name || '(이름 없음)'`
- drops 접근/할당 키: `c.id`

### `renderShopsSection` (섹션 4)

- `currencies.filter(c => c.name)` → `currencies` (모두 표시)
- 섹션 빈 상태 표시 조건 유지 (`currencies.length === 0`일 때 "재화를 먼저 추가하세요")
- summary 라벨: `c.name || '(이름 없음)'`
- shop item 필터링: `it.currencyId !== c.id`
- `makeShopAddCell(c.id)`: 매개변수를 `currencyName`(string) → `currencyId`(number)로 변경
- 새 shop item 생성 시: `{ currencyId, name: '', price: 0, buyCount: 0 }`

### 수지표 렌더 (`recompute`)

`computeBalance` 반환 키가 ID가 되었으므로 수지표 행 렌더 시 `state.currencies.forEach(c => { const b = balance[c.id]; const label = c.name || '(이름 없음)' })` 패턴으로 조회.

### `currencyLabel` 헬퍼 (신규, 선택적)

반복을 줄이려면 작은 유틸을 도입:

```js
function currencyLabel(c) {
  return c.name || '(이름 없음)';
}
```

## 테스트 (`test.html`)

### 헬퍼 함수 (신규)

```js
function addCurrency(state, name, bonus = 0) {
  const id = allocateCurrencyId(state.currencies);
  state.currencies.push({ id, name, bonus });
  return id;
}
```

### 기존 테스트 변환 패턴

Before:
```js
const s = defaultState();
s.currencies = [{ name: '엔화', bonus: 0 }];
s.stages[0].drops['엔화'] = 5;
s.shopItems = [{ currency: '엔화', name: 'x', price: 100, buyCount: 1 }];
```

After:
```js
const s = defaultState();
const yen = addCurrency(s, '엔화');
s.stages[0].drops[yen] = 5;
s.shopItems = [{ currencyId: yen, name: 'x', price: 100, buyCount: 1 }];
```

`test.html:130~400` 범위의 `defaultState`, `buildModel`, `computeBalance`, `hasMinimumData`, `validateState` 테스트 블록이 변환 대상.

### 신규 테스트

1. **`allocateCurrencyId`**
   - 빈 배열 → 1
   - `[{id:1},{id:2},{id:3}]` → 4
   - `[{id:1},{id:3}]` → 2
   - `[{id:2}]` → 1

2. **`normalizeCurrencyIds`**
   - id 누락된 currency가 있으면 새로 부여
   - 중복 id가 있으면 한쪽 재부여
   - dangling `shopItem.currencyId` 제거
   - dangling `stage.drops` / `owned` 키 제거

3. **빈 이름·중복 이름 허용**
   - `addCurrency(s, '')`로 추가 후 drops[id]·owned[id] 정상 동작
   - 같은 이름 두 개 추가 후 서로 다른 ID로 구분

4. **`hasMinimumData` 완화된 기준**
   - 이름 없는 재화만 있어도 `true` (다른 조건 충족 시)

5. **`validateState`**
   - `shopItem.currencyId`가 문자열이면 거부
   - `currency.shopName` 관련 기존 테스트는 제거

## 리스크 및 완화

- **대규모 동시 수정**: logic.js·ui.js·test.html이 같은 커밋에서 변경됨. 중간 상태가 없으므로 단계별로 나누지 않고 한 번에 진행. 테스트를 먼저 업데이트해 검증 기준을 마련한 뒤 구현을 따라가는 순서 권장 (writing-plans 단계에서 순서 결정).
- **구버전 localStorage**: `normalizeCurrencyIds`가 id 누락/중복/dangling은 치유하지만, 이름-키 drops/owned를 새 ID-키로 자동 변환하지는 않는다. 구버전 데이터의 drops/owned 값은 손실될 수 있음. 개발 단계라 허용.
- **solver 제약 키 충돌**: 과거엔 통화 이름이 키였으나 이제 `'c' + c.id` 형태. solver는 키 문자열에 의미 없으므로 안전하지만, 리그레션 테스트로 확인.

## 검증

- `test.html` 실행하여 모든 기존·신규 테스트 통과 확인
- `node build.js`로 `index.html` 재생성
- 브라우저에서 수동 테스트:
  1. `재화 추가` 즉시 빈 행 생성
  2. 빈 이름 재화가 섹션 1/3/4에 `(이름 없음)`으로 표시
  3. 이름 타이핑 시 섹션 1/3/4 헤더 실시간 업데이트
  4. 같은 이름 재화 두 개 생성 시 독립적으로 drops·owned·shopItems 관리
  5. 이름 변경해도 해당 재화의 drops/보유량/상점 아이템 유지
  6. 재화 삭제 시 관련 drops/owned/shopItems 제거
