# Заявление об авторских правах и условиях использования (NOTICE)

**Stronghold Protocol RU** — это **неофициальный фанатский ремейк** временного режима «卫戍协议：盟约» из игры *Arknights*, который **никак не связан** с Shanghai Hypergryph Network Technology Co., Ltd. (上海鹰角网络科技有限公司), Yostar и их аффилированными лицами, не авторизован и не одобрен ими.

## 1. Лицензия на код: GPL-3.0-or-later

Copyright (C) 2026 Stronghold-Protocol contributors

Исходный код и текст документации, написанные специально для этого проекта (JS / CSS / HTML в `server/`, `shared/`, `public/`, а также `tools/`, `scripts/`, `test/`, `docs/` и т.д.), распространяются под **GNU General Public License версии 3 или (по вашему выбору) любой более поздней версии** (GPL-3.0-or-later), полный текст см. в [LICENSE](LICENSE). Вы можете использовать, изменять и распространять этот код на условиях данной лицензии.

Исключения:

- `tools/local-extract/aklz4.py` взят из [isHarryh/Ark-Unpacker](https://github.com/isHarryh/Ark-Unpacker) и остается под лицензией BSD-3-Clause (см. `tools/local-extract/LICENSE-Ark-Unpacker.txt`).
- Сторонние библиотеки, устанавливаемые через npm (PixiJS, pixi-spine, Preact, htm, three.js, ws и др.), и шрифты сохраняют свои оригинальные лицензии, см. [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

**Дополнительное разрешение (раздел 7 GPL-3.0)** — Additional permission under GNU GPL version 3 section 7:

> If you modify this Program, or any covered work, by linking or combining it with the Spine Runtimes (as shipped in
> pixi-spine, or a modified version of them), containing parts covered by the terms of the Spine Runtimes License
> Agreement, the licensors of this Program grant you additional permission to convey the resulting work.
> Corresponding Source for a non-source form of such a combination shall include the source code for the parts of
> the Spine Runtimes used as well as that of the covered work.

(По смыслу: разрешается объединять данный проект с Spine Runtimes из pixi-spine и распространять полученную работу; сами Spine Runtimes по-прежнему подчиняются своей собственной лицензии.)

## 2. Содержимое, не принадлежащее проекту и не подпадающее под GPL

Все **названия, персонажи, художественные материалы, модели Spine, графика интерфейса, музыка и звуки, тексты и игровые данные**, связанные с *Arknights* и «卫戍协议», являются собственностью Shanghai Hypergryph Network Technology Co., Ltd. и его лицензиаров (Yostar и др.). В частности:

- `public/assets/**` в полном релизном пакете (включая извлеченные локально из официального клиента 3D-модели доски и текстуры `public/assets/local/**`) и `public/fonts/**` (шрифты принадлежат их авторам);
- `data/*.json`, сгенерированные из официальных таблиц данных, а также `docs/research/*.json`, `test/fixtures/official-waves.json`, `public/dev/recordings/*.json`, содержащие игровые данные или производные от них;
- игровые скриншоты в `docs/img/`;
- тексты с общественных страниц PRTS, BWIKI, NGA, 巴哈姆特 и др., цитируемые в `docs/` (остаются под лицензиями их источников; тексты вики — CC BY-NC-SA).

Это содержимое **не входит в область действия лицензии GPL-3.0**, и проект не имеет права предоставлять на него какие-либо права кому-либо.

## 3. Только некоммерческое использование

- Проект предназначен **исключительно для обучения, исследований и личного некоммерческого развлечения**.
- Правообладатели игровых материалов и данных не давали проекту или его пользователям разрешения на коммерческое использование, поэтому всё, что содержит или зависит от этих материалов — полный релизный пакет, развернутые серверы, скриншоты, записи и трансляции — **не может использоваться для извлечения прибыли** в любой форме. Включая, помимо прочего:
  - продажу или платное распространение;
  - платный хостинг, платные комнаты или членство;
  - размещение рекламы;
  - донаты, спонсорство или краудфандинг, связанные с проектом;
  - включение в любой платный продукт или услугу.
- При распространении полного пакета сохраняйте настоящее заявление, [LICENSE](LICENSE) и [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), а также указывайте неофициальный и некоммерческий характер.
- Сама GPL разрешает коммерческое использование **кода**, однако вышеуказанные ограничения касаются игровых материалов и данных, не принадлежащих проекту.

## 4. Уведомление правообладателей и удаление

Если вы являетесь правообладателем и считаете, что какой-либо контент проекта нарушает ваши права, пожалуйста, создайте Issue в этом репозитории (или свяжитесь с владельцем репозитория через GitHub). Мы как можно скорее удалим соответствующий контент, либо отзовем полный пакет или весь репозиторий.

## 5. Отказ от гарантий

- Проект предоставляется «как есть», **без каких-либо явных или подразумеваемых гарантий** (см. разделы 15 и 16 LICENSE).
- Риски, связанные с использованием, развертыванием или публикацией проекта, включая сетевую безопасность, сторонние инструменты и сервисы для совместной игры, местное законодательство, несет сам пользователь.
- Проект не требует и не запрашивает никакие игровые аккаунты; опциональное локальное извлечение читает только файлы уже установленного на вашем компьютере клиента.

---

**English summary.** Unofficial, non-commercial fan remake; not affiliated with or endorsed by Hypergryph or Yostar.
The project's own code is GPL-3.0-or-later (with the Spine Runtimes linking permission above). All Arknights names,
art, models, audio and data — including everything under `public/assets/` in the release bundle — are © Hypergryph /
Yostar and their licensors, are **not** covered by the GPL, and may be used for study and personal non-commercial
purposes only: no selling, paid distribution, paid hosting, ads, donations or any other monetisation. Rights holders
can request removal through a GitHub issue and the content will be taken down. No warranty of any kind.
