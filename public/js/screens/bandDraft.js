// Band draft — BAND_DRAFT «2/2 Выбор стратегии» (research 06 §4.2, D1): слева — порядок ходов (аватар, имя, состояние:
// … ожидает / ⌛ выбирает / стратегия выбрана ✓), текущий выбирающий подсвечен; в центре — сетка всех стратегий,
// разрешённых для типа режима (иконка, имя, ЖЦ); стратегия, уже выбранная союзником, несёт аватар выбравшего и помечена
// «Выбрано союзником» — её нельзя выбрать повторно (research 09 §5, guidebook «Стратегии и поочерёдный выбор»; сервер тоже
// откажет); справа — панель подробностей (иконка, начальный запас жизней, имя, название эффекта + форматированное описание),
// с кнопками «Пропустить» (совместная игра, один раз) и «Подтвердить выбор».
// Один отсчёт (user playtest #4 item 4): у каждого хода одни и те же часы (Match BAND_TURN_SECONDS, m.public.draft
// turnSeconds), и шапка шага ведёт обратный отсчёт — m.public.deadline И ЕСТЬ конец хода, то же число, что и в строке текущего
// выбирающего. Подсвеченная стратегия (та, что в панели подробностей) — это то, что получает ход, истёкший по времени: каждое её
// изменение сообщается на сервер (g.bandFocus), и сервер назначает её, если она свободна, иначе «Хуа Фалинь», иначе первую
// свободную стратегию (timeoutBand). Выбор начинается с этого значения по умолчанию, поэтому подсказка под списком ходов
// всегда называет то, что даст таймаут.
// Одиночная игра и совместный матч с одним человеком (серверный soloUntimed: draft.untimed): часов вообще нет.
// Стратегия, построенная вокруг альянса, который режим отключает (bands.json bondIds ∩ неактивные альянсы режима — «Стандарт»:
// 潘格尼尼 → 拉特兰, 克莱门莎 → 阿戈尔, 玛恩纳 → 卡西米尔; бот такую никогда не берёт), несёт метку «Отключено в этом матче» на карточке
// и в панели подробностей (BandOffTag / BandOffNote, DESIGN §21.26, внешний вид §21.7); она остаётся выбираемой — только для информации.
// «Информация о матче» (GitHub issue #8 item 1, «при выборе стратегии нельзя вернуться и посмотреть запрещённых операторов и альянсы»):
// «Посмотреть отключённые альянсы и операторов» под списком ходов снова открывает строки альянсов, легенду и «Запрещённых операторов матча»
// из брифинга, только для чтения (ui/matchInfo.js MatchInfoDialog — те же самые блоки, что и в брифинге). Черновик при этом продолжает
// работать: его строка состояния повторяет текущий ход и отсчёт (draftInfoStatus), смена хода (выбор, пропуск, истёкший ход,
// выбор AI) закрывает диалог, конец черновика его размонтирует, и он никогда не касается подсвеченной стратегии или кнопок.

import { useEffect, useMemo, useRef, useState } from '../../vendor/hooks.module.js';
import { html, Button, Icon, MicroLabel, useTicker, secondsLeft } from '../ui/components.js';
import { useGameData, BandIcon, RichText, PlayerAvatar, LpTower, Sprite } from '../ui/gameComponents.js';
import { StepHeader, ExitModal } from '../ui/matchChrome.js';
import { MatchInfoDialog, matchInfoModel } from '../ui/matchInfo.js';
import { actions, act } from '../ui/gameActions.js';
import { normalizeDraft, sortedPlayers } from '../ui/gameLogic.js';
import { useStore } from '../store.js';
import { audio } from '../audio.js';
import { modeOffBonds, bandOffBonds, bandOffLine } from '../ui/gameLogic.js';

const cx = (...p) => p.flat().filter(Boolean).join(' ');

/** «Отключено в этом матче» на карточке стратегии, чьи альянсы `names` отключены режимом (bandOffBonds); иначе — ничего. */
export function BandOffTag({ names = [] }) {
  return names.length ? html`<span class="dband__off" title=${bandOffLine(names)}>Отключено в этом матче</span>` : null;
}

/** Пояснение в панели подробностей для такой стратегии: «В этом матче отключён альянс «Латеран», эффект стратегии может не сработать» (названия альянсов зачёркнуты). */
export function BandOffNote({ names = [] }) {
  if (!names.length) return null;
  return html`<p class="draft-detail__off" role="note" aria-label=${bandOffLine(names)}><${Icon} name="info" /><span>В этом матче отключён альянс ${names.map((n, i) => html`<span key=${i}>«<s class="draft-detail__offname">${n}</s>»</span>`)}: эффект стратегии может не сработать</span></p>`;
}

/**
 * Стратегии, доступные в режиме (modeTypeList содержит тип режима), отсортированные по sortId.
 * @param {any[]} bands
 * @param {string|null} modeType 'SINGLE'|'MULTI'
 */
export function allowedBands(bands, modeType) {
  const sid = (b) => (Number.isFinite(b.sortId) ? b.sortId : 99);
  return (Array.isArray(bands) ? bands : [])
    .filter((b) => b && (!modeType || !Array.isArray(b.modeTypeList) || b.modeTypeList.includes(modeType)))
    .sort((a, b) => sid(a) - sid(b) || (a.bandId < b.bandId ? -1 : a.bandId > b.bandId ? 1 : 0));
}

/** Официальная стратегия по умолчанию для автоматического выбора (data/config.json bandDraft.timeoutBandId). */
export const DEFAULT_TIMEOUT_BAND = 'band_bldsk';

/**
 * Стратегия, которую сервер назначает мне, когда мой ход истекает по времени (server/match/Match.js defaultBand): официальное значение
 * по умолчанию «Хуа Фалинь», пока её не занял союзник, иначе первая свободная стратегия в порядке черновика (sortId) — никогда та,
 * которую уже выбрал союзник («Выбрано союзником»).
 * @param {any[]} bands allowedBands(...) (порядок sortId)
 * @param {Map<string, any>} taken teammateBands(...)
 * @param {string} [defaultId]
 * @returns {string|null}
 */
export function timeoutBand(bands, taken, defaultId = DEFAULT_TIMEOUT_BAND) {
  const list = Array.isArray(bands) ? bands : [];
  const has = (id) => !!(taken && typeof taken.has === 'function' && taken.has(id));
  if (defaultId && !has(defaultId) && (!list.length || list.some((b) => b.bandId === defaultId))) return defaultId;
  return list.find((b) => !has(b.bandId))?.bandId || defaultId || null;
}

/**
 * Стратегии, взятые союзниками («Выбрано союзником»): bandId → выбравшие игроки (никогда не сам зритель).
 * @param {Map<string, string>} picks normalizeDraft(...).picks (playerId → bandId)
 * @param {string} myId
 */
export function teammateBands(picks, myId) {
  const out = new Map();
  for (const [pid, bid] of picks instanceof Map ? picks : []) {
    if (pid === myId || typeof bid !== 'string') continue;
    if (!out.has(bid)) out.set(bid, []);
    out.get(bid).push(pid);
  }
  return out;
}

/**
 * Стратегия, которую показывает панель подробностей (= подсвеченная стратегия, которую возьмёт истёкший ход): текущая, иначе мой
 * выбор, иначе та, что даст таймаут (timeoutBand: «Хуа Фалинь», пока свободна, иначе первая свободная). Когда наступает мой ход, а
 * показанная стратегия уже занята («Выбрано союзником»), берём то же значение по умолчанию (иначе подтверждение было бы заблокировано).
 * @param {string|null} sel
 * @param {{ bands: any[], taken: Map<string, any>, myPick: string|null, myTurn: boolean, defaultId?: string }} o
 */
export function draftSelection(sel, { bands, taken, myPick, myTurn, defaultId = DEFAULT_TIMEOUT_BAND }) {
  if (!Array.isArray(bands) || !bands.length) return sel;
  const free = timeoutBand(bands, taken, defaultId) || bands[0].bandId;
  if (!sel) return myPick || free;
  if (!myPick && myTurn && taken.has(sel)) return free;
  return sel;
}

/**
 * Стратегия, которую истёкший ход назначает мне (server Match.timeoutBand): подсвеченная, пока она принадлежит режиму и её
 * не занял союзник, иначе timeoutBand. Null после моего выбора.
 * @param {string|null} sel подсвеченная стратегия
 * @param {{ bands: any[], taken: Map<string, any>, myPick?: string|null, defaultId?: string }} o
 */
export function autoPickBand(sel, { bands, taken, myPick = null, defaultId = DEFAULT_TIMEOUT_BAND }) {
  if (myPick) return null;
  const list = Array.isArray(bands) ? bands : [];
  const has = (id) => !!(taken && typeof taken.has === 'function' && taken.has(id));
  if (sel && !has(sel) && list.some((b) => b.bandId === sel)) return sel;
  return timeoutBand(list, taken, defaultId);
}

/**
 * Подсказка под списком ходов в совместной игре: один пропуск, часы хода и то, что истёкший ход назначит мне (подсвеченная
 * стратегия, пока свободна — autoPickBand). В черновике без ограничения времени (один человек) часы не называются.
 * @param {{ timed: boolean, turnSeconds?: number|null, autoName?: string|null, selected?: boolean }} o
 *   selected: автовыбор — это подсвеченная стратегия (а не значение по умолчанию вместо стратегии, которую занял союзник)
 */
export function draftTip({ timed, turnSeconds = null, autoName = null, selected = true }) {
  const skip = 'В совместной симуляции можно один раз пропустить выбор стратегии';
  if (!timed) return `${skip}; матч без ограничения времени`;
  const clock = Number(turnSeconds) > 0 ? `у каждого Доктора ${Math.round(turnSeconds)} сек.` : 'у каждого Доктора ограниченное время';
  if (!autoName) return `${skip}; ${clock}`;
  return `${skip}; ${clock}, при истечении автоматически выберется${selected ? ' текущая' : ''} «${autoName}»`;
}

/**
 * Отсчёт в шапке шага во время черновика: отсчёт текущего хода (m.public.deadline = draft.turnDeadline) с длительностью хода как
 * шкалой — null, когда черновик без ограничения времени.
 * @param {any} pub m.public
 * @returns {{ deadline: number, total: number|null } | null}
 */
export function draftClock(pub) {
  const d = pub && typeof pub.draft === 'object' ? pub.draft : null;
  if (!d || d.untimed) return null;
  const deadline = Number(pub.deadline) > 0 ? Number(pub.deadline) : Number(d.turnDeadline) || 0;
  if (!(deadline > 0)) return null;
  return { deadline, total: Number(d.turnSeconds) > 0 ? Number(d.turnSeconds) : null };
}

/**
 * Строка состояния диалога «Информация о матче»: что делает черновик, пока диалог его закрывает — мой выбор, иначе чей сейчас
 * ход и сколько секунд осталось (число из шапки шага; нет — когда без ограничения времени), предупреждение при ≤ 10 сек., как у отсчёта.
 * @param {{ myPick?: string|null, pickName?: string|null, myTurn: boolean, turnName?: string|null, secs?: number|null,
 *   waiting?: boolean }} o waiting: союзникам ещё предстоит выбор после моего
 * @returns {{ text: string, secs: number|null, tone: 'mint'|'gold'|'warn'|'dim' }}
 */
export function draftInfoStatus({ myPick = null, pickName = null, myTurn, turnName = null, secs = null, waiting = false }) {
  if (myPick) return { text: `Выбрано «${pickName || ''}»${waiting ? ', ждём остальных Докторов' : ''}`, secs: null, tone: 'mint' };
  const s = Number.isFinite(secs) ? Math.max(0, Math.round(secs)) : null;
  const tone = s != null && s <= 10 ? 'warn' : 'gold';
  if (myTurn) return { text: 'Ваш ход', secs: s, tone };
  return { text: turnName ? `Ход ${turnName}` : 'Ожидание своего хода', secs: s, tone: s != null ? tone : 'dim' };
}

/** Экран BAND_DRAFT. */
export function BandDraftScreen() {
  const pub = useStore((s) => s.match.public);
  const priv = useStore((s) => s.match.private);
  const myId = useStore((s) => s.me.playerId);
  const roomSolo = useStore((s) => s.room?.mode === 'solo');
  const gd = useGameData();
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(null);
  const [exit, setExit] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const mode = gd.config?.modes?.[pub?.modeId];
  const offBonds = modeOffBonds(mode); // альянсы, которые этот режим никогда не активирует («Стандарт»: 10 из 23)
  const solo = roomSolo || mode?.type === 'SINGLE' || String(pub?.modeId || '').includes('single');
  const bands = useMemo(() => allowedBands(gd.list('bands'), mode?.type || (solo ? 'SINGLE' : 'MULTI')), [gd.ready, mode?.type, solo]);
  const players = sortedPlayers(pub);
  const draft = normalizeDraft(pub?.draft, players);
  const myPick = draft.picks.get(myId) || priv?.bandId || null;
  const myTurn = !myPick && (solo || draft.turnPid === myId);
  const skipsLeft = draft.skipsLeft.has(myId) ? draft.skipsLeft.get(myId) : (skipped ? 0 : 1);
  const canSkip = !solo && myTurn && skipsLeft > 0 && draft.order.length > 1;
  const taken = solo ? new Map() : teammateBands(draft.picks, myId);
  const pickers = new Map(); // bandId → игроки
  for (const [pid, bid] of draft.picks) {
    const p = players.find((x) => x.playerId === pid);
    if (!pickers.has(bid)) pickers.set(bid, []);
    pickers.get(bid).push(p || { playerId: pid, name: '?' });
  }

  // выбор по умолчанию: мой, иначе то, что даст таймаут («Хуа Фалинь», пока свободна); когда мой ход приходит, а выбранная
  // стратегия уже занята союзником («Выбрано союзником»), выбор возвращается к этому значению по умолчанию
  const defaultId = gd.config?.bandDraft?.timeoutBandId || DEFAULT_TIMEOUT_BAND;
  const takenKey = [...taken.keys()].sort().join(',');
  useEffect(() => {
    const next = draftSelection(sel, { bands, taken, myPick, myTurn, defaultId });
    if (next !== sel) setSel(next);
  }, [bands.length, myPick, myTurn, takenKey]);
  // сигнал «ваш ход»
  useEffect(() => { if (myTurn && !solo) audio.sfx('yourTurn'); }, [myTurn]);
  // диалог «Информация о матче» не переживает ход, в котором был открыт: смена хода (выбор, пропуск, истёкший ход, выбор AI)
  // или мой выбор закрывает его, чтобы тот, чей ход начинается, видел черновик
  const turnKey = `${draft.turnPid || ''}|${myPick || ''}`;
  useEffect(() => { setInfoOpen(false); }, [turnKey]);

  // один отсчёт (user playtest #4 item 4): текущего хода — m.public.deadline, те же часы, что и в строке текущего выбирающего
  const clock = solo ? null : draftClock(pub);
  // подсвеченная стратегия — то, что возьмёт истёкший ход (Match.timeoutBand): сообщаем о каждом изменении до моего выбора
  const timed = !solo && !!pub?.draft && !pub.draft.untimed;
  const focusSent = useRef(null);
  useEffect(() => {
    if (!timed || myPick || !sel || focusSent.current === sel) return;
    focusSent.current = sel;
    act('g.bandFocus', { bandId: sel }, { sfx: false, quiet: true });
  }, [sel, timed, myPick]);

  // что даст таймаут: подсвеченная стратегия, пока свободна, иначе значение по умолчанию (никогда «Выбрано союзником» — Match.js timeoutBand)
  const autoId = autoPickBand(sel, { bands, taken, myPick, defaultId });
  const autoName = (autoId && gd.band(autoId)?.name) || gd.band(defaultId)?.name || 'Хуа Фалинь';

  const band = sel ? gd.band(sel) : null;
  const selTaken = !!band && taken.has(band.bandId);
  const confirm = async () => {
    if (!band || busy || !myTurn || selTaken) return;
    setBusy('pick');
    await actions.band(band.bandId);
    setBusy(null);
  };
  const skip = async () => {
    if (busy || !canSkip) return;
    setBusy('skip');
    if (await actions.bandSkip()) setSkipped(true);
    setBusy(null);
  };
  const turnName = players.find((p) => p.playerId === draft.turnPid)?.name;
  useTicker(clock ? 250 : 0);
  // в строке текущего выбирающего показывается то же число, что и в шапке шага (оба читают один и тот же дедлайн хода)
  const turnSecs = clock ? secondsLeft(clock.deadline) : null;
  const turnLen = Number(pub?.draft?.turnSeconds) > 0 ? Math.round(pub.draft.turnSeconds) : null;
  // «Информация о матче»: блоки брифинга (строятся, только пока диалог открыт) и состояние черновика под ним
  const info = infoOpen ? matchInfoModel(pub, { bonds: gd.list('bonds'), chess: gd.chess, mode }) : null;
  const infoStatus = infoOpen ? draftInfoStatus({ myPick, pickName: myPick ? gd.band(myPick)?.name : null, myTurn, turnName, secs: turnSecs,
    waiting: !solo && !draft.done }) : null;

  return html`<div class="screen draft">
    <div class="brief__bg" aria-hidden="true"></div>
    <${StepHeader} step=${2} of=${2} title="Выбор стратегии" micro="STRATEGY // BAND CHECK" pub=${clock ? { ...pub, deadline: clock.deadline } : { ...pub, deadline: 0 }}
      total=${clock ? clock.total : null} onExit=${() => setExit(true)} />
    <main class="draft__main">
      <aside class="draft-order">
        <h3 class="brief-h"><span>${solo ? 'Одиночная симуляция' : 'Порядок ходов'}</span><${MicroLabel}>${solo ? 'FREE PICK' : 'RANDOM ORDER'}</${MicroLabel}></h3>
        ${(solo ? players.filter((p) => p.playerId === myId) : draft.order.map((pid) => players.find((p) => p.playerId === pid)).filter(Boolean)).map((p, i) => {
          const picked = draft.picks.get(p.playerId) || (p.playerId === myId ? myPick : p.bandId) || null;
          const cur = !picked && (solo || draft.turnPid === p.playerId);
          const pband = picked ? gd.band(picked) : null;
          return html`<div key=${p.playerId} class=${cx('dorder', cur && 'is-cur', picked && 'is-done', p.playerId === myId && 'is-self')}>
            ${!solo ? html`<span class="dorder__idx num">${i + 1}</span>` : null}
            <${PlayerAvatar} player=${p} self=${p.playerId === myId} />
            <div class="dorder__text">
              <b class="dorder__name">${p.name || 'Доктор'}${p.isBot ? html`<span class="dorder__ai">AI</span>` : null}</b>
              <span class="dorder__state">${picked ? html`<span class="t-mint">${pband?.name || 'Выбрано'}</span>`
                : cur ? html`<span class="t-gold"><${Icon} name="hourglass" />выбирает${turnSecs != null ? html`<b class="num dorder__secs">${turnSecs}s</b>` : null}</span>`
                : html`<span class="t-dim"><${Icon} name="dots" />ожидает</span>`}</span>
            </div>
            <span class="dorder__box">
              ${picked ? html`<${BandIcon} bandId=${picked} size="sm" /><span class="dorder__check"><${Icon} name="check" /></span>`
                : cur && p.playerId === myId ? html`<${Sprite} k="bandChoose/youturn_finger" class="dorder__finger" fallback=${html`<${Icon} name="chevronLeft" />`} />`
                : null}
            </span>
          </div>`;
        })}
        <${Button} variant="secondary" icon="search" block=${true} class="draft-order__info" data-testid="match-info-open"
          aria-haspopup="dialog" onClick=${() => setInfoOpen(true)}>Неактивные альянсы<//>
        ${!solo ? html`<p class="draft-order__tip" data-testid="draft-tip">${draftTip({ timed, turnSeconds: turnLen, autoName: myPick ? null : autoName, selected: autoId === sel })}</p>` : null}
      </aside>

      <section class="draft-grid" role="listbox" aria-label="Стратегии">
        ${bands.map((b) => {
          const who = pickers.get(b.bandId) || [];
          const isTaken = taken.has(b.bandId);
          const offNames = bandOffBonds(b, offBonds).map((id) => gd.bond(id)?.name || id); // «Отключено в этом матче» (всё ещё выбираема)
          return html`<button key=${b.bandId} type="button" role="option" aria-selected=${sel === b.bandId ? 'true' : 'false'} data-band=${b.bandId}
              aria-disabled=${isTaken ? 'true' : 'false'} title=${isTaken ? 'Выбрано союзником' : offNames.length ? bandOffLine(offNames) : undefined}
              class=${cx('dband', sel === b.bandId && 'is-sel', myPick === b.bandId && 'is-mine', isTaken && 'is-taken', offNames.length && 'is-off')} onClick=${() => { setSel(b.bandId); audio.sfx('tab', { volume: 0.5 }); }}>
            <${BandIcon} bandId=${b.bandId} size="lg" />
            <span class="dband__name">${b.name}</span>
            <span class="dband__lp num"><i></i>${b.totalHp}</span>
            <${BandOffTag} names=${offNames} />
            ${who.length ? html`<span class="dband__who">${who.slice(0, 4).map((p) => html`<${PlayerAvatar} key=${p.playerId} player=${p} size="sm" />`)}</span>` : null}
            ${isTaken ? html`<span class="dband__taken">Выбрано союзником</span>` : null}
          </button>`;
        })}
      </section>

      <aside class="draft-detail brackets">
        ${band ? html`
          <div class="draft-detail__art">
            <${BandIcon} bandId=${band.bandId} size="xl" />
          </div>
          <div class="draft-detail__hp"><span>Начальный запас жизней</span><${LpTower} value=${band.totalHp} size="lg" /></div>
          <h2 class="draft-detail__name">${band.name}</h2>
          <${BandOffNote} names=${bandOffBonds(band, offBonds).map((id) => gd.bond(id)?.name || id)} />
          <div class="draft-detail__eff">
            <${MicroLabel} tone="mint">EFFECT</${MicroLabel}>
            <b>${band.effectName || ''}</b>
            <${RichText} as="p" text=${band.descRaw || band.desc} class="draft-detail__desc" />
          </div>` : html`<p class="t-dim">Выберите стратегию, чтобы посмотреть подробности</p>`}
        <div class="draft-detail__actions">
          ${myPick ? html`<p class="draft-detail__status t-mint"><${Icon} name="check" />Выбрано «${gd.band(myPick)?.name || ''}»${!solo && !draft.done ? ', ждём остальных Докторов' : ''}</p>`
            : selTaken ? html`<p class="draft-detail__status draft-detail__status--taken"><${Icon} name="close" />Выбрано союзником, выберите другую стратегию</p>`
            : !myTurn ? html`<p class="draft-detail__status"><${Icon} name="hourglass" />${turnName ? `${turnName} выбирает…` : 'Ожидание своего хода'}</p>` : null}
          <div class="draft-detail__btns">
            ${!solo ? html`<${Button} variant="secondary" size="lg" icon="chevrons" disabled=${!canSkip} loading=${busy === 'skip'} onClick=${skip}
              title=${skipsLeft > 0 ? 'Пропустить ход и выбрать позже' : 'Пропуски закончились'}>Пропустить${skipsLeft > 0 ? '' : ' (использовано)'}<//>` : null}
            <${Button} variant="primary" size="lg" icon="check" disabled=${!myTurn || !band || selTaken} loading=${busy === 'pick'} onClick=${confirm}>${selTaken ? 'Выбрано союзником' : 'Подтвердить выбор'}<//>
          </div>
        </div>
      </aside>
    </main>
    <${ExitModal} open=${exit} onClose=${() => setExit(false)} solo=${solo} />
    <${MatchInfoDialog} open=${infoOpen} onClose=${() => setInfoOpen(false)} model=${info}
      status=${infoStatus ? html`<span class=${cx('minfo-dlg__turn', `is-${infoStatus.tone}`)}>
        <${Icon} name=${infoStatus.tone === 'mint' ? 'check' : 'hourglass'} />${infoStatus.text}${infoStatus.secs != null ? html`<b class="num">${infoStatus.secs}s</b>` : null}
      </span>` : null} />
  </div>`;
}