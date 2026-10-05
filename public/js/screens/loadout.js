// Настройка оперативников (Operator loadout, DESIGN §16): выберите экипированный навык каждого оперативника и модуль его
// элитной версии перед матчем (официальное правило: «Перед началом игры нельзя изменить уровень оперативников, но можно
// изменить их навыки и модули»). Полноэкранный оверлей, открываемый из лобби, комнаты и брифинга (INFO_CHECK) —
// `openLoadout(from)` / <LoadoutButton/>; <LoadoutHost/> монтируется один раз в main.js. Стили:
// css/screens/loadout.css (официальные спрайты пресетов из арта локального клиента, когда присутствуют: operator_preset,
// image_skill_select_outline, skill_select_deco, icon_equip_non; иконки типов модулей из groups.module — буквенные
// плитки без них).
//
// Слева: ростер 112 видимых оперативников (фильтры по рангу / классу / альянсу, поиск, только изменённые) — каждая
// карточка показывает экипированный навык (S1–S3) и, при изменении, значок модуля элитной версии. Справа: выбранный
// оперативник — навыки (иконка, название, по умолчанию, восстановление SP, начальные / затраты SP, длительность,
// описание на обычном Lv.4 или элитном Lv.7), боевые характеристики (характеристики, радиус атаки, особенность и
// таланты выбранного варианта — сначала элитный, обычный по переключателю — с которым он сражается под выбранным
// навыком и модулем: собственный блок карточки деталей и чистые функции, GitHub issue #64) и модули элитной версии
// (не экипирован / X / Y … с бонусом к характеристикам, улучшением особенности и изменениями талантов), восстановить
// по умолчанию; восстановить всё по умолчанию в верхней панели. Настройка хранится в ui/loadoutSync.js
// (localStorage + room.loadout); модель — ui/loadoutModel.js.
// Клавиатура: Esc закрывает, ←/→ перемещают по (отфильтрованному) ростеру, когда фокус не в поле поиска.

import { useEffect, useMemo, useRef, useState } from '../../vendor/hooks.module.js';
import { html, Icon, MicroLabel, Button, TierChip, TextField, Countdown, Spinner, confirmDialog, hasDeadline } from '../ui/components.js';
import { Img, RichText, UnitThumb } from '../ui/gameComponents.js';
import { chessAvatarUrl, chessPortraitUrl, subProfIconUrl, bondIconUrl, moduleTypeIconUrl } from '../ui/assetUrls.js';
import { chessStatsBlock, traitText, chessTalents } from '../ui/detailPanel.js';
import { chessLoadout } from '../ui/gameLogic.js';
import { data, useData, localAsset } from '../data.js';
import { useStore } from '../store.js';
import { PHASE } from '../../../shared/constants.js';
import {
  MODULE_NONE, PROF_ORDER, PROF_NAME, rosterOf, filterRoster, recordsOf, chessOptions, effectiveChoice, setChoice, resetChoice,
  changedCount, skillLabel, moduleBadge, attrRows, skillTags,
} from '../ui/loadoutModel.js';
import { loadoutStore, openLoadout, closeLoadout, setEntries } from '../ui/loadoutSync.js';

export { openLoadout, closeLoadout };

const cx = (...p) => p.flat().filter(Boolean).join(' ');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

/** Квадратный глиф профессии (manifest prof.large: чёрный глиф на белом, отрисовывается loadout.css как белый). */
function profGlyphUrl(m, prof) {
  const k = String(prof || '').toLowerCase();
  const v = m && m.prof && m.prof.large ? m.prof.large[k] : null;
  return typeof v === 'string' ? v : null;
}

/** URL иконки навыка для SkillRecord (манифест `skills[iconId]` / `skillsById`), null если отсутствует. */
function skillIconOf(m, rec) {
  const skills = m && typeof m === 'object' ? m.skills : null;
  if (!skills || !rec) return null;
  const id = rec.iconId || rec.skillId;
  if (id && typeof skills[id] === 'string') return skills[id];
  const alt = m.skillsById && rec.skillId ? m.skillsById[rec.skillId] : null;
  return alt && typeof skills[alt] === 'string' ? skills[alt] : null;
}

/**
 * URL иконки модуля: официальная иконка типа из арта локального клиента (`local-assets.json` groups.module,
 * сопоставление по typeName без учёта регистра), иначе манифест `modules[icon]` / `uniequip[icon]`, если пайплайн
 * ассетов его предоставляет.
 */
function moduleIconOf(m, rec) {
  if (!rec) return null;
  const local = moduleTypeIconUrl(data.get('local'), rec.typeName || rec.type);
  if (local) return local;
  if (!m) return null;
  for (const group of ['modules', 'uniequip', 'equip']) {
    const g = m[group];
    if (g && typeof g === 'object') {
      const v = g[rec.icon] || g[rec.uniEquipId] || g[rec.typeIcon];
      if (typeof v === 'string') return v;
    }
  }
  return null;
}

/** Иконка навыка с официальной обводкой выбора; при отсутствии — буквенная плитка. */
function SkillIcon({ m, rec, index, on = false, size = 'md' }) {
  const src = skillIconOf(m, rec);
  return html`<span class=${cx('lo-sicon', `lo-sicon--${size}`, on && 'is-on')}>
    <${Img} src=${src} fallback=${html`<span class="lo-sicon__glyph num">${skillLabel(index)}</span>`} />
    ${on && size !== 'xs' ? html`<${Img} src=${localAsset('ui/outer', 'image_skill_select_outline')} class="lo-sicon__outline" fallback=${html`<i class="lo-sicon__ring"></i>`} />` : null}
  </span>`;
}

/** Плитка значка модуля: официальная иконка типа, если есть в арте локального клиента, иначе буква типа; ⊘ для «не экипирован». */
export function ModuleGlyph({ m, rec, id, size = 'md' }) {
  const src = rec ? moduleIconOf(m, rec) : null;
  if (id === MODULE_NONE || !rec) {
    return html`<span class=${cx('lo-mglyph', 'lo-mglyph--none', `lo-mglyph--${size}`)}>
      <${Img} src=${localAsset('ui/outer', 'icon_equip_non')} fallback=${html`<i class="lo-mglyph__slash"></i>`} />
    </span>`;
  }
  return html`<span class=${cx('lo-mglyph', `lo-mglyph--${size}`)} data-type=${moduleBadge(rec)}>
    <${Img} src=${src} fallback=${html`<b class="lo-mglyph__t num">${moduleBadge(rec)}</b>`} />
  </span>`;
}

// ---- карточка ростера ---------------------------------------------------------------------------------------------

function RosterCard({ m, chess, golden, entries, selected, onPick }) {
  const choice = effectiveChoice(entries, chess, golden);
  const opt = chessOptions(chess, golden);
  const skillRec = opt.skillOptions.find((s) => s.index === choice.skill)?.normal || chess.skill;
  const modRec = golden && choice.module !== MODULE_NONE ? opt.moduleOptions.find((x) => x.id === choice.module)?.rec || null : null;
  const modChanged = golden && choice.module !== opt.defaultModule;
  return html`<button type="button" role="option" aria-selected=${selected ? 'true' : 'false'} data-chess=${chess.chessId}
      class=${cx('lo-card', `lo-card--t${chess.tier}`, selected && 'is-sel', choice.changed && 'is-changed')} onClick=${() => onPick(chess.chessId)}
      title=${`${chess.name} · ${skillRec?.name || ''}`}>
    <span class="lo-card__art">
      <${Img} src=${chessAvatarUrl(m, chess)} fallback=${html`<span class="lo-card__glyph">${[...(chess.name || '?')][0]}</span>`} />
    </span>
    <${TierChip} tier=${chess.tier} size="sm" class="lo-card__tier" />
    ${choice.changed ? html`<span class="lo-card__flag" aria-label="Изменено"></span>` : null}
    <span class="lo-card__name">${chess.name}</span>
    <span class="lo-card__kit">
      <span class=${cx('lo-card__sk', choice.skill !== opt.defaultSkill && 'is-alt')}>
        <${SkillIcon} m=${m} rec=${skillRec} index=${choice.skill} size="xs" />
        <b class="num">${skillLabel(choice.skill)}</b>
      </span>
      ${golden ? html`<span class=${cx('lo-card__mod', modChanged && 'is-alt')} title=${modRec ? `${modRec.typeName} ${modRec.name}` : 'Без модуля'}>
        ${choice.module === MODULE_NONE ? '—' : moduleBadge(modRec)}
      </span>` : null}
    </span>
  </button>`;
}

// ---- детали -------------------------------------------------------------------------------------------------------

function SkillOption({ m, opt, on, level, onPick }) {
  const rec = level === 'elite' ? opt.elite || opt.normal : opt.normal || opt.elite;
  const tags = skillTags(rec);
  return html`<button type="button" role="radio" aria-checked=${on ? 'true' : 'false'} class=${cx('lo-skill', on && 'is-on')}
      data-skill=${opt.index} onClick=${() => onPick(opt.index)}>
    ${on ? html`<span class="lo-skill__deco" aria-hidden="true"><${Img} src=${localAsset('ui/outer', 'skill_select_deco')} fallback=${html`<i></i>`} /></span>` : null}
    <${SkillIcon} m=${m} rec=${rec} index=${opt.index} on=${on} size="md" />
    <span class="lo-skill__body">
      <span class="lo-skill__head">
        <span class="lo-skill__slot num">${skillLabel(opt.index)}</span>
        <b class="lo-skill__name">${rec?.name || 'Неизвестный навык'}</b>
        ${opt.isDefault ? html`<span class="lo-badge lo-badge--def">По умолчанию</span>` : null}
        ${on ? html`<span class="lo-badge lo-badge--on"><${Icon} name="check" />Экипировано</span>` : null}
      </span>
      <span class="lo-skill__tags">
        <span class=${cx('lo-sp', `lo-sp--${tags.spKind}`)}>${tags.sp}</span>
        ${tags.init != null ? html`<span class="lo-tag">Начальные <b class="num">${tags.init}</b></span>` : null}
        ${tags.cost != null ? html`<span class="lo-tag">Затраты <b class="num">${tags.cost}</b></span>` : null}
        ${tags.duration ? html`<span class="lo-tag">Длительность <b class="num">${tags.duration}</b></span>` : null}
        ${tags.charges ? html`<span class="lo-tag">Заряды <b class="num">${tags.charges}</b></span>` : null}
      </span>
      <${RichText} as="span" class="lo-skill__desc" text=${rec?.descRaw || rec?.desc || ''} />
    </span>
  </button>`;
}

function ModuleInfo({ m, golden, opt }) {
  if (!golden) return null;
  const rec = opt.id === MODULE_NONE ? null : opt.rec;
  if (!rec) {
    const traitBase = golden.traitBase || null;
    return html`<div class="lo-minfo lo-minfo--none">
      <p class="lo-minfo__lead">Без модуля: элитный оперативник сражается с базовыми характеристиками, особенностью и талантами.</p>
      ${traitBase?.desc ? html`<div class="lo-minfo__row"><span class="lo-minfo__k"></span><${RichText} class="lo-minfo__v" text=${traitBase.descRaw || traitBase.desc} /></div>` : null}
    </div>`;
  }
  const rows = attrRows(rec.attr);
  const trait = rec.traitOverride;
  const traitText = trait ? (trait.moduleDescRaw || trait.moduleDesc || trait.descRaw || trait.desc) : null;
  const talents = (Array.isArray(rec.talentChanges) ? rec.talentChanges : []).filter((t) => t && (t.name || t.desc) && !t.hidden);
  return html`<div class="lo-minfo">
    <div class="lo-minfo__title"><${Img} src=${moduleIconOf(m, rec)} class="lo-minfo__icon" /><span class="lo-minfo__type num">${rec.typeName || ''}</span><b>${rec.name || rec.uniEquipId}</b>
      ${opt.isDefault ? html`<span class="lo-badge lo-badge--def">По умолчанию</span>` : null}</div>
    <div class="lo-minfo__row">
      <span class="lo-minfo__k"></span>
      <span class="lo-minfo__v lo-attrs">${rows.length ? rows.map((r) => html`<span key=${r.key} class=${cx('lo-attr', r.positive ? 'is-up' : 'is-down')}>${r.label}<b class="num">${r.text}</b></span>`) : html`<span class="t-dim">Нет бонусов к характеристикам</span>`}</span>
    </div>
    ${traitText ? html`<div class="lo-minfo__row"><span class="lo-minfo__k"></span><${RichText} class="lo-minfo__v" text=${traitText} /></div>` : null}
    ${talents.map((t, i) => html`<div key=${i} class="lo-minfo__row"><span class="lo-minfo__k">Талант</span>
      <span class="lo-minfo__v">${t.name ? html`<b class="lo-minfo__tname">${t.name}</b>` : null}<${RichText} text=${t.descRaw || t.desc || ''} /></span></div>`)}
  </div>`;
}

const getChessRec = (id) => data.lookup('chess', id);

/**
 * Что показывает «Боевые характеристики» (GitHub issue #64): вариант оперативника — элитная запись, когда запрошена и
 * у оперативника она есть, иначе обычная — как его делает сохранённая настройка. chessLoadout (ui/gameLogic.js)
 * разрешает навык и модуль так же, как карточка деталей в матче и симуляция (shared/loadoutRecord.js): характеристики /
 * особенность / таланты выбранного модуля элитной версии (без модуля: базовые), радиус пассивной атаки выбранного
 * навыка; у обычного оперативника нет модуля, навык не меняет его характеристики. Здесь ничего не пересчитывается.
 * @param {any} base обычная запись оперативника @param {any} golden его элитная запись или null
 * @param {Record<string, any>} entries сохранённая настройка @param {'normal'|'elite'} level
 * @param {(id: string) => any} getChess
 * @returns {{ elite: boolean, chess: any, lo: any, record: any, trait: string, talents: any[] } | null} null без записи
 */
export function statsPreview(base, golden, entries, level, getChess) {
  const elite = level === 'elite' && !!golden;
  const chess = elite ? golden : base;
  if (!chess) return null;
  const lo = chessLoadout(chess, entries, getChess);
  const record = lo?.record || chess;
  // (правило самой карточки: строка «Особенность» существует, когда она есть у оперативника; её текст следует за выбранным модулем)
  return { elite, chess, lo, record, trait: chess.trait?.desc ? traitText(chess, !!chess.isGolden, lo) || '' : '', talents: chessTalents(record) };
}

/**
 * «Боевые характеристики»: характеристики, радиус атаки, особенность и таланты выбранного оперативника под выбранным
 * навыком и модулем — блок характеристик карточки деталей (ui/detailPanel.js chessStatsBlock) без живых чисел, так
 * что игрок видит здесь то же, что показывают магазин / карточка на поле до боя (не изменения снаряжения, альянса или
 * применения навыка в идущем матче). Переключатель выбирает обычную или элитную запись; элитная — по умолчанию,
 * потому что модуль есть только там.
 * @param {{ base: any, golden: any, entries: Record<string, any>, level: 'normal'|'elite', onLevel: (l: 'normal'|'elite') => void, getChess?: (id: string) => any }} props
 */
export function LoadoutStats({ base, golden, entries, level, onLevel, getChess = getChessRec }) {
  const pv = statsPreview(base, golden, entries, level, getChess);
  if (!pv) return null;
  return html`<section class="lo-sec lo-sec--stats" aria-label="Боевые характеристики" data-variant=${pv.elite ? 'elite' : 'normal'}>
    <header class="lo-sec__head">
      <h3>Боевые характеристики<${MicroLabel}>STATS<//></h3>
      <div class="lo-seg" role="tablist" aria-label="Версия характеристик">
        <button type="button" role="tab" aria-selected=${pv.elite ? 'false' : 'true'} class=${cx(!pv.elite && 'is-on')} data-variant="normal" onClick=${() => onLevel('normal')}>Обычный</button>
        <button type="button" role="tab" aria-selected=${pv.elite ? 'true' : 'false'} class=${cx(pv.elite && 'is-on')} data-variant="elite" disabled=${!golden} onClick=${() => onLevel('elite')}>Элитный</button>
      </div>
    </header>
    ${chessStatsBlock({ rec: pv.record, chess: pv.chess })}
    ${pv.trait || pv.talents.length ? html`<div class="lo-minfo lo-minfo--kit">
      ${pv.trait ? html`<div class="lo-minfo__row"><span class="lo-minfo__k"></span><${RichText} class="lo-minfo__v" text=${pv.trait} /></div>` : null}
      ${pv.talents.map((t, i) => html`<div key=${i} class="lo-minfo__row"><span class="lo-minfo__k">Талант</span>
        <span class="lo-minfo__v"><b class="lo-minfo__tname">${t.name}</b><${RichText} text=${t.descRaw || t.desc || ''} /></span></div>`)}
    </div>` : null}
    <p class="lo-stats__cap">${pv.elite ? 'Характеристики с выбранным модулем; ' : golden ? 'У обычного оперативника нет модулей, выбранный модуль действует у «Элитного»; ' : ''}без учёта активации навыков, снаряжения, альянсов и прочих боевых бонусов</p>
  </section>`;
}

function Detail({ m, chess, golden, entries, onChange, onReset, locked }) {
  const [level, setLevel] = useState('normal');
  const [statLevel, setStatLevel] = useState('elite'); // боевые характеристики: элитный показывает эффект выбранного модуля
  const bodyRef = useRef(null);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [chess?.chessId]);
  if (!chess) return html`<aside class="lo-detail lo-detail--empty"><p class="t-dim">Нет подходящих оперативников</p></aside>`;
  const opt = chessOptions(chess, golden);
  const choice = effectiveChoice(entries, chess, golden);
  const modOpt = opt.moduleOptions.find((x) => x.id === choice.module) || null;
  const lv = (c) => c?.status?.skillLevel ?? '—';
  return html`<aside class="lo-detail" aria-label=${`${chess.name} настройка`}>
    <div class="lo-dhead">
      <div class=${cx('lo-dhead__art', `lo-dhead__art--t${chess.tier}`)}>
        <${Img} src=${chessPortraitUrl(m, golden || chess)} fallback=${html`<${UnitThumb} kind="chess" id=${chess.chessId} size="lg" />`} />
      </div>
      <div class="lo-dhead__info">
        <div class="lo-dhead__chips"><${TierChip} tier=${chess.tier} size="md" />
          ${choice.changed ? html`<span class="lo-badge lo-badge--changed">Изменено</span>` : html`<span class="lo-badge lo-badge--plain">По умолчанию</span>`}</div>
        <h2 class="lo-dhead__name">${chess.name}</h2>
        <span class="lo-dhead__en">${chess.appellation || ''}</span>
        <span class="lo-dhead__class">
          <${Img} src=${profGlyphUrl(m, chess.profession)} class="lo-dhead__prof lo-profglyph" />${PROF_NAME[chess.profession] || ''}
          <i class="lo-sep"></i><${Img} src=${subProfIconUrl(m, chess)} class="lo-dhead__prof" />${chess.subProfessionName || ''}
        </span>
        <span class="lo-dhead__bonds">${(chess.bonds || []).map((b) => html`<span key=${b} class="lo-bond">
          <${Img} src=${bondIconUrl(m, b)} class="lo-bond__icon" fallback=${html`<i class="lo-bond__dot"></i>`} />${data.lookup('bonds', b)?.name || b}</span>`)}</span>
      </div>
      <${Button} variant="ghost" size="sm" icon="refresh" class="lo-dhead__reset" disabled=${!choice.changed} onClick=${onReset}>Восстановить по умолчанию<//>
    </div>
    <div class="lo-detail__body" ref=${bodyRef}>
      <section class="lo-sec">
        <header class="lo-sec__head">
          <h3>Навыки<${MicroLabel}>SKILL<//></h3>
          <div class="lo-seg" role="tablist" aria-label="Уровень навыка">
            <button type="button" role="tab" aria-selected=${level === 'normal' ? 'true' : 'false'} class=${cx(level === 'normal' && 'is-on')} onClick=${() => setLevel('normal')}>Обычный <span class="num">Lv.${lv(chess)}</span></button>
            <button type="button" role="tab" aria-selected=${level === 'elite' ? 'true' : 'false'} class=${cx(level === 'elite' && 'is-on')} disabled=${!golden} onClick=${() => setLevel('elite')}>Элитный <span class="num">Lv.${lv(golden)}</span></button>
          </div>
        </header>
        <div class="lo-skills" role="radiogroup" aria-label="Выбор навыка">
          ${opt.skillOptions.map((s) => html`<${SkillOption} key=${s.index} m=${m} opt=${s} level=${level} on=${s.index === choice.skill}
            onPick=${(i) => onChange({ skill: i })} />`)}
        </div>
      </section>
      <${LoadoutStats} base=${chess} golden=${golden} entries=${entries} level=${statLevel} onLevel=${setStatLevel} />
      ${golden ? html`<section class="lo-sec lo-sec--mod">
        <header class="lo-sec__head">
          <h3>Модули<${MicroLabel}>MODULE<//></h3>
          <span class="lo-sec__note">Только у элитных оперативников · Уровень модуля <b class="num">${golden.status?.equipLevel ?? 1}</b></span>
        </header>
        <div class="lo-mods" role="radiogroup" aria-label="Выбор модуля">
          ${opt.moduleOptions.map((mo) => html`<button key=${mo.id} type="button" role="radio" aria-checked=${mo.id === choice.module ? 'true' : 'false'}
              data-module=${mo.id} class=${cx('lo-mod', mo.id === choice.module && 'is-on', mo.id === MODULE_NONE && 'lo-mod--none')}
              onClick=${() => onChange({ module: mo.id })}>
            <${ModuleGlyph} m=${m} rec=${mo.rec} id=${mo.id} />
            <span class="lo-mod__text">
              <span class="lo-mod__type num">${mo.id === MODULE_NONE ? 'НЕТ' : mo.rec?.typeName || ''}</span>
              <b class="lo-mod__name">${mo.id === MODULE_NONE ? 'Без модуля' : mo.rec?.name || mo.id}</b>
            </span>
            ${mo.isDefault ? html`<span class="lo-badge lo-badge--def lo-mod__def">По умолчанию</span>` : null}
          </button>`)}
        </div>
        ${modOpt ? html`<${ModuleInfo} m=${m} golden=${golden} opt=${modOpt} />` : null}
      </section>` : null}
      ${locked ? html`<p class="lo-locknote"><${Icon} name="info" />Настройки этого матча заблокированы, изменения вступят в силу в следующем матче</p>` : null}
    </div>
  </aside>`;
}

// ---- фильтры -------------------------------------------------------------------------------------------------------

function Filters({ m, filters, onFilters, bonds }) {
  const set = (patch) => onFilters({ ...filters, ...patch });
  return html`<div class="lo-filters">
    <div class="lo-frow">
      <div class="lo-chips" role="group" aria-label="Ранг">
        <button type="button" class=${cx('lo-chip', !filters.tier && 'is-on')} onClick=${() => set({ tier: null })}>Все</button>
        ${[1, 2, 3, 4, 5, 6].map((t) => html`<button key=${t} type="button" class=${cx('lo-chip', 'lo-chip--tier', `lo-chip--t${t}`, filters.tier === t && 'is-on')}
          aria-pressed=${filters.tier === t ? 'true' : 'false'} title=${`Ранг ${ROMAN[t]}`} onClick=${() => set({ tier: filters.tier === t ? null : t })}><span class="num">${ROMAN[t]}</span></button>`)}
      </div>
      <${TextField} size="sm" icon="search" value=${filters.query} placeholder="Поиск оперативника / класса / альянса" class="lo-search"
        onInput=${(v) => set({ query: String(v).slice(0, 24) })} />
    </div>
    <div class="lo-frow">
      <div class="lo-chips lo-chips--prof" role="group" aria-label="Класс">
        ${PROF_ORDER.map((p) => html`<button key=${p} type="button" class=${cx('lo-chip', 'lo-chip--prof', filters.prof === p && 'is-on')}
          aria-pressed=${filters.prof === p ? 'true' : 'false'} title=${PROF_NAME[p]} onClick=${() => set({ prof: filters.prof === p ? null : p })}>
          <${Img} src=${profGlyphUrl(m, p)} class="lo-chip__icon lo-profglyph" fallback=${html`<span>${PROF_NAME[p][0]}</span>`} /><span class="lo-chip__lbl">${PROF_NAME[p]}</span></button>`)}
      </div>
      <label class="lo-select">
        <span class="lo-select__k">Альянс</span>
        <select value=${filters.bond || ''} onChange=${(e) => set({ bond: e.currentTarget.value || null })} aria-label="Фильтр по альянсу">
          <option value="">Все альянсы</option>
          ${bonds.map((b) => html`<option key=${b.bondId} value=${b.bondId}>${b.name}</option>`)}
        </select>
      </label>
      <button type="button" class=${cx('lo-toggle', filters.changedOnly && 'is-on')} aria-pressed=${filters.changedOnly ? 'true' : 'false'}
        onClick=${() => set({ changedOnly: !filters.changedOnly })}><i class="lo-toggle__box"><${Icon} name="check" /></i>Только изменённые</button>
    </div>
  </div>`;
}

// ---- экран ---------------------------------------------------------------------------------------------------------

const SYNC_TEXT = {
  idle: ['', ''], pending: ['Сохранение…', 'is-busy'], sending: ['Синхронизация…', 'is-busy'], synced: ['Синхронизировано', 'is-ok'],
  locked: ['Матч заблокирован · Следующий матч', 'is-warn'], error: ['Ошибка синхронизации', 'is-bad'],
};

/** Экран оверлея. */
function LoadoutScreen({ st }) {
  const ready = useData('chess', 'bonds', 'assets', 'local');
  const phase = useStore((s) => s.match?.public?.phase || null);
  const inMatch = useStore((s) => !!s.room?.inMatch);
  // брифинг кооператива (INFO_CHECK, 25 с): оверлей перекрывает собственный отсчёт брифинга, поэтому показывает
  // оставшееся время — матч блокирует настройку по его истечении (ревью-фикс: правки молча применялись только к следующему матчу)
  const infoDeadline = useStore((s) => (s.match?.public?.phase === PHASE.INFO_CHECK ? s.match.public.deadline : 0));
  const m = data.get('assets');
  const getChess = (id) => data.lookup('chess', id);
  const getBond = (id) => data.lookup('bonds', id);
  const roster = useMemo(() => rosterOf(data.list('chess')), [ready]);
  const bonds = useMemo(() => {
    const used = new Set(roster.flatMap((c) => c.bonds || []));
    return (data.list('bonds') || []).filter((b) => b && used.has(b.bondId))
      .sort((a, b) => (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0) || (a.bondOrder ?? 0) - (b.bondOrder ?? 0) || String(a.name).localeCompare(String(b.name), 'zh'));
  }, [ready, roster]);
  const list = filterRoster(roster, st.filters, st.entries, getChess, getBond);
  const selId = st.sel && roster.some((c) => c.chessId === st.sel) ? st.sel : list[0]?.chessId || roster[0]?.chessId || null;
  const { base, golden } = selId ? recordsOf(selId, getChess) : { base: null, golden: null };
  const nChanged = changedCount(st.entries, getChess);
  const locked = (inMatch && phase && phase !== PHASE.INFO_CHECK && phase !== PHASE.LOBBY) || st.sync === 'locked';
  const gridRef = useRef(null);
  const [narrowDetail, setNarrowDetail] = useState(false); // телефоны: деталь скользит поверх ростера

  const pick = (id) => { loadoutStore.set({ sel: id }); setNarrowDetail(true); };
  const change = (patch) => { if (base) setEntries(setChoice(loadoutStore.get().entries, base, golden, patch)); };
  const resetOne = () => { if (base) setEntries(resetChoice(loadoutStore.get().entries, base.chessId)); };
  const resetAll = async () => {
    if (!nChanged) return;
    const ok = await confirmDialog({ title: 'Восстановить всё', text: `Восстановить настройки навыков и модулей ${nChanged} оперативников по умолчанию?`, okText: 'Восстановить', danger: true });
    if (ok) setEntries({});
  };

  // Esc закрывает; ←/→ листают отфильтрованный ростер (не во время ввода в поле поиска)
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.modal')) return; // диалог подтверждения обрабатывает свои клавиши
      const typing = e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeLoadout(); return; }
      if (typing) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const ids = filterRoster(rosterOf(data.list('chess')), loadoutStore.get().filters, loadoutStore.get().entries, getChess, getBond).map((c) => c.chessId);
        if (!ids.length) return;
        const cur = Math.max(0, ids.indexOf(loadoutStore.get().sel));
        const next = ids[(cur + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
        loadoutStore.set({ sel: next });
        e.preventDefault();
      }
      // проглатываем односимвольные игровые горячие клавиши (R / F / D / Space …), пока оверлей открыт
      if (e.key.length === 1 || e.key === ' ') { e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // удерживаем выбранную карточку в поле зрения
  useEffect(() => {
    const el = gridRef.current?.querySelector(`[data-chess="${selId}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [selId]);

  const [syncText, syncCls] = SYNC_TEXT[st.sync] || SYNC_TEXT.idle;
  const fromText = st.from === 'briefing' ? 'Настройки текущего матча можно изменить до окончания фазы подтверждения информации' : 'Перед началом симуляции можно настроить навыки и модули оперативников; их уровень изменить нельзя';

  return html`<div class="lo" role="dialog" aria-modal="true" aria-label="Настройка оперативников">
    <div class="lo__bg" aria-hidden="true"></div>
    <header class="lo-top">
      <div class="lo-top__left">
        <${Button} variant="ghost" size="md" icon="chevronLeft" class="lo-back" onClick=${closeLoadout} aria-label="Назад" title="Назад (Esc)">Назад<//>
      </div>
      <div class="lo-top__center">
        <${MicroLabel} tone="mint">OPERATOR LOADOUT<//>
        <h1 class="lo-top__title"><${Img} src=${localAsset('ui/outer', 'operator_preset')} class="lo-top__icon" fallback=${html`<${Icon} name="edit" class="lo-top__icon" />`} />Настройка оперативников</h1>
      </div>
      <div class="lo-top__right">
        ${inMatch && hasDeadline(infoDeadline) ? html`<${Countdown} deadline=${infoDeadline} size="sm" gauge=${false} label="До конца настройки" class="lo-deadline" />` : null}
        ${syncText ? html`<span class=${cx('lo-sync', syncCls)} role="status">${syncText}</span>` : null}
        <span class="lo-count">Изменено <b class="num">${nChanged}</b><span class="num t-dim">/${roster.length}</span></span>
        <${Button} variant="secondary" size="sm" icon="refresh" disabled=${!nChanged} onClick=${resetAll}>Восстановить всё<//>
      </div>
    </header>
    <p class=${cx('lo-note', locked && 'is-locked')}><${Icon} name="info" />${locked ? 'Настройки этого матча заблокированы (после подтверждения информации изменение невозможно), изменения вступят в силу в следующем матче' : fromText}</p>
    ${!ready ? html`<div class="lo-loading"><${Spinner} size="sm" />Загрузка данных оперативников (загружается один раз при открытии страницы)…</div>` : html`<main class=${cx('lo-body', narrowDetail && 'is-detail')}>
      <section class="lo-roster">
        <${Filters} m=${m} filters=${st.filters} bonds=${bonds} onFilters=${(filters) => loadoutStore.set({ filters })} />
        <div class="lo-grid" role="listbox" aria-label="Список оперативников" ref=${gridRef}>
          ${list.length ? list.map((c) => html`<${RosterCard} key=${c.chessId} m=${m} chess=${c} golden=${c.goldenId ? getChess(c.goldenId) : null}
            entries=${st.entries} selected=${c.chessId === selId} onPick=${pick} />`) : html`<p class="lo-empty t-dim">Нет подходящих оперативников</p>`}
        </div>
      </section>
      <div class="lo-detail-wrap">
        <button type="button" class="lo-detail-back tapx" onClick=${() => setNarrowDetail(false)}><${Icon} name="chevronLeft" />Список оперативников</button>
        <${Detail} m=${m} chess=${base} golden=${golden} entries=${st.entries} onChange=${change} onReset=${resetOne} locked=${locked} />
      </div>
    </main>`}
  </div>`;
}

/**
 * Должен ли оверлей закрыться, потому что его контекст сменился: открытый из брифинга и матч покинул INFO_CHECK
 * (черновику стратегий нужен игрок), или открытый из лобби / комнаты и матч начался (брифинг берёт верх).
 * @param {{ open: boolean, from: string|null }} st @param {string|null} phase @param {boolean} inMatch @param {boolean} wasInMatch
 */
export function shouldAutoClose(st, phase, inMatch, wasInMatch) {
  if (!st || !st.open) return false;
  if (st.from === 'briefing') return !!phase && phase !== PHASE.INFO_CHECK;
  return inMatch && !wasInMatch;
}

/** Монтируется один раз (main.js): рендерит оверлей, пока он открыт. */
export function LoadoutHost() {
  const st = useStore((s) => s, Object.is, loadoutStore);
  const phase = useStore((s) => s.match?.public?.phase || null);
  const inMatch = useStore((s) => !!s.room?.inMatch);
  const wasInMatch = useRef(inMatch);
  useEffect(() => {
    if (shouldAutoClose(st, phase, inMatch, wasInMatch.current)) closeLoadout();
    wasInMatch.current = inMatch;
  }, [phase, inMatch, st.open]);
  useEffect(() => {
    if (st.open) document.documentElement.classList.add('sp-loadout-open');
    else document.documentElement.classList.remove('sp-loadout-open');
  }, [st.open]);
  if (!st.open) return null;
  return html`<${LoadoutScreen} st=${st} />`;
}

/**
 * Значок кнопки входа: то же число, что и «Изменено N» на экране (сохранённая запись оперативника, которого больше нет
 * в данных, никогда не применяется), как только chess.json загружен; до этого — сохранённые записи (только значок не
 * должен вызывать загрузку 1,6 МБ). Ревью-фикс: он считал устаревшие записи, которые экран не считает.
 * @param {Record<string, any>} entries @param {((id: string) => any) | null} getChess null, пока chess.json не загружен
 */
export function badgeCount(entries, getChess) {
  return getChess ? changedCount(entries, getChess) : Object.keys(entries || {}).length;
}

/**
 * Кнопка входа (лобби / комната / брифинг).
 * @param {{ from: 'lobby'|'room'|'briefing', size?: string, variant?: string, class?: string, label?: string }} props
 */
export function LoadoutButton({ from, size = 'md', variant = 'secondary', class: cls, label = 'Настройка оперативников' }) {
  useData('local'); // официальная иконка пресета (перерисовка после появления манифеста локального арта)
  const entries = useStore((s) => s.entries, Object.is, loadoutStore);
  const n = badgeCount(entries, data.status('chess') === 'ready' ? (id) => data.lookup('chess', id) : null);
  return html`<button type="button" class=${cx('btn', `btn--${variant}`, `btn--${size}`, 'lo-entry', cls)} data-testid="loadout-open"
      onClick=${() => openLoadout(from)} title="Настроить навыки и модули оперативников">
    <${Img} src=${localAsset('ui/outer', 'operator_preset')} class="lo-entry__icon" fallback=${html`<${Icon} name="edit" class="btn__icon" />`} />
    <span class="btn__label">${label}</span>
    ${n ? html`<span class="lo-entry__n num" aria-label=${`${n} оперативников изменено`}>${n}</span>` : null}
  </button>`;
}