# Mobile Viewport Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 브라우저가 device-width로 렌더하도록 `src/index.html`에 viewport meta를 추가하고, 빌드 산출물 `index.html`을 재생성한다.

**Architecture:** `src/index.html`의 `<head>`에 `<meta name="viewport" content="width=device-width, initial-scale=1">` 한 줄을 `<meta charset="utf-8">` 바로 뒤에 삽입. `build.js`는 `<script src>` 태그만 인라인 치환하므로 `<head>` 내용은 그대로 전파된다. CSS·JS 로직·테스트 코드 변경 없음.

**Tech Stack:** HTML, Node.js (build.js), 브라우저 수동 회귀(test.html)

**Branch:** `develop` (이미 체크아웃 완료)

**Spec:** `docs/superpowers/specs/2026-04-15-mobile-viewport-design.md`

---

### Task 1: `src/index.html`에 viewport meta 추가

**Files:**
- Modify: `src/index.html:4` (between `<meta charset="utf-8">` and `<title>`)

- [ ] **Step 1: 현재 `<head>` 내용 확인**

Run: `sed -n '1,10p' src/index.html`
Expected output:
```
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>이벤트 플래너</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 20px auto; padding: 0 16px; }
```

(확인만 — 이미 meta 태그가 있다면 이 태스크는 스킵하고 사용자에게 알린다.)

- [ ] **Step 2: meta 태그 삽입**

`src/index.html`의 4행(`<meta charset="utf-8">`) 다음 줄에 다음을 삽입한다. Edit 도구 사용:

`old_string`:
```
  <meta charset="utf-8">
  <title>이벤트 플래너</title>
```

`new_string`:
```
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>이벤트 플래너</title>
```

**주의**: `user-scalable=no`·`maximum-scale=1.0`은 접근성 저해이므로 절대 포함시키지 않는다. `initial-scale=1`만 지정.

- [ ] **Step 3: 삽입 확인**

Run: `sed -n '1,10p' src/index.html`
Expected: 4행이 `  <meta charset="utf-8">`, 5행이 `  <meta name="viewport" content="width=device-width, initial-scale=1">`, 6행이 `  <title>이벤트 플래너</title>`.

---

### Task 2: 빌드 산출물 `index.html` 재생성

**Files:**
- Regenerate: `index.html` (루트)

- [ ] **Step 1: `node build.js` 실행**

Run: `node build.js`
Expected output: `wrote <absolute-path>/index.html (<NN>.N KB)` (크기는 기존 대비 약 +70바이트 수준).

경고가 나오면(`missing source, leaving tag intact:`) 빌드 실패이므로 원인 조사 후 중단.

- [ ] **Step 2: 루트 `index.html`에 meta 태그 포함 확인**

Run: `grep -n 'name="viewport"' index.html`
Expected: `5:  <meta name="viewport" content="width=device-width, initial-scale=1">`

(줄 번호는 Task 1 Step 3과 동일해야 한다 — `<head>` 상단은 script 인라인 치환 영향을 받지 않으므로.)

- [ ] **Step 3: 루트 `index.html` 구조 온전성 확인**

Run: `grep -c '<script>' index.html`
Expected: `5` (solver, hangul, logic, preset-defaults, ui — 모두 인라인됨)

Run: `grep -c 'src="' index.html`
Expected: `0` (남은 `<script src>` 없음)

---

### Task 3: 회귀 테스트 — 로직 변경 없음 확인

**Files:**
- Read-only: `test.html`

- [ ] **Step 1: `test.html`을 브라우저에서 열기**

브라우저(또는 DevTools 프리뷰)로 `file:///<repo>/test.html`을 연다.

- [ ] **Step 2: 모든 테스트가 통과했는지 확인**

Expected: 페이지 상단에 "All tests passed" 또는 동등한 초록 표시. 실패가 하나라도 있으면 이 스펙 범위 밖의 회귀 — 이 스펙은 로직 파일을 건드리지 않았으므로 실패가 뜨면 중단하고 사용자에게 보고.

(`test.html`은 `src/logic.js` 등을 직접 로드한다. `src/index.html` head는 테스트 경로와 무관하므로 통과해야 정상.)

---

### Task 4: 수동 모바일 확인 (선택)

**Files:** 없음 (수동 확인)

- [ ] **Step 1: 루트 `index.html`을 모바일 에뮬레이션으로 확인**

Chrome/Edge DevTools → Toggle Device Toolbar → iPhone 12 Pro (390×844) 선택 → 페이지 새로고침.

Expected:
- 본문 폰트가 읽을 만한 크기(physical ~16px)로 렌더
- 섹션 1(보유량), 섹션 2(재화/상점), 섹션 3(스테이지), 섹션 4(상점) 네 영역이 모두 드러나며 탭 가능
- 본문에 가로 스크롤이 발생하지 않거나, 발생해도 스펙의 비목표에 해당(재화 4개 + 권장횟수 표 등)

가로 스크롤이 광범위하게 발생하면 이 스펙 범위를 넘는 개선이 필요 — 사용자에게 보고해 후속 작업으로 이관.

- [ ] **Step 2: DevTools iPhone 에뮬레이션에서 input 탭**

임의의 `<input>`(예: 보유량)을 탭해 포커스가 정상 잡히고, iOS Safari 스타일 자동 확대가 없는지 확인(가능하면 실기기 iOS에서도).

Expected: 포커스 시 확대 없음 (input이 `font: inherit`로 body 16px를 상속하므로 안전).

---

### Task 5: 커밋

**Files:** `src/index.html`, `index.html`

- [ ] **Step 1: 변경 범위 확인**

Run: `git status`
Expected: `src/index.html`, `index.html` 두 파일만 modified.

Run: `git diff --stat`
Expected: 두 파일 각각 +1 라인(둘 다 같은 meta 태그 한 줄).

- [ ] **Step 2: 의도치 않은 변경이 없는지 검토**

Run: `git diff src/index.html`
Expected: `<meta charset="utf-8">` 다음에 `<meta name="viewport" content="width=device-width, initial-scale=1">`가 추가된 단일 hunk.

Run: `git diff index.html`
Expected: `src/index.html`과 동일한 hunk — 다른 라인(인라인된 JS 등)에 변화가 없어야 한다. 변화가 있다면 스크립트 소스가 바뀌지 않았는데 왜 diff가 떴는지 원인 조사.

- [ ] **Step 3: 커밋 생성**

```bash
git add src/index.html index.html
git commit -m "$(cat <<'EOF'
feat: add mobile viewport meta

Mobile browsers were downscaling the 980px default viewport, making
fonts and inputs unreadably tiny on phones. Adding width=device-width
with initial-scale=1 lets the existing CSS render at its natural size.

No CSS or JS changes — sticks to the minimal-intervention scope in
the spec.

Spec: docs/superpowers/specs/2026-04-15-mobile-viewport-design.md
EOF
)"
```

- [ ] **Step 4: 커밋 확인**

Run: `git log -1 --stat`
Expected: `src/index.html` +1 −0, `index.html` +1 −0.

Run: `git status`
Expected: `nothing to commit, working tree clean` (develop 브랜치 위에서).

---

## Verification Summary

완료 조건:
1. `src/index.html`에 viewport meta 1줄 추가됨
2. `index.html`(루트)에 같은 meta 1줄 추가됨 (`node build.js` 실행으로)
3. `test.html` 모든 테스트 통과 (회귀 없음 확인)
4. 모바일 에뮬레이션에서 폰트·input이 읽을 만한 크기로 렌더
5. develop 브랜치에 단일 커밋으로 반영

비목표(이 계획에서 다루지 않는 것):
- CSS 미디어쿼리 추가
- 테이블 가로 스크롤 래퍼
- 터치 타겟/폰트 크기 튜닝
- 데스크탑 레이아웃 변경
