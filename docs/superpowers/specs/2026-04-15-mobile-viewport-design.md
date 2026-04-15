# 모바일 뷰포트 메타 추가

**작성일**: 2026-04-15
**대상**: `src/index.html`, `index.html`

## 배경

스마트폰에서 앱이 매우 불편하다. 원인은 `src/index.html`에 `<meta name="viewport">`가 없다는 것. 이 태그가 없으면 대부분 모바일 브라우저는 980px 가상 뷰포트로 렌더한 뒤 물리 화면 폭에 맞춰 축소한다. 결과적으로:

- 본문 폰트(16px)가 물리적으로 ~6px 수준으로 보임
- `<input>` 요소가 작아 손가락으로 탭하기 어려움
- `h1 .toolbar button`(0.7em) 등 기존에 작은 요소는 더 작아짐

사용자는 "CSS 스타일 최소화 지향"을 명시했으며, 이 스펙의 범위는 viewport meta 1줄 추가만으로 한정한다. 다른 모바일 개선(폰트 크기 조정, 터치 타겟 확대, 가로 스크롤 안전망 등)은 이번 스펙에서 다루지 않는다.

## 목표

1. 모바일 브라우저가 device-width로 렌더하도록 viewport meta 추가
2. 기본 16px 폰트·인풋이 물리적으로도 16px 수준으로 보이게 복구

## 비목표

- h1 툴바 버튼 크기 조정 (0.7em 유지)
- 데이터 밀집 테이블(스테이지·밸런스·권장횟수)의 좁은 화면용 레이아웃 변경
- 재화 수가 늘어 좌우 넘침이 발생할 때의 가로 스크롤 래퍼 (재화는 최대 4개 수준으로 상정)
- 모바일 미디어쿼리 추가
- 데스크탑 레이아웃 변경

사용자 지침: 실제 써보고 불편한 점이 생기면 그때 개별 대응한다.

## 변경 내용

### `src/index.html`

`<head>` 안의 `<meta charset="utf-8">` 다음 줄에 추가:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

`initial-scale=1`만 지정한다. `user-scalable=no`·`maximum-scale=1` 등 확대 제한은 **넣지 않는다** (접근성 저해).

### `index.html` (루트, 빌드 산출물)

`build.js`는 `src/index.html`을 읽어 `<script src="…">` 태그만 인라인으로 치환하므로, `<head>` 내용은 그대로 전파된다. `node build.js` 실행으로 루트 `index.html`에도 meta 태그가 동일하게 포함된다.

## 리스크

- **가로 넘침 가능성**: 재화 4개 기준으로 권장횟수 표가 7열(3 고정 + 4 재화)이다. 폭 375px 기기에서 열당 ~49px로 빡빡할 수 있음. 현재 스펙 범위에선 허용 — 실제 불편이 확인되면 후속 작업에서 가로 스크롤 래퍼 또는 열 압축으로 대응.
- **iOS Safari 포커스 줌**: input의 계산된 `font-size`가 16px 미만일 때 자동 확대가 발생한다. 현재 스타일은 `font: inherit`이고 body는 기본 16px이므로 영향 없음.

## 검증

1. `node build.js` 실행 → 루트 `index.html` 재생성
2. 재생성된 `index.html`에 `<meta name="viewport" content="width=device-width, initial-scale=1">` 포함 확인
3. `test.html` 실행 → 기존 로직 테스트가 여전히 통과 (구조 변화 없음이지만 회귀 확인)
4. 실기기 또는 DevTools 모바일 에뮬레이션(예: iPhone 12, 390×844)에서:
   - 본문 폰트가 읽을 만한 크기로 렌더
   - 보유량·스테이지·상점 입력창을 손가락으로 탭·수정 가능
   - 가로 스크롤 발생 시 해당 구간 기록 (후속 작업 입력)
