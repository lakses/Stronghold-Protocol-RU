// Экран лобби: выбор 独立模拟 / 同盟模拟 и сложности (标准/险境/绝境/终极), создание комнаты
// или присоединение к ней по 同盟密钥 (недавние коды запоминаются). Показывает статус подключения и пинг.
//
// Описания сложностей берутся из data/config.json `modes[modeId]`, когда присутствуют, иначе из
// официальных текстов act2autochess `modeDataDict`, встроенных ниже (desc + effectDescList), поэтому
// экран полон ещё до генерации данных. Раунды: соло 标准 = 9, всё остальное 14 (+R15
// скрытое ядро на 险境+), по research 00-INDEX §2. Пул полей боя (`modes[].stages`): 标准 всегда
// играет 战场#01, 险境 тянет одно из 8, 绝境 / 终极 одно из 7 (m01 исключён).

import { useEffect, useRef, useState } from '../../vendor/hooks.module.js';
import { DIFFICULTIES, DIFFICULTY_NAMES, DIFFICULTY_COLORS, ROOM_CODE_LEN, MAX_SEATS, modeIdFor } from '../../../shared/constants.js';
import { html, Button, Icon, MicroLabel, Panel, TextField, PingPill, AvatarFrame, Tooltip, Spinner, DifficultyIcon, doctorNo } from '../ui/components.js';
import { toast, toastError } from '../ui/toasts.js';
import { GuideButton } from '../ui/guide.js';
import { LoadoutButton } from './loadout.js';
import { net, identity } from '../net.js';
import { store, useStore, shallowEqual, loadPref, savePref } from '../store.js';
import { getConfig, getMode, getStage, useData } from '../data.js';

/** Официальные тексты режимов (activity_table act2autochess.modeDataDict), запасной вариант при отсутствии config.json. */
export const MODE_TEXT = {
  single: {
    FUNNY: { code: 'AC-1', desc: 'Короткая тренировочная симуляция', effects: ['Можно быстро завершить операцию', 'Стандартные награды'] },
    NORMAL: { code: 'AC-2', desc: 'Тренировочная симуляция с повышенной атакующей силой врагов', effects: ['Доступно больше альянсов', 'Значительно увеличенные награды'] },
    HARD: { code: 'AC-3', desc: 'Тренировочная симуляция с чрезвычайно высокой атакующей силой врагов', effects: ['Сложная боевая обстановка', 'Появляются более опасные враги'] },
    ABYSS: { code: 'AC-4', desc: 'Тренировочная симуляция с атакующей силой врагов на пределе', effects: ['Боевая обстановка невероятно сложна', 'Появляются крайне опасные враги'] },
  },
  multi: {
    FUNNY: { code: 'AC-1', desc: 'Тренировочная симуляция с пониженной атакующей силой врагов', effects: ['Боевая обстановка довольно мягкая', 'Стандартные награды'] },
    NORMAL: { code: 'AC-2', desc: 'Тренировочная симуляция с повышенной атакующей силой врагов', effects: ['Доступно больше альянсов', 'Значительно увеличенные награды'] },
    HARD: { code: 'AC-3', desc: 'Тренировочная симуляция с чрезвычайно высокой атакующей силой врагов', effects: ['Сложная боевая обстановка', 'Появляются более опасные враги'] },
    ABYSS: { code: 'AC-4', desc: 'Тренировочная симуляция с атакующей силой врагов на пределе', effects: ['Боевая обстановка невероятно сложна', 'Появляются крайне опасные враги'] },
  },
};

/** Пул полей боя по сложности при отсутствии config.json (списки `stages` режимов; одинаково для соло и кооператива). */
export const STAGE_POOL = { FUNNY: ['act1autochess_m01'], NORMAL: 8, HARD: 7, ABYSS: 7 };

/**
 * Отображаемое имя поля боя: stages.json, когда загружен, иначе выводится из id (act1 m0N → 战场#0N, act2 m0N → 战场#0(N+4)).
 * @param {string} id например 'act1autochess_m01'
 */
export function stageLabel(id) {
  const rec = getStage(id);
  if (rec && typeof rec.name === 'string' && rec.name) return rec.name.split(/\s+/)[0];
  const m = String(id || '').match(/^act(\d)autochess_m(\d+)$/);
  return m ? `Поле боя #${String(Number(m[2]) + (m[1] === '2' ? 4 : 0)).padStart(2, '0')}` : '';
}

/**
 * Примечание о поле боя сложности (официальная формулировка): единственное поле фиксировано («Поле боя фиксировано: 战场#01»),
 * большее — тянется случайно («Случайное поле боя (всего 8)»).
 * @param {string[] | number | null | undefined} stages список `stages` режима (или количество)
 * @returns {string} '' когда неизвестно
 */
export function stageNote(stages) {
  if (Array.isArray(stages)) {
    const ids = stages.filter((s) => typeof s === 'string' && s);
    if (ids.length === 1) { const name = stageLabel(ids[0]); return name ? `Поле боя фиксировано: ${name}` : 'Поле боя фиксировано'; }
    return ids.length > 1 ? `Случайное поле боя (всего ${ids.length})` : '';
  }
  return Number.isInteger(stages) && stages > 1 ? `Случайное поле боя (всего ${stages})` : '';
}

const MODE_CARDS = [
  {
    id: 'solo', name: 'Одиночная', en: 'SOLO SIMULATION', icon: 'user',
    desc: 'Самостоятельно распоряжайтесь средствами и оперативниками, проходя всю симуляцию в своём темпе.',
    points: ['1 Доктор', 'Фазы отдыха и выбора без ограничения времени'],
  },
  {
    id: 'coop', name: 'Групповая', en: 'ALLIANCE SIMULATION', icon: 'users',
    desc: `Объединитесь в альянс с максимум ${MAX_SEATS - 1} Докторами, делите пул оперативников и вместе отражайте волны врагов.`,
    points: [`1–${MAX_SEATS} Докторов · Можно дополнить ИИ-союзниками`, 'Фаза совместной обороны · Общий запас жизней в финальном штурме'],
  },
];

/**
 * Текст для карточки сложности, предпочитая data/config.json.
 * @param {'solo'|'coop'} roomMode
 * @param {string} difficulty
 * @returns {{ code: string, desc: string, effects: string[], rounds: number, hidden: boolean, stageNote: string }}
 */
export function difficultyInfo(roomMode, difficulty) {
  const fallback = MODE_TEXT[roomMode === 'solo' ? 'single' : 'multi'][difficulty] || { code: '', desc: '', effects: [] };
  // modeIdFor() приводит сложность к нижнему регистру: никогда не вызывайте её со значением, которое сервер не проверил.
  const m = DIFFICULTIES.includes(difficulty) ? getMode(modeIdFor(roomMode, difficulty)) : null;
  const effects = Array.isArray(m?.effectDescList)
    ? m.effectDescList.map((e) => String(e).replace(/^[·•\s]+/, '')).filter(Boolean)
    : fallback.effects;
  const rounds = Number.isFinite(m?.lastRound) ? m.lastRound : roomMode === 'solo' && difficulty === 'FUNNY' ? 9 : 14;
  return {
    code: typeof m?.code === 'string' ? m.code : fallback.code,
    desc: typeof m?.desc === 'string' ? m.desc : fallback.desc,
    effects,
    rounds,
    hidden: difficulty !== 'FUNNY',
    stageNote: stageNote(Array.isArray(m?.stages) && m.stages.length ? m.stages : STAGE_POOL[difficulty]),
  };
}

const CODE_RE = new RegExp(`^[A-Z0-9]{${ROOM_CODE_LEN}}$`);
/**
 * Приводит ввод пользователя к коду комнаты: принимает вставленную ссылку-приглашение (`…?room=ABCD`), оставляет
 * заглавные буквы и цифры и обрезает до длины кода.
 * @param {string} v
 * @returns {string}
 */
export function normalizeCode(v) {
  let s = String(v ?? '');
  const m = s.match(/[?&]room=([A-Za-z0-9]+)/);
  if (m) s = m[1];
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LEN);
}

/**
 * Код комнаты из строки запроса deep link (`?room=CODE`), или null когда отсутствует/некорректен.
 * Принимает ROOM_CODE_LEN..ROOM_CODE_LEN+2 символов (лимит присоединения протокола).
 * @param {string} search например location.search
 * @returns {string|null}
 */
export function parseRoomParam(search) {
  try {
    const raw = new URLSearchParams(search || '').get('room');
    if (!raw) return null;
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(code)) return null;
    return code.length >= ROOM_CODE_LEN && code.length <= ROOM_CODE_LEN + 2 ? code : null;
  } catch {
    return null;
  }
}

/** Недавние присоединённые/созданные коды кооперативных комнат (сначала самые свежие). */
export function recentRooms() {
  const list = loadPref('recentRooms', []);
  return Array.isArray(list) ? list.filter((c) => typeof c === 'string' && CODE_RE.test(c)).slice(0, 4) : [];
}

/** @param {string} code */
export function rememberRoom(code) {
  if (!CODE_RE.test(code)) return;
  savePref('recentRooms', [code, ...recentRooms().filter((c) => c !== code)].slice(0, 4));
}

const FALLBACK_TIPS = [
  'В совместной симуляции можно один раз пропустить выбор стратегии',
  'Даже при заморозке в центре управления можно вручную обновить ассортимент',
  'Два предмета с одинаковым названием можно объединить в один более сильный',
  'Только союзник, завершивший операцию идеально, может участвовать в совместной обороне',
];
const TIP_ROTATE_MS = 5000; // matchingTipRotateInterval

/** Вращающиеся тактические подсказки (config.json `tips`, взвешенный список { tip, weight }). */
function TipsPanel() {
  const cfg = getConfig();
  const tips = Array.isArray(cfg?.tips)
    ? cfg.tips.map((t) => (typeof t === 'string' ? t : t?.tip)).filter((t) => typeof t === 'string' && t)
    : FALLBACK_TIPS;
  const list = tips.length ? tips : FALLBACK_TIPS;
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * list.length));
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => i + 1), TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, []);
  const i = ((idx % list.length) + list.length) % list.length;
  return html`<div class="tips brackets">
    <div class="tips__head">
      <${Icon} name="info" />
      <span>Тактические подсказки</span>
      <${MicroLabel}>TACTICAL TIPS<//>
      <span class="tips__idx num">${String(i + 1).padStart(2, '0')}<span class="t-dim">/${String(list.length).padStart(2, '0')}</span></span>
      <button type="button" class="tips__nav" onClick=${() => setIdx(i - 1 + list.length)} aria-label="Предыдущая"><${Icon} name="chevronLeft" /></button>
      <button type="button" class="tips__nav" onClick=${() => setIdx(i + 1)} aria-label="Следующая"><${Icon} name="chevronRight" /></button>
    </div>
    <p key=${i} class="tips__text">${list[i]}</p>
  </div>`;
}

function ModeCard({ card, selected, onSelect }) {
  return html`<button type="button" class=${`mode-card brackets${selected ? ' is-selected' : ''}`} onClick=${() => onSelect(card.id)}
      aria-pressed=${selected ? 'true' : 'false'}>
    <span class="mode-card__bg" aria-hidden="true"></span>
    <span class="mode-card__icon"><${Icon} name=${card.icon} /></span>
    <span class="mode-card__text">
      <${MicroLabel} tone=${selected ? 'mint' : undefined}>${card.en}<//>
      <span class="mode-card__name">${card.name}</span>
      <span class="mode-card__desc">${card.desc}</span>
      <span class="mode-card__points">${card.points.map((p) => html`<span key=${p}>${p}</span>`)}</span>
    </span>
    <span class="mode-card__check" aria-hidden="true"><${Icon} name="check" />Выбрано</span>
  </button>`;
}

function DifficultyCard({ roomMode, difficulty, selected, onSelect }) {
  const info = difficultyInfo(roomMode, difficulty);
  return html`<button type="button" class=${`diff-card${selected ? ' is-selected' : ''}`}
      style=${`--d-color:${DIFFICULTY_COLORS[difficulty]}`} onClick=${() => onSelect(difficulty)} aria-pressed=${selected ? 'true' : 'false'}>
    <span class="diff-card__bar" aria-hidden="true"></span>
    <span class="diff-card__head">
      <${DifficultyIcon} difficulty=${difficulty} class="diff-card__glyph" />
      <span class="diff-card__name">${DIFFICULTY_NAMES[difficulty]}</span>
      <span class="diff-card__code num">${info.code}</span>
      <span class="diff-card__meta">
        <span class="num">${info.rounds}</span> раундов${info.hidden ? html`<span class="diff-card__hidden">+ Скрытое ядро</span>` : null}
      </span>
    </span>
    <span class="diff-card__desc">${info.desc}</span>
    <span class="diff-card__effects">${info.effects.map((e) => html`<span key=${e}>${e}</span>`)}${info.stageNote ? html`<span key="stage" class="diff-card__stage"><${Icon} name="rook" />${info.stageNote}</span>` : null}</span>
    <span class="diff-card__check" aria-hidden="true"><${Icon} name="check" /><span>Выбрано</span></span>
  </button>`;
}

/** Компонент экрана лобби. */
export function LobbyScreen() {
  const me = useStore((s) => s.me, shallowEqual);
  const conn = useStore((s) => s.connection, shallowEqual);
  useData('config');
  const [roomMode, setRoomMode] = useState(() => (loadPref('lobby.mode', 'coop') === 'solo' ? 'solo' : 'coop'));
  const [difficulty, setDifficulty] = useState(() => {
    const d = loadPref('lobby.difficulty', 'FUNNY');
    return DIFFICULTIES.includes(d) ? d : 'FUNNY';
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);
  const [recent] = useState(recentRooms);
  const alive = useRef(true);
  const inFlight = useRef(false); // синхронная защита от двойных кликов (обновления состояния асинхронны)
  useEffect(() => () => { alive.current = false; }, []);

  const online = conn.status === 'online';
  const codeOk = CODE_RE.test(code);

  const pickMode = (m) => { setRoomMode(m); savePref('lobby.mode', m); };
  const pickDifficulty = (d) => { setDifficulty(d); savePref('lobby.difficulty', d); };

  const run = async (kind, fn) => {
    if (inFlight.current) return;
    if (!online) { toast('Ещё нет подключения к серверу, подождите', 'warn'); return; }
    inFlight.current = true;
    setBusy(kind);
    try { await fn(); } catch (err) { toastError(err); } finally {
      inFlight.current = false;
      if (alive.current) setBusy(null);
    }
  };
  const create = () => run('create', () => net.request('room.create', { mode: roomMode, difficulty }));
  const join = (c = code) => {
    const k = normalizeCode(c);
    if (!CODE_RE.test(k)) { toast(`Ключ альянса — ${ROOM_CODE_LEN} букв или цифр`, 'warn'); return; }
    run('join', () => net.request('room.join', { code: k }));
  };
  const backToTitle = () => {
    identity.setEntered(false);
    store.set((s) => ({ session: { ...s.session, entered: false } }));
  };

  return html`<div class="screen lobby-screen">
    <header class="topbar">
      <div class="topbar__left">
        <${Button} variant="ghost" size="sm" icon="chevronLeft" onClick=${backToTitle} title="Вернуться к заголовку">Назад<//>
        <${PingPill} ms=${conn.ping} online=${online} />
      </div>
      <div class="topbar__center">
        <${MicroLabel} tone="mint">SIMULATION PROTOCOL SELECT<//>
        <h1 class="topbar__title">Выбор протокола симуляции</h1>
      </div>
      <div class="topbar__right">
        <${GuideButton} class="lobby-guide" variant="secondary" />
        <${LoadoutButton} from="lobby" size="sm" class="lobby-loadout" />
        <div class="me-chip">
          <${AvatarFrame} size="sm" name=${me.name} seat=${0} self=${true} />
          <div class="me-chip__text">
            <span class="me-chip__name">${me.name || 'Доктор'}</span>
            <${MicroLabel}>${me.playerId != null ? `DOCTOR #${doctorNo(me.playerId)}` : 'DOCTOR'}<//>
          </div>
        </div>
      </div>
    </header>

    <div class="lobby-body screen__scroll">
      <section class="lobby-left">
        <div class="section-label"><span class="section-label__idx num">01</span>Способ симуляции<${MicroLabel}>MODE<//></div>
        <div class="mode-cards">
          ${MODE_CARDS.map((c) => html`<${ModeCard} key=${c.id} card=${c} selected=${roomMode === c.id} onSelect=${pickMode} />`)}
        </div>

        <div class="section-label"><span class="section-label__idx num">03</span>Присоединиться к альянсу<${MicroLabel}>JOIN WITH ALLIANCE KEY<//></div>
        <${Panel} class="join-panel" tone="amber">
          <div class="join-row">
            <${TextField} size="code" icon="key" value=${code} placeholder="Введите ключ альянса / вставьте ссылку-приглашение"
              transform=${normalizeCode} onInput=${(v) => setCode(normalizeCode(v))} onEnter=${() => join()} />
            <${Button} variant="amber" size="lg" icon="users" loading=${busy === 'join'} disabled=${!codeOk || !online} onClick=${() => join()}>Войти в альянс<//>
          </div>
          <div class="join-foot">
            ${recent.length ? html`<span class="t-lo">Недавние альянсы</span>
              ${recent.map((c) => html`<button key=${c} type="button" class="code-chip num" onClick=${() => { setCode(c); join(c); }}>${c}</button>`)}`
              : html`<span class="t-dim">Запросите у товарища ${ROOM_CODE_LEN}-значный ключ альянса или откройте ссылку-приглашение</span>`}
          </div>
        <//>
        <${TipsPanel} />
      </section>

      <section class="lobby-right">
        <div class="section-label"><span class="section-label__idx num">02</span>Сложность симуляции<${MicroLabel}>DIFFICULTY<//></div>
        <div class="diff-list">
          ${DIFFICULTIES.map((d) => html`<${DifficultyCard} key=${d} roomMode=${roomMode} difficulty=${d} selected=${difficulty === d} onSelect=${pickDifficulty} />`)}
        </div>
        <div class="create-box">
          <${Tooltip} block=${true} text=${online ? null : 'Подключение к серверу…'}>
            <${Button} variant="primary" size="xl" block=${true} iconRight="chevrons" loading=${busy === 'create'} disabled=${!online} onClick=${create}>
              ${roomMode === 'solo' ? 'Начать симуляцию' : 'Создать альянс'}
            <//>
          <//>
          <div class="create-box__hint">
            ${online
              ? html`<span>${roomMode === 'solo' ? 'После создания можно сразу начать симуляцию' : 'После создания можно пригласить друзей или добавить ИИ-союзников'}</span>`
              : html`<${Spinner} size="sm" label="CONNECTING" />`}
          </div>
        </div>
      </section>
    </div>
  </div>`;
}