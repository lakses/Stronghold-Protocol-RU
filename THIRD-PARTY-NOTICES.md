# Уведомления о сторонних компонентах (Third-party notices)

Собственный код Stronghold Protocol распространяется под лицензией **GPL-3.0-or-later** (см. [LICENSE](LICENSE) и [NOTICE.md](NOTICE.md)).
Приведенные ниже компоненты **не** входят в это разрешение: каждый из них остается под своей собственной лицензией, текст которой воспроизведен в конце этого файла. В репозиторий ничего из этого не коммитится, за исключением `tools/local-extract/aklz4.py`; клиентские библиотеки устанавливаются через npm и копируются в `public/vendor/` с помощью `tools/vendor.mjs` (postinstall), а релизный пакет содержит их (вместе с `node_modules/`, что сохраняет файлы лицензий каждого пакета).

Собственный код этого проекта распространяется под лицензией GPL-3.0-or-later; следующие сторонние компоненты сохраняют свои оригинальные лицензии и не подпадают под действие GPL.

## Программное обеспечение

| Компонент | Версия | Лицензия | Где используется | В репозитории | В релизном пакете |
|---|---|---|---|---|---|
| [PixiJS](https://github.com/pixijs/pixijs) | 7.4.2 | MIT | Браузерный рендерер — `public/vendor/pixi.min.js` | нет (npm) | да |
| [pixi-spine](https://github.com/pixijs/spine) | 4.0.6 | Баннер MIT; содержит **Spine Runtimes** под **Spine Runtimes License Agreement** (лицензия пакета "SEE SPINE-LICENSE") | Воспроизведение моделей Spine — `public/vendor/pixi-spine.js` | нет (npm) | да |
| [Preact](https://github.com/preactjs/preact) | 10.29.8 | MIT | Интерфейс — `public/vendor/preact.module.js`, `hooks.module.js` | нет (npm) | да |
| [htm](https://github.com/developit/htm) | 3.1.1 | Apache-2.0 | Шаблоны интерфейса — `public/vendor/htm.module.js` | нет (npm) | да |
| [three.js](https://github.com/mrdoob/three.js) | 0.186.1 | MIT | Официальная 3D-доска — `public/vendor/three.core.js`, `three.module.js` | нет (npm) | да |
| [ws](https://github.com/websockets/ws) | 8.22.0 | MIT | Сервер WebSocket (`server/`) | нет (npm) | да (`node_modules/`) |
| [puppeteer-core](https://github.com/puppeteer/puppeteer) | 25.12.0 | Apache-2.0 | Опциональные браузерные тесты (dev-зависимость) | нет (npm) | нет |
| [Ark-Unpacker](https://github.com/isHarryh/Ark-Unpacker) декодер LZ4AK | — | BSD-3-Clause | `tools/local-extract/aklz4.py` (опциональное локальное извлечение) | **да** — сохраняет свое уведомление; полный текст также в `tools/local-extract/LICENSE-Ark-Unpacker.txt` | да |
| [UnityPy](https://github.com/K0lb3/UnityPy) (через MooncellWiki/UnityPy), [lz4](https://github.com/python-lz4/python-lz4), [Pillow](https://github.com/python-pillow/Pillow) | см. `tools/local-extract/requirements.txt` | MIT / BSD-3-Clause / MIT-CMU | Опциональное локальное извлечение; устанавливается через pip в `.venv-extract` только при согласии хоста | нет | нет |

Лицензия Spine Runtimes требует, среди прочего, чтобы при распространении включались ее лицензия и уведомление об авторских правах (воспроизведены ниже), а также чтобы «каждый пользователь Продуктов получил свою собственную лицензию на Spine Editor», если интеграция не покрывается Лицензионным соглашением Spine Editor — прочтите его перед распространением. Чтобы вообще допустить такое сочетание, этот проект предоставляет дополнительное разрешение в соответствии с разделом 7 GPL-3.0 на связывание с Spine Runtimes (см. [NOTICE.md](NOTICE.md)).

## Шрифты

| Шрифт | Лицензия | Как он здесь оказался |
|---|---|---|
| Bender (Jovanny Lemonad / Oleg Zhuravlev, Gladkikh Ivan) | условия свободного использования шрифта от авторов (не GPL) | загружается `tools/fetch-assets.mjs` из [TimWangZi/The-font-of-Arknights](https://github.com/TimWangZi/The-font-of-Arknights) в `public/fonts/` (включен в релизный пакет) |
| Novecento Wide (Jan Tonellato / Synthview) | условия свободного использования шрифта от авторов (не GPL) | как указано выше |
| Noto Sans SC, Oxanium, Rajdhani | SIL Open Font License 1.1 | загружается браузером из Google Fonts во время выполнения; не распространяется |

## Игровые данные, графика и аудио

Все названия, персонажи, иллюстрации, модели Spine, графика интерфейса, музыка, звуковые эффекты и игровые данные *Arknights* / 「卫戍协议：盟约」 являются © Shanghai Hypergryph Network Technology Co., Ltd. (上海鹰角网络科技有限公司) и его лицензиарами (Yostar и другие). Они **не** лицензированы под GPL, и этот проект не предоставляет никаких прав на них; см. [NOTICE.md](NOTICE.md) для ознакомления с условиями некоммерческого использования. Зеркала сообщества, используемые `tools/fetch-assets.mjs` / `tools/build-data.mjs`: [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData), [yuanyan3060/ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource), [fexli/ArknightsResource](https://github.com/fexli/ArknightsResource), [isHarryh/Ark-Models](https://github.com/isHarryh/Ark-Models), [ArknightsAssets/ArknightsAssets2](https://github.com/ArknightsAssets/ArknightsAssets2) — спасибо их сопровождающим. Цитаты из PRTS Wiki, BWIKI, NGA, 巴哈姆特 и других страниц сообщества в `docs/` остаются под условиями их источников (тексты вики распространяются по лицензии CC BY-NC-SA).

---

## Тексты лицензий

### PixiJS — MIT

```text
Лицензия MIT

Copyright (c) 2013-2023 Mathew Groves, Chad Engler

Настоящим предоставляется бесплатное разрешение любому лицу, получившему копию
данного программного обеспечения и связанных с ним файлов документации (далее —
«Программное обеспечение»), безвозмездно распоряжаться Программным обеспечением
без ограничений, включая, помимо прочего, права на использование, копирование,
изменение, объединение, публикацию, распространение, сублицензирование и/или
продажу копий Программного обеспечения, а также разрешать лицам, которым
предоставляется Программное обеспечение, делать то же самое при соблюдении
следующих условий:

Указанное выше уведомление об авторских правах и данное уведомление о разрешении
должны быть включены во все копии или существенные части Программного обеспечения.

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ,
ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ГАРАНТИИ ТОВАРНОЙ
ПРИГОДНОСТИ, СООТВЕТСТВИЯ ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ И ОТСУТСТВИЯ НАРУШЕНИЙ ПРАВ.
НИ В КОЕМ СЛУЧАЕ АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ПО ЛЮБЫМ
ИСКАМ, УЩЕРБУ ИЛИ ИНОЙ ОТВЕТСТВЕННОСТИ, БУДЬ ТО ПО ДОГОВОРУ, ДЕЛИКТУ ИЛИ ИНЫМ
ОСНОВАНИЯМ, ВОЗНИКАЮЩИМ ИЗ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ, ЕГО ИСПОЛЬЗОВАНИЯ ИЛИ
ИНЫХ ДЕЙСТВИЙ С НИМ.

Лицензионное соглашение Spine Runtimes
Последнее обновление: 1 января 2020 г. Заменяет все предыдущие версии.

Copyright (c) 2013-2020, Esoteric Software LLC

Интеграция Spine Runtimes в программное обеспечение или иное создание
производных произведений Spine Runtimes разрешено на условиях раздела 2
Лицензионного соглашения Spine Editor:
http://esotericsoftware.com/spine-editor-license

В противном случае разрешается интегрировать Spine Runtimes в программное
обеспечение или иным образом создавать производные произведения Spine Runtimes
(совместно именуемые «Продукты») при условии, что каждый пользователь Продуктов
должен получить свою собственную лицензию Spine Editor, а распространение
Продуктов в любой форме должно включать данную лицензию и уведомление об
авторских правах.

SPINE RUNTIMES ПРЕДОСТАВЛЯЮТСЯ КОМПАНИЕЙ ESOTERIC SOFTWARE LLC «КАК ЕСТЬ», И ЛЮБЫЕ
ЯВНЫЕ ИЛИ ПОДРАЗУМЕВАЕМЫЕ ГАРАНТИИ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ПОДРАЗУМЕВАЕМЫЕ
ГАРАНТИИ ТОВАРНОЙ ПРИГОДНОСТИ И СООТВЕТСТВИЯ ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ,
ИСКЛЮЧАЮТСЯ. НИ В КОЕМ СЛУЧАЕ ESOTERIC SOFTWARE LLC НЕ НЕСЕТ ОТВЕТСТВЕННОСТИ ЗА
ЛЮБЫЕ ПРЯМЫЕ, КОСВЕННЫЕ, СЛУЧАЙНЫЕ, ОСОБЫЕ, ШТРАФНЫЕ ИЛИ КОСВЕННЫЕ УБЫТКИ
(ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ПРИОБРЕТЕНИЕ ЗАМЕНЯЮЩИХ ТОВАРОВ ИЛИ УСЛУГ, ПОТЕРЮ
ДАННЫХ ИЛИ ПРИБЫЛИ, ПРЕРЫВАНИЕ ДЕЯТЕЛЬНОСТИ), ВОЗНИКШИЕ ЛЮБЫМ ОБРАЗОМ ИЗ
ИСПОЛЬЗОВАНИЯ SPINE RUNTIMES, ДАЖЕ ЕСЛИ БЫЛО СООБЩЕНО О ВОЗМОЖНОСТИ ТАКОГО УЩЕРБА.

Лицензия MIT

Copyright (c) 2015-present Jason Miller

Настоящим предоставляется бесплатное разрешение любому лицу, получившему копию
данного программного обеспечения и связанных с ним файлов документации (далее —
«Программное обеспечение»), безвозмездно распоряжаться Программным обеспечением
без ограничений, включая, помимо прочего, права на использование, копирование,
изменение, объединение, публикацию, распространение, сублицензирование и/или
продажу копий Программного обеспечения, а также разрешать лицам, которым
предоставляется Программное обеспечение, делать то же самое при соблюдении
следующих условий:

Указанное выше уведомление об авторских правах и данное уведомление о разрешении
должны быть включены во все копии или существенные части Программного обеспечения.

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ,
ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ГАРАНТИИ ТОВАРНОЙ
ПРИГОДНОСТИ, СООТВЕТСТВИЯ ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ И ОТСУТСТВИЯ НАРУШЕНИЙ ПРАВ.
НИ В КОЕМ СЛУЧАЕ АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ПО ЛЮБЫМ
ИСКАМ, УЩЕРБУ ИЛИ ИНОЙ ОТВЕТСТВЕННОСТИ, БУДЬ ТО ПО ДОГОВОРУ, ДЕЛИКТУ ИЛИ ИНЫМ
ОСНОВАНИЯМ, ВОЗНИКАЮЩИМ ИЗ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ, ЕГО ИСПОЛЬЗОВАНИЯ ИЛИ
ИНЫХ ДЕЙСТВИЙ С НИМ.

Лицензия MIT

Copyright © 2010-2026 three.js authors

Настоящим предоставляется бесплатное разрешение любому лицу, получившему копию
данного программного обеспечения и связанных с ним файлов документации (далее —
«Программное обеспечение»), безвозмездно распоряжаться Программным обеспечением
без ограничений, включая, помимо прочего, права на использование, копирование,
изменение, объединение, публикацию, распространение, сублицензирование и/или
продажу копий Программного обеспечения, а также разрешать лицам, которым
предоставляется Программное обеспечение, делать то же самое при соблюдении
следующих условий:

Указанное выше уведомление об авторских правах и данное уведомление о разрешении
должны быть включены во все копии или существенные части Программного обеспечения.

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ,
ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ГАРАНТИИ ТОВАРНОЙ
ПРИГОДНОСТИ, СООТВЕТСТВИЯ ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ И ОТСУТСТВИЯ НАРУШЕНИЙ ПРАВ.
НИ В КОЕМ СЛУЧАЕ АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ПО ЛЮБЫМ
ИСКАМ, УЩЕРБУ ИЛИ ИНОЙ ОТВЕТСТВЕННОСТИ, БУДЬ ТО ПО ДОГОВОРУ, ДЕЛИКТУ ИЛИ ИНЫМ
ОСНОВАНИЯМ, ВОЗНИКАЮЩИМ ИЗ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ, ЕГО ИСПОЛЬЗОВАНИЯ ИЛИ
ИНЫХ ДЕЙСТВИЙ С НИМ.

Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com>
Copyright (c) 2013 Arnout Kazemier and contributors
Copyright (c) 2016 Luigi Pinca and contributors

Настоящим предоставляется бесплатное разрешение любому лицу, получившему копию
данного программного обеспечения и связанных с ним файлов документации (далее —
«Программное обеспечение»), безвозмездно распоряжаться Программным обеспечением
без ограничений, включая, помимо прочего, права на использование, копирование,
изменение, объединение, публикацию, распространение, сублицензирование и/или
продажу копий Программного обеспечения, а также разрешать лицам, которым
предоставляется Программное обеспечение, делать то же самое при соблюдении
следующих условий:

Указанное выше уведомление об авторских правах и данное уведомление о разрешении
должны быть включены во все копии или существенные части Программного обеспечения.

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ,
ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ГАРАНТИИ ТОВАРНОЙ
ПРИГОДНОСТИ, СООТВЕТСТВИЯ ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ И ОТСУТСТВИЯ НАРУШЕНИЙ ПРАВ.
НИ В КОЕМ СЛУЧАЕ АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ПО ЛЮБЫМ
ИСКАМ, УЩЕРБУ ИЛИ ИНОЙ ОТВЕТСТВЕННОСТИ, БУДЬ ТО ПО ДОГОВОРУ, ДЕЛИКТУ ИЛИ ИНЫМ
ОСНОВАНИЯМ, ВОЗНИКАЮЩИМ ИЗ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ, ЕГО ИСПОЛЬЗОВАНИЯ ИЛИ
ИНЫХ ДЕЙСТВИЙ С НИМ.

Лицензия BSD 3-Clause

Copyright (c) 2022, Harry Huang
Все права защищены.

Распространение и использование в исходной и бинарной формах, с изменениями или
без них, разрешены при соблюдении следующих условий:

1. При распространении исходного кода должны сохраняться вышеуказанное
   уведомление об авторских правах, данный список условий и следующий отказ от
   ответственности.

2. При распространении в бинарной форме должны воспроизводиться вышеуказанное
   уведомление об авторских правах, данный список условий и следующий отказ от
   ответственности в документации и/или других материалах, поставляемых с
   распространением.

3. Ни название правообладателя, ни имена его участников не могут быть
   использованы для подтверждения или продвижения продуктов, созданных на
   основе данного программного обеспечения, без специального предварительного
   письменного разрешения.

ДАННОЕ ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ ПРАВООБЛАДАТЕЛЯМИ И УЧАСТНИКАМИ
«КАК ЕСТЬ», И ЛЮБЫЕ ЯВНЫЕ ИЛИ ПОДРАЗУМЕВАЕМЫЕ ГАРАНТИИ, ВКЛЮЧАЯ, ПОМИМО
ПРОЧЕГО, ПОДРАЗУМЕВАЕМЫЕ ГАРАНТИИ ТОВАРНОЙ ПРИГОДНОСТИ И СООТВЕТСТВИЯ
ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ, ИСКЛЮЧАЮТСЯ. НИ В КОЕМ СЛУЧАЕ ПРАВООБЛАДАТЕЛЬ ИЛИ
УЧАСТНИКИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ЗА ЛЮБЫЕ ПРЯМЫЕ, КОСВЕННЫЕ, СЛУЧАЙНЫЕ,
ОСОБЫЕ, ШТРАФНЫЕ ИЛИ КОСВЕННЫЕ УБЫТКИ (ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ПРИОБРЕТЕНИЕ
ЗАМЕНЯЮЩИХ ТОВАРОВ ИЛИ УСЛУГ; ПОТЕРЮ ДАННЫХ ИЛИ ПРИБЫЛИ; ПРЕРЫВАНИЕ
ДЕЯТЕЛЬНОСТИ), ВОЗНИКШИЕ ЛЮБЫМ ОБРАЗОМ ИЗ ИСПОЛЬЗОВАНИЯ ДАННОГО ПРОГРАММНОГО
ОБЕСПЕЧЕНИЯ, ДАЖЕ ЕСЛИ БЫЛО СООБЩЕНО О ВОЗМОЖНОСТИ ТАКОГО УЩЕРБА.

Лицензия MIT

Copyright (c) 2019-2021 K0lb3

Настоящим предоставляется бесплатное разрешение любому лицу, получившему копию
данного программного обеспечения и связанных с ним файлов документации (далее —
«Программное обеспечение»), безвозмездно распоряжаться Программным обеспечением
без ограничений, включая, помимо прочего, права на использование, копирование,
изменение, объединение, публикацию, распространение, сублицензирование и/или
продажу копий Программного обеспечения, а также разрешать лицам, которым
предоставляется Программное обеспечение, делать то же самое при соблюдении
следующих условий:

Указанное выше уведомление об авторских правах и данное уведомление о разрешении
должны быть включены во все копии или существенные части Программного обеспечения.

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ,
ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ГАРАНТИИ ТОВАРНОЙ
ПРИГОДНОСТИ, СООТВЕТСТВИЯ ОПРЕДЕЛЕННОМУ НАЗНАЧЕНИЮ И ОТСУТСТВИЯ НАРУШЕНИЙ ПРАВ.
НИ В КОЕМ СЛУЧАЕ АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ПО ЛЮБЫМ
ИСКАМ, УЩЕРБУ ИЛИ ИНОЙ ОТВЕТСТВЕННОСТИ, БУДЬ ТО ПО ДОГОВОРУ, ДЕЛИКТУ ИЛИ ИНЫМ
ОСНОВАНИЯМ, ВОЗНИКАЮЩИМ ИЗ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ, ЕГО ИСПОЛЬЗОВАНИЯ ИЛИ
ИНЫХ ДЕЙСТВИЙ С НИМ.


                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2018 Google Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
