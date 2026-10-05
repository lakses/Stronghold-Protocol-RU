// Экран комнаты (同盟等待室): 4 карточки мест (рамка аватара, имя, состояние готовности, значок ИИ, корона хоста),
// управление хоста (выбор сложности, добавление/удаление ИИ в кооперативе, старт), код приглашения с копированием кода /
// копированием ссылки, переключатель готовности и выход.
//
// Правило старта (server/lobby.js): room.start требует, чтобы каждый *другой* человек был подключён и готов; старт
// хоста считается его готовностью. Поэтому 开始模拟 доступна ровно тогда и отправляет только room.start
// (без отдельного round trip room.ready, который мог бы оставить хоста «готовым» после неудачного старта).
// Соло-комнаты показывают одно место.

import { useEffect, useRef, useState } from '../../vendor/hooks.module.js';
import { DIFFICULTIES, DIFFICULTY_NAMES, DIFFICULTY_COLORS, MAX_SEATS } from '../../../shared/constants.js';
import {
  html, Button, Icon, MicroLabel, PingPill, AvatarFrame, DifficultyTag, DifficultyIcon, Tooltip, confirmDialog, doctorNo,
} from '../ui/components.js';
import { toast, toastError } from '../ui/toasts.js';
import { GuideButton } from '../ui/guide.js';
import { LoadoutButton } from './loadout.js';
import { net } from '../net.js';
import { store, useStore, shallowEqual, emptyMatch } from '../store.js';
import { difficultyInfo } from './lobby.js';

/**
 * Места, дополненные до вместимости комнаты (кооператив 4, соло 1), каждое null или запись места.
 * @param {any} room payload room.state
 * @returns {(null | {seat:number, playerId:any, name:string, isBot:boolean, ready:boolean, connected:boolean})[]}
 */
export function normalizeSeats(room) {
  const cap = room?.mode === 'solo' ? 1 : MAX_SEATS;
  const src = Array.isArray(room?.seats) ? room.seats : [];
  const out = [];
  for (let i = 0; i < cap; i++) {
    const s = src[i];
    out.push(s && typeof s === 'object' ? { ...s, seat: Number.isInteger(s.seat) ? s.seat : i } : null);
  }
  return out;
}

/**
 * Производные факты о комнате для локального игрока.
 * @param {any} room
 * @param {any} myId
 */
export function roomFacts(room, myId) {
  const seats = normalizeSeats(room);
  const occupied = seats.filter(Boolean);
  const humans = occupied.filter((s) => !s.isBot);
  const mine = occupied.find((s) => s.playerId === myId) || null;
  const isHost = room?.hostId != null && room.hostId === myId;
  const others = humans.filter((s) => s.playerId !== myId);
  // Хост никогда не готовится: старт матча и есть готовность хоста (правило сервера), поэтому счётчик
  // считает хоста готовым — «Готовы 0/1» рядом с «Разрешён вход в симуляцию» противоречило бы само себе.
  const isReady = (s) => !!s.ready || s.playerId === room?.hostId;
  const readyHumans = humans.filter(isReady).length;
  const othersReady = others.every((s) => s.ready && s.connected !== false);
  return {
    seats, occupied, humans, mine, isHost, readyHumans, isReady,
    emptySeats: seats.filter((s) => !s).length,
    canStart: isHost && othersReady && !!mine,
    othersReady,
  };
}

/** Ссылка-приглашение для кода комнаты (текущий URL страницы с ?room=CODE). */
export function inviteLink(code) {
  const loc = globalThis.location;
  const base = loc ? `${loc.origin}${loc.pathname}` : '';
  return `${base}?room=${encodeURIComponent(code)}`;
}

/**
 * Копирует текст в буфер обмена (асинхронный API с запасным textarea для небезопасных контекстов).
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    if (globalThis.navigator?.clipboard && globalThis.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* проваливаемся дальше */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // 16 px: iOS приближает поля меньшего размера при фокусе; `readonly` не даёт клавиатуре появиться
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.select();
    // iOS Safari игнорирует select() на textarea: именно явный диапазон он и копирует (игра по локальной сети через http
    // не имеет navigator.clipboard, поэтому этот путь — тот, которым идут iPhone / iPad)
    try { ta.setSelectionRange(0, ta.value.length); } catch { /* ignore */ }
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function SeatCard({ seat, index, room, facts, myId, busy, onAddBot, onRemoveBot }) {
  const coop = room.mode !== 'solo';
  if (!seat) {
    const canAdd = coop && facts.isHost;
    return html`<article class="seat seat--empty" style=${`--seat-i:${index}`}>
      <header class="seat__head"><span class="seat__no num">P${index + 1}</span><${MicroLabel}>SEAT ${String(index + 1).padStart(2, '0')}<//></header>
      <div class="seat__art seat__art--empty">
        <div class="seat__radar" aria-hidden="true"></div>
        <span class="seat__wait">Ожидание Доктора</span>
        <${MicroLabel}>AWAITING DOCTOR<//>
      </div>
      <footer class="seat__foot">
        ${canAdd
          ? html`<${Button} variant="secondary" size="sm" icon="robot" block=${true} loading=${busy === `add`} onClick=${onAddBot}>Добавить ИИ-союзника<//>`
          : html`<span class="seat__state t-dim">Свободно</span>`}
      </footer>
    </article>`;
  }
  const isMe = seat.playerId === myId;
  const isHostSeat = seat.playerId === room.hostId;
  const offline = seat.connected === false && !seat.isBot;
  // Хосту никогда не нужно переключать готовность: старт матча готовит его (правило сервера).
  const state = offline ? 'offline' : seat.ready || seat.isBot ? 'ready' : isHostSeat ? 'host' : 'waiting';
  return html`<article class=${`seat brackets${isMe ? ' is-me' : ''}${isHostSeat ? ' is-host' : ''}${seat.isBot ? ' is-bot' : ''} is-${state}`}
      style=${`--seat-i:${index}`}>
    <header class="seat__head">
      <span class="seat__no num">P${index + 1}</span>
      <${MicroLabel}>SEAT ${String(index + 1).padStart(2, '0')}<//>
      ${isHostSeat ? html`<span class="seat__host"><${Icon} name="crown" />Создатель</span>` : null}
    </header>
    <div class="seat__art">
      <div class="seat__stripes" aria-hidden="true"></div>
      <${AvatarFrame} size="xl" name=${seat.name} seat=${index} bot=${seat.isBot} self=${isMe} ready=${state === 'ready'} offline=${offline} />
      ${seat.isBot ? html`<span class="seat__bot-label"><${Icon} name="robot" />ИИ-союзник</span>` : null}
    </div>
    <div class="seat__who">
      <span class="seat__name">${seat.name || 'Доктор'}</span>
      ${isMe ? html`<span class="seat__you">Вы</span>` : null}
    </div>
    <${MicroLabel}>${seat.isBot ? 'AUTONOMOUS UNIT' : `DOCTOR #${doctorNo(seat.playerId)}`}<//>
    <footer class="seat__foot">
      <span class=${`seat__state seat__state--${state}`}>
        ${state === 'ready' ? html`<${Icon} name="check" />Готов`
          : state === 'offline' ? html`<${Icon} name="wifiOff" />Связь прервана`
          : state === 'host' ? html`<${Icon} name="crown" />В ожидании`
          : html`<${Icon} name="hourglass" />Готовится`}
      </span>
      ${seat.isBot && facts.isHost ? html`<${Tooltip} text="Убрать этого ИИ-союзника">
        <${Button} variant="ghost" size="sm" square=${true} icon="close" loading=${busy === `rm${index}`} onClick=${() => onRemoveBot(index)} aria-label="Убрать ИИ-союзника" />
      <//>` : null}
    </footer>
  </article>`;
}

function InviteBox({ code }) {
  const copy = async (what) => {
    const ok = await copyText(what === 'code' ? code : inviteLink(code));
    if (ok) toast(what === 'code' ? `Скопирован ключ альянса ${code}` : 'Ссылка-приглашение скопирована', 'success');
    else toast('Не удалось скопировать, скопируйте вручную', 'warn');
  };
  return html`<div class="invite brackets">
    <div class="invite__label"><${Icon} name="key" /><span>Ключ альянса</span><${MicroLabel}>ALLIANCE KEY<//></div>
    <div class="invite__code num selectable" aria-label=${`Ключ альянса ${code}`}>${[...String(code)].map((ch, i) => html`<span key=${i}>${ch}</span>`)}</div>
    <div class="invite__btns">
      <${Button} size="sm" icon="copy" onClick=${() => copy('code')}>Копировать ключ<//>
      <${Button} size="sm" icon="link" onClick=${() => copy('link')}>Копировать ссылку<//>
    </div>
  </div>`;
}

function DifficultyPicker({ room, isHost, busy, onPick }) {
  if (!isHost) {
    return html`<div class="dpick dpick--ro">
      <${DifficultyTag} difficulty=${room.difficulty} size="lg" code=${difficultyInfo(room.mode, room.difficulty).code} />
      <span class="t-dim">Выбирает создатель</span>
    </div>`;
  }
  return html`<div class="dpick" role="radiogroup" aria-label="Сложность симуляции">
    ${DIFFICULTIES.map((d) => html`<button key=${d} type="button" role="radio" aria-checked=${room.difficulty === d ? 'true' : 'false'}
        class=${`dpick__opt${room.difficulty === d ? ' is-active' : ''}`} style=${`--d-color:${DIFFICULTY_COLORS[d]}`}
        disabled=${!!busy} onClick=${() => room.difficulty !== d && onPick(d)}>
      <${DifficultyIcon} difficulty=${d} />${DIFFICULTY_NAMES[d].replace('模拟', '')}
    </button>`)}
  </div>`;
}

/** Компонент экрана комнаты. */
export function RoomScreen() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me, shallowEqual);
  const conn = useStore((s) => s.connection, shallowEqual);
  const [busy, setBusy] = useState(null);
  const alive = useRef(true);
  const inFlight = useRef(false); // синхронная защита от двойных кликов (обновления состояния асинхронны)
  useEffect(() => () => { alive.current = false; }, []);

  if (!room) return null;
  const online = conn.status === 'online';
  const coop = room.mode !== 'solo';
  const facts = roomFacts(room, me.playerId);
  const myReady = !!facts.mine?.ready;
  const info = difficultyInfo(room.mode, room.difficulty);

  const run = async (kind, fn) => {
    if (inFlight.current) return;
    if (!online) { toast('Связь прервана, повторите позже', 'warn'); return; }
    inFlight.current = true;
    setBusy(kind);
    try { await fn(); } catch (err) { toastError(err); } finally {
      inFlight.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const toggleReady = () => run('ready', () => net.request('room.ready', { ready: !myReady }));
  const start = () => run('start', () => net.request('room.start', {}));
  const addBot = () => run('add', () => net.request('room.addBot', {}));
  const removeBot = (seat) => run(`rm${seat}`, () => net.request('room.removeBot', { seat }));
  const setDifficulty = (difficulty) => run('diff', () => net.request('room.setDifficulty', { difficulty }));
  const leave = async () => {
    if (inFlight.current) return;
    const othersHere = facts.humans.some((s) => s.playerId !== me.playerId);
    if (facts.isHost && othersHere) {
      const ok = await confirmDialog({ title: 'Покинуть альянс', text: 'Вы создатель альянса; после выхода статус создателя перейдёт другому или альянс распадётся. Точно выйти?', okText: 'Выйти', danger: true });
      if (!ok) return;
    }
    inFlight.current = true;
    setBusy('leave');
    try {
      await net.request('room.leave', {});
    } catch (err) {
      if (err?.code !== 'NOT_IN_ROOM') toastError(err);
    } finally {
      // Выход локально всегда безопасен: сервер либо подтвердил, либо нас уже нет в комнате.
      store.set({ room: null, match: emptyMatch() });
      inFlight.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const statusLine = !online
    ? html`<span class="t-orange"><${Icon} name="wifiOff" />Связь прервана, переподключение…</span>`
    : !coop
      ? html`<span class="t-mint"></span>`
    : facts.isHost
      ? facts.canStart
        ? html`<span class="t-mint">*Состав альянса укомплектован, разрешён вход в симуляцию</span>`
        : html`<span class="t-lo">Ожидание готовности всех Докторов</span>`
      : myReady
        ? html`<span class="t-mint">Готов · Ожидание старта от создателя</span>`
        : html`<span class="t-lo">После готовности создатель сможет начать симуляцию</span>`;

  return html`<div class="screen room-screen">
    <header class="topbar">
      <div class="topbar__left">
        <${Tooltip} text="Покинуть альянс" placement="bottom">
          <${Button} variant="danger" size="lg" square=${true} icon="exit" loading=${busy === 'leave'} onClick=${leave} aria-label="Покинуть альянс" />
        <//>
        <div class="room-ping">
          <${PingPill} ms=${conn.ping} online=${online} />
          <${MicroLabel}>Текущий пинг<//>
        </div>
        <${GuideButton} class="room-guide" variant="secondary" />
      </div>
      <div class="topbar__center">
        <${MicroLabel} tone="mint">${coop ? 'ALLIANCE LOBBY' : 'SOLO SIMULATION'}<//>
        <h1 class="topbar__title">${coop ? 'Симуляция альянса' : 'Одиночная симуляция'}<span class="topbar__sep"></span><${DifficultyTag} difficulty=${room.difficulty} size="lg" /></h1>
      </div>
      <div class="topbar__right">
        ${coop ? html`<${InviteBox} code=${room.code} />` : html`<div class="solo-note"><${MicroLabel}>SINGLE OPERATOR<//><span>Только 1 Доктор</span></div>`}
      </div>
    </header>

    <main class=${`seats${coop ? '' : ' seats--solo'}`}>
      ${facts.seats.map((s, i) => html`<${SeatCard} key=${s ? `p${s.playerId}` : `e${i}`} seat=${s} index=${i} room=${room} facts=${facts}
        myId=${me.playerId} busy=${busy} onAddBot=${addBot} onRemoveBot=${removeBot} />`)}
      ${coop ? null : html`<aside class="solo-brief brackets">
        <${MicroLabel} tone="mint">BRIEFING<//>
        <h2>${DIFFICULTY_NAMES[room.difficulty] || ''}<span class="num t-dim"> ${info.code}</span></h2>
        <p>${info.desc}</p>
        <ul>
          ${info.effects.map((e) => html`<li key=${e}>${e}</li>`)}
          <li>Всего <b class="num">${info.rounds}</b> раундов${info.hidden ? ', при выполнении условий — скрытое ядро' : ''}</li>
          <li>В одиночной симуляции фазы отдыха и мутаций без ограничения времени</li>
        </ul>
      </aside>`}
    </main>

    <footer class="room-bar">
      <div class="room-bar__left">
        <span class="room-bar__label">Сложность симуляции<${MicroLabel}>DIFFICULTY<//></span>
        <${DifficultyPicker} room=${room} isHost=${facts.isHost} busy=${busy} onPick=${setDifficulty} />
      </div>
      <div class="room-bar__center">
        <div class="ready-count" hidden=${!coop}>
          <span class="t-lo">Готовы</span>
          <b class="num">${facts.readyHumans}</b><span class="num t-dim">/${facts.humans.length}</span>
          <span class="ready-count__icons" aria-hidden="true">
            ${facts.humans.map((s) => html`<${Icon} key=${s.playerId} name="user" class=${facts.isReady(s) ? 'is-on' : ''} />`)}
          </span>
        </div>
        <div class="room-bar__status">${statusLine}</div>
      </div>
      <div class="room-bar__right">
        <${LoadoutButton} from="room" size="lg" class="room-loadout" />
        ${facts.isHost
          ? html`<${Tooltip} text=${facts.canStart ? null : 'Ещё не все Доктора готовы'}>
              <${Button} variant="primary" size="xl" icon="play" loading=${busy === 'start'} disabled=${!facts.canStart || !online} onClick=${start}>Начать симуляцию<//>
            <//>`
          : html`<${Button} variant=${myReady ? 'primary' : 'secondary'} size="xl" icon=${myReady ? 'check' : 'hourglass'} active=${myReady}
              loading=${busy === 'ready'} disabled=${!online || !facts.mine} onClick=${toggleReady}>${myReady ? 'Готов' : 'Приготовиться'}<//>`}
      </div>
    </footer>
  </div>`;
}