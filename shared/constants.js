// Общие перечисления и константы (сервер + браузер). Чистый ESM, без Node API.

export const PROTOCOL_VERSION = 1;
/** Версия релиза, показываемая игрокам (титульный экран, баннер сервера, /healthz). Держится равной
 * "version" в package.json (test/version.test.js); PROTOCOL_VERSION выше — отдельный номер формата передачи. */
export const APP_VERSION = '0.1.2';

export const MAX_SEATS = 4;
export const ROOM_CODE_LEN = 4;
export const NAME_MAX_LEN = 12;

export const DIFFICULTIES = ['FUNNY', 'NORMAL', 'HARD', 'ABYSS'];
export const DIFFICULTY_NAMES = { FUNNY: 'РАССЛАБЛЕННЫЙ', NORMAL: 'СРЕДНИЙ', HARD: 'СЛОЖНЫЙ', ABYSS: 'БЕЗДНА' };
export const DIFFICULTY_COLORS = { FUNNY: '#f6a329', NORMAL: '#e85a1a', HARD: '#e73118', ABYSS: '#ff0024' };

// modeId в data/config.json = `mode_${type}_${difficulty.toLowerCase()}` с type single|multi
export const modeIdFor = (roomMode, difficulty) =>
  `mode_${roomMode === 'solo' ? 'single' : 'multi'}_${difficulty.toLowerCase()}`;

export const PHASE = Object.freeze({
  LOBBY: 'LOBBY',
  INFO_CHECK: 'INFO_CHECK',
  BAND_DRAFT: 'BAND_DRAFT',
  BATTLE_CHECK: 'BATTLE_CHECK',
  ROUND_START: 'ROUND_START',
  SP_DRAFT: 'SP_DRAFT',
  PREP: 'PREP',
  COMBAT: 'COMBAT',
  UNITE: 'UNITE',
  SETTLE: 'SETTLE',
  FINAL_ASSAULT: 'FINAL_ASSAULT',
  HIDDEN_CORE: 'HIDDEN_CORE',
  RESULT: 'RESULT',
});

export const PHASE_NAMES = {
  LOBBY: 'Ожидание', INFO_CHECK: 'Подтверждение информации', BAND_DRAFT: 'Выбор стратегии', BATTLE_CHECK: 'Запуск протокола',
  ROUND_START: 'Начало раунда', SP_DRAFT: 'Фаза выбора', PREP: 'Фаза отдыха', COMBAT: 'Бой', UNITE: 'Совместная оборона',
  SETTLE: 'Расчёт', FINAL_ASSAULT: 'Финальный штурм', HIDDEN_CORE: 'Скрытое ядро', RESULT: 'Симуляция завершена',
};

// Геометрия доски на сетке 19×21 (строка 0 = низ). См. DESIGN §3.
export const GEO = Object.freeze({
  ROWS: 19, COLS: 21,
  FIELD: { r0: 9, r1: 12, c0: 2, c1: 10 },        // собственная область развёртывания
  NORMAL_RECT: { r0: 9, r1: 12, c0: 0, c1: 10 },  // прямоугольник симуляции обычного боя
  UNITE_RECT: { r0: 9, r1: 12, c0: 0, c1: 20 },
  BOSS_RECT: { r0: 0, r1: 5, c0: 0, c1: 20 },
  HAND_ROW: 7, HAND_SIZE: 10,                      // idx слота руки = col 0..9
  TEMP_ROW: 8, TEMP_C0: 4, TEMP_SIZE: 5,           // idx временного слота 0..4 = cols 4..8
  PARTNER_COL_OFFSET: 8,
});

export const AREA = Object.freeze({ BOARD: 'board', HAND: 'hand', TEMP: 'temp', OUTSIDE: 'outside' });

export const PIECE_KIND = Object.freeze({ CHESS: 'chess', ITEM: 'item', TOKEN: 'token' });

/**
 * Развёртывается ли размещённая фигура призыва навыка (赫默's 医疗探机, 巫恋's 诅咒娃娃) также один раз бесплатно
 * в начале боя. true = трактовка PRTS (卫戍协议/帮助 §作战阶段: "все вручную развёрнутые призывы, независимо от
 * состояния владения оперативником… развёртываются один раз немедленно при начале боя", пример — дрон 赫默), выбрана
 * пользователем 2026-10-01 после playtest #6 (DESIGN §20); false = трактовка playtest #4 («это 赫默 активирует навык
 * и развёртывает один раз, а не в начале боя немедленно»): фигура занимает клетку только когда навык владельца её даёт.
 * В любом случае фигура заново появляется на своей клетке каждый раз, когда навык владельца её даёт.
 * Один переключатель для всего, что от него зависит: симуляция (server/sim/content/tokens.js dockSkillSummons) и
 * подсказка карточки призыва (public/js/ui/detailPanel.js summonDeployHint). docs/PLAYING.md §4 и docs/SIM.md
 * (token pieces) описывают правило прозой — test/ui/playtest6_summons.test.js падает, пока они не совпадут со значением.
 */
export const SKILL_SUMMON_START_DEPLOY = true;

/**
 * Официальный предел стаков на один альянс (docs/research/11-limits-official.md §1): в клиенте
 * `Torappu.Battle.AutoChessBattleConst.MAX_GARRISON_STACK = 999`, а его счётчик альянсов (`AddBondCount`) хранит
 * `min(L + n, 999)` — каждый альянс останавливается на 999 сам по себе; сообщество сообщает об альянсах,
 * сидящих на 999, пока их подкармливают (巴哈姆特 12534 "每把都能999层", 12316 "999謝"; research 02 §layers).
 * Единственная реализация предела (DESIGN §20.12). Каждый писатель стаков альянса идёт через `layerGainRoom`:
 * выигрыши на стороне подготовки (server/match/PlayerState.js addLayers — 特质, предметы, стратегии, карты 机变,
 * альянсы), расчёт боевых приростов (server/match/Match.js) и живая копия в бою (server/sim/Battle.js addLayers,
 * как клиентский AddBondCount) — и прямые записи инструментов разработчика (tools/matchrun.mjs --layers,
 * tools/balance.mjs applyBoard); прирост на пределе даёт 0 (нет onLayers, нет события 'layer'), а проверка
 * клиентского результата (server/match/fields.js) ограничивает заявленный прирост оставшимся местом. Вехи,
 * оплачиваемые за N стаков (远见, 奇迹, 维多利亚 …), прекращаются вместе со счётчиком. 0 / Infinity = без предела.
 */
export const BOND_LAYER_CAP = 999;

/**
 * Слои, которые прирост `n` фактически добавляет альянсу, имеющему `before`, при BOND_LAYER_CAP: min(n, cap − before),
 * никогда не отрицательно (счётчик, уже стоящий на пределе или выше, получает 0 и никогда не понижается); 0 для
 * неположительного / не конечного `n`, кроме +Infinity (= «оставшееся место»).
 */
export function layerGainRoom(before, n) {
  if (!(n > 0)) return 0;
  const cap = BOND_LAYER_CAP > 0 ? BOND_LAYER_CAP : Infinity;
  const b = Number.isFinite(before) && before > 0 ? before : 0;
  return Math.max(0, Math.min(n, cap - b));
}

/**
 * Официальный лимит урона по лидеру «限伤» (docs/research/11-limits-official.md §2):
 * `AutoChessBattleConst.MAX_BATTLE_DAMAGE = 300000`. В бою с лидером вне тренировки — наши виды боёв 'boss'
 * (Финальный штурм) и 'hidden' (Скрытое ядро) — одиночное попадание по лидеру (`AutoChessBattleUtil.IsBossEnemy`:
 * enemyId из activity_table autoChessData.bossInfoDict = data/bosses.json `enemyKey`; в симуляции это юниты с
 * тегом 'boss': те лидеры и их зеркальные копии, никогда части, эскорты или дроны), у которого
 * `ceil(финальный урон)` ≥ этого значения, ОТМЕНЯЕТСЯ: 0 урона, ничего не зачисляется в общий пул
 * (`AutoChessStepModeManager._OnBossEnemyTakeDamage` → `modifier.Cancel()`). Это не обрезка: попадание на 299999
 * проходит. Проверяется в server/sim/damage.js (dealDamage после DEF / RES и каждого множителя, до щитов;
 * Battle.loseHp). Обычные юниты, обычные раунды и 联防 не затрагиваются. 0 / Infinity = выключено.
 */
export const BOSS_HIT_LIMIT = 300000;

// Биты флагов юнита в снапшоте (DESIGN §8.2)
export const UF = Object.freeze({
  BLOCKED: 1, STUNNED: 2, FROZEN: 4, STEALTH: 8, SKILL: 16, SHIELD: 32, INVULN: 64, COLD: 128, SLEEP: 256, FLYING: 512,
});

export const ANIM = Object.freeze({ IDLE: 0, MOVE: 1, ATTACK: 2, SKILL: 3, DIE: 4, STUN: 5, DEPLOY: 6 });

export const ERR = Object.freeze({
  BAD_MSG: 'BAD_MSG',             // некорректное / неизвестное сообщение
  RATE: 'RATE',                   // ограничение частоты
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_STARTED: 'ROOM_STARTED',
  NOT_HOST: 'NOT_HOST',
  NOT_READY: 'NOT_READY',
  WRONG_PHASE: 'WRONG_PHASE',
  NO_FUNDS: 'NO_FUNDS',
  HAND_FULL: 'HAND_FULL',
  BOARD_FULL: 'BOARD_FULL',
  BAD_TILE: 'BAD_TILE',
  BAD_TARGET: 'BAD_TARGET',
  SOLD_OUT: 'SOLD_OUT',
  MAX_LEVEL: 'MAX_LEVEL',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ALREADY: 'ALREADY',
  TEMP_NOT_EMPTY: 'TEMP_NOT_EMPTY',
  ELIMINATED: 'ELIMINATED',
  INTERNAL: 'INTERNAL',
});

export const ERR_TEXT = {
  BAD_MSG: 'Некорректный запрос', RATE: 'Слишком частые действия', NOT_IN_ROOM: 'Вы не в комнате', ROOM_NOT_FOUND: 'Комната с таким ключом альянса не найдена',
  ROOM_FULL: 'Комната заполнена', ROOM_STARTED: 'Симуляция уже началась', NOT_HOST: 'Действие доступно только создателю', NOT_READY: 'Ещё не все игроки готовы',
  WRONG_PHASE: 'В текущей фазе это действие невозможно', NO_FUNDS: 'Недостаточно средств', HAND_FULL: 'Зона подготовки заполнена', BOARD_FULL: 'Достигнут предел развёртывания',
  BAD_TILE: 'Невозможно развернуть на этой позиции', BAD_TARGET: 'Недопустимая цель', SOLD_OUT: 'Уже продано', MAX_LEVEL: 'Центр управления достиг максимального уровня',
  NOT_YOUR_TURN: 'Ещё не ваш ход', ALREADY: 'Действие уже выполнено', TEMP_NOT_EMPTY: 'Временная зона подготовки не пуста', ELIMINATED: 'Вы выбыли',
  INTERNAL: 'Внутренняя ошибка сервера',
};

// ---- Эмоции (交流, research 09 §4) ----------------------------------------------------------------------------
// 36 официальных эмоций в матче: display_meta_table emoticonData, сцена AUTOCHESS_BATTLE, 6 тем × 6, по одной странице
// колеса на тему в порядке activity_table autoChessData.enabledEmoticonThemeIdList, эмоции по sortId. `g.emote { id }`
// / `m.emote { playerId, id }` несут официальный emoji id. Сгенерированный справочник: data/emotes.json
// (tools/build-emotes.mjs); test/ui/emotes.test.js держит эту таблицу идентичной ему.
// У официальных эмоций нет текста (desc = null): `label` — наш и всегда только aria-label, никогда не отображается.
// Арт: извлечён из локального клиента (tools/local-extract) в /assets/local/emoticon/<dir>/<picId>.png и перечислен в
// data/local-assets.json в группе `emoticon/<dir>`; также скачан с публичного зеркала tools/fetch-assets.mjs
// (tools/assets/plan.mjs UI_EXTRAS → data/assets.json ui['emoticon/<dir>/<picId>'], GitHub issue #42). UI берёт
// сначала локальную картинку, затем копию с зеркала, и показывает нейтральный глиф, если нет ни того, ни другого.
// picId не выводится из id (autochess_battle_fooldoctor_03…06 → pic_fooldoctor_04/05/06/08_battle).
const emo = (id, sortId, picId, label) => Object.freeze({ id, sortId, picId, label });
export const EMOTE_THEMES = Object.freeze([
  { themeId: 'emoticon_autochess_basic', dir: 'basic', sortId: 100000, isBasic: true, name: 'Набор эмоций: Протокол крепости', emotes: [
    emo('autochess_battle_happy', 1001, 'pic_happy_battle', 'Радость'),
    emo('autochess_battle_scared', 1002, 'pic_scared_battle', 'Страх'),
    emo('autochess_battle_sorry', 1003, 'pic_sorry_battle', 'Извините'),
    emo('autochess_battle_thanks', 1004, 'pic_thanks_battle', 'Спасибо'),
    emo('autochess_battle_thinking', 1005, 'pic_thinking_battle', 'Размышление'),
    emo('autochess_battle_nice_cooperate', 1006, 'pic_cooperate_battle', 'Приятного сотрудничества'),
  ] },
  { themeId: 'emoticon_originium_slug', dir: 'slug', sortId: 1001, isBasic: false, name: 'Набор эмоций: Жучий ход', emotes: [
    emo('slug_autochess_battle_nice_work', 2001, 'pic_nice_work_battle', 'Приятного сотрудничества!'),
    emo('slug_autochess_battle_thanks', 2002, 'pic_thanks_battle', 'Спасибо!'),
    emo('slug_autochess_battle_sorry', 2003, 'pic_sorry_battle', 'Извините!'),
    emo('slug_autochess_battle_bye', 2004, 'pic_bye_battle', 'До свидания!'),
    emo('slug_autochess_battle_distrust', 2005, 'pic_distrust_battle', '？？？'),
    emo('slug_autochess_battle_very_soon', 2006, 'pic_very_soon_battle', 'Скоро буду!'),
  ] },
  { themeId: 'emoticon_autochess_basic_2', dir: 'basic_2', sortId: 100001, isBasic: true, name: 'Набор эмоций: Протокол крепости', emotes: [
    emo('autochess_battle_noproblem', 1007, 'pic_noproblem_battle', 'Без проблем!'),
    emo('autochess_battle_respect', 1008, 'pic_respect_battle', 'Честь!'),
    emo('autochess_battle_call', 1009, 'pic_call_battle', 'Ура!'),
    emo('autochess_battle_playingcool', 1010, 'pic_playingcool_battle', 'Круто!'),
    emo('autochess_battle_sad', 1011, 'pic_sad_battle', 'Грусть'),
    emo('autochess_battle_dying', 1012, 'pic_dying_battle', 'Умираю'),
  ] },
  { themeId: 'emoticon_foolsday_doctor', dir: 'fooldoctor', sortId: 1002, isBasic: false, name: 'Набор эмоций: Докторчик', emotes: [
    emo('autochess_battle_fooldoctor_01', 1020, 'pic_fooldoctor_01_battle', 'Докторчик 1'),
    emo('autochess_battle_fooldoctor_02', 1021, 'pic_fooldoctor_02_battle', 'Докторчик 2'),
    emo('autochess_battle_fooldoctor_03', 1022, 'pic_fooldoctor_04_battle', 'Докторчик 3'),
    emo('autochess_battle_fooldoctor_04', 1023, 'pic_fooldoctor_05_battle', 'Докторчик 4'),
    emo('autochess_battle_fooldoctor_05', 1024, 'pic_fooldoctor_06_battle', 'Докторчик 5'),
    emo('autochess_battle_fooldoctor_06', 1025, 'pic_fooldoctor_08_battle', 'Докторчик 6'),
  ] },
  { themeId: 'emoticon_foolsday_amiya', dir: 'foolamiya', sortId: 1003, isBasic: false, name: 'Набор эмоций: Мимико', emotes: [
    emo('autochess_battle_foolamiya_01', 1040, 'pic_foolamiya_01_battle', 'Мимико 1'),
    emo('autochess_battle_foolamiya_02', 1041, 'pic_foolamiya_02_battle', 'Мимико 2'),
    emo('autochess_battle_foolamiya_03', 1042, 'pic_foolamiya_03_battle', 'Мимико 3'),
    emo('autochess_battle_foolamiya_04', 1043, 'pic_foolamiya_04_battle', 'Мимико 4'),
    emo('autochess_battle_foolamiya_05', 1044, 'pic_foolamiya_05_battle', 'Мимико 5'),
    emo('autochess_battle_foolamiya_06', 1045, 'pic_foolamiya_06_battle', 'Мимико 6'),
  ] },
  { themeId: 'emoticon_foolsday_wisdel', dir: 'foolwisdel', sortId: 1004, isBasic: false, name: 'Набор эмоций: Вивимэй', emotes: [
    emo('autochess_battle_foolwisdel_01', 1060, 'pic_foolwisdel_01_battle', 'Вивимэй 1'),
    emo('autochess_battle_foolwisdel_02', 1061, 'pic_foolwisdel_02_battle', 'Вивимэй 2'),
    emo('autochess_battle_foolwisdel_03', 1062, 'pic_foolwisdel_03_battle', 'Вивимэй 3'),
    emo('autochess_battle_foolwisdel_04', 1063, 'pic_foolwisdel_04_battle', 'Вивимэй 4'),
    emo('autochess_battle_foolwisdel_05', 1064, 'pic_foolwisdel_05_battle', 'Вивимэй 5'),
    emo('autochess_battle_foolwisdel_06', 1065, 'pic_foolwisdel_06_battle', 'Вивимэй 6'),
  ] },
].map((t) => Object.freeze({ ...t, emotes: Object.freeze(t.emotes) })));
/** Каждая эмоция со своей темой: `{ id, sortId, picId, label, themeId, dir }`, в порядке колеса. */
export const EMOTE_CATALOG = Object.freeze(EMOTE_THEMES.flatMap((t) => t.emotes.map((e) => Object.freeze({ ...e, themeId: t.themeId, dir: t.dir }))));
/** 36 официальных id эмоций (белый список протокола: `EMOTES.includes(id)`). */
export const EMOTES = Object.freeze(EMOTE_CATALOG.map((e) => e.id));
const EMOTE_INDEX = new Map(EMOTE_CATALOG.map((e) => [e.id, e]));
/** Запись каталога по id эмоции, или null (безопасно для любого ввода, включая '__proto__'). */
export const emoteInfo = (id) => (typeof id === 'string' && EMOTE_INDEX.get(id)) || null;
// Карты с ключом-строкой без прототипа: проводной id вроде '__proto__' / 'toString' даёт undefined, а не метод Object
const emoteMap = (pick) => Object.freeze(Object.assign(Object.create(null), Object.fromEntries(EMOTE_CATALOG.map((e) => [e.id, pick(e)]))));
/** id эмоции → id темы. */
export const EMOTE_THEME = emoteMap((e) => e.themeId);
/** id эмоции → наш aria-label (никогда не отображается). */
export const EMOTE_LABEL = emoteMap((e) => e.label);
/** Группа арта эмоции в data/local-assets.json (`emoticon/<dir>`), или null. */
export const emoteArtGroup = (id) => { const e = emoteInfo(id); return e ? `emoticon/${e.dir}` : null; };
/** Канонический URL извлечённого арта эмоции (`/assets/local/emoticon/<dir>/<picId>.png`), или null для неизвестных id. */
export const emoteArtPath = (id) => { const e = emoteInfo(id); return e ? `/assets/local/emoticon/${e.dir}/${e.picId}.png` : null; };
export const EMOTE_COOLDOWN_MS = 1000; // activity_table autoChessData.constData.chatCD (s)
export const EMOTE_BUBBLE_MS = 3000;   // constData.chatTime (s): как долго пузырь висит на экране