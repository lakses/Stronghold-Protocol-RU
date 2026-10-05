// shared/loadoutRecord.js — настройки оперативников (DESIGN §16, DATA.md §2.2): запись data/chess.json в том виде, в
// каком её делают выбранный навык / модуль. Чистый ESM, общий для симуляции (server/sim/simdata.js реэкспортирует его:
// getChess(id, loadout) строит определения юнитов из него) и клиентского UI (карточка деталей показывает характеристики /
// 特性 / таланты, с которыми юнит сражается — интеграция playtest #2: элитный на 不装备 показывал ATK и особенность
// своего модуля по умолчанию; attackRangeGrid = радиус, с которым он развёрнут, а также оверлей доски и колесо
// развёртывания — extendedGrid это собственный рост 攻击距离 в бою, реэкспортируется server/sim/targeting.js). Одна
// реализация, поэтому карточка и бой никогда не расходятся. (Какие выборы доступны игроку: shared/protocol.js
// loadoutOptions.)

import { GEO } from './constants.js';

/**
 * Разрешает настройку относительно записи оперативника.
 * @param {object|null} rec запись data/chess.json
 * @param {{ skillIndex?: number, moduleId?: string, skill?: number, module?: string }|null} [loadout]
 * @returns {{ skillIndex: number|null, moduleId: string|null, skillIsDefault: boolean, moduleIsDefault: boolean,
 *             isDefault: boolean }|null} null без записи; `moduleId` null для оперативников без выбора модулей
 */
export function resolveRecordLoadout(rec, loadout = null) {
  if (!rec || typeof rec !== 'object') return null;
  const skills = Array.isArray(rec.skills) ? rec.skills : null;
  const defSkill = rec.skill && Number.isInteger(rec.skill.index) ? rec.skill.index : (skills?.find((s) => s && s.isDefault)?.index ?? null);
  const lo = loadout && typeof loadout === 'object' ? loadout : {};
  const wantSkill = lo.skillIndex ?? lo.skill;
  const skillIndex = skills && Number.isInteger(wantSkill) && skills.some((s) => s && s.index === wantSkill) ? wantSkill : defSkill;
  const mods = Array.isArray(rec.modules) ? rec.modules : null;
  const defMod = mods ? (mods.find((m) => m && m.isDefault)?.uniEquipId ?? 'none') : null;
  const wantMod = lo.moduleId ?? lo.module;
  const moduleId = mods && (wantMod === 'none' || (typeof wantMod === 'string' && mods.some((m) => m && m.uniEquipId === wantMod))) ? wantMod : defMod;
  const skillIsDefault = skillIndex === defSkill;
  const moduleIsDefault = moduleId === defMod;
  return { skillIndex, moduleId, skillIsDefault, moduleIsDefault, isDefault: skillIsDefault && moduleIsDefault };
}

const clean6 = (v) => (typeof v !== 'number' || !Number.isFinite(v) || Number.isInteger(v) || Math.abs(v) >= 1e6 ? v : Math.round(v * 1e6) / 1e6);

/** Характеристики с модулем: `statsBase` без модуля + плоский `attr` модуля (та же арифметика, что в tools/build-data.mjs). */
export function composeStats(statsBase, attr) {
  const s = { ...(statsBase || {}) };
  for (const [f, v] of Object.entries(attr || {})) s[f] = clean6((s[f] || 0) + v);
  return s;
}

/**
 * Таланты с модулем: применяет ModuleRecord.talentChanges к талантам без модуля — правило слияния из
 * tools/build-data.mjs mergeTalentChanges (переопределение существующего индекса: значения модуля побеждают,
 * базовые ключи, которые модуль не повторяет, сохраняются; иначе добавляется; пустые заглушки отбрасываются).
 */
export function composeTalents(base, changes) {
  const talents = (base || []).map((t) => ({ ...t }));
  for (const ch of changes || []) {
    const { talentIndex, ...rest } = ch;
    const rec = { index: talentIndex, ...rest, fromModule: true };
    const at = talentIndex >= 0 ? talents.findIndex((x) => x.index === talentIndex) : -1;
    if (at >= 0) {
      const old = talents[at];
      talents[at] = {
        ...rec,
        name: rec.name || old.name, desc: rec.desc ?? old.desc, descRaw: rec.descRaw ?? old.descRaw,
        bb: { ...old.bb, ...rec.bb }, bbStr: { ...old.bbStr, ...rec.bbStr },
        rangeGrid: rec.rangeGrid || old.rangeGrid, tokenKey: rec.tokenKey || old.tokenKey,
        hidden: old.hidden && rec.hidden,
      };
    } else {
      talents.push(rec);
    }
  }
  return talents.filter((t) => t.name || t.desc || Object.keys(t.bb || {}).length || t.tokenKey);
}

/**
 * Запись оперативника в том виде, как её делает выбранная настройка (новый объект; входные данные никогда не
 * мутируются): `skill` = выбранный SkillRecord; элитный оперативник с нестандартным выбором модуля: `stats` =
 * statsBase + attr модуля, `trait` = traitOverride или traitBase модуля, `talents` = talentsBase + talentChanges,
 * `module` = выбранный модуль (`active:false`, id null для 'none'). Талант, призывающий через контейнерный токен
 * (凛御银灰), следует за токеном выбранного навыка. Настройка по умолчанию возвращает сам `rec`.
 * @param {object} rec запись data/chess.json
 * @param {object} lo resolveRecordLoadout(rec, …)
 */
export function loadoutRecord(rec, lo) {
  if (!rec || !lo || lo.isDefault) return rec;
  const out = { ...rec };
  if (!lo.moduleIsDefault && Array.isArray(rec.modules)) {
    const m = lo.moduleId === 'none' ? null : rec.modules.find((x) => x.uniEquipId === lo.moduleId) ?? null;
    out.stats = composeStats(rec.statsBase ?? rec.stats, m ? m.attr : null);
    out.trait = (m && m.traitOverride) || rec.traitBase || rec.trait;
    out.talents = composeTalents(rec.talentsBase ?? rec.talents, m ? m.talentChanges : null);
    out.module = m
      ? { id: m.uniEquipId, name: m.name ?? null, type: m.typeName ?? null, level: m.level ?? rec.module?.level ?? 0, active: true }
      : { id: null, name: null, type: null, level: rec.module?.level ?? 0, active: false };
  }
  if (!lo.skillIsDefault && Array.isArray(rec.skills)) {
    const s = rec.skills.find((x) => x.index === lo.skillIndex);
    if (s) {
      out.skill = s;
      if (rec.assets) out.assets = { ...rec.assets, skillIcon: s.iconId ?? rec.assets.skillIcon };
      const tok = s.overrideTokenKey;
      if (tok && (rec.tokens || []).includes(tok) && (out.talents || []).some((t) => t && t.containerTokenKey)) {
        out.talents = out.talents.map((t) => (t && t.containerTokenKey ? { ...t, tokenKey: tok } : t));
      }
    }
  }
  return out;
}

/**
 * Радиус атаки, с которым (разрешённая по настройке) запись оперативника сражается от места развёртывания — карточка
 * деталей без живой записи, оверлей радиуса на доске и колесо развёртывания (DESIGN §16), те же клетки, с которых
 * начинает боевой юнит (prep m.unitStats `range`): сетка выбранного навыка, когда он читается как «被动效果：攻击范围扩大»
 * (引星棘刺 S3 3-9: её собственный радиус, пока она его несёт, tier5 kit); иначе элитный с экипированным модулем,
 * читающимся как «攻击范围扩大», использует его собственную сетку — его изменение таланта только на радиус
 * (talentIndex −1), например SPC-X = радиус кастера 3×3 + центральная клетка [0,3] — как это делают наборы (tier4
 * moduleRangeGrid, tier5 moduleRangeUp); в остальных случаях его `rangeGrid`. Затем увеличенный постоянным 攻击距离
 * из 特性 (traitRangeExtend: 信仰搅拌机 SPT-Y "攻击距离+1"). Радиус работающего навыка — это радиус живой записи.
 * @param {object|null} rec результат loadoutRecord(…) (или запись data/chess.json: её модуль по умолчанию)
 * @returns {number[][]|null}
 */
export function attackRangeGrid(rec) {
  if (!rec || typeof rec !== 'object') return null;
  let g = Array.isArray(rec.rangeGrid) ? rec.rangeGrid : null;
  const sk = rec.skill;
  const m = rec.module;
  if (sk && Array.isArray(sk.rangeGrid) && sk.rangeGrid.length && /被动效果：攻击范围扩大/.test(String(sk.desc ?? ''))) {
    g = sk.rangeGrid;
  } else if (rec.isGolden && m && m.active && m.id && /攻击范围扩大/.test(String(rec.trait?.moduleDesc ?? ''))) {
    const mod = (Array.isArray(rec.modules) ? rec.modules : []).find((x) => x && x.uniEquipId === m.id);
    const mg = (mod?.talentChanges || []).find((t) => t && t.talentIndex === -1 && Array.isArray(t.rangeGrid) && t.rangeGrid.length)?.rangeGrid;
    if (mg) g = mg;
  }
  const ext = traitRangeExtend(rec);
  return g && ext ? extendedGrid(g, ext) : g;
}

/**
 * Постоянный 攻击距离 (ability_range_forward_extend), который даёт 特性 записи — модуля, например 信仰搅拌机 SPT-Y
 * «攻击距离+1» (tier4 rangeUp: постоянный бафф rangeExtend, s.baseRangeExtend); 0 для того, что работает
 * «в Интегрированной стратегии» (空弦 ISW-A). Остальные 攻击距离 режима — у навыков (их работающий радиус).
 * @param {object|null} rec результат loadoutRecord(…)
 */
export function traitRangeExtend(rec) {
  const t = rec && typeof rec === 'object' ? rec.trait : null;
  if (!t || typeof t !== 'object' || /集成战略/.test(String(t.moduleDesc ?? ''))) return 0;
  const n = Math.floor(Number(t.bb?.ability_range_forward_extend) || 0);
  return n > 0 ? n : 0;
}

/**
 * Сетка радиуса (`[dRow, dCol]`, направление ВПРАВО), выросшая на `extend` (rangeExtend / 攻击距离, DESIGN §3):
 * каждая строка получает целые клетки 1 … ⌊extend⌋ за своим дальним (+dCol) концом — относительная форма того, что
 * строит server/sim/targeting.js absoluteRangeKeys, дедуплицированная, мусорные элементы отброшены. Одна реализация
 * для боя (реэкспортируется targeting.js: Battle._refreshRange хранит её как `unit.liveRangeGrid`, живой 攻击范围
 * карточки, когда применяется extend) и для attackRangeGrid записи.
 * @param {Array<[number, number]>|null|undefined} grid
 * @param {number} [extend]
 * @returns {Array<[number, number]>}
 */
export function extendedGrid(grid, extend = 0) {
  const out = [];
  const seen = new Set();
  const add = (dr, dc) => { const k = `${dr},${dc}`; if (!seen.has(k)) { seen.add(k); out.push([dr, dc]); } };
  if (!Array.isArray(grid)) return out;
  const cells = grid.filter((p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]));
  for (const [dr, dc] of cells) add(dr, dc);
  if (extend > 0 && Number.isFinite(extend)) {
    const maxByRow = new Map();
    for (const [dr, dc] of cells) maxByRow.set(dr, Math.max(maxByRow.get(dr) ?? -Infinity, dc));
    for (const [dr, mx] of maxByRow) for (let k = 1; k <= Math.min(extend, GEO.COLS); k++) add(dr, mx + k);
  }
  return out;
}