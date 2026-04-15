// Event Planner — DOM 렌더링 및 이벤트 바인딩. 브라우저 전용.

const STORAGE_KEY = 'eventPlannerState';

let state = loadState();

let activeAutocomplete = null;
// { input, dropdown, row, shopItemIdx, shopItem, results, selectedIdx }

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

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('saveState failed:', e.message);
  }
}

function render() {
  renderResultSection();
  renderCurrenciesSection();
  renderStagesSection();
  renderShopsSection();
}

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
    input.min = '0';
    input.value = state.owned[c.name] ?? 0;
    input.addEventListener('blur', () => {
      const n = Number(input.value);
      state.owned[c.name] = Number.isFinite(n) && n >= 0 ? n : 0;
      afterValueEdit();
    });
    label.appendChild(input);
    row.appendChild(label);
  });
  ownedDiv.appendChild(row);
}

function renderCurrenciesSection() {
  const container = document.getElementById('currencies-container');
  container.innerHTML = '';

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>재화</th><th>보너스 % <span class="info-icon">ⓘ<span class="info-tip">여러 보너스를 합칠 때 <code>25+15+15+15+25+15</code>처럼 <code>+</code>로 이어서 입력할 수 있습니다.</span></span></th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');

  state.currencies.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.appendChild(makeTextCell(c.name, (v) => {
      if (v === state.currencies[idx].name) return;
      renameCurrency(idx, v);
      saveState();
      renderResultSection();
      renderStagesSection();
      renderShopsSection();
      recompute();
    }, '이벤트 포인트, 벚꽃 찹쌀떡, etc...'));
    tr.appendChild(makeSumCell(c.bonus, v => { c.bonus = v; afterValueEdit(); }));
    tr.appendChild(makeDeleteCell(() => { removeCurrency(idx); }));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 재화 추가';
  addBtn.addEventListener('click', () => {
    state.currencies.push({ name: '', bonus: 0 });
    afterEdit();
  });
  const row = document.createElement('div');
  row.className = 'btn-row';
  row.appendChild(addBtn);
  container.appendChild(row);
}

function renderStagesSection() {
  const container = document.getElementById('stages-container');
  container.innerHTML = '';

  const currencyCols = state.currencies.filter(c => c.name);

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
    th.textContent = c.name;
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
      const value = state.stages[i].drops[c.name] ?? 0;
      tr.appendChild(makeNumCell(value, v => {
        if (v) state.stages[i].drops[c.name] = v;
        else delete state.stages[i].drops[c.name];
        afterValueEdit();
      }));
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

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
    summary.textContent = `${c.name} 상점`;
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    let itemCount = 0;
    state.shopItems.forEach((it, idx) => {
      if (it.currency !== c.name) return;
      itemCount++;
      grid.appendChild(makeShopItemCell(it, idx));
    });

    grid.appendChild(makeShopAddCell(c.name));

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

function makeItemNameInput(it, idx) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-name-input';
  input.value = it.name ?? '';
  input.placeholder = '보고서, 선물 etc...';
  input.dataset.shopIdx = String(idx);

  input.addEventListener('focus', () => openAutocomplete(input, it, idx));
  input.addEventListener('input', () => updateAutocomplete(input.value));
  input.addEventListener('keydown', e => handleAutocompleteKey(e, input));
  input.addEventListener('focusout', () => {
    // mousedown preventDefault가 걸린 경우(드롭다운 클릭)에는 이 경로가 실행되어도
    // selectPresetItem이 afterEdit으로 덮어씀. 일반 blur는 여기서 커밋.
    setTimeout(() => {
      // afterEdit의 render()가 인풋을 detach했다면 이 핸들러는 오래된 input.value로
      // 방금 갱신된 state를 덮어써버림. isConnected로 감지하고 바일아웃.
      if (!input.isConnected) return;
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
    el.textContent = p.name;
    el.addEventListener('mousedown', e => {
      e.preventDefault();  // focusout 방지
    });
    el.addEventListener('click', () => {
      selectPresetItem(a.shopItemIdx, p);
    });
    a.dropdown.appendChild(el);
  });
  scrollSelectedIntoView();
}

function scrollSelectedIntoView() {
  const a = activeAutocomplete;
  if (!a) return;
  const el = a.dropdown.children[a.selectedIdx];
  if (!el) return;
  const itemH = el.offsetHeight;
  const top = el.offsetTop;
  const bottom = top + itemH;
  const viewH = a.dropdown.clientHeight;
  const viewTop = a.dropdown.scrollTop;
  const viewBottom = viewTop + viewH;
  // 선택 항목 위·아래로 1칸씩 여유가 보이도록 스크롤
  if (top - itemH < viewTop) {
    a.dropdown.scrollTop = Math.max(0, top - itemH);
  } else if (bottom + itemH > viewBottom) {
    a.dropdown.scrollTop = bottom + itemH - viewH;
  }
}

function handleAutocompleteKey(e, input) {
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
  if (!it) return;
  it.name = preset.name;
  it.price = preset.price;
  it.buyCount = preset.buyCount;
  const currency = it.currency;
  // afterEdit의 render()가 드롭다운을 잘라내기 전에 activeAutocomplete를 명시적으로 null로
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

function makeShopAddCell(currencyName) {
  const cell = document.createElement('div');
  cell.className = 'shop-cell shop-cell-add';
  const btn = document.createElement('button');
  btn.textContent = '+ 아이템 추가';
  btn.addEventListener('click', () => {
    state.shopItems.push({ currency: currencyName, name: '', price: 0, buyCount: 0 });
    afterEdit();
  });
  cell.appendChild(btn);
  return cell;
}

// --- 셀 / 인풋 헬퍼 ---
function makeTextInput(value, onCommit, placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value ?? '';
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onCommit(input.value, input));
  return input;
}

function makeNumInput(value, onCommit, opts = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
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
  return input;
}

function makeTextCell(value, onCommit, placeholder) {
  const td = document.createElement('td');
  td.appendChild(makeTextInput(value, onCommit, placeholder));
  return td;
}

function makeNumCell(value, onCommit, opts = {}) {
  const td = document.createElement('td');
  td.appendChild(makeNumInput(value, onCommit, opts));
  return td;
}

function makeSumCell(value, onCommit) {
  const td = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.value = value ?? 0;
  const commit = () => {
    const n = parseSumExpr(input.value);
    input.value = n;
    onCommit(n);
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  });
  td.appendChild(input);
  return td;
}

function makeDeleteCell(onClick) {
  const td = document.createElement('td');
  const btn = document.createElement('button');
  btn.className = 'btn-del';
  btn.tabIndex = -1;
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

function afterValueEdit() {
  saveState();
  recompute();
}

function renameCurrency(idx, newName) {
  const old = state.currencies[idx].name;
  if (newName === old) return;
  state.currencies[idx].name = newName;
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
}

function removeCurrency(idx) {
  const name = state.currencies[idx].name;
  state.currencies.splice(idx, 1);
  state.stages.forEach(stage => { delete stage.drops[name]; });
  delete state.owned[name];
  state.shopItems = state.shopItems.filter(it => it.currency !== name);
  afterEdit();
}

function recompute() {
  const result = document.getElementById('result-container');
  result.innerHTML = '';

  if (!hasMinimumData(state)) {
    result.innerHTML = '<div class="result-msg">재화·스테이지 드랍·상점 아이템을 먼저 입력하세요</div>';
    return;
  }

  const model = buildModel(state);
  if (Object.keys(model.constraints).length === 0) {
    const header = document.createElement('div');
    header.className = 'result-ok';
    header.textContent = '이미 충분합니다 ✅';
    result.appendChild(header);
    renderBalanceTable(result, {});
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

  const activeCurrencies = state.currencies.filter(c => c.name);
  const stageTable = document.createElement('table');
  stageTable.className = 'stage-rec-table';
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
    tr.innerHTML = `<td>스테이지 ${i + 1}</td><td>${STAGE_AP[i]} ap</td><td>${runs} 번</td>`;
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

  const header = document.createElement('div');
  header.className = 'result-ok';
  header.textContent = '✅ 총 AP: ' + totalAP;
  container.appendChild(header);

  // 재화 수지 표
  renderBalanceTable(container, solved);
}

function renderBalanceTable(container, solved) {
  const balTitle = document.createElement('div');
  balTitle.textContent = '재화 수지';
  balTitle.style.marginTop = '12px';
  container.appendChild(balTitle);

  const balanceTable = document.createElement('table');
  balanceTable.innerHTML = '<thead><tr><th>재화</th><th>보유</th><th>필요</th><th>획득</th><th>잉여</th></tr></thead>';
  const balBody = document.createElement('tbody');
  const balance = computeBalance(state, solved);
  state.currencies.filter(c => c.name).forEach(c => {
    const b = balance[c.name];
    const tr = document.createElement('tr');
    const surplusColor = b.surplus < 0 ? 'color:#c33' : '';
    tr.innerHTML =
      `<td>${escapeHtml(c.name)}</td>` +
      `<td>${b.owned}</td>` +
      `<td>${b.needed}</td>` +
      `<td>+${b.gained}</td>` +
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

const PRESET_PLACEHOLDER = `{
  "name": "기초 기술노트",
  "price": 5,
  "buyCount": 50
},
{
  "name": "일반 기술노트",
  "price": 15,
  "buyCount": 38
},
{
  "name": "상급 기술노트",
  "price": 50,
  "buyCount": 25
},
{
  "name": "최고급 기술노트",
  "price": 200,
  "buyCount": 15
}`;

function openPresetEdit() {
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('preset-view').style.display = 'block';
  document.querySelector('h1 .toolbar').style.display = 'none';
  const ta = document.getElementById('preset-textarea');
  ta.placeholder = PRESET_PLACEHOLDER;
  ta.value = state.presetItems.map(p => JSON.stringify(p, null, 2)).join(',\n');
}

function closePresetEdit() {
  document.getElementById('main-view').style.display = '';
  document.getElementById('preset-view').style.display = 'none';
  document.querySelector('h1 .toolbar').style.display = '';
}

function resetPresetEdit() {
  if (!confirm('프리셋을 기본값으로 되돌립니다. 현재 편집 중인 내용은 사라집니다. 계속할까요?')) return;
  const defaults = cloneDefaultPresetItems();
  document.getElementById('preset-textarea').value =
    defaults.map(p => JSON.stringify(p, null, 2)).join(',\n');
}

function applyPresetEdit() {
  const text = document.getElementById('preset-textarea').value.trim();
  let parsed;
  try {
    parsed = text === '' ? [] : JSON.parse('[' + text + ']');
  } catch (e) {
    alert('JSON 파싱 실패: ' + e.message);
    return;
  }
  const candidate = Object.assign({}, state, { presetItems: parsed });
  const err = validateState(candidate);
  if (err) {
    alert('유효하지 않은 프리셋: ' + err);
    return;
  }
  state.presetItems = parsed;
  saveState();
  closePresetEdit();
  render();
}

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
  // 개발자용 편집기라 loadState/importJson 같은 하위호환 주입(presetItems 등)은 의도적으로 생략.
  // 필드를 실수로 지우면 validateState 에러로 그대로 표시한다.
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

// 포커스가 입력 필드로 이동할 때 전체 선택. setTimeout으로 mouseup 이후에
// select()를 호출해 클릭 시 커서 위치 덮어쓰기를 회피.
document.addEventListener('focusin', e => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (t.type !== 'text' && t.type !== 'number') return;
  if (t.readOnly) return;
  setTimeout(() => {
    if (document.activeElement === t) t.select();
  }, 0);
});

// 초기 렌더
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-export').addEventListener('click', exportJson);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', importJson);
  document.getElementById('btn-json').addEventListener('click', openJsonView);
  document.getElementById('btn-json-apply').addEventListener('click', applyJsonView);
  document.getElementById('btn-json-cancel').addEventListener('click', closeJsonView);
  document.getElementById('btn-preset-edit').addEventListener('click', openPresetEdit);
  document.getElementById('btn-preset-apply').addEventListener('click', applyPresetEdit);
  document.getElementById('btn-preset-cancel').addEventListener('click', closePresetEdit);
  document.getElementById('btn-preset-reset').addEventListener('click', resetPresetEdit);
  render();
  recompute();
});
