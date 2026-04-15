# Event Planner (자작 버전) 설계 문서

작성일: 2026-04-13

## 1. 배경 / 목적

원본 사이트(`Event Planner.html`)는 게임 이벤트의 스테이지 드랍·상점 데이터를 입력받아
선형 계획법으로 **"필요한 재화를 다 모으는 데 드는 최소 AP"** 를 계산해주는 도구다.
그러나 사이트 운영자가 매 이벤트에 맞춰 데이터를 즉시 업데이트하지 않는 경우가 있어,
사용자가 직접 데이터를 입력하고 같은 계산을 할 수 있는 **단일 HTML 파일**이 필요하다.

추가로 원본은 LP 풀이 후 결과를 사후적으로 `ceil`/`round`하는 방식이라 정수화 과정에서
잉여 재화가 누적되는 약점이 있다. 자작 버전은 솔버의 **정수 LP(ILP)** 모드를 사용해 이
문제를 제거한다.

## 2. 범위

- **포함**: Shop 모드 한 가지 (필요 재화 충족을 위한 최소 AP 산정)
- **불포함**: Currency 모드, Materials 모드, Manual 모드, 자동 구매 추적,
  로그인/계정, 다국어, 다중 이벤트 동시 관리

## 3. 기술 스택

- **단일 HTML 파일** (`event-planner.html`)
- HTML/CSS/JavaScript 모두 인라인. 빌드 도구·서버 없음. 더블클릭으로 동작.
- `javascript-lp-solver` 라이브러리도 같은 파일 안에 인라인 (~50KB).
  소스는 `Event Planner_files/solver.js.다운로드` 의 사본 사용.
- 프레임워크 없음 — vanilla JS, 단일 `state` 객체 + `render()` 함수.
- UI 언어: 한국어.

## 4. 데이터 모델

```js
state = {
  currencies: [
    { name: "엔화", bonus: 5, shopName: "일본 상점" },
    { name: "달러", bonus: 0, shopName: "미국 상점" },
  ],
  // 12개 고정. AP는 인덱스로 결정되므로 state에 저장하지 않음.
  stages: [
    { drops: { "엔화": 5, "달러": 1 } },   // #1, AP 10
    { drops: { "엔화": 4, "달러": 2 } },   // #2, AP 10
    // ...
    { drops: { "엔화": 1, "달러": 8 } },   // #12, AP 20
  ],
  shopItems: [
    { currency: "엔화", name: "가챠권", price: 200, buyCount: 5 },
    { currency: "달러", name: "스킬북", price: 50,  buyCount: 10 },
  ],
  owned: { "엔화": 0, "달러": 0 },
  groupsEnabled: [true, true, true],   // [그룹1(1~4), 그룹2(5~8), 그룹3(9~12)]
}
```

**상수**

```js
const STAGE_AP = [10,10,10,10, 15,15,15,15, 20,20,20,20];
```

**불변 규칙**

- 스테이지 12개 고정. 추가/삭제 불가. AP는 상수 표에서 결정.
- 보너스, 가격, 구매수량, 보유량, 드랍은 모두 정수.
- 보너스는 추가 퍼센트 정수로 입력 (0 = 보너스 없음, 50 = +50%, -5 = -5%). 계산식: `ceil(드랍 × (100 + 보너스) / 100)`. 음수 허용.
- 상점은 별도 객체가 아니며, `shopItems[].currency` 가 어느 상점에 속하는지 결정.
- 한 상점의 결제 재화는 한 종류로 고정.
- 재화 추가 시 상점이 자동으로 1:1 생성. 재화 삭제 시 그 재화의 모든 `shopItems`,
  모든 `stages[].drops[그재화]`, `owned[그재화]` 모두 함께 삭제.

## 5. UI 레이아웃

페이지 구조 — 위에서 아래로 4개 섹션. 각 섹션은 `<details>` 로 접기/펼치기 가능.

```
┌──────────────────────────────────────────────┐
│ 이벤트 플래너   [JSON 보기][내보내기][불러오기]   │
├──────────────────────────────────────────────┤
│ ▼ 1. 보유량 & 결과    (기본 펼침, 가장 자주 봄)  │
│   보유량:  엔화[ 1200 ]   달러[ 300 ]          │
│   ─────────────────────────                  │
│   ✅ 총 AP: 245                                │
│   ─────────────────────────                  │
│   스테이지 권장 횟수                            │
│   ┌────┬─────┬──────┬─────────┬─────────┐    │
│   │ #  │ AP  │ 횟수 │ +엔화    │ +달러    │    │
│   ├────┼─────┼──────┼─────────┼─────────┤    │
│   │ 1  │ 10  │  3   │   15    │    3    │    │
│   │ 5  │ 15  │  7   │   28    │   28    │    │
│   │ 12 │ 20  │  4   │    4    │   32    │    │
│   └────┴─────┴──────┴─────────┴─────────┘    │
│   (횟수 0인 행은 숨김)                          │
│   재화 수지                                     │
│   ┌──────┬──────┬──────┬──────┬──────┐       │
│   │ 재화 │ 보유 │ 획득 │ 필요 │ 잉여 │       │
│   ├──────┼──────┼──────┼──────┼──────┤       │
│   │ 엔화 │ 1200 │  +47 │ 1200 │  +47 │       │
│   │ 달러 │  300 │  +63 │  340 │  +23 │       │
│   └──────┴──────┴──────┴──────┴──────┘       │
├──────────────────────────────────────────────┤
│ ▼ 2. 재화 / 상점     (기본 펼침)                │
│   ┌──────┬───────┬──────────┬─────┐          │
│   │ 재화 │ 보너스%│ 상점 이름 │ 삭제│           │
│   ├──────┼───────┼──────────┼─────┤          │
│   │ 엔화 │  105  │ 일본 상점 │  ×  │          │
│   │ 달러 │  100  │ 미국 상점 │  ×  │          │
│   └──────┴───────┴──────────┴─────┘          │
│   [+ 재화 추가]                                 │
├──────────────────────────────────────────────┤
│ ▼ 3. 스테이지 (12개 고정)   (기본 펼침)         │
│   ☑ 그룹 1  (1~4, 10 AP)                       │
│   ┌────┬─────┬──────┬──────┐                  │
│   │ 1  │ 10  │  5   │  1   │                  │
│   │ ...                    │                  │
│   │ 4  │ 10  │  2   │  4   │                  │
│   └────┴─────┴──────┴──────┘                  │
│   ☑ 그룹 2  (5~8, 15 AP)                       │
│   ...                                          │
│   ☐ 그룹 3  (9~12, 20 AP) ← 비활성, 회색 처리   │
│   ...                                          │
├──────────────────────────────────────────────┤
│ ▼ 4. 상점       (기본 접힘)                     │
│   ▼ 일본 상점 (엔화로 결제)                      │
│   ┌──────────┬──────┬────────┬─────┐          │
│   │ 아이템   │ 가격 │ 구매수량│ 삭제│          │
│   ├──────────┼──────┼────────┼─────┤          │
│   │ 가챠권   │ 200  │   5    │  ×  │          │
│   └──────────┴──────┴────────┴─────┘          │
│   [+ 아이템 추가]                                │
│                                                │
│   ▼ 미국 상점 (달러로 결제)                      │
│   ... (똑같은 구조)                             │
└──────────────────────────────────────────────┘
```

**입력 동작**

- 모든 셀은 `<input>`. 포커스가 빠질 때(`blur`) `recompute()` 호출.
- "재화 추가" 버튼은 빈 행 1개 추가 (`{ name:"", bonus:100, shopName:"" }`).
- "아이템 추가" 버튼은 해당 상점 그룹 안에 빈 행 1개 추가.
- 그룹 체크박스 토글 시 즉시 `recompute()` 호출.

**JSON 직접 편집 토글**

- 헤더의 `[JSON 보기]` 버튼 → 4개 섹션을 숨기고 `<textarea>` + `[적용][취소]` 표시.
- `[적용]`: JSON 파싱 → 검증 → `state` 교체 → 표 UI 복귀 → `recompute()`.
- `[취소]`: 표 UI로 복귀.

## 6. LP 변환 로직

```js
function buildModel(state) {
  // 1) 변수: 비활성 그룹을 제외한 스테이지 (s1..s12) 각각 정수 결정변수
  const variables = {};
  state.stages.forEach((stage, i) => {
    const group = Math.floor(i / 4);                  // 0, 1, 2
    if (!state.groupsEnabled[group]) return;          // 비활성 그룹 스킵

    const v = { AP: STAGE_AP[i] };
    state.currencies.forEach(c => {
      if (!c.name) return;                            // 빈 이름 스킵
      const raw = stage.drops[c.name] ?? 0;
      // 보너스 적용 + ceil (원본 line 2164 공식과 동일)
      v[c.name] = Math.ceil(+(raw * (100 + c.bonus) / 100).toFixed(5));
    });
    variables["s" + (i + 1)] = v;
  });

  // 2) 제약: 재화별 최소 필요량 = (Σ price × buyCount) - 보유량
  const constraints = {};
  state.currencies.forEach(c => {
    if (!c.name) return;
    const need = state.shopItems
      .filter(it => it.currency === c.name)
      .reduce((sum, it) => sum + it.price * it.buyCount, 0);
    const remaining = need - (state.owned[c.name] ?? 0);
    if (remaining > 0) constraints[c.name] = { min: remaining };
  });

  // 3) 정수 제약: 모든 스테이지 변수는 정수 (ILP)
  const ints = {};
  Object.keys(variables).forEach(k => { ints[k] = 1; });

  return { optimize: "AP", opType: "min", variables, constraints, ints };
}
```

**계산 트리거**

```js
function recompute() {
  saveToLocalStorage();
  if (!hasMinimumData(state)) {
    showResult({ message: "재화·스테이지 드랍·상점 아이템을 먼저 입력하세요" });
    return;
  }
  const model = buildModel(state);
  // 제약이 비었다 = 보유량이 이미 모든 필요량을 충족 → 솔버 호출 생략
  if (Object.keys(model.constraints).length === 0) {
    showResult({ alreadyEnough: true });
    return;
  }
  let result;
  try {
    result = solver.Solve(model);
  } catch (e) {
    console.error(e);
    showResult({ error: "솔버 오류: " + e.message });
    return;
  }
  if (!result.feasible) {
    showResult({ error: "현재 입력으로는 목표 달성 불가능 (드랍이 부족하거나 모순)" });
    return;
  }
  showResult({ stages: result, totalAP: result.result });
}
```

`hasMinimumData`: 다음 세 조건을 모두 만족.
- 이름이 빈 문자열이 아닌 `currencies` 가 1개 이상.
- `groupsEnabled` 중 `true` 가 1개 이상.
- `shopItems` 중 `price > 0` 이고 `buyCount > 0` 인 항목이 1개 이상.

LP 모델 자체의 풀이 가능성(스테이지에 그 재화 드랍이 있는지 등)은 솔버에 맡기고
사전 체크하지 않는다 — 부적합한 입력이면 솔버가 `feasible:false` 를 반환해 빨간
박스로 표시된다.

## 7. 결과 표시 로직

`solver.Solve` 의 반환값:

```js
{ feasible: true, result: 245, bounded: true, s1: 3, s5: 7, s12: 4, ... }
```

- `result` → "총 AP".
- `s1..s12` → 권장 횟수. 0이거나 키 없음이면 행 숨김.
- `+재화` 칸 = `Math.ceil(드랍 × 보너스 / 100) × 권장횟수`.
- 재화 수지의 "획득" = 모든 활성 스테이지 권장횟수에 대한 같은 합.
- 재화 수지의 "잉여" = `보유 + 획득 - 필요`. 0 이상이 정상. 음수는 빨간색
  (이론상 발생 안 해야 하며, 발생 시 버그 신호).

**불가능/안내 케이스**

| 상황 | 표시 |
|---|---|
| 입력 부족 | 결과 영역에 회색 안내 |
| `feasible: false` | 결과 영역에 빨간 박스 |
| 보유량이 모든 필요량 ≥ | "이미 충분합니다 ✅" + 권장 0회 |

## 8. 저장/불러오기

**localStorage 자동 저장**

- 키: `eventPlannerState`
- 트리거: `recompute()` 안에서 매번 (= 모든 `blur` 이벤트).
- 페이지 로드 시 복원. 파싱 실패 시 콘솔 경고 + 빈 상태 시작.

**JSON 내보내기**

- 헤더의 `[내보내기]` 버튼.
- `state` 를 `JSON.stringify(state, null, 2)` 로 직렬화.
- `Blob` → `<a download="event-planner-YYYY-MM-DD.json">` → 클릭.

**JSON 불러오기**

- 헤더의 `[불러오기]` 버튼 → 숨겨진 `<input type="file" accept=".json">` 트리거.
- 파일 읽기 → 파싱 → 검증 → 통과 시 `state` 교체 후 전체 다시 그림.
- 검증 실패 시 alert + 기존 상태 유지.

**검증 규칙 (불러오기 / JSON 적용 공통)**

```
state 객체이고 다음 키가 모두 존재할 것:
  currencies     : 배열, 각 요소는 { name:string, bonus:number, shopName:string }
  stages         : 길이 12 배열, 각 요소는 { drops: object }
  shopItems      : 배열, 각 요소는 { currency:string, name:string,
                                      price:number, buyCount:number }
  owned          : 객체 (재화 이름 → number)
  groupsEnabled  : 길이 3 배열 of boolean
```

위반 시 "유효하지 않은 파일입니다" alert.

## 9. 에러 처리 정책

| 상황 | 처리 |
|---|---|
| 입력 부족 (재화 0개 등) | 결과 영역에 회색 안내 |
| 솔버 `feasible: false` | 결과 영역에 빨간 박스 |
| 보유량이 이미 충분 | "이미 충분합니다 ✅" |
| 보너스/AP/가격/드랍/구매수량/보유량이 빈 문자열 | `0` 으로 간주 (보너스 포함) |
| NaN 또는 음수 (보너스 제외) | `0` 으로 간주. 보너스는 음수 허용 |
| 솔버 라이브러리가 throw | try/catch → 콘솔 + 빨간 박스 |
| 재화 이름 중복 | 허용. 마지막 정의가 이김 |
| 재화 이름 빈 문자열 | 그 행은 LP 모델에서 제외 |
| localStorage 손상 | 콘솔 경고 + 빈 상태 |
| 파일 불러오기 실패 | alert + 기존 상태 유지 |

**원칙**: 어떤 입력으로도 화면이 깨지지 않게 한다. 경고는 결과 영역으로만 흘리고
입력 영역은 항상 살아 있게 둔다.

## 10. 파일 산출물

- `event-planner.html` — 위의 모든 것이 인라인된 단일 HTML 파일.

## 11. 비-목표 (의도적으로 안 다루는 것)

- 다중 이벤트 동시 관리
- 클라우드 동기화
- 자동 데이터 수집/구매 추적
- Currency·Materials·Manual 모드
- 모바일 전용 UI 최적화 (데스크탑 우선, 단 반응형으로 깨지지만 않게)
- 다국어
