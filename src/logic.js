// Event Planner — 순수 로직 함수들. 브라우저·Node 모두에서 require/로드 가능.

const STAGE_AP = [10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20];

function applyBonus(raw, bonus) {
  return Math.ceil(+(raw * (100 + bonus) / 100).toFixed(5));
}

function parseSumExpr(text) {
  if (text == null) return 0;
  const parts = String(text).split('+').map(p => p.trim()).filter(p => p !== '');
  if (parts.length === 0) return 0;
  let total = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) return 0;
    total += n;
  }
  return total;
}

function allocateCurrencyId(currencies) {
  const used = new Set(currencies.map(c => c.id));
  for (let i = 1; ; i++) {
    if (!used.has(i)) return i;
  }
}

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

const TIE_EPSILON = 1e-6;

// LP-only: we deliberately do not flag variables as integer. Branch-and-cut on
// this structure (12 vars × 4 constraints) runs effectively forever in the pure-
// JS solver once >3 currency constraints are active; LP relaxation + ceil() in
// the caller finishes in <1 ms and overshoots optimal AP by <0.1%.
// TIE_EPSILON is group-level (not per stage) so LP ties resolve toward the later
// group. Per-stage perturbation would force the integer solver to exhaust its
// branch tree, which is what caused v1.1.1's freeze.
function buildModel(state) {
  const variables = {};
  state.stages.forEach((stage, i) => {
    const group = Math.floor(i / 4);
    if (!state.groupsEnabled[group]) return;

    const v = { AP: STAGE_AP[i] - TIE_EPSILON * group };
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

  return { optimize: 'AP', opType: 'min', variables, constraints };
}

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

function hasMinimumData(state) {
  const hasCurrency = state.currencies.length > 0;
  const hasGroup = state.groupsEnabled.some(g => g);
  const hasItem = state.shopItems.some(it =>
    typeof it.currencyId === 'number' && (it.price || 0) > 0 && (it.buyCount || 0) > 0
  );
  return hasCurrency && hasGroup && hasItem;
}

function matchPresetItems(query, presetItems) {
  // 공백 무시: "반기술"으로 "일반 기술노트"가 매칭되도록 양쪽 모두 공백 제거 후 비교
  const q = (query || '').replace(/\s+/g, '');
  if (!q) return presetItems.slice();
  const qDis = disassemble(q);
  const qCho = getChoseong(q);
  return presetItems.filter(p => {
    const name = p.name.replace(/\s+/g, '');
    const nameDis = disassemble(name);
    if (nameDis.includes(qDis)) return true;
    // qCho는 query에 한글이 없을 때 ''가 되는데, ''.includes('')는 항상 true라서 모든 아이템이 매칭돼버림. 가드 필수.
    if (qCho) {
      const nameCho = getChoseong(name);
      if (nameCho.includes(qCho)) return true;
    }
    return false;
  });
}

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGE_AP, applyBonus, parseSumExpr, defaultState, buildModel, computeBalance, hasMinimumData, validateState, matchPresetItems, allocateCurrencyId, normalizeCurrencyIds };
}
