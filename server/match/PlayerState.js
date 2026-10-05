// server/match/PlayerState.js — авторитетное состояние каждого игрока + все обработчики намерений фазы подготовки (DESIGN §6.2).
//
// Обработчики валидируют → мутируют → пересчитывают альянсы → помечают приватный вид грязным. Они никогда не бросают
// исключение на некорректный ввод; они возвращают `{ ok: true }` или `{ error: ERR.*, detail? }`. Правила (research 00-INDEX
// §3–§4, 01 A1, 04 §2):
//   * Рука (整备区) — 10 слотов, заполняется справа налево; временная зона (临时整备区) — 5 слотов. Полная рука отказывает
//     в покупках / выводах, кроме покупки, которая завершает слияние, и вывода, чей собственный стек призыва освобождает
//     слот. Пассивные приобретения (результаты слияния, выдачи, возвращённое снаряжение) уходят во временную зону; она
//     блокирует готовность («пока переполнение не устранено, нельзя начать операцию»). Фигура во временной зоне
//     разрешается (оперативник продаётся обратно в пул, предметы уничтожаются, стеки призывов удаляются — они
//     возвращаются в начале следующего раунда, grantTokensFor) в дедлайн первой подготовки, в которой игрок мог с ней
//     что-то сделать (tempDue): фигура, попавшая туда во время подготовки до готовности, истекает в конце той же
//     подготовки; попавшая после готовности, в конце подготовки (выдачи <в конце фазы отдыха>), в бою / расчёте
//     (выдачи из результата боя, слияния, возвращённое снаряжение) или в начале следующего раунда / 机变 — остаётся
//     видимой и доступной (перемещение в свободный слот руки, размещение, экипировка, уничтожение, продажа) всю
//     СЛЕДУЮЩУЮ подготовку — ничего не уничтожается до того, как игрок увидел это в подготовке («ресурсы во временной
//     зоне подготовки автоматически уничтожаются после перехода к следующему раунду»).
//   * Доска: своя область, ряды 9–12 × столбцы 2–10, легальность из легенды стадии (board.js); лимит развёртывания 8
//     (+эффекты); токены (размещаемые призывы) не занимают слоты развёртывания. Обмен между доской и рукой разрешён
//     всегда. В раунде с лидером легальность читает половину поля лидера, принадлежащую игроку (Match.deployFieldOf →
//     board.js field 'bossL' / 'bossR', user playtest #5 item 7); координаты доски не меняются. Изменение рельефа
//     (карты 机变, переопределения контента) или смена поля развёртывания отзывает фигуры, оставшиеся на клетках, которые
//     они больше не могут занимать (в руку, при переполнении — во временную зону; призывы обратно в стек) — см. _evictIllegal.
//   * Магазин: слоты оперативников по уровню + слот предмета, взвешенные по копиям броски из ОБЩЕГО пула (pool.js);
//     обновление — 1 (сначала бесплатные), один переключатель замораживает все нераспроданные слоты до начала
//     следующего раунда (ручное обновление при заморозке перебрасывает всё, и новые слоты остаются замороженными),
//     цена повышения уровня = базовая − прошедшие раунды (минимум 0).
//   * Слияние: 3 обычные копии (у 风丸 — 2) на доске / в руке / во временной зоне → 1 элитный; снаряжение
//     возвращается в руку; предлагается выбор из 3 разных бесплатных оперативников ранга min(уровень+1, 6) (никогда
//     дважды один оперативник — user playtest #6 item 19; при нехватке ранга добирается из ранга ниже; выбрать 1,
//     истекает в конце подготовки; предложение, полученное после подготовки — эффекты РАСЧЁТА / Финального штурма —
//     сохраняется на следующую подготовку). Куда идёт элитный (PRTS 卫戍协议/帮助 «отправить 1 оперативника в состоянии
//     【Элитный】 в руку (если расходуется развёрнутый в боевой зоне оперативник, то отправить в соответствующую позицию
//     боевой зоны)», user playtest #6 follow-up): когда одна из израсходованных копий стояла на доске — на клетку этой
//     копии с её направлением (если их несколько — та, что разворачивается первой — board.js mergeTile, [ASSUMED]);
//     он заменяет развёрнутую копию, поэтому число развёрнутых не растёт, и он получает свой стек призывов
//     (grantTokensFor). Иначе — в руку, при переполнении во временную зону — в том числе вне фазы подготовки (элитный
//     из слияния в РАСЧЁТЕ ждёт в временной зоне следующей подготовки).
//   * Покомпонентные счётчики раунда (pieceRoundCount, piece.meta.round): собственные счётчики оперативника за текущий
//     раунд (у 拉普兰德 — ручные обновления, свидетелем которых она была — обратная связь игрока после 0.1.0); новая
//     фигура начинается с 0, элитный, слитый в этом раунде, сохраняет наибольшее из копий [ASSUMED].
//   * Трансформации (transformChess, 突变细胞 — PRTS прим.: «при срабатывании исходный оперативник уничтожается,
//     получается случайный начальный оперативник на один ранг выше»): уничтожение, за которым следует получение. Носитель
//     покидает место, где стоит (клетка доски освобождается, счёт развёртывания уменьшается), его снаряжение — включая
//     саму клетку — сначала возвращается в руку (при переполнении во временную зону), затем новый оперативник получается
//     как любой другой (acquireChess: рука, при переполнении временная зона, правило «нет места»; слияние, которое он
//     завершает, размещает элитного на клетке израсходованной развёрнутой копии — никогда на клетке носителя — иначе
//     в руке). Официальные кадры: на следующей подготовке клетка пуста, и новый оперативник ждёт в 整备区 (указано в PR #2).
//   * Предметы: экипировать максимум 2 (третий заменяет экипированный предмет, который выбирает игрок — g.equip
//     replaceUid, без него — самый старый; экипированные предметы в остальном заблокированы: g.destroy отказывает),
//     2 одинаковых нормальных предмета (рука / временная зона / экипировано) сливаются в золотой предмет в руке,
//     предметы никогда не продаются (уничтожение за 0). Предметы consume-on-equip разрешаются через реестр эффектов
//     и никогда не занимают слот.
//   * Токены (PRTS 卫戍协议/帮助 §战斗部署, user playtest #6): размещение владельца с ручными размещаемыми призывами
//     (tokens.json `placeable`: 医疗探机 у 赫默 и 诅咒娃娃 у 巫恋 на их S2, 爬行号·防护单元 у 凯瑟琳, 海嗣 / 狼群 /
//     流形) отправляет один стек (deployLimit копий — у 凯瑟琳 2) в руку, размещается рукой как любая фигура (без слота
//     развёртывания); отзыв / продажа / слияние владельца удаляет его токены (элитный, получивший клетку слитой копии,
//     получает собственный стек, как при любом размещении), перемещение его по доске (в том числе когда призыв, перетащенный
//     на него, меняет его местами) возвращает размещённые призывы обратно в их стек («при перемещении оперативника все
//     его призывы уходят с поля и сбрасываются в руку»); стек призыва, убранный из временной зоны в дедлайн подготовки,
//     возвращается в начале следующего раунда (startRound добавляет каждому владельцу на доске его призывы до deployLimit,
//     «призывы оперативника возвращаются в следующем раунде»). В бою призыв навыка занимает клетку, когда срабатывает
//     навык (sim/content/tokens.js dockSkillSummons). Призыв, чей текст читается как «развёртывается только в радиусе
//     атаки призывателя» (tokens.json `ownerRange`: 狼群 / 流形 тактиков — их тактическая точка; player report #9 после
//     0.1.0), размещается только на клетке радиуса атаки своего владельца (_legal / summonRange: сетка с учётом
//     настройки оперативника, повёрнутая по направлению владельца); обмен с владельцем проверяется с новой клетки
//     владельца, и призыв, оставшийся снаружи после поворота на месте (или повышения), возвращается в стек (recompute →
//     _liftOutOfRange) [ASSUMED: сохраняется, если ещё внутри]. Поворот, после которого у такого призыва не будет ни
//     стека, ни свободного слота в руке / временной зоне, отклоняется (HAND_FULL); в остальных случаях (повышение,
//     владелец сдвинут без места) он уходит с доски, а его стек возвращается в начале следующего раунда (grantTokensFor) —
//     ни одно размещение вне радиуса не доходит до боя.
//   * Направление (DESIGN §3, research 09 §1.2): у каждой фигуры на доске есть `dir` ∈ UP|RIGHT|DOWN|LEFT
//     (server/sim/dir.js), устанавливается через g.move {…, dir} (без него ⇒ RIGHT) и сохраняется между раундами. g.move
//     на СОБСТВЕННУЮ клетку фигуры разворачивает её на месте; обмен сохраняет dir занявшего; фигура, поставленная на доску
//     эффектом (элитный из слияния, занимающий клетку израсходованной копии), сохраняет dir этой клетки, всё остальное
//     по умолчанию — RIGHT (`pieceDir`). g.art {…, dir} поворачивает радиус применения (画卷 1-1: своя клетка + клетка
//     впереди).
//   * Настройка оперативников (DESIGN §16): проверенная `seat.loadout` человека ({ [baseChessId]: { skill, module } },
//     записи, равные значениям по умолчанию, отбрасываются) перепроверяется по данным этого матча (shared/protocol.js
//     checkLoadout; при несоответствии откатывается к значениям по умолчанию) и остаётся замороженной; боты всегда
//     используют значения по умолчанию. Match.setLoadout может заменить её только во время INFO_CHECK. battleInput()
//     разрешает каждого оперативника в `skillIndex` + `moduleId` (resolveLoadout: обычный оперативник → moduleId null,
//     элитный → uniEquipId | 'none'); m.private публикует `loadout`.

import { ERR, GEO, PHASE, layerGainRoom } from '../../shared/constants.js';
import { checkLoadout, resolveLoadout } from '../../shared/protocol.js';
import { FIELD, tileKey, parseKey, inField, canPlace, positionClass, boardOrder, freeSlot, pieceDir, parseDir, mergeTile, ownerRangeKeys } from './board.js';
import { attackRangeGrid, loadoutRecord, resolveRecordLoadout } from '../../shared/loadoutRecord.js';
import { offsetTile } from '../sim/dir.js';
import { computeBonds, bondList, bondSnapshot, activatedLayers, bondsWithGains } from './bondsMeta.js';
import { itemKey } from './gamedata.js';
import { bountyText } from './choices.js';

const HAND_SIZE = GEO.HAND_SIZE;
const TEMP_SIZE = GEO.TEMP_SIZE;
/** g.reward принимает idx 0..5 (shared/protocol.js) */
const MAX_OFFER_SLOTS = 6;
const OK = Object.freeze({ ok: true });
const fail = (error, detail) => (detail ? { error, detail } : { error });

export class PlayerState {
  /**
   * @param {import('./Match.js').Match} m матч-владелец
   * @param {{ seat: number, playerId: string, name: string, isBot: boolean, connected: boolean }} seat
   */
  constructor(m, seat) {
    this.m = m;
    this.gd = m.gd;
    this.playerId = seat.playerId;
    this.seat = seat.seat;
    this.name = seat.name;
    this.isBot = !!seat.isBot;
    this.connected = this.isBot ? true : !!seat.connected;
    this.left = false;
    this.autoplay = false;
    this.alive = true;
    this.lp = 0;
    this.bandId = null;
    this.funds = 0;
    this.pendingFunds = 0;
    this.ready = false;
    this.infoReady = this.isBot;
    this.lastEmoteAt = -Infinity;
    /** настройка оперативников (DESIGN §16): замороженная { [baseChessId]: { skill, module } }, {} = все на значениях по умолчанию */
    this.loadout = Object.freeze({});
    if (!this.isBot && seat.loadout) this.setLoadout(seat.loadout);
    this.shop = { level: 1, upgradePrice: this.gd.upgradeBase(1) ?? 0, slots: [], frozen: false, freeRefreshes: 0 };
    /** очередь предложений награды (награды за слияние, специальные обновления): { tier, source, label, slots: [{ kind, id, price, sold }] } */
    this.offers = [];
    /** @type {Array<any>} */
    this.hand = new Array(HAND_SIZE).fill(null);
    /** @type {Array<any>} */
    this.temp = new Array(TEMP_SIZE).fill(null);
    /** сколько подготовок этого игрока уже закончилось (endPrep) = индекс текущей (или следующей) подготовки */
    this.prepsEnded = 0;
    /** @type {Map<number, number>} uid фигуры во временной зоне → индекс подготовки, в дедлайн которой она разрешается (см. tempDue) */
    this._tempDue = new Map();
    /** @type {Map<string, any>} 'r,c' → фигура */
    this.board = new Map();
    /** постоянные слои альянсов */
    this.layers = {};
    /** вычисленные состояния альянсов */
    this.bonds = {};
    /**
     * слои, полученные в бою в этом раунде, из завершённого обычного боя ({ [bondId]: n }, Match._finishCombat), пока
     * settle() не сделает их постоянными — виды их добавляют (bondsView, DESIGN §20.15); иначе null
     */
    this.pendingLayerGains = null;
    /** опциональный бонус к счётчику конкретного альянса, записанный эффектами */
    this.bondCountBonus = {};
    /** список EffectRef: { id, key, name, desc, iconKind, iconId, counter?, battle, params, data } */
    this.effects = [];
    /** активные контракты: { id, card, roundsLeft, chooser } */
    this.bounties = [];
    /** произвольные счётчики для контента (ctx.counter / setCounter) */
    this.counters = {};
    /** счётчики за раунд (сбрасываются в начале раунда) */
    this.round = { refreshes: 0, buys: 0, sells: 0, spent: 0, gainedChess: 0, arts: 0 };
    this.deployCapBonus = 0;
    this.deployCapMin = 0;
    this.deviceOverrides = {};
    this.tileOverrides = {};
    this.stats = {
      dmgDealt: 0, kills: 0, leaks: 0, gold: 0, refreshes: 0, merges: 0, itemMerges: 0, itemsEquipped: 0,
      bossDamage: 0, lpLost: 0, buys: 0, sells: 0, perfectRounds: 0, fundsGained: 0, healing: 0,
    };
    this.eliminatedRound = null;
    this.lpAtFinal = null;
    /** последний боевой результат игрока (состояние переноса в совместной обороне, контракты) */
    this.lastResult = null;
    this._deployMap = null;
    /** поле развёртывания для `_deployMap` ('normal' | 'bossL' | 'bossR', Match.deployFieldOf) */
    this._deployField = undefined;
    /** карта развёртывания изменилась с момента последней проверки легальности доски (invalidateDeployMap) */
    this._legalityStale = false;
    /** Match.scheduleBotPrep: последняя подготовка бота этого места (старые нарезанные репетиции отпадают) */
    this._botPrepToken = 0;
    this.bonds = computeBonds(this.gd, this);
  }

  // =================================================================================================
  // основы

  get isHumanActive() { return !this.isBot && !this.left; }
  /** Движок действует за это место (ИИ-союзник или «AI 托管»; ушедший человек выбывает, так что делать нечего). */
  get botControlled() { return this.isBot || this.left || this.autoplay; }

  get deployCap() { return Math.max(1, this.gd.deployCap + this.deployCapBonus, this.deployCapMin); }
  get deployCount() { let n = 0; for (const p of this.board.values()) if (p.kind === 'chess') n++; return n; }
  get tempEmpty() { return this.temp.every((x) => x == null); }

  /**
   * Индекс подготовки, в дедлайн которой разрешается фигура во временной зоне (сравните с `prepsEnded`): записывается,
   * когда фигура попадает во временную зону (_putTemp); фигура, попавшая туда иным способом, считается должной в
   * текущей (или следующей) подготовке.
   */
  tempDue(piece) {
    const due = piece ? this._tempDue.get(piece.uid) : undefined;
    return Number.isInteger(due) ? due : this.prepsEnded;
  }

  /**
   * Должная подготовка для фигуры, попадающей во временную зону сейчас: текущая подготовка, пока игрок ещё может с ней
   * что-то сделать (PREP, не готов); после готовности или в конце подготовки (выдачи onPrepEnd) — следующая; вне
   * PREP (COMBAT, SETTLE, ROUND_START, 机变) — следующая подготовка, которая закончится — `prepsEnded` уже её называет.
   */
  _tempDueNow() {
    return this.prepsEnded + (this.m.phase === PHASE.PREP && this.ready ? 1 : 0);
  }

  /** Каждая запись фигуры в слот временной зоны идёт через это (записывает её должную подготовку). */
  _putTemp(i, piece) {
    this.temp[i] = piece;
    this._tempDue.set(piece.uid, this._tempDueNow());
  }

  /**
   * Заменяет настройку оперативников (DESIGN §16) после перепроверки по данным этого матча. Принимает проверенную
   * форму `{ id: { skill, module|null } }` или сырые записи `room.loadout`. Возвращает false (настройка не изменена),
   * если она не соответствует данным; боты сохраняют значения по умолчанию.
   * @param {any} loadout
   * @returns {boolean}
   */
  setLoadout(loadout) {
    if (this.isBot) return false;
    const entries = {};
    if (loadout && typeof loadout === 'object' && !Array.isArray(loadout)) {
      for (const [id, e] of Object.entries(loadout)) {
        if (!e || typeof e !== 'object') continue;
        const x = {};
        if (Number.isInteger(e.skill)) x.skill = e.skill;
        if (typeof e.module === 'string') x.module = e.module;
        if (Object.keys(x).length) entries[id] = x;
      }
    }
    const res = checkLoadout(entries, (id) => this.gd.chess(id));
    if (!res || !res.ok) {
      this.m.log?.warn?.(`[match ${this.m.roomCode}] loadout of ${this.playerId} ignored: ${res && res.detail}`);
      return false;
    }
    const out = {};
    for (const [id, e] of Object.entries(res.loadout)) out[id] = Object.freeze({ skill: e.skill, module: e.module ?? null });
    this.loadout = Object.freeze(out);
    return true;
  }

  /** Индекс навыка / модуль, с которым оперативник сражается под настройкой игрока (DESIGN §16). */
  loadoutFor(chessRecord) {
    return resolveLoadout(this.loadout, chessRecord, (id) => this.gd.chess(id));
  }

  /**
   * Классы развёртывания клеток доски (server/match/board.js buildDeployMap) на поле, где игрок разворачивается сейчас
   * (Match.deployFieldOf: собственная доска или её половина поля лидера в раунде с лидером — user playtest #5 item 7).
   * Смена этого поля (начало раунда с лидером, перепаривание) перепроверяет легальность доски, как изменение рельефа.
   */
  deployMap() {
    const field = typeof this.m.deployFieldOf === 'function' ? this.m.deployFieldOf(this) : 'normal';
    if (this._deployMap && this._deployField !== undefined && this._deployField !== field) {
      this._deployMap = null;
      this._legalityStale = true;
    }
    if (!this._deployMap) this._deployMap = this.m.deployMapFor(this, field);
    this._deployField = field;
    return this._deployMap;
  }
  /**
   * Рельеф доски изменился (карты 机变, переопределения устройств / клеток контентом): легальность перепроверяется в
   * следующем recompute() / battleInput() — после всего изменения, так что промежуточное состояние карты, которая
   * переключает несколько устройств, никогда не перемещает фигуру.
   */
  invalidateDeployMap() { this._deployMap = null; this._legalityStale = true; }

  /**
   * После изменения рельефа фигуры, стоящие на клетках, которые они больше не могут занимать (ближний оперативник на
   * клетке, ставшей 射击台; что угодно на клетке, ставшей недоступной для развёртывания), отзываются как при 撤退:
   * оперативник идёт в руку (при переполнении во временную зону — пассивное перемещение; игрок переразмещает его во
   * время подготовки), его призывы уходят с доски вместе с ним; призыв возвращается в стек владельца. Ничего не теряется:
   * если и рука, и временная зона полны, фигура остаётся на месте.
   * @returns {number} сколько фигур перемещено
   */
  _evictIllegal() {
    this._legalityStale = false;
    const names = [];
    let moved = 0;
    for (const kind of ['chess', 'token']) {
      for (const { r, c, piece } of boardOrder(this.board)) {
        if (piece.kind !== kind || this._legal(piece, r, c)) continue;
        const key = tileKey(r, c);
        this.board.delete(key);
        const ok = kind === 'chess' ? !!this.stow(piece, { allowTemp: true }) : this._returnToken(piece);
        if (!ok) { this.board.set(key, piece); continue; }
        moved++;
        if (kind === 'chess') {
          this.removeTokensOf(piece.uid);
          const rec = this.gd.chess(piece.id);
          names.push(rec && rec.name ? rec.name : piece.id);
        }
      }
    }
    if (names.length) this.m.toast(this, 'warn', `Изменение рельефа: ${names.join(', ')} не могут оставаться на месте и отозваны в зону подготовки`);
    return moved;
  }

  dirty() { this.m.markPrivate(this); }

  // =================================================================================================
  // учёт фигур

  newPiece(kind, id, extra = {}) {
    return { uid: this.m.nextUid(), kind, id, items: kind === 'chess' ? [] : undefined, count: kind === 'token' ? 1 : undefined, ownerUid: undefined, poolCopies: 0, boughtRound: this.m.round, meta: {}, ...extra };
  }

  /**
   * Находит фигуру по uid. Возвращает { piece, area: 'board'|'hand'|'temp'|'equipped', idx?, key?, holder? } или null.
   */
  find(uid) {
    if (!Number.isInteger(uid)) return null;
    for (let i = 0; i < this.hand.length; i++) {
      const p = this.hand[i];
      if (!p) continue;
      if (p.uid === uid) return { piece: p, area: 'hand', idx: i };
      if (p.items) for (const it of p.items) if (it.uid === uid) return { piece: it, area: 'equipped', holder: p };
    }
    for (let i = 0; i < this.temp.length; i++) {
      const p = this.temp[i];
      if (!p) continue;
      if (p.uid === uid) return { piece: p, area: 'temp', idx: i };
      if (p.items) for (const it of p.items) if (it.uid === uid) return { piece: it, area: 'equipped', holder: p };
    }
    for (const [key, p] of this.board) {
      if (p.uid === uid) return { piece: p, area: 'board', key };
      if (p.items) for (const it of p.items) if (it.uid === uid) return { piece: it, area: 'equipped', holder: p };
    }
    return null;
  }

  /** Все принадлежащие оперативники: доска (в порядке развёртывания), затем рука, затем временная зона. */
  allChess() {
    const out = [];
    for (const { piece } of boardOrder(this.board)) if (piece.kind === 'chess') out.push(piece);
    for (const p of this.hand) if (p && p.kind === 'chess') out.push(p);
    for (const p of this.temp) if (p && p.kind === 'chess') out.push(p);
    return out;
  }

  /** Расположения принадлежащих фигур в порядке предпочтения при слиянии: временная зона, рука (слева→направо), доска (порядок чтения). */
  _chessLocations() {
    const out = [];
    for (let i = 0; i < this.temp.length; i++) if (this.temp[i] && this.temp[i].kind === 'chess') out.push({ piece: this.temp[i], area: 'temp', idx: i });
    for (let i = 0; i < this.hand.length; i++) if (this.hand[i] && this.hand[i].kind === 'chess') out.push({ piece: this.hand[i], area: 'hand', idx: i });
    for (const { r, c, piece } of boardOrder(this.board)) if (piece.kind === 'chess') out.push({ piece, area: 'board', key: tileKey(r, c) });
    return out;
  }

  /** Убирает найденную фигуру из её контейнера (без побочных эффектов). */
  _detach(loc) {
    if (!loc) return;
    if (loc.area === 'hand') this.hand[loc.idx] = null;
    else if (loc.area === 'temp') { this.temp[loc.idx] = null; this._tempDue.delete(loc.piece.uid); }
    else if (loc.area === 'board') this.board.delete(loc.key);
    else if (loc.area === 'equipped') {
      const i = loc.holder.items.indexOf(loc.piece);
      if (i >= 0) loc.holder.items.splice(i, 1);
    }
  }

  /**
   * Помещает фигуру в руку (справа налево) или, если `allowTemp`, в слоты временной зоны (должна в дедлайн первой
   * подготовки, в которой игрок может с ней что-то сделать, _tempDueNow). Возвращает 'hand' | 'temp' | null.
   */
  stow(piece, { allowTemp = true, toTemp = false, preferIdx = null } = {}) {
    if (!toTemp) {
      if (Number.isInteger(preferIdx) && preferIdx >= 0 && preferIdx < this.hand.length && this.hand[preferIdx] == null) {
        this.hand[preferIdx] = piece;
        return 'hand';
      }
      const i = freeSlot(this.hand);
      if (i >= 0) { this.hand[i] = piece; return 'hand'; }
      if (!allowTemp) return null;
    }
    const j = freeSlot(this.temp);
    if (j >= 0) { this._putTemp(j, piece); return 'temp'; }
    return null;
  }

  /**
   * Покомпонентный счётчик текущего раунда (`piece.meta.round` = { r, n: { key: count } }): 0 для ключа, который в этом
   * раунде ещё не считался. Счётчики принадлежат оперативнику: перемещение их сохраняет, новая фигура (купленная,
   * выданная, полученная трансформацией) начинается с 0, а элитный, слитый в этом раунде, сохраняет наибольший счётчик
   * своих копий (_mergeChess) — «первое активное обновление в этом раунде» у 拉普兰德 это первое ручное обновление,
   * свидетелем которого она была (обратная связь игрока после 0.1.0, garrisons/meta.js).
   */
  pieceRoundCount(piece, key) {
    const rc = piece && piece.meta && piece.meta.round;
    return rc && rc.r === this.m.round && Number.isFinite(rc.n[key]) ? rc.n[key] : 0;
  }

  /** Добавляет `n` к счётчику фигуры за текущий раунд (pieceRoundCount); возвращает новое значение. */
  bumpPieceRoundCount(piece, key, n = 1) {
    if (!piece || typeof key !== 'string' || !Number.isFinite(n)) return 0;
    if (!piece.meta || typeof piece.meta !== 'object') piece.meta = {};
    const v = this.pieceRoundCount(piece, key) + n;
    if (!piece.meta.round || piece.meta.round.r !== this.m.round) piece.meta.round = { r: this.m.round, n: {} };
    piece.meta.round.n[key] = v;
    return v;
  }

  /** Возвращает копии фигуры в пул (её экипированные предметы обрабатывает вызывающий). */
  returnCopies(piece) {
    if (piece && piece.kind === 'chess' && piece.poolCopies > 0) {
      this.m.pool.give(this.gd.baseIdOf(piece.id), piece.poolCopies);
      piece.poolCopies = 0;
    }
  }

  /** Удаляет все токены, принадлежащие оперативнику (доска, рука, временная зона). */
  removeTokensOf(ownerUid) {
    for (const [k, p] of [...this.board]) if (p.kind === 'token' && p.ownerUid === ownerUid) this.board.delete(k);
    for (let i = 0; i < this.hand.length; i++) if (this.hand[i] && this.hand[i].kind === 'token' && this.hand[i].ownerUid === ownerUid) this.hand[i] = null;
    for (let i = 0; i < this.temp.length; i++) if (this.temp[i] && this.temp[i].kind === 'token' && this.temp[i].ownerUid === ownerUid) this.temp[i] = null;
  }

  /**
   * Владелец, меняющий свою клетку на доске (перемещён, поменян): его призывы на доске возвращаются в стек (PRTS
   * 卫戍协议/帮助 «при перемещении оперативника все его призывы уходят с поля и сбрасываются в руку»); при переполнении —
   * во временную зону, если нет стека или слота (потерянный там стек вернётся в начале следующего раунда). `keep`:
   * призыв, только что размещённый игроком (тот, что перетащен на своего владельца и поменял владельца местами),
   * остаётся там, где был поставлен.
   */
  _liftTokensOf(ownerUid, keep = null) {
    for (const [k, p] of [...this.board]) {
      if (p.kind !== 'token' || p.ownerUid !== ownerUid || p === keep) continue;
      this.board.delete(k);
      if (!this._returnToken(p, null, { allowTemp: true })) this.board.set(k, p); // некуда деть: остаётся на месте
    }
  }

  /** Сколько копий одного типа призыва есть у владельца (размещённые фигуры + стеки в руке / временной зоне). */
  _tokenCountOf(ownerUid, tokenId) {
    const mine = (p) => !!p && p.kind === 'token' && p.ownerUid === ownerUid && p.id === tokenId;
    let n = 0;
    for (const p of this.board.values()) if (mine(p)) n += p.count || 1;
    for (const p of this.hand) if (mine(p)) n += p.count || 1;
    for (const p of this.temp) if (mine(p)) n += p.count || 1;
    return n;
  }

  /**
   * Владелец на доске: отправляет свои размещаемые призывы в руку (один стек на тип токена, добитый до лимита
   * развёртывания; gamedata.placeableTokens / tokens.json `placeable`, user playtest #6) — те, что делает его
   * экипированный навык / модуль (DESIGN §16: у 赫默 S2 — дрон 医疗无人机, у 赫默 S1 — ни одного). Вызывается, когда
   * владелец размещён, и в начале каждого раунда, что возвращает стек, убранный из временной зоны в дедлайн последней
   * подготовки (PRTS 卫戍协议/帮助 §手牌区 «призывы оперативника возвращаются в следующем раунде»); копии, которые у
   * владельца уже есть (размещённые или в стеке), повторно не выдаются.
   */
  grantTokensFor(owner) {
    const rec = owner && owner.kind === 'chess' ? this.gd.chess(owner.id) : null;
    if (!rec) return;
    for (const { tokenId, count } of this.gd.placeableTokens(owner.id, this.loadoutFor(rec))) {
      const missing = count - this._tokenCountOf(owner.uid, tokenId);
      if (missing <= 0) continue;
      const stack = [...this.hand, ...this.temp].find((p) => p && p.kind === 'token' && p.ownerUid === owner.uid && p.id === tokenId);
      if (stack) { stack.count = (stack.count || 1) + missing; continue; }
      const t = this.newPiece('token', tokenId, { count: missing, ownerUid: owner.uid });
      this.stow(t, { allowTemp: true });
    }
  }

  // =================================================================================================
  // приобретение, слияния, повышение

  /** Обычные копии базового оперативника, которыми владеет игрок сейчас (доска / рука / временная зона). */
  countCopies(baseId) {
    let n = 0;
    for (const loc of this._chessLocations()) {
      const p = loc.piece;
      if (!this.gd.isGolden(p.id) && this.gd.baseIdOf(p.id) === baseId) n++;
    }
    return n;
  }

  /** Завершит ли приобретение ещё одной обычной копии `chessId` слияние? */
  completesChessMerge(chessId) {
    const rec = this.gd.chess(chessId);
    if (!rec || rec.isGolden) return false;
    const need = this.gd.mergeCount(chessId);
    if (!(need > 1) || !this.gd.goldenIdOf(chessId)) return false;
    return this.countCopies(this.gd.baseIdOf(chessId)) + 1 >= need;
  }

  /**
   * Приобретает оперативника (покупка, награда, выдача эффекта). Забирает копии из пула (обычный 1, элитный
   * goldenCopies), если доступны, немедленно сливает, если это завершает набор, иначе кладёт его (рука, при
   * переполнении временная зона). Запускает onGain (для элитного, когда произошло слияние, research 01 §7 «1+1+2»).
   * Возвращает принадлежащую фигуру (элитного после слияния) или null.
   * @param {string} chessId
   * @param {{ source?: string, toTemp?: boolean, fromPool?: boolean, silent?: boolean }} [opts]
   */
  acquireChess(chessId, { source = 'grant', toTemp = false, fromPool = true, silent = false } = {}) {
    const rec = this.gd.chess(chessId);
    if (!rec) return null;
    const base = this.gd.baseIdOf(chessId);
    const need = rec.isGolden ? this.gd.goldenCopies : 1;
    const taken = fromPool ? this.m.pool.take(base, need) : 0;
    const piece = this.newPiece('chess', chessId, { poolCopies: taken });
    this.round.gainedChess++;
    let owned = piece;
    if (!rec.isGolden && this.completesChessMerge(chessId)) {
      owned = this._mergeChess(base, piece);
      if (!owned) return null;
    } else {
      const where = this.stow(piece, { allowTemp: true, toTemp });
      if (!where) {
        this.returnCopies(piece);
        this.m.toast(this, 'warn', 'Зона подготовки заполнена, полученный оперативник возвращён');
        return null;
      }
    }
    this.recompute();
    if (!silent) this.m.dispatch(this, 'onGain', { piece: owned, kind: 'chess', source });
    this.recompute();
    return owned;
  }

  /**
   * Сливает `need` обычных копий `baseId` (сначала входящая ещё не уложенная фигура, затем временная зона, рука,
   * доска) в элитного — PRTS 卫戍协议/帮助 §干员的获得与精锐化: «отправить 1 оперативника в состоянии 【Элитный】 в руку
   * (если расходуется развёрнутый в боевой зоне оперативник, то отправить в соответствующую позицию боевой зоны)»
   * (это подтвердил follow-up user playtest #6). Клетка (`mergeTile`): когда одна из израсходованных копий стояла на
   * доске, элитный занимает её клетку и направление — если их несколько, та, что разворачивается первой (порядок чтения
   * доски: сверху → вниз, затем слева → направо) [ASSUMED]. Входящая копия никогда не разворачивается (трансформация
   * 突变细胞 уничтожила своего носителя до получения: эта клетка не принадлежит ни одной копии). Он заменяет развёрнутую
   * копию, так что число развёрнутых не растёт. Иначе элитный идёт в руку, при переполнении во временную зону — в том
   * числе вне фазы подготовки (элитный из слияния в РАСЧЁТЕ ждёт во временной зоне до следующей подготовки, tempDue).
   * Снаряжение копий возвращается в руку («после повышения оперативника выданное снаряжение возвращается в зону
   * подготовки»; при переполнении — во временную зону; если обе полны, оно остаётся на элитном, до его equipPerChess
   * (2) слотов — любой дальнейший предмет уничтожается с предупреждением в лог, как и до официального правила), а
   * пара одинаковых нормальных предметов среди него сливается, как любое приобретение (checkItemMerges); их призывы
   * удаляются, а элитный на доске получает собственный стек призывов (grantTokensFor: его настройка, как при любом
   * размещении). Возвращает фигуру элитного (или null, если элитного не удалось сохранить).
   * @param {string} baseId
   * @param {any} incoming приобретённая ещё не уложенная копия (null: только принадлежащие копии)
   */
  _mergeChess(baseId, incoming) {
    const need = this.gd.mergeCount(baseId);
    const goldenId = this.gd.goldenIdOf(baseId);
    if (!(need > 1) || !goldenId) return null;
    const locs = this._chessLocations().filter((l) => !this.gd.isGolden(l.piece.id) && this.gd.baseIdOf(l.piece.id) === baseId);
    const consumed = [];
    if (incoming) consumed.push({ piece: incoming, area: 'new' });
    for (const l of locs) { if (consumed.length >= need) break; consumed.push(l); }
    if (consumed.length < need) return null;
    let copies = 0;
    const items = [];
    for (const l of consumed) {
      copies += l.piece.poolCopies || 0;
      if (l.area !== 'new') this._detach(l);
      this.removeTokensOf(l.piece.uid);
      for (const it of l.piece.items || []) items.push(it);
      l.piece.items = [];
    }
    const elite = this.newPiece('chess', goldenId, { poolCopies: copies });
    // покомпонентные счётчики этого раунда: наибольшее из копий (элитный, собранный из 拉普兰德, которые уже увидели
    // своё первое обновление в этом раунде, не срабатывает снова — [ASSUMED] консервативно, pieceRoundCount)
    for (const l of consumed) {
      const rc = l.piece.meta && l.piece.meta.round;
      if (rc && rc.r === this.m.round) for (const [k, v] of Object.entries(rc.n)) this.bumpPieceRoundCount(elite, k, Math.max(0, v - this.pieceRoundCount(elite, k)));
    }
    const deployed = consumed.filter((l) => l.key && !this.board.has(l.key)).map((l) => ({ key: l.key, dir: pieceDir(l.piece) }));
    const toTile = (t) => { elite.dir = parseDir(t.dir) || 'RIGHT'; this.board.set(t.key, elite); return 'board'; };
    const tile = mergeTile(deployed, (r, c) => this._legal(elite, r, c));
    let where = tile ? toTile(tile) : this.stow(elite, { allowTemp: true });
    // рука и временная зона полны, и ни одна развёрнутая клетка не легальна для него (изменение рельефа ещё не
    // перепроверено): он остаётся на клетке первой развёрнутой копии, а не теряется, как фигура, для которой
    // _evictIllegal не нашёл места
    if (!where && deployed.length) where = toTile(mergeTile(deployed));
    for (const it of items) {
      if (this.stow(it, { allowTemp: true })) continue;
      if (where && elite.items.length < this.gd.equipPerChess) { elite.items.push(it); continue; }
      this.m.log.warn?.(`[match ${this.m.roomCode}] ${this.playerId}: returned item ${it.id} destroyed (no space)`);
    }
    // возвращённое снаряжение следует правилу автослияния, как и любое другое приобретение («при наличии 2 одинаковых
    // начальных предметов… они автоматически сливаются»)
    this.checkItemMerges();
    // развёрнут как любой оперативник, поставленный рукой: его ручные размещаемые призывы идут в руку (после
    // возвращённого снаряжения, которое во временной зоне было бы потеряно — стек призыва, убранный там, вернётся
    // в начале следующего раунда)
    if (where === 'board') this.grantTokensFor(elite);
    if (!where) {
      this.m.pool.give(baseId, copies);
      this.m.toast(this, 'warn', 'Зона подготовки заполнена, повышенный элитный оперативник не помещается');
      this.m.log.warn?.(`[match ${this.m.roomCode}] ${this.playerId}: merge result dropped (hand+temp full)`);
      this.recompute();
      return null;
    }
    this.stats.merges++;
    this.pushRewardOffer('merge');
    const rec = this.gd.chess(goldenId);
    this.m.tickerFor('GOLDEN_CHAR', [this.name, rec ? rec.name : goldenId], { playerId: this.playerId });
    this.m.dispatch(this, 'onMerge', { kind: 'chess', piece: elite, baseId, consumed: consumed.map((l) => l.piece.uid), area: where });
    return elite;
  }

  /** Повышает обычного оперативника до его элитного на месте (升华, 博士投影). Забирает дополнительные копии из пула, если доступны. */
  promote(piece) {
    if (!piece || piece.kind !== 'chess' || this.gd.isGolden(piece.id)) return false;
    const goldenId = this.gd.goldenIdOf(piece.id);
    if (!goldenId) return false;
    const base = this.gd.baseIdOf(piece.id);
    const extra = Math.max(0, this.gd.goldenCopies - (piece.poolCopies || 0));
    piece.poolCopies = (piece.poolCopies || 0) + this.m.pool.take(base, extra);
    piece.id = goldenId;
    this.recompute();
    return true;
  }

  /**
   * Трансформация (突变细胞 «после боя носитель заменяется случайным оперативником на один ранг выше»; PRTS 卫戍协议：
   * 盟约 нижняя половина / PRTS盟约记录 прим.: «при срабатывании исходный оперативник уничтожается, получается случайный
   * начальный оперативник на один ранг выше (максимум шестой)»): уничтожение, за которым следует получение. Носитель
   * уничтожается там, где стоит — клетка доски освобождается (счёт развёртывания уменьшается), его призывы удаляются,
   * его копии возвращаются в пул. Его снаряжение, включая саму клетку, снимается первым (PRTS 卫戍协议/帮助 «при потере
   * этого оперативника (продажа, уничтожение, слияние и т. п.)… снимается автоматически»): в руку, при переполнении во
   * временную зону, автослияние, как при любом приобретении. Затем `newId` получается как любой другой приобретённый
   * оперативник (acquireChess, onGain source 'transform'): рука, при переполнении временная зона («при отправке в руку
   * ресурсы сначала заполняют пустые слоты справа налево»), а если обе полны — возвращается в пул («зона подготовки
   * заполнена, полученный оперативник возвращён»); он не получает карту призыва в руку (только размещение её приносит), и
   * слияние, которое он завершает, следует обычному правилу (_mergeChess: элитный на клетке израсходованной развёрнутой
   * копии, иначе в руке — освобождённая клетка носителя ничьей копией не является). Предмет, для которого не нашлось
   * слота, занимает освободившийся при приобретении (слияние расходует копии), иначе остаётся на полученном оперативнике
   * до его equipPerChess слотов, иначе уничтожается с предупреждением в лог (как при слиянии). Официальные кадры (bilibili
   * BV1vzyVBuEN9, BV1Qkw1zMEoR; указано в PR #2): на следующей подготовке клетка носителя пуста, на одно развёртывание
   * больше, а новый оперативник ждёт в 整备区.
   * @param {any} piece носитель (принадлежащая фигура оперативника)
   * @param {string} newId id оперативника, полученного вместо него
   * @returns {any} полученная фигура (элитный, если он завершил слияние) или null
   */
  transformChess(piece, newId) {
    const loc = this.find(piece.uid);
    if (!loc || loc.piece.kind !== 'chess' || !this.gd.chess(newId)) return null;
    // 原干员销毁: с клетки / слота, его призывы удалены, его копии возвращаются в пул
    this._detach(loc);
    this.removeTokensOf(piece.uid);
    const items = piece.items || [];
    piece.items = [];
    this.returnCopies(piece);
    // его снаряжение снимается первым (возвращённая пара автосливается, что может освободить слот для приобретения)
    const left = items.filter((it) => !this.stow(it, { allowTemp: true }));
    this.checkItemMerges();
    // 获得一名…干员: получается как любой другой приобретённый оперативник
    const np = this.acquireChess(newId, { source: 'transform' });
    for (const it of left) {
      if (this.stow(it, { allowTemp: true })) continue;
      if (np && this.find(np.uid) && np.items.length < this.gd.equipPerChess) { np.items.push(it); continue; }
      this.m.log.warn?.(`[match ${this.m.roomCode}] ${this.playerId}: returned item ${it.id} destroyed (no space)`);
    }
    if (left.length) this.checkItemMerges();
    this.recompute();
    return np;
  }

  /** Обычный предмет → золотая версия на месте (整备). */
  upgradeItem(piece) {
    const rec = this.gd.item(piece.id);
    if (!rec || rec.isGolden) return false;
    const gid = rec.upgradeChessId || rec.goldenId;
    if (!gid || !this.gd.item(gid)) return false;
    piece.id = gid;
    this.recompute();
    return true;
  }

  /**
   * Ставит в очередь предложение награды: `count` РАЗНЫХ оперативников ранга min(уровень + смещение, maxTier) по
   * цене 0 (выбрать 1). Каждый — взвешенный по копиям бросок из общего пула, исключая уже выбранных; ранг, оставшийся
   * без другого оперативника, добирается из ранга ниже (user playtest #6 item 19: официальная награда за повышение
   * никогда не предлагает одного оперативника дважды — отчёт пользователя из первых рук; слоты обычного магазина
   * могут повторяться). Предложение не резервирует копии (выбор забирает одну).
   */
  pushRewardOffer(source = 'merge', { tier = null, ids = null, label = null } = {}) {
    const ro = this.gd.rewardOffer();
    const t = Number.isInteger(tier) ? tier : Math.min(this.shop.level + ro.tierOffset, ro.maxTier);
    // предложение никогда не показывает одного оперативника дважды, кто бы ни строил список (user playtest #6 item 19)
    let list = Array.isArray(ids) ? [...new Set(ids)].filter((id) => this.gd.chess(id)) : null;
    if (!list) {
      list = [];
      const fresh = (id) => !list.includes(id);
      for (let i = 0; i < ro.count; i++) {
        let id = null;
        for (let tt = t; tt >= 1 && !id; tt--) id = this.m.pool.roll(this.m.rngShop, { tier: tt, filter: fresh });
        if (id) list.push(id);
      }
    }
    if (!list.length) return null;
    const offer = { tier: t, source, label: typeof label === 'string' && label ? label : null, slots: list.slice(0, MAX_OFFER_SLOTS).map((id) => ({ kind: 'chess', id, price: ro.price, sold: false })) };
    this.offers.push(offer);
    this.dirty();
    return offer;
  }

  /**
   * Ставит в очередь бесплатное предложение выбора одного предмета (凯瑟琳 定向投放, 娜仁图亚 见者有份); показывается
   * как shop.rewardOffer со слотами вида 'item' под его `label` (имя эффекта; player report #6 после 0.1.0).
   */
  pushItemOffer(ids, { source = 'effect', tier = null, label = null } = {}) {
    const list = [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => this.gd.item(id)).slice(0, MAX_OFFER_SLOTS);
    if (!list.length) return null;
    const offer = { tier: Number.isInteger(tier) ? tier : null, source, label: typeof label === 'string' && label ? label : null, slots: list.map((id) => ({ kind: 'item', id, price: 0, sold: false })) };
    this.offers.push(offer);
    this.dirty();
    return offer;
  }

  /** Кандидаты на слияние предметов: обычные, сливаемые, с золотой версией. */
  _itemMergeable(id) {
    const rec = this.gd.item(id);
    if (!rec || rec.isGolden || rec.itemType !== 'EQUIP' || !rec.mergeable) return false;
    const n = Number.isInteger(rec.upgradeNum) ? rec.upgradeNum : this.gd.itemMergeCount;
    if (!(n > 1 && n < 100)) return false;
    const gid = rec.upgradeChessId || rec.goldenId;
    return !!(gid && this.gd.item(gid));
  }

  _itemLocations(id) {
    const out = [];
    for (let i = 0; i < this.temp.length; i++) if (this.temp[i] && this.temp[i].kind === 'item' && this.temp[i].id === id) out.push({ piece: this.temp[i], area: 'temp', idx: i });
    for (let i = 0; i < this.hand.length; i++) if (this.hand[i] && this.hand[i].kind === 'item' && this.hand[i].id === id) out.push({ piece: this.hand[i], area: 'hand', idx: i });
    for (const holder of this.allChess()) for (const it of holder.items || []) if (it.id === id) out.push({ piece: it, area: 'equipped', holder });
    return out;
  }

  completesItemMerge(id) {
    if (!this._itemMergeable(id)) return false;
    const rec = this.gd.item(id);
    const n = Number.isInteger(rec.upgradeNum) ? rec.upgradeNum : this.gd.itemMergeCount;
    return this._itemLocations(id).length + 1 >= n;
  }

  /**
   * Приобретает предмет (покупка, карта поставки, выдача). Сливается с идентичной обычной копией (рука / временная
   * зона / экипировано) в золотой предмет (в руку). Возвращает принадлежащую фигуру или null.
   */
  acquireItem(itemId, { source = 'grant', toTemp = false, silent = false } = {}) {
    const rec = this.gd.item(itemId);
    if (!rec) return null;
    let piece = this.newPiece('item', itemId);
    if (this.completesItemMerge(itemId)) {
      piece = this._mergeItem(itemId, piece);
      if (!piece) return null;
    } else if (!this.stow(piece, { allowTemp: true, toTemp })) {
      this.m.toast(this, 'warn', 'Зона подготовки заполнена, полученное снаряжение уничтожено');
      return null;
    }
    this.recompute();
    if (!silent) this.m.dispatch(this, 'onGain', { piece, kind: 'item', source });
    return piece;
  }

  _mergeItem(itemId, incoming = null) {
    const rec = this.gd.item(itemId);
    const need = Number.isInteger(rec.upgradeNum) ? rec.upgradeNum : this.gd.itemMergeCount;
    const locs = this._itemLocations(itemId);
    const consumed = incoming ? [{ piece: incoming, area: 'new' }] : [];
    for (const l of locs) { if (consumed.length >= need) break; consumed.push(l); }
    if (consumed.length < need) return null;
    // запоминаем, где стояли экипированные близнецы: при полной руке И полной временной зоне золотой предмет занимает
    // слот первого из них
    const slotOf = consumed.filter((l) => l.area === 'equipped').map((l) => ({ holder: l.holder, idx: l.holder.items.indexOf(l.piece) }));
    for (const l of consumed) if (l.area !== 'new') this._detach(l);
    const golden = this.newPiece('item', rec.upgradeChessId || rec.goldenId);
    if (!this.stow(golden, { allowTemp: true })) {
      const at = slotOf[0];
      if (!at || !this.find(at.holder.uid)) {
        this.m.toast(this, 'warn', 'Зона подготовки заполнена, синтезированное снаряжение уничтожено');
        return null;
      }
      at.holder.items.splice(Math.max(0, Math.min(at.idx, at.holder.items.length)), 0, golden);
    }
    this.stats.itemMerges++;
    this.m.dispatch(this, 'onMerge', { kind: 'item', piece: golden, itemId, consumed: consumed.map((l) => l.piece.uid) });
    return golden;
  }

  /** Сливает каждую пару одинаковых нормальных предметов, которыми владеет игрок сейчас (после экипировок / возвратов). */
  checkItemMerges() {
    for (let guard = 0; guard < 20; guard++) {
      const counts = new Map();
      const scan = (p) => { if (p && p.kind === 'item' && this._itemMergeable(p.id)) counts.set(p.id, (counts.get(p.id) || 0) + 1); };
      for (const p of this.hand) scan(p);
      for (const p of this.temp) scan(p);
      for (const holder of this.allChess()) for (const it of holder.items || []) scan(it);
      let did = false;
      for (const [id, n] of counts) {
        const rec = this.gd.item(id);
        const need = Number.isInteger(rec.upgradeNum) ? rec.upgradeNum : this.gd.itemMergeCount;
        if (n >= need) { if (this._mergeItem(id, null)) did = true; break; }
      }
      if (!did) return;
    }
  }

  // =================================================================================================
  // экономика

  addFunds(n, { reason = '' } = {}) {
    if (!Number.isFinite(n) || n === 0) return 0;
    const v = Math.trunc(n);
    const before = this.funds;
    this.funds = Math.max(0, this.funds + v);
    if (v > 0) this.stats.fundsGained += v;
    this.dirty();
    return this.funds - before;
  }

  spend(n) {
    const v = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    if (v > this.funds) return false;
    this.funds -= v;
    this.stats.gold += v;
    this.round.spent += v;
    this.dirty();
    return true;
  }

  /** onSpend, запускается один раз, когда действие платежа завершено (покупка / обновление / levelUp / награда / эффект). */
  _afterSpend(amount, reason) {
    if (!(amount > 0)) return;
    this.m.dispatch(this, 'onSpend', { amount, reason, total: this.stats.gold });
  }

  /**
   * Прирост стаков альянса (на стороне подготовки). `requireActive` = «дать уже активированному 【X】 +N стаков».
   * Возвращает добавленные слои: не больше оставшегося места под BOND_LAYER_CAP (999, shared/constants.js) — прирост
   * на пределе даёт 0 и ничего не запускает.
   */
  addLayers(bondId, n, { requireActive = false, reason = '' } = {}) {
    if (!this.gd.bond(bondId) || !Number.isFinite(n) || n <= 0) return 0;
    if (requireActive && !(this.bonds[bondId] && this.bonds[bondId].active)) return 0;
    const before = this.layers[bondId] || 0;
    const add = layerGainRoom(before, Math.floor(n));
    if (add <= 0) return 0;
    this.layers[bondId] = before + add;
    this.recompute();
    this.m.dispatch(this, 'onLayers', { bondId, from: before, to: before + add, reason });
    return add;
  }

  // =================================================================================================
  // магазин

  /** Действующая цена слота магазина после модификаторов onPrice (никогда не отрицательная). */
  priceOf(slot) {
    if (!slot) return 0;
    const ev = { slot, kind: slot.kind, id: slot.id, price: slot.basePrice };
    this.m.dispatch(this, 'onPrice', ev, { quiet: true });
    const p = Number(ev.price);
    return Number.isFinite(p) ? Math.max(0, Math.round(p)) : slot.basePrice;
  }

  _rollChessSlot() {
    const id = this.m.pool.roll(this.m.rngShop, { maxTier: this.shop.level });
    return id ? { kind: 'chess', id, basePrice: this.gd.chessPrice(id), frozen: false, sold: false } : null;
  }

  _rollItemSlot() {
    const id = this.m.pool.rollItem(this.m.rngShop, this.shop.level);
    return id ? { kind: 'item', id, basePrice: this.gd.itemPrice(id), frozen: false, sold: false } : null;
  }

  /**
   * Перебрасывает магазин. keepFrozen → замороженные нераспроданные слоты выживают (начало раунда); иначе
   * перебрасывается всё (ручное обновление). Количество слотов следует текущему уровню.
   */
  rollShop({ keepFrozen = false } = {}) {
    const { chess: nChess, item: nItem } = this.gd.shopSlots(this.shop.level);
    const old = this.shop.slots;
    const layout = this.shop.layout || { chess: old.length, item: 0 };
    const oldChess = old.slice(0, layout.chess);
    const oldItems = old.slice(layout.chess);
    const keep = (s, kind) => (keepFrozen && s && s.kind === kind && !s.sold && s.frozen ? { ...s } : null);
    // замороженные слоты сохраняют позицию; проданные / пустые / незамороженные перебрасываются
    const slots = [];
    for (let i = 0; i < nChess; i++) slots.push(keep(oldChess[i], 'chess') ?? this._rollChessSlot());
    for (let i = 0; i < nItem; i++) slots.push(keep(oldItems[i], 'item') ?? this._rollItemSlot());
    this.shop.slots = slots;
    this.shop.layout = { chess: nChess, item: nItem };
    for (const s of slots) if (s) s.frozen = this.shop.frozen;
    this.dirty();
  }

  /** Начало боя: незамороженные слоты опустошаются (research 01 A1). */
  clearUnfrozenShop() {
    this.shop.slots = this.shop.slots.map((s) => (s && s.frozen && !s.sold ? s : null));
    this.dirty();
  }

  // =================================================================================================
  // гейтинг

  _gate({ allowWhenReady = false } = {}) {
    if (!this.alive) return fail(ERR.ELIMINATED);
    if (this.m.phase !== PHASE.PREP) return fail(ERR.WRONG_PHASE);
    if (this.ready && !allowWhenReady) return fail(ERR.WRONG_PHASE, 'ready');
    return null;
  }

  // =================================================================================================
  // обработчики намерений

  buy(slotIdx) {
    const g = this._gate(); if (g) return g;
    if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= this.shop.slots.length) return fail(ERR.BAD_TARGET);
    const slot = this.shop.slots[slotIdx];
    if (!slot) return fail(ERR.BAD_TARGET);
    if (slot.sold) return fail(ERR.SOLD_OUT);
    const price = this.priceOf(slot);
    if (this.funds < price) return fail(ERR.NO_FUNDS);
    const handFull = freeSlot(this.hand) < 0;
    let piece;
    if (slot.kind === 'chess') {
      const rec = this.gd.chess(slot.id);
      if (!rec) return fail(ERR.BAD_TARGET);
      const base = this.gd.baseIdOf(slot.id);
      const need = rec.isGolden ? this.gd.goldenCopies : 1;
      if (this.m.pool.has(base) && this.m.pool.left(base) < need) return fail(ERR.SOLD_OUT);
      if (handFull && !this.completesChessMerge(slot.id)) return fail(ERR.HAND_FULL);
      this.spend(price);
      slot.sold = true;
      piece = this.acquireChess(slot.id, { source: 'buy' });
    } else {
      if (!this.gd.item(slot.id)) return fail(ERR.BAD_TARGET);
      if (handFull && !this.completesItemMerge(slot.id)) return fail(ERR.HAND_FULL);
      this.spend(price);
      slot.sold = true;
      piece = this.acquireItem(slot.id, { source: 'buy' });
    }
    this.stats.buys++;
    this.round.buys++;
    this.m.dispatch(this, 'onBuy', { piece, slot, price, kind: slot.kind });
    this._afterSpend(price, 'buy');
    this.recompute();
    return OK;
  }

  refresh() {
    const g = this._gate(); if (g) return g;
    const free = this.shop.freeRefreshes > 0;
    const price = free ? 0 : this.gd.refreshPrice;
    if (!free && this.funds < price) return fail(ERR.NO_FUNDS);
    if (free) this.shop.freeRefreshes--;
    else this.spend(price);
    this.rollShop({ keepFrozen: false });
    this.stats.refreshes++;
    this.round.refreshes++;
    this.m.dispatch(this, 'onRefresh', { slots: this.shop.slots, free, price });
    this._afterSpend(price, 'refresh');
    this.dirty();
    return OK;
  }

  freeze() {
    const g = this._gate(); if (g) return g;
    this.shop.frozen = !this.shop.frozen;
    for (const s of this.shop.slots) if (s && !s.sold) s.frozen = this.shop.frozen;
    this.dirty();
    return OK;
  }

  levelUp() {
    const g = this._gate(); if (g) return g;
    if (this.shop.level >= this.gd.maxShopLevel) return fail(ERR.MAX_LEVEL);
    const price = Math.max(0, this.shop.upgradePrice);
    if (this.funds < price) return fail(ERR.NO_FUNDS);
    this.spend(price);
    this.shop.level++;
    this.shop.upgradePrice = this.gd.upgradeBase(this.shop.level) ?? 0;
    this.m.tickerFor('SHOP_LEVEL', [this.name, String(this.shop.level)], { playerId: this.playerId, param: String(this.shop.level) });
    this.m.dispatch(this, 'onLevelUp', { level: this.shop.level, price });
    this._afterSpend(price, 'levelUp');
    this.dirty();
    return OK;
  }

  sell(uid) {
    const g = this._gate(); if (g) return g;
    const loc = this.find(uid);
    if (!loc) return fail(ERR.BAD_TARGET);
    if (loc.piece.kind !== 'chess') return fail(ERR.BAD_TARGET, loc.piece.kind === 'item' ? 'items cannot be sold' : 'tokens cannot be sold');
    const piece = loc.piece;
    // его снаряжение возвращается в руку (при переполнении во временную зону): отказать, а не уничтожать, если места нет
    const room = this.hand.filter((x) => x == null).length + this.temp.filter((x) => x == null).length + (loc.area === 'hand' || loc.area === 'temp' ? 1 : 0);
    if ((piece.items || []).length > room) return fail(ERR.HAND_FULL, 'no room for the equipment');
    this._detach(loc);
    this.removeTokensOf(piece.uid);
    for (const it of piece.items || []) {
      if (!this.stow(it, { allowTemp: true })) this.m.log.warn?.(`[match ${this.m.roomCode}] ${this.playerId}: item ${it.id} lost on sell (no space)`);
    }
    piece.items = [];
    this.returnCopies(piece);
    const ev = { piece, gain: this.gd.sellPrice(piece.id) };
    this.m.dispatch(this, 'onSold', ev);
    const gain = Number.isFinite(ev.gain) ? Math.max(0, Math.trunc(ev.gain)) : 1;
    this.addFunds(gain, { reason: 'sell' });
    this.stats.sells++;
    this.round.sells++;
    this.checkItemMerges();
    this.recompute();
    return OK;
  }

  /**
   * g.move {uid, to, dir?}. Фигуры: оперативник / токен между доской, рукой и временной зоной; предметы только в
   * пределах руки. `dir` (UP|RIGHT|DOWN|LEFT, без него ⇒ RIGHT; `to.dir` читается, когда верхнеуровневый отсутствует) —
   * направление фигуры, перемещённой на доску — на её собственную клетку это разворот фигуры на месте.
   */
  move(uid, to, dir) {
    const g = this._gate(); if (g) return g;
    const loc = this.find(uid);
    if (!loc || loc.area === 'equipped') return fail(ERR.BAD_TARGET);
    if (!to || typeof to !== 'object') return fail(ERR.BAD_TARGET);
    const piece = loc.piece;
    if (to.area === 'board') {
      if (piece.kind === 'item') return fail(ERR.BAD_TARGET, 'items are equipped, not placed');
      const d = parseDir(dir !== undefined ? dir : to.dir);
      if (!d) return fail(ERR.BAD_TARGET, 'bad dir');
      return piece.kind === 'token' ? this._moveTokenToBoard(loc, to.row, to.col, d) : this._moveChessToBoard(loc, to.row, to.col, d);
    }
    if (to.area === 'hand') {
      if (!Number.isInteger(to.idx) || to.idx < 0 || to.idx >= this.hand.length) return fail(ERR.BAD_TARGET);
      return this._moveToHand(loc, to.idx);
    }
    return fail(ERR.BAD_TARGET);
  }

  _placementOf(piece) {
    const rec = piece.kind === 'token' ? this.gd.token(piece.id) : this.gd.chess(piece.id);
    return positionClass(rec);
  }

  /**
   * Где фигура может стоять на (r, c): карта развёртывания её класса позиции (board.js canPlace) и, для призыва, чей
   * текст читается как «развёртывается только в радиусе атаки призывателя» (tokens.json `ownerRange`: 狼群 у 伺夜,
   * 流形 у 缪尔赛思), клетка радиуса атаки её владельца (summonRange). `owner` = позиция владельца после проверяемого
   * хода ({ key, piece, dir }: призыв, поменявшийся местами со своим владельцем).
   */
  _legal(piece, r, c, owner = null) {
    if (!canPlace(this.deployMap(), this._placementOf(piece), r, c)) return false;
    const range = this.summonRange(piece, owner);
    return !range || range.has(tileKey(r, c));
  }

  /**
   * Ключи 'r,c' радиуса атаки владельца привязанного к радиусу призыва (player report #9 после 0.1.0: тактическую точку
   * 伺夜 можно было разместить где угодно; PRTS 狼群 特性 «развёртывается только в радиусе атаки призывателя»):
   * разрешённая с учётом настройки сетка радиуса владельца (shared/loadoutRecord.js attackRangeGrid — то, что
   * предпросматривает колесо развёртывания), повёрнутая по его направлению вокруг его клетки на доске (board.js
   * ownerRangeKeys). Null, когда фигура не привязана к радиусу или её владельца нет на доске (остальные правила
   * отказывают в таком размещении).
   * @param {any} piece
   * @param {{ key: string, piece: any, dir: string } | null} [owner] позиция владельца, которую использовать вместо текущей
   * @returns {Set<string> | null}
   */
  summonRange(piece, owner = null) {
    if (!piece || piece.kind !== 'token' || this.gd.token(piece.id)?.ownerRange !== true) return null;
    let at = owner;
    if (!at) for (const [key, p] of this.board) if (p.uid === piece.ownerUid && p.kind === 'chess') { at = { key, piece: p, dir: pieceDir(p) }; break; }
    const rec = at && this.gd.chess(at.piece.id);
    if (!rec) return null;
    const grid = attackRangeGrid(loadoutRecord(rec, resolveRecordLoadout(rec, this.loadoutFor(rec)))) || rec.rangeGrid;
    const [r, c] = parseKey(at.key);
    return ownerRangeKeys(grid, r, c, at.dir);
  }

  /**
   * Привязанные к радиусу призывы, оставшиеся вне радиуса атаки их владельца (владелец развёрнут на месте, повышен,
   * его настройка изменилась, перемещён без места, чтобы забрать свои призывы), возвращаются в стек — призыв, всё ещё
   * внутри, остаётся [ASSUMED: официально возвращает каждый призыв ПЕРЕМЕЩЁННОГО владельца, PRTS 卫戍协议/帮助 «при
   * перемещении оперативника все его призывы уходят с поля и сбрасываются в руку»; разворот на месте сохраняет те,
   * что может]. Тот, у которого нет ни стека, ни свободного слота в руке / временной зоне, уходит с доски: его стек
   * вернётся в начале следующего раунда, как стек призыва, убранный из временной зоны в дедлайн подготовки
   * (startRound → grantTokensFor, «призывы оперативника возвращаются в следующем раунде»), поэтому ни одно
   * нелегальное размещение не доходит до боя. Возвращает количество снятых с доски; тост называет их.
   */
  _liftOutOfRange() {
    const back = [], gone = [];
    for (const [k, p] of [...this.board]) {
      if (p.kind !== 'token') continue;
      const range = this.summonRange(p);
      if (!range || range.has(k)) continue;
      this.board.delete(k);
      (this._returnToken(p, null, { allowTemp: true }) ? back : gone).push(this.gd.token(p.id)?.name || p.id);
    }
    if (back.length) this.m.toast(this, 'warn', `${back.join(', ')} могут быть развёрнуты только в радиусе атаки призывателя, возвращены в зону подготовки`);
    if (gone.length) this.m.toast(this, 'warn', `${gone.join(', ')} могут быть развёрнуты только в радиусе атаки призывателя; зона подготовки полна, будут возвращены в следующем раунде`);
    return back.length + gone.length;
  }

  /**
   * Может ли каждый привязанный к радиусу призыв `owner`, оставшийся за пределами радиуса из (ownerKey, dir),
   * вернуться в свой стек или в свободный слот руки / временной зоны (_reorient иначе отказывает: собственный разворот
   * игрока никогда не стоит призыва, как и вывод в полную руку даёт HAND_FULL).
   */
  _roomForOutOfRange(owner, ownerKey, dir) {
    const at = { key: ownerKey, piece: owner, dir };
    const stacks = [...this.hand, ...this.temp].filter((p) => p && p.kind === 'token' && p.ownerUid === owner.uid);
    const needSlot = new Set();
    for (const [k, p] of this.board) {
      if (p.kind !== 'token' || p.ownerUid !== owner.uid || stacks.some((s) => s.id === p.id)) continue;
      const range = this.summonRange(p, at);
      if (range && !range.has(k)) needSlot.add(p.id);
    }
    return needSlot.size <= [...this.hand, ...this.temp].filter((p) => p == null).length;
  }

  _moveChessToBoard(loc, r, c, dir = 'RIGHT') {
    const piece = loc.piece;
    if (!inField(r, c) || !this._legal(piece, r, c)) return fail(ERR.BAD_TILE);
    const key = tileKey(r, c);
    const occ = this.board.get(key) || null;
    if (occ === piece) return this._reorient(piece, dir);
    if (loc.area === 'board') {
      // доска → доска: ход или обмен (занявший должен быть легален на исходной клетке и сохраняет своё направление);
      // оперативник, меняющий свою клетку, уносит свои призывы с доски (обратно в стеки, _liftTokensOf) — включая его
      // собственный призыв, поменявшийся на его старой клетке, так что этому проверка клетки не нужна
      if (occ) {
        const [sr, sc] = parseKey(loc.key);
        const ownSummon = occ.kind === 'token' && occ.ownerUid === piece.uid;
        if (!ownSummon && !this._legal(occ, sr, sc)) return fail(ERR.BAD_TILE);
        this.board.set(loc.key, occ);
        if (occ.kind === 'chess') this._liftTokensOf(occ.uid);
      } else {
        this.board.delete(loc.key);
      }
      piece.dir = dir;
      this.board.set(key, piece);
      this._liftTokensOf(piece.uid);
      this.recompute();
      return OK;
    }
    // рука / временная зона → доска
    if (!occ || occ.kind !== 'chess') {
      if (this.deployCount >= this.deployCap) return fail(ERR.BOARD_FULL);
    }
    this._detach(loc);
    if (occ) {
      this.board.delete(key);
      if (occ.kind === 'chess') {
        this.removeTokensOf(occ.uid);
        this._putBack(loc, occ);
      } else {
        this._returnToken(occ, loc);
      }
    }
    piece.dir = dir;
    this.board.set(key, piece);
    this.grantTokensFor(piece);
    this.recompute();
    return OK;
  }

  /**
   * Разворот на месте (g.move на собственную клетку фигуры с новым направлением). Привязанные к радиусу призывы
   * владельца, оставшиеся за пределами нового радиуса, возвращаются в стек (recompute → _liftOutOfRange); HAND_FULL
   * (ничего не меняется), когда одному из них некуда деться.
   */
  _reorient(piece, dir) {
    if (pieceDir(piece) === dir) return OK;
    if (piece.kind === 'chess') {
      const loc = this.find(piece.uid);
      if (loc && loc.area === 'board' && !this._roomForOutOfRange(piece, loc.key, dir)) return fail(ERR.HAND_FULL);
    }
    piece.dir = dir;
    this.recompute();
    return OK;
  }

  /** Кладёт фигуру в слот контейнера, описанный `loc` (idx руки / временной зоны), или в любое свободное место. */
  _putBack(loc, piece) {
    if (loc.area === 'hand' && this.hand[loc.idx] == null) { this.hand[loc.idx] = piece; return true; }
    if (loc.area === 'temp' && this.temp[loc.idx] == null) { this._putTemp(loc.idx, piece); return true; }
    return !!this.stow(piece, { allowTemp: true });
  }

  /**
   * Токен с доски возвращается в руку: сливается в стек владельца, иначе занимает свободный слот. `allowTemp: false`
   * (собственный вывод игрока): стек призыва — это карта, поэтому при полной руке и отсутствии стека, куда влиться,
   * отказывается, как любая другая карта (research 01 A1), вместо переполнения во временную зону.
   */
  _returnToken(tok, preferLoc = null, { allowTemp = true } = {}) {
    const stack = [...this.hand, ...this.temp].find((p) => p && p.kind === 'token' && p.ownerUid === tok.ownerUid && p.id === tok.id);
    if (stack) { stack.count = (stack.count || 1) + (tok.count || 1); return true; }
    tok.count = tok.count || 1;
    if (preferLoc && preferLoc.area === 'hand' && this.hand[preferLoc.idx] == null) { this.hand[preferLoc.idx] = tok; return true; }
    return !!this.stow(tok, { allowTemp });
  }

  _moveTokenToBoard(loc, r, c, dir = 'RIGHT') {
    const piece = loc.piece;
    if (!inField(r, c)) return fail(ERR.BAD_TILE);
    const key = tileKey(r, c);
    const occ = this.board.get(key) || null;
    // призыв, перетащенный на своего владельца, меняется с ним местами: привязанный к радиусу должен быть внутри
    // радиуса владельца от клетки, которую владелец занимает (клетки призыва, с направлением владельца)
    const ownerAfter = loc.area === 'board' && occ && occ !== piece && occ.uid === piece.ownerUid ? { key: loc.key, piece: occ, dir: pieceDir(occ) } : null;
    if (!this._legal(piece, r, c, ownerAfter)) return fail(ERR.BAD_TILE);
    if (occ === piece) return this._reorient(piece, dir);
    if (loc.area === 'board') {
      // доска → доска: ход или обмен; оперативник, поменявшийся на старую клетку призыва, сменил свою клетку, поэтому
      // его другие призывы возвращаются в стеки, как у любого перемещённого оперативника (_liftTokensOf; только что
      // размещённый призыв остаётся)
      if (occ) {
        const [sr, sc] = parseKey(loc.key);
        if (!this._legal(occ, sr, sc)) return fail(ERR.BAD_TILE);
        this.board.set(loc.key, occ);
      } else {
        this.board.delete(loc.key);
      }
      piece.dir = dir;
      this.board.set(key, piece);
      if (occ && occ.kind === 'chess') this._liftTokensOf(occ.uid, piece);
      this.recompute();
      return OK;
    }
    if (occ) return fail(ERR.BAD_TILE, 'occupied');
    // владелец должен быть на доске, чтобы его призывы можно было развернуть
    const owner = [...this.board.values()].find((p) => p.uid === piece.ownerUid);
    if (!owner) return fail(ERR.BAD_TARGET, 'owner not deployed');
    if ((piece.count || 1) > 1) {
      piece.count -= 1;
      const one = this.newPiece('token', piece.id, { count: 1, ownerUid: piece.ownerUid, dir });
      this.board.set(key, one);
    } else {
      this._detach(loc);
      piece.count = 1;
      piece.dir = dir;
      this.board.set(key, piece);
    }
    this.recompute();
    return OK;
  }

  _moveToHand(loc, idx) {
    const piece = loc.piece;
    const occ = this.hand[idx];
    if (occ === piece) return OK;
    if (piece.kind === 'token') {
      if (loc.area !== 'board') {
        // стек токена в руке / временной зоне: обычный сдвиг / обмен слотами внутри контейнеров
        return this._swapContainers(loc, idx);
      }
      this.board.delete(loc.key);
      if (!this._returnToken(piece, occ == null ? { area: 'hand', idx } : null, { allowTemp: false })) {
        this.board.set(loc.key, piece);
        return fail(ERR.HAND_FULL);
      }
      this.recompute();
      return OK;
    }
    if (loc.area === 'board') {
      // вывод (撤退): в пустой слот или обмен с оперативником-занявшим (который занимает клетку доски). Стеки
      // собственных призывов фигуры уходят из руки вместе с ней, поэтому слот, занятый одним из них, считается
      // свободным (полная рука даёт ноль карт в итоге)
      const ownStack = (p) => !!p && p.kind === 'token' && p.ownerUid === piece.uid;
      if (occ == null || ownStack(occ)) {
        this.board.delete(loc.key);
        this.removeTokensOf(piece.uid);
        this.hand[idx] = piece;
      } else if (occ.kind === 'chess') {
        const [sr, sc] = parseKey(loc.key);
        if (!this._legal(occ, sr, sc)) return fail(ERR.BAD_TILE);
        // карта со скамейки занимает клетку выводимой фигуры с направлением этой клетки
        occ.dir = pieceDir(piece);
        this.board.set(loc.key, occ);
        this.hand[idx] = piece;
        this.removeTokensOf(piece.uid);
        this.grantTokensFor(occ);
      } else {
        let j = freeSlot(this.hand);
        if (j < 0) j = this.hand.findIndex(ownStack);
        if (j < 0) return fail(ERR.HAND_FULL);
        this.board.delete(loc.key);
        this.removeTokensOf(piece.uid);
        this.hand[j] = piece;
      }
      this.recompute();
      return OK;
    }
    return this._swapContainers(loc, idx);
  }

  /** рука / временная зона → слот руки: сдвиг в пустой слот или обмен с занявшим. */
  _swapContainers(loc, idx) {
    const piece = loc.piece;
    const occ = this.hand[idx];
    this._detach(loc);
    this.hand[idx] = piece;
    if (occ) {
      if (loc.area === 'hand') this.hand[loc.idx] = occ;
      else this._putTemp(loc.idx, occ);
    }
    this.recompute();
    return OK;
  }

  /**
   * g.equip {itemUid, targetUid, replaceUid?}. Третий предмет на носителе с обоими занятыми слотами заменяет
   * экипированный предмет, который игрок выбрал в диалоге замены (`replaceUid`, research 09 §1.2 UseEquipUp.unloadInstId;
   * без него — самый старый); заменённый предмет уничтожается. `replaceUid`, не являющийся одним из экипированных
   * предметов цели, отклоняется.
   */
  equip(itemUid, targetUid, replaceUid = null) {
    const g = this._gate(); if (g) return g;
    const iloc = this.find(itemUid);
    if (!iloc || iloc.piece.kind !== 'item' || (iloc.area !== 'hand' && iloc.area !== 'temp')) return fail(ERR.BAD_TARGET);
    const rec = this.gd.item(iloc.piece.id);
    if (!rec || rec.itemType !== 'EQUIP') return fail(ERR.BAD_TARGET, 'not equipment');
    const tloc = this.find(targetUid);
    if (!tloc || tloc.piece.kind !== 'chess' || tloc.area === 'equipped') return fail(ERR.BAD_TARGET);
    const item = iloc.piece;
    const target = tloc.piece;
    if (replaceUid != null && !(Number.isInteger(replaceUid) && (target.items || []).some((x) => x.uid === replaceUid))) return fail(ERR.BAD_TARGET, 'replace: not equipped on the target');
    const consume = typeof rec.kind === 'string' && rec.kind.startsWith('consume_on_equip');
    if (consume) {
      const key = 'item:' + itemKey(item.id);
      if (!this.m.registry.has(key)) return fail(ERR.BAD_TARGET, 'effect not available');
      const ev = { item, target, golden: !!rec.isGolden, keep: false, error: null, consumed: true };
      this.m.dispatchItem(this, item, target, 'onEquip', ev);
      if (ev.error) return fail(ERR[ev.error] ? ev.error : ERR.BAD_TARGET, typeof ev.detail === 'string' ? ev.detail : undefined);
      // обработчик мог уничтожить цель (信标) — ищем предмет заново
      const again = this.find(item.uid);
      if (again && again.area !== 'equipped') this._detach(again);
      if (ev.keep) {
        const holder = this.find(target.uid);
        if (holder && holder.piece.kind === 'chess') this._attach(holder.piece, item);
      }
      this.stats.itemsEquipped++;
      this.checkItemMerges();
      this.recompute();
      return OK;
    }
    this._detach(iloc);
    if (this.completesItemMerge(item.id)) {
      // идентичная обычная копия уже есть (экипирована где-то): сливать вместо экипировки — золотой предмет идёт
      // в руку (research 04 §2 «копии в руке и на оперативниках обе считаются»)
      if (this._mergeItem(item.id, item)) { this.recompute(); return OK; }
      if (!this.find(item.uid)) this.stow(item, { allowTemp: true });
    }
    this._attach(target, item, replaceUid);
    this.stats.itemsEquipped++;
    this.m.dispatchItem(this, item, target, 'onEquip', { item, target, golden: !!rec.isGolden, consumed: false });
    this.checkItemMerges();
    this.recompute();
    return OK;
  }

  /**
   * Прикрепляет предмет. При обоих занятых слотах заменяется предмет, названный `replaceUid` (выбор игрока), иначе
   * самый старый; заменённый предмет уничтожается.
   */
  _attach(target, item, replaceUid = null) {
    target.items = target.items || [];
    while (target.items.length >= this.gd.equipPerChess) {
      const i = replaceUid != null ? target.items.findIndex((x) => x.uid === replaceUid) : -1;
      const [old] = target.items.splice(i >= 0 ? i : 0, 1);
      replaceUid = null;
      this.m.dispatchItem(this, old, target, 'onDestroy', { item: old, holder: target, reason: 'replace' });
    }
    target.items.push(item);
  }

  /** g.art {itemUid, row, col, dir?}: сетка радиуса применения поворачивается на `dir` (без него ⇒ RIGHT). */
  useArt(itemUid, row, col, dir) {
    const g = this._gate(); if (g) return g;
    const d = parseDir(dir);
    if (!d) return fail(ERR.BAD_TARGET, 'bad dir');
    const loc = this.find(itemUid);
    if (!loc || loc.piece.kind !== 'item' || (loc.area !== 'hand' && loc.area !== 'temp')) return fail(ERR.BAD_TARGET);
    const rec = this.gd.item(loc.piece.id);
    if (!rec || rec.itemType !== 'MAGIC') return fail(ERR.BAD_TARGET, 'not an art');
    if (!inField(row, col)) return fail(ERR.BAD_TILE);
    if (this.round.arts >= this.gd.maxArtsPerRound) return fail(ERR.BAD_TARGET, 'art limit');
    const key = 'item:' + itemKey(loc.piece.id);
    if (!this.m.registry.has(key)) return fail(ERR.BAD_TARGET, 'effect not available');
    const grid = Array.isArray(rec.rangeGrid) && rec.rangeGrid.length ? rec.rangeGrid : [[0, 0]];
    const targets = [];
    for (const [dr, dc] of grid) {
      const [tr, tc] = offsetTile(row, col, dr, dc, d);
      const p = this.board.get(tileKey(tr, tc));
      if (p) targets.push(p);
    }
    const ev = { item: loc.piece, row, col, dir: d, targets, error: null, used: true };
    this.m.dispatchItem(this, loc.piece, null, 'onArt', ev);
    if (ev.error) return fail(ERR[ev.error] ? ev.error : ERR.BAD_TARGET, typeof ev.detail === 'string' ? ev.detail : undefined);
    if (ev.used !== false) {
      const again = this.find(itemUid);
      if (again) this._detach(again);
      this.round.arts++;
    }
    this.recompute();
    return OK;
  }

  /**
   * g.destroy {uid}: предмет в руке / временной зоне (применения тоже). Экипированные предметы заблокированы
   * (research 04 §2 / дополнение: они покидают оперативника только при повышении, слиянии или продаже); замена одного
   * из них — это `replaceUid` из g.equip.
   */
  destroy(uid) {
    const g = this._gate(); if (g) return g;
    const loc = this.find(uid);
    if (!loc || loc.piece.kind !== 'item') return fail(ERR.BAD_TARGET, 'only items can be destroyed');
    if (loc.area === 'equipped') return fail(ERR.BAD_TARGET, 'equipped items are locked');
    this._detach(loc);
    this.m.dispatchItem(this, loc.piece, loc.holder || null, 'onDestroy', { item: loc.piece, holder: loc.holder || null, reason: 'player' });
    this.recompute();
    return OK;
  }

  pickReward(idx) {
    const g = this._gate(); if (g) return g;
    const offer = this.offers[0];
    if (!offer) return fail(ERR.BAD_TARGET, 'no reward');
    if (!Number.isInteger(idx) || idx < 0 || idx >= offer.slots.length) return fail(ERR.BAD_TARGET);
    const slot = offer.slots[idx];
    if (!slot || slot.sold) return fail(ERR.SOLD_OUT);
    const handFull = freeSlot(this.hand) < 0;
    if (slot.kind === 'item') {
      if (!this.gd.item(slot.id)) return fail(ERR.BAD_TARGET);
      if (handFull && !this.completesItemMerge(slot.id)) return fail(ERR.HAND_FULL);
    } else {
      const rec = this.gd.chess(slot.id);
      if (!rec) return fail(ERR.BAD_TARGET);
      const base = this.gd.baseIdOf(slot.id);
      const need = rec.isGolden ? this.gd.goldenCopies : 1;
      if (this.m.pool.has(base) && this.m.pool.left(base) < need) return fail(ERR.SOLD_OUT);
      if (handFull && !this.completesChessMerge(slot.id)) return fail(ERR.HAND_FULL);
    }
    const price = Number.isFinite(slot.price) && slot.price > 0 ? Math.trunc(slot.price) : 0;
    if (price > this.funds) return fail(ERR.NO_FUNDS);
    slot.sold = true;
    this.offers.shift();
    if (price > 0) this.spend(price);
    if (slot.kind === 'item') this.acquireItem(slot.id, { source: 'reward' });
    else this.acquireChess(slot.id, { source: 'reward' });
    this._afterSpend(price, 'reward');
    this.recompute();
    return OK;
  }

  setReady(on) {
    if (!this.alive) return fail(ERR.ELIMINATED);
    if (this.m.phase !== PHASE.PREP) return fail(ERR.WRONG_PHASE);
    if (on && !this.tempEmpty) return fail(ERR.TEMP_NOT_EMPTY);
    if (this.ready === !!on) return OK;
    this.ready = !!on;
    // снятие готовности: игрок снова может действовать, поэтому то, что переполнилось, пока он был готов, должно
    // быть разрешено в дедлайн этой подготовки
    if (!on) for (const p of this.temp) if (p && this.tempDue(p) > this.prepsEnded) this._tempDue.set(p.uid, this.prepsEnded);
    this.dirty();
    this.m.onReadyChanged(this);
    return OK;
  }

  /**
   * Дедлайн подготовки: каждая фигура во временной зоне, должная в этой подготовке (tempDue ≤ prepsEnded),
   * разрешается — оперативник продаётся обратно (его копии из пула возвращаются, его призывы удаляются), предметы
   * уничтожаются, стек призыва владельца, всё ещё находящегося на доске, удаляется и возвращается в начале следующего
   * раунда (startRound → grantTokensFor; PRTS «призывы оперативника возвращаются в следующем раунде»). Фигуры,
   * переполнившиеся после того, как игрок уже не мог действовать (после готовности, в конце подготовки), сохраняются
   * на следующую подготовку.
   */
  resolveTemp() {
    let changed = false;
    for (let i = 0; i < this.temp.length; i++) {
      const p = this.temp[i];
      if (!p || this.tempDue(p) > this.prepsEnded) continue;
      this.temp[i] = null;
      this._tempDue.delete(p.uid);
      changed = true;
      if (p.kind === 'chess') {
        this.removeTokensOf(p.uid);
        this.returnCopies(p);
      }
    }
    if (changed) this.recompute();
  }

  // =================================================================================================
  // вспомогательные функции жизненного цикла раунда (вызывает Match)

  startRound(r) {
    this.round = { refreshes: 0, buys: 0, sells: 0, spent: 0, gainedChess: 0, arts: 0 };
    this.pendingLayerGains = null; // разрешено (или истекло) в последнем РАСЧЁТЕ
    if (r > 1) this.shop.upgradePrice = Math.max(0, this.shop.upgradePrice - 1);
    // обработчики onIncome могут перезаписать ev.income / ev.pending (например, 老鲤 удерживает доход R1–R2 до R3)
    const ev = { round: r, income: this.gd.income(r), pending: this.pendingFunds };
    this.pendingFunds = 0;
    this.m.dispatch(this, 'onIncome', ev);
    const nonNeg = (v) => (Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0);
    this.addFunds(nonNeg(ev.income) + nonNeg(ev.pending), { reason: 'income' });
    // временная зона НЕ очищается здесь: дедлайн последней подготовки разрешил то, с чем игрок мог действовать
    // (endPrep); то, что переполнилось после него (выдачи из результата боя, слияния в РАСЧЁТЕ, возвращённое
    // снаряжение), показывается и доступно в этой подготовке (tempDue). Так же предложения награды прошлой подготовки
    // уже истекли в её конце; то, что всё ещё в очереди, было получено после неё — слияние, завершённое во время
    // РАСЧЁТА / Финального штурма (突变细胞, выдачи из результата боя) — и показывается в этой подготовке
    this.ready = false;
    // стеки призывов, убранные из временной зоны в дедлайн последней подготовки, возвращаются (PRTS 卫戍协议/帮助
    // §手牌区); полная рука ⇒ временная зона
    for (const p of [...this.board.values()]) if (p.kind === 'chess') this.grantTokensFor(p);
    this.rollShop({ keepFrozen: true });
    this.shop.frozen = false;
    for (const s of this.shop.slots) if (s) s.frozen = false;
    this.recompute();
  }

  /**
   * Дедлайн подготовки (Match.endPrep, после эффектов onPrepEnd <в конце фазы отдыха>): фигуры во временной зоне,
   * должные в этой подготовке, разрешаются; то, что переполнилось после готовности или во время onPrepEnd, остаётся
   * на следующую подготовку, которую `prepsEnded` теперь называет.
   */
  endPrep() {
    this.resolveTemp();
    this.prepsEnded++;
    for (const uid of [...this._tempDue.keys()]) if (!this.temp.some((p) => p && p.uid === uid)) this._tempDue.delete(uid);
    this.offers = [];
    this.clearUnfrozenShop();
    if (!this.gd.leftoverKeptBands.includes(this.bandId)) this.funds = 0;
    this.ready = true;
    this.dirty();
  }

  eliminate(round) {
    this.alive = false;
    this.ready = false;
    this.eliminatedRound = round;
    const all = [];
    for (const p of this.board.values()) all.push(p);
    for (const p of this.hand) if (p) all.push(p);
    for (const p of this.temp) if (p) all.push(p);
    for (const p of all) this.returnCopies(p);
    this.board.clear();
    this.hand.fill(null);
    this.temp.fill(null);
    this._tempDue.clear();
    this.offers = [];
    this.bounties = [];
    this.shop.slots = [];
    this.funds = 0;
    this.pendingFunds = 0;
    this.recompute();
  }

  recompute() {
    this.deployMap(); // смена поля развёртывания (подготовка раунда с лидером) помечает легальность устаревшей
    if (this._legalityStale) this._evictIllegal();
    this._liftOutOfRange();
    this.bonds = computeBonds(this.gd, this);
    this.dirty();
  }

  activatedLayers() { return activatedLayers(this.bonds); }

  /**
   * Состояния альянсов, которые показывают виды (m.private bonds, m.public players[].bonds): вычисленные состояния
   * плюс незавершённые боевые приросты этого раунда из завершённого обычного боя (bondsMeta.bondsWithGains). Никогда
   * не используется правилами.
   */
  bondsView() { return bondsWithGains(this.bonds, this.pendingLayerGains); }

  // =================================================================================================
  // вход в бой

  battleInput({ side = 'L', colOffset = 0, carry = null } = {}) {
    // изменение рельефа, за которым ещё не последовало recompute (хук контента в конце подготовки), никогда не
    // выставляет нелегальную доску
    this.deployMap();
    if (this._legalityStale) this.recompute();
    const units = [];
    for (const { r, c, piece } of boardOrder(this.board)) {
      if (piece.kind === 'chess') {
        const u = { uid: piece.uid, kind: 'chess', chessId: piece.id, row: r, col: c, dir: pieceDir(piece), items: (piece.items || []).map((i) => i.id) };
        // DESIGN §16: экипированный навык / модуль (только элитный) из настройки (при отсутствии — значения по умолчанию)
        const lo = this.loadoutFor(this.gd.chess(piece.id));
        u.skillIndex = lo.skillIndex;
        u.moduleId = lo.moduleId;
        if (carry && carry.has(piece.uid)) u.carryState = carry.get(piece.uid);
        units.push(u);
      } else if (piece.kind === 'token') {
        units.push({ uid: piece.uid, kind: 'token', tokenId: piece.id, row: r, col: c, dir: pieceDir(piece), ownerUid: piece.ownerUid });
      }
    }
    return {
      playerId: this.playerId,
      seat: this.seat,
      side,
      colOffset,
      units,
      bonds: bondSnapshot(this.bonds),
      bandId: this.bandId,
      playerEffects: this.effects.filter((e) => e.battle !== false).map((e) => ({
        id: e.id, key: e.key ?? null, source: e.iconKind ?? null, params: e.params ?? null, counter: e.counter ?? null, data: e.data ?? null,
      })),
      deviceOverrides: { ...this.deviceOverrides },
    };
  }

  // =================================================================================================
  // виды

  pieceView(p, rc = null) {
    const rec = p.kind === 'item' ? this.gd.item(p.id) : p.kind === 'token' ? this.gd.token(p.id) : this.gd.chess(p.id);
    const v = {
      uid: p.uid,
      kind: p.kind,
      id: p.id,
      golden: !!(rec && rec.isGolden),
      tier: rec && Number.isInteger(rec.tier) ? rec.tier : null,
      items: p.kind === 'chess' ? (p.items || []).map((it) => ({ uid: it.uid, id: it.id })) : [],
      count: p.kind === 'token' ? (p.count || 1) : 1,
      ownerUid: p.kind === 'token' ? p.ownerUid ?? null : null,
    };
    if (rc) { v.row = rc[0]; v.col = rc[1]; v.dir = pieceDir(p); }
    return v;
  }

  effectsView() {
    const out = [];
    const band = this.bandId ? this.gd.band(this.bandId) : null;
    if (band) out.push({ id: band.effectId || band.bandId, name: band.effectName || band.name, desc: band.desc || '', iconKind: 'band', iconId: band.iconId || band.bandId });
    for (const e of this.effects) {
      if (e.hidden) continue;
      const v = { id: e.id, name: e.name || e.id, desc: e.desc || '', iconKind: e.iconKind || 'choice', iconId: e.iconId || e.id };
      if (e.counter != null) v.counter = e.counter;
      out.push(v);
    }
    for (const b of this.bounties) {
      // бои, за которыми ещё придут враги контракта (официальная многораундовая карта: каждый бой, без счётчика), и
      // официальный rich-text карточки (синие «следующий бой» / «два боя», красное «каждый бой»; многораундовая карта
      // читается так, пока длится — choices.js bountyText, MULTI_ROUND_BOUNTY_BATTLES) — user playtest #6 item 4
      const left = b.roundsLeft >= 90 ? null : b.roundsLeft;
      const eff = b.card.effectId ? this.gd.effect(b.card.effectId) : null;
      out.push({
        id: b.id, name: b.card.name || 'Контракт', desc: bountyText((eff && eff.descRaw) || b.card.desc || '', b.card), iconKind: 'choice', iconId: b.card.effectId || 'bounty',
        counter: left, counterText: left == null ? 'В каждом последующем бою' : `Осталось боёв: ${left}`,
      });
    }
    return out;
  }

  privateView() {
    const slots = this.shop.slots.map((s) => (s ? { kind: s.kind, id: s.id, price: this.priceOf(s), basePrice: s.basePrice, sold: !!s.sold, frozen: !!s.frozen } : null));
    const offer = this.offers[0] || null;
    const free = this.shop.freeRefreshes > 0;
    const board = [];
    for (const { r, c, piece } of boardOrder(this.board)) board.push(this.pieceView(piece, [r, c]));
    return {
      t: 'm.private',
      playerId: this.playerId,
      seat: this.seat,
      alive: this.alive,
      lp: this.lp,
      funds: this.funds,
      bandId: this.bandId,
      ready: this.ready,
      canReady: this.alive && this.tempEmpty && this.m.phase === PHASE.PREP,
      shop: {
        level: this.shop.level,
        maxLevel: this.gd.maxShopLevel,
        upgradePrice: this.shop.level >= this.gd.maxShopLevel ? 0 : this.shop.upgradePrice,
        refreshPrice: free ? 0 : this.gd.refreshPrice,
        freeRefreshes: this.shop.freeRefreshes,
        frozen: this.shop.frozen,
        slots,
        // `source` 'merge' = награда за повышение (晋升奖励); любое другое предложение (стратегия, предмет, 特质)
        // несёт `label`, который показывает панель; `queued` = предложения, ждущие за ним (player report #6 после 0.1.0)
        rewardOffer: offer ? { tier: offer.tier, source: offer.source === 'merge' ? 'merge' : 'special', label: offer.label || null, queued: this.offers.length - 1, slots: offer.slots.map((s) => ({ kind: s.kind === 'item' ? 'item' : 'chess', id: s.id, price: s.price, sold: !!s.sold })) } : null,
      },
      hand: this.hand.map((p) => (p ? this.pieceView(p) : null)),
      temp: this.temp.map((p) => (p ? this.pieceView(p) : null)),
      board,
      deployCap: this.deployCap,
      deployCount: this.deployCount,
      bonds: bondList(this.gd, this.bondsView(), { full: true }),
      effects: this.effectsView(),
      nextEnemies: this.m.nextEnemiesFor(this),
      // DESIGN §16: действующая настройка оперативников ({ [baseChessId]: { skill, module } }; не перечисленные — значения по умолчанию)
      loadout: this.loadout,
      stats: {
        dmgDealt: Math.round(this.stats.dmgDealt), kills: this.stats.kills, leaks: this.stats.leaks, gold: this.stats.gold,
        refreshes: this.stats.refreshes, merges: this.stats.merges,
      },
    };
  }
}

export { FIELD };