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

function buildModel(state) {
  const variables = {};
  state.stages.forEach((stage, i) => {
    const group = Math.floor(i / 4);
    if (!state.groupsEnabled[group]) return;

    // Tiebreaker: higher stages get a micro discount in the objective
    // so that ties in true AP resolve toward the higher stage.
    const v = { AP: STAGE_AP[i] - TIE_EPSILON * (i + 1) };
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

function hasMinimumData(state) {
  const hasCurrency = state.currencies.some(c => c.name && c.name.length > 0);
  const hasGroup = state.groupsEnabled.some(g => g);
  const hasItem = state.shopItems.some(it =>
    it.currency && (it.price || 0) > 0 && (it.buyCount || 0) > 0
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
    if (c.shopName !== undefined && typeof c.shopName !== 'string')
      return 'currency.shopName must be string';
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
  module.exports = { STAGE_AP, applyBonus, parseSumExpr, defaultState, buildModel, computeBalance, hasMinimumData, validateState, matchPresetItems };
}
