# 상점 아이템 프리셋 & 한글 자동완성 설계

**날짜**: 2026-04-14
**대상 프로젝트**: `event-planner.html` (단일 페이지, vanilla JS)

## 배경 / 목적

이벤트 플래너의 상점 아이템(`name`, `price`, `buyCount`)을 매번 수동 입력하는 부담을 줄이기 위해, 자주 쓰이는 아이템을 "프리셋"으로 미리 등록해두고 이름 인풋에서 자동완성으로 즉시 채워 넣는 기능을 추가한다. 대부분의 이벤트에서 판매 상품과 가격이 비슷하다는 관찰에서 출발한다.

프리셋은 현재는 개발자(프로젝트 소유자)가 JSON 보기로 직접 편집하고, 어느 정도 완성되면 페이지에 하드코딩된 초기값으로 굳어진다. 일반 사용자가 편집 UI를 세련되게 쓰지는 않지만 만일을 위해 경로는 남겨둔다.

## 범위

**포함**:
- `state`에 `presetItems` 배열 필드 추가 (기존 `state` JSON 보기/저장/불러오기 흐름에 자동 편승).
- 상점 섹션(`<details id="sec-shops">`) 우상단에 "프리셋 수정" 버튼 — 클릭 시 기존 JSON 보기 오픈.
- 상점 아이템 이름 인풋에 드롭다운 자동완성 — 포커스 즉시 전체 목록 표시, 입력 시 필터링.
- 자모 부분일치 + 초성 부분일치 한글 매칭 (es-hangul에서 `disassemble`, `getChoseong` 로직 추출).
- 선택 시 `name`/`price`/`buyCount` 자동 입력 후 같은 상점(재화)의 다음 아이템 이름 인풋으로 포커스 이동(없으면 아무 동작 없음).
- `+ 아이템 추가` 기본 이름을 빈 문자열 + placeholder `'보고서, 선물 etc...'`로 변경.

**미포함**:
- 프리셋 전용 편집 UI (모달/패널 등). JSON 보기 재사용으로 충분.
- 프리셋 메타 정보 (이름/버전/설명). 단순 배열.
- 프리셋과 상점 간 currency 연계. 프리셋은 재화 구분 없는 플랫 리스트.
- es-hangul을 npm 의존성으로 추가. 필요한 함수만 순수 JS로 복사.

## § 1. 데이터 모델 (`logic.js`)

### `defaultState`

`presetItems` 필드 추가:
```js
function defaultState() {
  return {
    currencies: [],
    stages: Array.from({ length: 12 }, () => ({ drops: {} })),
    shopItems: [],
    owned: {},
    groupsEnabled: [true, true, true],
    presetItems: [],   // 신규
  };
}
```

각 프리셋 항목의 형식: `{ name: string, price: number, buyCount: number }`. `currency` 필드 없음 (플랫 리스트, 모든 상점에서 공유).

### `validateState`

`presetItems` 검증 추가:
```js
if (!Array.isArray(s.presetItems)) return 'presetItems must be an array';
for (const it of s.presetItems) {
  if (!it || typeof it !== 'object') return 'presetItem must be object';
  if (typeof it.name !== 'string') return 'presetItem.name must be string';
  if (typeof it.price !== 'number') return 'presetItem.price must be number';
  if (typeof it.buyCount !== 'number') return 'presetItem.buyCount must be number';
}
```

### 하위호환

기존에 localStorage / JSON 파일에 저장돼 있던 state는 `presetItems` 필드가 없다. `ui.js`의 `loadState`와 `importJson`에서 JSON 파싱 직후, `parsed.presetItems === undefined`이면 `parsed.presetItems = []`로 주입한 뒤 `validateState` 호출. (validation 로직 자체는 `logic.js`에 있지만 주입은 호출부에서.) 이로써 기존 데이터가 오류 없이 로드된다.

## § 2. 프리셋 수정 버튼 (`event-planner.html`, `ui.js`)

### HTML

`<details id="sec-shops">`의 자식(summary 바깥)으로 버튼을 추가. summary 내부 구조는 건드리지 않는다.

```html
<details id="sec-shops" open>
  <summary>4. 상점</summary>
  <button id="btn-preset-edit" class="preset-edit-btn">프리셋 수정</button>
  <div id="shops-container"></div>
</details>
```

### CSS

```css
#sec-shops { position: relative; }
.preset-edit-btn {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 0.8em;
}
```

버튼이 details의 자식이지만 summary 바깥이므로 클릭해도 details 토글이 발생하지 않는다(`<details>`는 오직 `<summary>` 클릭에만 토글). 따라서 `e.stopPropagation()`도 불필요.

### 동작

```js
document.getElementById('btn-preset-edit').addEventListener('click', openJsonView);
```

기존 `openJsonView()`는 `state` 전체 JSON을 textarea에 띄운다. `presetItems`가 `state`에 포함돼 있으므로 자동으로 같이 편집 가능하다. "적용" 버튼은 기존 로직(`applyJsonView`)이 처리한다.

## § 3. 자동완성 드롭다운 (`ui.js`)

### 매칭 함수 (`logic.js`)

순수 함수로 `logic.js`에 추가:

```js
function matchPresetItems(query, presetItems) {
  if (!query) return presetItems.slice();        // 전체, 등록 순서 유지
  const qDis = disassemble(query);
  const qCho = getChoseong(query);
  return presetItems.filter(p => {
    const nameDis = disassemble(p.name);
    if (nameDis.includes(qDis)) return true;     // 자모 부분일치
    if (qCho) {                                  // 쿼리에 한글 초성이 있을 때만 초성 매칭
      const nameCho = getChoseong(p.name);
      if (nameCho.includes(qCho)) return true;
    }
    return false;
  });
}
```

> **주의**: `qCho` 가드가 없으면 `getChoseong('zzz')` === `''`이고 `string.includes('')` === `true`라서 비-한글 쿼리가 모든 아이템을 매칭해버린다. 가드를 반드시 유지할 것.

- `includes` 사용 — 접두사뿐 아니라 중간/접미 매칭 포함. 예: "기술노트" 입력 시 "일반 기술노트", "상급 기술노트", "최고급 기술노트" 전부 매치.
- 정렬 없음 — `Array.filter`가 원본 순서를 보존하므로 `state.presetItems` 등록 순서 그대로 드롭다운에 나타난다.
- 자모 매칭("가방" ← "갑") 과 초성 매칭("가방" ← "ㄱㅂ")을 OR 결합.

### DOM 구조

아이템 이름 인풋의 부모 셀(`.shop-cell`) 안에 드롭다운을 동적으로 삽입:

```html
<div class="shop-cell">
  <div class="shop-cell-row item-name-row">
    <input type="text" class="item-name-input" data-shop-idx="7" placeholder="보고서, 선물 etc..."/>
    <button class="btn-del">×</button>
    <!-- 자동완성 활성 시에만 -->
    <div class="autocomplete-dropdown">
      <div class="autocomplete-item selected">기술노트 — 100 × 5</div>
      <div class="autocomplete-item">일반 기술노트 — 200 × 3</div>
    </div>
  </div>
  <!-- 구매/가격 row -->
</div>
```

- 드롭다운은 **이름 인풋이 들어있는 첫 행(`.item-name-row`)** 안에 위치. 그 행을 `position: relative`로 만들고 드롭다운은 `position: absolute`로 빼내 flex 흐름에서 제외. `top: 100%`가 곧 "이름 인풋 행의 바닥"이 되어 인풋 바로 아래에 붙는다.
- z-index로 아래쪽 구매/가격 행 위에 레이어로 떠서 덮는다.
- 표시 포맷: `이름 — 가격 × 구매수`.
- 전역에 활성 드롭다운 핸들 하나만 유지(다른 인풋 포커스 시 기존 드롭다운은 자동 닫힘).

### CSS (추가)

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
}
.autocomplete-item { padding: 4px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.autocomplete-item.selected,
.autocomplete-item:hover { background: #8883; }
```

### 이벤트

`makeShopItemCell`의 이름 인풋 생성 부분을 전용 `makeItemNameInput(shopItemIdx, shopItem)`으로 분리하고 다음 핸들러를 바인딩:

| 이벤트 | 동작 |
|---|---|
| `focus` | 드롭다운 열기. 빈 쿼리면 전체 프리셋 표시. 첫 항목을 `selected` 기본값으로. |
| `input` | 쿼리로 매칭 재실행, 드롭다운 재렌더. 결과 0개면 드롭다운 숨김. selected 위치는 0으로 리셋. |
| `keydown` `ArrowDown` | selected를 다음 항목으로. 마지막이면 그대로. `preventDefault`. |
| `keydown` `ArrowUp` | selected를 이전 항목으로. 처음이면 그대로. `preventDefault`. |
| `keydown` `Enter` | selected 항목이 있으면 `selectPresetItem()`. `preventDefault`. 드롭다운이 닫혀 있으면 기본 동작. |
| `keydown` `Escape` | 드롭다운만 닫음. 값 유지. |
| `focusout` | `setTimeout(0)` 후 드롭다운 닫기 + 기존 blur 커밋(`onCommit(input.value, input)`) 실행. |
| 드롭다운 항목 `mousedown` | `e.preventDefault()`로 focusout 방지. `mouseup`/`click`으로 `selectPresetItem()` 호출. |

기존 `focusin` 글로벌 핸들러가 인풋 `.select()`를 수행하므로, 다음 아이템으로 포커스 이동 시 전체선택 처리는 자동으로 이루어진다.

### 선택 액션

```js
function selectPresetItem(shopItemIdx, preset) {
  const it = state.shopItems[shopItemIdx];
  it.name = preset.name;
  it.price = preset.price;
  it.buyCount = preset.buyCount;
  afterEdit();                       // saveState + render + recompute
  focusNextShopItemNameIn(it.currency, shopItemIdx);
}

function focusNextShopItemNameIn(currency, currentIdx) {
  const nextIdx = state.shopItems.findIndex(
    (s, i) => i > currentIdx && s.currency === currency
  );
  if (nextIdx === -1) return;        // 같은 상점에 다음 아이템 없음 → no-op
  requestAnimationFrame(() => {
    const el = document.querySelector(`.item-name-input[data-shop-idx="${nextIdx}"]`);
    if (el) el.focus();              // 전체선택은 기존 focusin 핸들러가 처리
  });
}
```

- `data-shop-idx` 속성으로 re-render 후 DOM 식별. `state.shopItems` 인덱스를 그대로 사용.
- "다음 아이템"은 **같은 재화(currency) 안에서 `state.shopItems` 배열상 더 뒤에 있는 첫 항목**. 재화 간 점프 없음. 마지막이면 아무 것도 하지 않음.

### 빈 이름 셀 & placeholder

`makeShopAddCell`의 아이템 추가 시 초기값 변경:
```js
state.shopItems.push({ currency: currencyName, name: '', price: 0, buyCount: 0 });
```

이름 인풋에 placeholder:
```js
input.placeholder = '보고서, 선물 etc...';
```

사용자는 `+ 아이템 추가`를 여러 번 눌러 빈 셀을 먼저 만든 뒤 첫 셀부터 순서대로 채우는 흐름을 쓴다. 이 흐름이 "선택 시 다음 셀로 자동 포커스 이동"과 자연스럽게 맞물린다.

## § 4. es-hangul 로직 추출 (`hangul.js`)

신규 파일 `hangul.js`를 추가하고, `es-hangul-main`에서 필요한 함수만 순수 JS로 복사한다.

**공개 함수 (전역)**:
- `disassemble(str)` — 한글 문자열을 자모 단위 문자열로 분해. 예: `"가방"` → `"ㄱㅏㅂㅏㅇ"`, `"갑"` → `"ㄱㅏㅂ"`.
- `getChoseong(str)` — 초성만 추출. 예: `"가방"` → `"ㄱㅂ"`, `"띄어 쓰기"` → `"ㄸㅇ ㅆㄱ"`.

**의존성 (전부 인라인으로 복사)**:
- `disassemble` ← `disassembleToGroups` ← `disassembleCompleteCharacter` + `_internal/constants`의 `DISASSEMBLED_CONSONANTS_BY_CONSONANT`, `DISASSEMBLED_VOWELS_BY_VOWEL`, `hasProperty`
- `getChoseong` ← `_internal/constants`의 `CHOSEONGS` + 로컬 `JASO_HANGUL_NFD` 상수

**변환 원칙**:
- TypeScript 타입 제거, import 문 전부 제거 (같은 파일 내 참조로 치환).
- 내부 헬퍼(`disassembleToGroups`, `disassembleCompleteCharacter`, `hasProperty` 등)는 파일 스코프 함수로 유지하고 전역 노출하지 않는다. `disassemble`, `getChoseong`만 전역.
- 기능 자체를 수정하지 않는다. es-hangul의 테스트 케이스 기준 동작이 그대로 유지되어야 한다.

**라이선스 주석**: 파일 상단에 attribution:
```js
// Extracted from es-hangul (MIT License). https://github.com/toss/es-hangul
// Only `disassemble` and `getChoseong` are exposed; internal helpers are file-scoped.
```

## § 5. 파일 변경 요약

### 신규
- `hangul.js`

### 수정
| 파일 | 변경 |
|---|---|
| `logic.js` | `defaultState.presetItems = []` / `validateState`에 `presetItems` 검증 / 순수 매칭 함수 `matchPresetItems(query, items)` 추가 |
| `ui.js` | `loadState`·`importJson`에서 `presetItems` 기본값 주입 / `makeShopItemCell`의 이름 인풋을 전용 `makeItemNameInput`으로 분리·자동완성 바인딩 / `makeShopAddCell` 기본값 `name: ''` + placeholder / `focusNextShopItemNameIn` 헬퍼 / 프리셋 수정 버튼 클릭 핸들러(`openJsonView`) |
| `event-planner.html` | `<script src="hangul.js">` 추가 (`solver.js` 다음, `logic.js` 이전) / `<details id="sec-shops">` 안에 `#btn-preset-edit` 추가 / 자동완성 드롭다운 CSS · `.preset-edit-btn` CSS |

### 스크립트 로드 순서
```html
<script src="solver.js"></script>
<script src="hangul.js"></script>
<script src="logic.js"></script>
<script src="ui.js"></script>
```

## § 6. 수동 테스트 시나리오

1. **하위호환**: 기존 저장 state를 로드 — `presetItems` 없어도 오류 없이 열림. 빈 배열로 주입됨.
2. **프리셋 등록**: "JSON 보기"에서 `presetItems`에 다음을 입력 후 적용.
   ```json
   [
     {"name":"기술노트","price":100,"buyCount":5},
     {"name":"일반 기술노트","price":200,"buyCount":3},
     {"name":"상급 기술노트","price":400,"buyCount":2},
     {"name":"최고급 기술노트","price":800,"buyCount":1},
     {"name":"가방","price":50,"buyCount":10}
   ]
   ```
3. **프리셋 수정 버튼**: `<details id="sec-shops">` 우상단 "프리셋 수정" 버튼 클릭 → JSON 보기 열림, `presetItems` 포함.
4. **버튼이 details 토글 안 함**: 버튼 클릭해도 상점 섹션이 접히지 않음.
5. **아이템 추가**: `+ 아이템 추가` 클릭 → 빈 이름, placeholder "보고서, 선물 etc..." 표시.
6. **포커스 시 전체 목록**: 빈 이름 인풋 포커스 → 드롭다운에 5개 프리셋 전부 등록 순서대로 표시.
7. **자모 부분일치 (접두사)**: "가" 입력 → "가방" 매치.
8. **자모 부분일치 (미완성 자소)**: "갑" 입력 → "가방" 매치.
9. **자모 부분일치 (중간 문자열)**: "기술노트" 입력 → "기술노트", "일반 기술노트", "상급 기술노트", "최고급 기술노트" 등록 순서대로 표시.
10. **초성 부분일치**: "ㄱㅅㄴㅌ" 입력 → 위 4개 모두 표시.
11. **부분 초성**: "ㄱㅂ" 입력 → "가방" 매치.
12. **결과 0개**: "zzz" 입력 → 드롭다운 닫힘.
13. **선택 → 자동 입력**: 드롭다운에서 "기술노트" 클릭 → 해당 셀의 name/price/buyCount가 자동 입력됨.
14. **다음 셀 포커스**: 13 직후, 같은 상점의 다음 빈 셀의 이름 인풋에 포커스 + 전체선택.
15. **다음 셀 없음**: 같은 상점의 마지막 셀에서 선택 → 포커스 이동 없음(no-op).
16. **다른 상점 점프 없음**: 한 상점의 마지막 셀에서 선택해도 다른 상점 셀로 넘어가지 않음.
17. **키보드**: `ArrowDown`/`ArrowUp`으로 selected 이동, `Enter`로 선택, `Escape`로 닫기(값 유지), `Tab`/blur로 닫기(값 커밋).
18. **한 번에 하나**: 다른 이름 인풋으로 포커스 이동 시 이전 드롭다운은 자동으로 닫힘.

## 비범위 / 주의

- 프리셋 삭제 시 이미 사용 중인 `shopItems`에는 영향 없음. 프리셋은 입력 보조일 뿐 상점 데이터의 참조가 아니다.
- 이름이 같은 프리셋이 둘 이상 등록돼도 둘 다 드롭다운에 나타난다(등록 순서 유지). 중복 검증은 하지 않는다.
- `price`/`buyCount`의 타입은 숫자. JSON 보기에서 잘못된 타입으로 저장하면 `validateState`가 거부한다.
- es-hangul 추출은 기능만 복사하고 라이선스 고지를 `hangul.js` 상단에 남긴다.
