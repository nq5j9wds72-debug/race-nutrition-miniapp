# Formula Spec v1.2

## Scope
Current draft covers:
- CARBS block
- HYDRATION block
- SODIUM block
- PLAN block

Other blocks to be added later:
- WARNINGS / CONFIDENCE integration

## CARBS — formula spec v1.2 draft

### 1. Цель блока

Carbs block в `v1.2` должен выдавать **практически выполнимый и честно ограниченный** план потребления углеводов на гонку.

Цель блока:
- не угадывать “идеальную физиологическую цифру”;
- а выбирать **разумный target внутри допустимого рабочего диапазона**;
- с учётом длительности нагрузки, practical feasibility, GI tolerance и ограничений fuel format.

Ключевой принцип:
**не обещать ложную точность там, где часть логики остаётся engineering model.**

---

### 2. Главные drivers и secondary modifiers

#### 2.1. Главный driver
`duration_min` — главный driver carbs logic.

#### 2.2. Главные practical modifiers
- `gi_tolerance_level`
- `fuel_format`

Они должны реально менять carbs result, а не быть только cosmetic / warning-only fields.

#### 2.3. Secondary modifiers
- `effort_level`
- `race_type`
- `elevation_gain_m`

Они используются как modifiers внутри диапазона, а не как отдельная “точная физиологическая формула”.

#### 2.4. Что не делаем главным driver
`weight_kg` не используется как основной driver within-race carbs/hour по умолчанию, если нет отдельной сильной базы.

---

### 3. Duration bands

Для `v1.2` carbs logic опирается на 3 duration bands:

- `< 60 min`
- `60–150 min`
- `> 150 min`

Смысл:
- короткий сценарий должен оставаться консервативным;
- средняя длительность — основной рабочий диапазон;
- длинная длительность допускает более высокий intake, но не автоматически и не без practical constraints.

---

### 4. Base working range by duration

Duration band задаёт **allowed working range**, а не готовый итоговый target.

#### `< 60 min`
- working range: `0–30 г/ч`
- default behavior должен быть консервативным
- short cool simple case не должен выглядеть перегруженным планом

#### `60–150 min`
- working range: `30–60 г/ч`

#### `> 150 min`
- working range: `60–90 г/ч`
- верхняя часть диапазона допустима только при совпадении practical условий
- длинная гонка сама по себе **не означает**, что надо автоматически ставить высокий intake

Итоговый target выбирается позже:
1. внутри duration range,
2. потом ограничивается GI ceiling,
3. потом ограничивается fuel-format cap.

---

### 5. Role of `gi_tolerance_level`

`gi_tolerance_level` влияет на:
- carbs/hour ceiling
- carbs per intake
- interval
- warnings
- confidence level плана

Важно:
**GI ceiling — это ceiling, а не auto-target.**

#### `low`
- `60–150 min` → ceiling `45 г/ч`
- `>150 min` → ceiling `60 г/ч`
- dose per intake: `15–20 г`
- preferred interval: `20 мин`
- warnings усиливаются
- output language должен честно показывать, что practical ambition ограничена GI tolerance

#### `medium`
- `60–150 min` → ceiling `60 г/ч`
- `>150 min` → ceiling `75 г/ч`
- dose per intake: `20–25 г`
- preferred interval: `20–25 мин`

#### `high`
- `60–150 min` → ceiling `60 г/ч`
- `>150 min` → ceiling `90 г/ч`
- dose per intake: `25–30 г`
- preferred interval: `15–20 мин`

Но:
- `high` **не означает автоматические `90 г/ч`**
- ceiling `90 г/ч` допустим только если:
  - `duration_min > 150`
  - `gi_tolerance_level = high`
  - `fuel_format = combo`
  - нет других ограничивающих practical факторов

---

### 6. Role of `fuel_format`

`fuel_format` — главный practical feasibility modifier.

Он должен ограничивать не только warnings, но и сам carbs result.
Это одно из ключевых исправлений относительно `v1.1`, где format почти не участвует в math.

#### `combo`
- самый гибкий и practical format
- может использовать полный ceiling по GI rules
- только здесь допускается выход к `90 г/ч`, и только если:
  - `gi_tolerance_level = high`
  - `duration_min > 150`
  - нет других ограничивающих факторов

#### `gels`
- practical format, но более консервативный, чем `combo`
- practical cap: `75 г/ч` **[MODEL-BASED practical cap]**
- даже при `high GI` не ведём gels-сценарий к `90 г/ч` как default behavior

#### `drink_only`
- ограниченный format по practical feasibility
- practical cap: `60 г/ч` **[MODEL-BASED practical cap]**
- если base logic хочет дать выше `60 г/ч`, итог должен clamp’иться до `60 г/ч`
- обязателен явный warning про ограниченную выполнимость high-carb plan только за счёт напитка

---

### 7. Role of `effort_level`

`effort_level` используется как **intra-band modifier**, а не как физиологическая истина.

Текущие фактические значения поля:
- `easy`
- `steady`
- `race`

Draft behavior:
- `easy` → lower part of band
- `steady` → neutral
- `race` → upper part of band

Но:
- `effort_level` не должен пробивать GI ceiling
- `effort_level` не должен пробивать fuel-format cap

---

### 8. Role of `race_type`

`race_type` не должен автоматически задавать carbs/hour сам по себе.
Он нужен как practical context modifier.

Draft behavior:
- `road` → neutral
- `trail` → contextual modifier execution complexity
- `ultra` → по умолчанию более осторожный practical context; не auto-upgrade carbs/hour, а скорее conservative modifier при прочих равных

---

### 9. Role of `elevation_gain_m`

`elevation_gain_m` используется осторожно и только как secondary contextual modifier.

Он не должен сам по себе резко поднимать carbs target.

Draft behavior:
- на `road` влияние минимальное или отсутствует
- на `trail/ultra` elevation может сдвигать выбор внутри band вверх, но ограниченно
- elevation не пробивает GI ceiling
- elevation не пробивает fuel-format cap

---

### 10. Target selection order

В `v1.2` carbs target должен собираться в таком порядке:

1. выбрать duration band
2. выбрать base target внутри band
3. применить `effort_level` / `race_type` / `elevation_gain_m` как intra-band modifiers
4. применить GI ceiling
5. применить fuel-format practical cap
6. собрать interval / dose per intake
7. добавить warnings и confidence language

---

### 10A. Intra-band zone selection

Base target внутри duration band выбирается через **zone system**, а не через “точную физиологическую формулу”.

Используем 3 зоны:
- `lower`
- `mid`
- `upper`

Это **[MODEL-BASED] engineering layer** на базе science-defined duration bands.

#### Zone mapping by duration band

Для `60–150 min`:
- `lower` = `30 г/ч`
- `mid` = `45 г/ч`
- `upper` = `60 г/ч`

Для `>150 min`:
- `lower` = `60 г/ч`
- `mid` = `75 г/ч`
- `upper` = `90 г/ч`

Для `<60 min`:
- используем отдельный консервативный short-duration behavior
- этот band пока не требует полной zone-логики
- default range остаётся `0–30 г/ч`

#### Starting zone

- `60–150 min` → starting zone = `mid`
- `>150 min` → starting zone = `mid`

#### Zone shifts by modifiers

##### `effort_level`
- `easy` → `-1 zone`
- `steady` → `0`
- `race` → `+1 zone`

##### `race_type`
Для `60–150 min`:
- `road` → `0`
- `trail` → `0`
- `ultra` → `0`

Для `>150 min`:
- `road` → `0`
- `trail` → `0`
- `ultra` → `-1 zone` **[MODEL-BASED]**

##### `elevation_gain_m`
Применяется только если `race_type = trail` или `race_type = ultra`:
- `<1500 m` → `0`
- `>=1500 m` → `+1 zone` **[MODEL-BASED]**

##### `gi_tolerance_level`
Это влияние применяется **до GI ceiling**, как practical ambition modifier:
- `low` → `-1 zone`
- `medium` → `0`
- `high` → `0`

Важно:
- `high` не даёт автоматический `+1 zone`
- `GI tolerance` ограничивает амбициозность, но не должно автоматически “разгонять” target вверх

#### Clamp rule

После применения всех zone shifts:
- ниже `lower` не опускаемся
- выше `upper` не поднимаемся

#### Conversion to base target

После clamp:
- выбранная зона переводится в `base carbs target`
- затем уже отдельно применяются:
  1. `GI ceiling`
  2. `fuel-format practical cap`

#### Why this model is used

Этот подход нужен, чтобы:
- не притворяться, что у нас есть точная физиологическая формула для каждого пользователя;
- сделать выбор внутри диапазона объяснимым;
- сохранить честную связь между duration bands и practical modifiers.

#### Notes

- `ultra => -1 zone` используется только для `>150 min`, а не для `60–150 min`
- `elevation_gain_m` intentionally используется осторожно:
  - только для `trail/ultra`
  - только от `1500+ м`
- это честнее, чем текущая схема `v1.1`, где высота даёт механическую прибавку `+5 / +10 г/ч` для `trail/ultra` без zone-logic.

---

### 11. Warnings and confidence

Warnings должны усиливаться, если:
- `low GI` и план близок к ceiling
- `drink_only` ограничивает target
- long race требует высокого intake, но format / GI не дают выполнить его уверенно
- модель даёт engineering estimate, а не персонализированную физиологию

Confidence language должен быть честнее, если:
- GI self-report ненадёжен
- format ограничивает feasibility
- план агрессивный
- сценарий длинный и сложный по исполнению

---

### 12. Expected behavior on Day 39 cases

- `CASE_001`
  - short cool simple case должен остаться консервативным и простым

- `CASE_002`
  - low GI case должен выглядеть более явно GI-limited
  - результат должен честно объяснять practical limit

- `CASE_003`
  - hot marathon `drink_only` должен выглядеть менее practical, чем `gels/combo`
  - итог должен быть жёстче ограничен по feasibility

- `CASE_004`
  - trail + elevation должен выглядеть более контекстно, но не auto-escalated

- `CASE_005`
  - ultra case не должен следовать скрытому правилу “longer = always higher carbs/hour”

---

### 13. Что в этом блоке science-based, а что model-based

**[SCIENCE-BASED]**
- duration as primary carbs driver
- higher intake needs better tolerability
- GI tolerance matters for practical fueling tolerance

**[MODEL-BASED]**
- exact ceilings by GI tier
- `gels = 75 г/ч` practical cap
- `drink_only = 60 г/ч` practical cap
- exact intra-band shift logic for effort / trail / ultra / elevation
- confidence language thresholds

**[HYPOTHESIS / NEEDS CHECK]**
- насколько self-reported GI tolerance стабильно отражает реальную gut readiness у конкретного пользователя

---

## HYDRATION — formula spec v1.2 draft

### 1. Цель блока

Hydration block в `v1.2` должен выдавать **практически выполнимый, safety-first и честно ограниченный** план потребления жидкости на гонку.

Цель блока:
- не делать вид, что существует одна точная персональная формула для всех;
- использовать персональный `sweat_rate_lph` как главный hydration input, если он известен и валиден;
- при отсутствии `sweat_rate_lph` использовать более грубый, но объяснимый fallback;
- отдельно учитывать риск **overdrinking** и не строить hydration как full-replacement default;
- выдавать результат так, чтобы пользователь понимал уровень уверенности модели.

Ключевой принцип:
**лучше консервативная и честная hydration model с warnings, чем псевдоточная “умная” формула без достаточной базы.**

---

### 2. Главные принципы блока

#### 2.1. [SCIENCE-BASED] Если известен `sweat_rate_lph`, это главный hydration input

Если у пользователя есть свой `sweat_rate_lph`, hydration block должен опираться прежде всего на него, а не на общую weather-based оценку.

#### 2.2. [SCIENCE-BASED] Hydration не должна строиться как full-replacement default

Цель блока — не “восполнить 100% потерь любой ценой”, а дать practical target, который снижает риск и недопивания, и перепивания.

#### 2.3. [SCIENCE-BASED] Weather fallback имеет lower confidence

Если `sweat_rate_lph` неизвестен, расчёт по погоде и контексту гонки остаётся приблизительным engineering estimate, а не персонально точной физиологией.

#### 2.4. [SCIENCE-BASED] Overdrinking risk — обязательная часть hydration logic

Hydration block должен иметь отдельную anti-overdrinking логику и не должен автоматически повышать fluid target только потому, что сценарий выглядит “тяжёлым”.

#### 2.5. [SCIENCE-BASED] Fixed universal hourly target для всех — плохая идея

Одинаковый fluid target для разных людей и условий создаёт ложную точность и особенно рискован в жаре, на длинных событиях и без персонального sweat test.

#### 2.6. [SCIENCE-BASED] Чем выше жара, длительность и неопределённость, тем ниже должна быть “уверенность модели”

Long duration + hot conditions + no sweat rate = lower-confidence scenario.
Это должно отражаться не только в warnings, но и в самом стиле результата.

---

### 3. Роль входных полей

#### 3.1. Главные drivers

- `sweat_rate_lph`
- `temperature_c`
- `duration_min`

#### 3.2. Главные fallback/context inputs

- `humidity_pct`
- `race_type`

#### 3.3. Secondary/context modifiers

- `weight_kg`
- `effort_level`
- `elevation_gain_m`

#### 3.4. Важно

- `sweat_rate_lph` — главный персональный hydration input
- `temperature_c` — главный environmental input
- `duration_min` — главный contextual input для hydration target и warning logic
- `humidity_pct` повышает точность heat-stress оценки, но не обязана быть доступна всегда
- `race_type` нужен как practical context modifier
- `weight_kg` можно использовать осторожно только как secondary/context input для fallback и warnings, а не как главный driver hourly fluid target
- `effort_level` можно использовать только как слабый contextual modifier, а не как “физиологическую истину”
- `elevation_gain_m` использовать осторожно: скорее как contextual execution/warning modifier, чем как основной driver fluid/hour

---

### 4. Архитектура блока

Hydration block в `v1.2` должен иметь 2 основные ветки:

#### 4.1. Branch A — known sweat rate

Используется, если:
- `sweat_rate_lph` задан
- значение валидно
- его можно безопасно использовать как персональный input

Общий принцип:
- fluid target строится как **консервативная доля от sweat loss**
- не как automatic full replacement
- и по умолчанию не должен равняться или превышать `sweat_rate_lph`
- с отдельными ceilings / warnings / confidence language

#### 4.2. Branch B — fallback

Используется, если:
- `sweat_rate_lph` отсутствует
- или значение невалидно
- или его нельзя безопасно использовать

Общий принцип:
- fluid target строится по conservative fallback logic
- на основе:
  - `temperature_c`
  - `humidity_pct`
  - `duration_min`
  - `race_type`
- при отсутствии `humidity_pct` допускается более грубый fallback по:
  - `temperature_c`
  - `duration_min`
  - `race_type`
- `weight_kg` может использоваться только как secondary safety/context input
- результат должен маркироваться как **lower-confidence estimate**

---

### 5. Validation / null behavior for `sweat_rate_lph`

#### 5.1. Считаем, что `sweat_rate_lph` отсутствует

Следующие состояния должны вести в fallback branch:

- поле отсутствует
- `null`
- пустое значение
- `0`
- отрицательное значение
- нечисловое значение

#### 5.2. Считаем, что `sweat_rate_lph` невалиден для core use

Значение не должно использоваться как персональный hydration input, если оно выглядит явно нереалистичным для MVP-диапазона или ввод не прошёл базовую sanity-check validation.

#### 5.3. Важный продуктовый принцип

Нельзя:
- маскировать `unknown` под “normal” или “medium”
- делать вид, что fallback и known-sweat-rate branch имеют одинаковую точность
- silently использовать сомнительный `sweat_rate_lph` без снижения confidence

#### 5.4. Поведение результата

Если `sweat_rate_lph` невалиден или неизвестен:
- включается fallback branch
- confidence снижается
- в warnings допускается честная формулировка о пользе sweat test, особенно в жаре и на длинных стартах

---

### 6. Какую роль не должны играть optional fields

#### 6.1. `humidity_pct`

- если есть — улучшает fallback estimate
- если нет — hydration block всё равно должен работать
- отсутствие `humidity_pct` не должно ломать расчёт

#### 6.2. `effort_level`

- может использоваться как небольшой contextual modifier
- если поле не задано, допустим default fallback
- влияние не должно быть настолько сильным, чтобы превращать hydration result в псевдоточную физиологию

#### 6.3. `elevation_gain_m`

- может усиливать practical execution stress и warning layer в trail/ultra context
- не должен без отдельной базы становиться главным прямым driver fluid/hour

#### 6.4. `weight_kg`

- допустим как вспомогательный safety/context input в fallback
- не должен подменять собой персональный `sweat_rate_lph`
- не должен создавать видимость персонализации уровня sweat-test branch

---

### 7. Что блок обязан делать честно

Hydration block в `v1.2` обязан:

1. Разводить 2 логики:
   - known sweat rate
   - fallback

2. Показывать lower confidence, если:
   - нет `sweat_rate_lph`
   - жарко
   - высокая влажность
   - событие длинное
   - сценарий выглядит более рискованным по overdrinking / heat stress

3. Не выдавать sodium как защиту от overdrinking-related risk

4. Не использовать агрессивную universal-логику вида:
   - “жарко = всегда резко больше пить”
   - “длинно = стремиться к full replacement”
   - “если неизвестно — просто дать среднее и звучать уверенно”

5. Подсказывать, когда sweat test особенно полезен:
   - жаркие условия
   - длинные старты
   - высокий fluid target
   - подозрение на heavy sweater
   - повторяющиеся длинные гонки
   - когда пользователь хочет более персонализированный hydration/sodium plan

---

### 8. Связь с target behavior cases

#### 8.1. Hot scenario without sweat rate

Для hot / humid сценария без `sweat_rate_lph` hydration result должен быть:
- более консервативным
- более честным по uncertainty
- более явным по warnings
- не выглядеть так же уверенно, как персональный sweat-rate case

#### 8.2. Known sweat-rate case

Если `sweat_rate_lph` известен:
- именно он должен быть главным hydration input
- weather context не исчезает, но уже не является главным персональным источником
- confidence должен быть выше, чем у fallback
- при длинном жарком ultra-сценарии warnings всё равно усиливаются

#### 8.3. Trail / long execution context

Для длинных trail/ultra scenarios hydration block должен быть practical:
- учитывать, что исполнение плана сложнее
- не делать вид, что точность fallback высока
- лучше усиливать warning layer, чем переобещать точность

---

### 9. Что нужно формализовать дальше в этом блоке

Ниже в этом разделе дальше нужно отдельно зафиксировать:

1. branch selection rules  
2. known sweat rate logic  
3. fallback logic  
4. role of temperature bands  
5. role of humidity in fallback  
6. role of race_type in fallback  
7. role of duration in hydration ceilings / warnings  
8. floor / soft cap / hard cap  
9. anti-overdrinking rules  
10. interval and per-intake translation  
11. warnings and confidence  
12. expected behavior on Day 39 / target cases  
13. что здесь science-based, model-based и hypothesis

---

### 10. Что уже зафиксировано на этом этапе

На текущем этапе уже считаем зафиксированным:

- `sweat_rate_lph` — главный персональный hydration input
- fallback без `sweat_rate_lph` — lower-confidence branch
- hydration не должна строиться как full-replacement default
- нужен отдельный anti-overdrinking layer
- `temperature_c` и `duration_min` — главные hydration context drivers
- `humidity_pct`, `race_type`, `weight_kg`, `effort_level`, `elevation_gain_m` — только contextual / secondary inputs, без псевдонаучного перегруза
- unknown / invalid `sweat_rate_lph` нельзя quietly трактовать как нормальный персональный input

---

### 11. Предварительное разделение по типам правил

#### [SCIENCE-BASED]
- приоритет персонального `sweat_rate_lph` над общим weather fallback
- вред как dehydration, так и overhydration
- отказ от automatic full replacement default
- lower confidence без персонального sweat rate
- необходимость отдельной anti-overdrinking logic

#### [MODEL-BASED]
- двухветочная архитектура блока
- fallback matrix по `temperature_c`, `humidity_pct`, `duration_min`, `race_type`
- использование `weight_kg` только как secondary/context input
- contextual role для `effort_level` и `elevation_gain_m`
- explicit confidence language and warning layer

#### [HYPOTHESIS / NEEDS CHECK]
- точная числовая fallback-matrix fluid/hour только по weather/context variables
- универсальный ideal replacement fraction для всех пользователей
- точные numeric thresholds для всех overdrinking scenarios без отдельной валидации на cases

---

### 12. Branch selection rules

#### 12.1. Главный принцип выбора ветки

Hydration block в `v1.2` обязан сначала определить,
можно ли использовать `sweat_rate_lph` как **персональный hydration input**.

Если да:
- используется **Branch A — known sweat rate**

Если нет:
- используется **Branch B — fallback**

Это правило должно быть жёстким и explainable:
- нельзя смешивать обе ветки так, как будто они имеют одинаковую точность;
- нельзя silently трактовать unknown / invalid `sweat_rate_lph` как “нормальный персональный input”;
- нельзя маскировать fallback под персонализированный sweat-rate calculation.

**Branch selection выполняется до любой дальнейшей hydration math**:
- до fallback matrix,
- до replacement fraction,
- до ceilings,
- до interval/per-intake translation,
- до warning scoring,
- до confidence wording.

---

#### 12.2. Когда выбирается Branch A — known sweat rate

Branch A выбирается только если одновременно выполнены все условия:

1. `sweat_rate_lph` передан пользователем
2. значение не пустое
3. значение числовое
4. значение положительное
5. значение проходит базовую hydration validation для `v1.2`
6. нет оснований считать это значение ненадёжным для core use

Итоговое правило:

**Если `sweat_rate_lph` валиден и пригоден для использования, hydration block должен считать его главным персональным input и идти в Branch A.**

---

#### 12.3. Когда выбирается Branch B — fallback

Branch B выбирается, если выполняется хотя бы одно из условий:

- `sweat_rate_lph` отсутствует
- `sweat_rate_lph = null`
- поле пустое
- значение нечисловое
- значение `<= 0`
- значение не проходит hydration validation для `v1.2`
- значение выглядит недостаточно надёжным для использования как персональный core input

Итоговое правило:

**Если `sweat_rate_lph` невалиден, неизвестен или сомнителен для core use, hydration block обязан переключиться в fallback branch.**

---

#### 12.4. Что значит “сомнителен для core use”

На уровне branch selection это означает:

- значение может быть формально введено,
  но продукт не должен безоговорочно считать его качественным персональным sweat test;
- если есть сомнение в пригодности значения,
  приоритет у safety и честности модели, а не у псевдоперсонализации;
- в спорных случаях лучше уйти в fallback branch с честным снижением confidence,
  чем оставить пользователя с “точным” числом, которому нельзя доверять.

---

#### 12.5. Branch selection не зависит от желания “дать более умный результат”

Выбор ветки не должен зависеть от таких мотивов, как:

- сделать output более персонализированным на вид
- сделать число менее “средним”
- убрать warning
- искусственно повысить confidence

Branch selection должен зависеть только от:
- наличия валидного `sweat_rate_lph`
- пригодности этого значения для персонального hydration use

---

#### 12.6. Поведение optional fields при выборе ветки

Следующие поля **не определяют ветку сами по себе**:

- `temperature_c`
- `humidity_pct`
- `duration_min`
- `race_type`
- `weight_kg`
- `effort_level`
- `elevation_gain_m`

Их роль:

- в Branch A они помогают настроить practical target, warnings и confidence
- в Branch B они помогают собрать fallback estimate

Но сами по себе эти поля:
- не могут “заменить” валидный `sweat_rate_lph`
- не могут превращать fallback в персональный sweat-rate branch
- не должны подменять branch selection своей “силой контекста”

---

#### 12.7. Что значит “known sweat rate остаётся главным input”

Если выбран Branch A:
- hydration engine не должен строить отдельный temperature-based base rate и потом смешивать его со `sweat_rate_lph` как будто это равноправные источники;
- `sweat_rate_lph` остаётся главным персональным входом;
- `temperature_c`, `humidity_pct`, `duration_min`, `race_type`, `effort_level` и другие contextual inputs могут влиять на:
  - replacement fraction,
  - ceilings,
  - warnings,
  - confidence,
  но не должны отменять сам приоритет `sweat_rate_lph`.

Главный принцип:
**weather/context могут модифицировать practical output внутри Branch A, но не должны подменять собой персональный sweat-rate input.**

---

#### 12.8. Поведение при отсутствии `humidity_pct`

Отсутствие `humidity_pct`:
- не запрещает расчёт hydration result
- не влияет на сам выбор ветки
- не должно ломать ни Branch A, ни Branch B

Если `humidity_pct` отсутствует:
- Branch A всё равно работает, если валиден `sweat_rate_lph`
- Branch B всё равно работает, но с более грубым fallback и более низкой точностью

---

#### 12.9. Поведение confidence при выборе ветки

Branch selection обязан сразу влиять на expected confidence:

- **Branch A — known sweat rate**
  - confidence выше, чем у fallback
  - но не автоматически “high” во всех сценариях

- **Branch B — fallback**
  - confidence ниже по умолчанию
  - в жаре, на длинных стартах и при высокой неопределённости confidence должен снижаться ещё сильнее

Главный принцип:
**наличие персонального `sweat_rate_lph` повышает объяснимость и персонализацию hydration model, но не отменяет ограничения, жару, длительность и warnings.**

---

#### 12.10. Что нельзя делать

Hydration block в `v1.2` не должен:

1. silently трактовать `unknown` как usable sweat-rate value
2. маскировать fallback под персональную hydration calculation
3. использовать сомнительный `sweat_rate_lph` только ради “умного” вида результата
4. повышать confidence без реального основания
5. делать вид, что fallback и known-sweat-rate branch равны по качеству
6. обходить branch selection rules ради красивого output
7. смешивать Branch A с temperature-based fallback logic так, как будто это одна и та же ветка

---

#### 12.11. Операционный итог для будущего backend

Перед любым расчётом `fluid_per_hour` hydration engine должен выполнить такой порядок:

1. проверить `sweat_rate_lph`
2. решить, usable он или нет
3. если usable → выбрать Branch A
4. если not usable → выбрать Branch B
5. только после этого переходить к math logic выбранной ветки
6. отдельно формировать confidence и warnings в соответствии с выбранной веткой

---

#### 12.12. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- персональный `sweat_rate_lph` предпочтительнее общего weather fallback
- без персонального sweat rate hydration estimate менее точен
- overconfidence при hydration planning нежелателен
- hydration не должна строиться как ложноперсонализированный universal model

**[MODEL-BASED]**
- двухветочная branch architecture
- жёсткий порядок выбора ветки до math logic
- правило “сомнительный sweat rate → fallback”
- явная связь branch selection с confidence layer
- правило “в Branch A weather/context модифицируют output, но не подменяют `sweat_rate_lph`”

**[HYPOTHESIS / NEEDS CHECK]**
- точные критерии, по которым значение `sweat_rate_lph` считается “сомнительным для core use”
- финальные numeric validation thresholds для перехода между usable / not usable

---

### 13. Known sweat rate logic

#### 13.1. Главный принцип Branch A

Если hydration engine выбрал **Branch A — known sweat rate**,
то `sweat_rate_lph` становится главным персональным input для расчёта `fluid_per_hour_l`.

Основная логика Branch A:

- сначала берём персональный `sweat_rate_lph`;
- затем рассчитываем **консервативную replacement fraction**;
- затем получаем preliminary fluid target;
- затем применяем anti-overdrinking protection;
- затем уже отдельно накладываем practical ceilings, warnings и confidence language.

Главный принцип:
**Branch A должен быть персонализированным, но не агрессивным.**

---

#### 13.2. Базовая структура расчёта

Внутри Branch A hydration math должен строиться так:

1. взять `sweat_rate_lph`
2. определить `replacement_fraction`
3. рассчитать:
   - `preliminary_fluid_per_hour_l = sweat_rate_lph * replacement_fraction`
4. проверить anti-overdrinking safety
5. затем уже применять:
   - soft/hard caps
   - warnings
   - confidence layer
   - interval/per-intake translation

Рабочая формула уровня spec:

`fluid_per_hour_l = sweat_rate_lph × replacement_fraction`

Но с обязательным правилом:
**итоговый fluid target по умолчанию не должен равняться или превышать `sweat_rate_lph`.**

---

#### 13.3. Какой должна быть replacement fraction

Replacement fraction в Branch A должна быть:

- **консервативной**
- **model-based**
- **ниже full replacement**
- **не универсально одинаковой для всех условий**

На уровне `v1.2` допустимо зафиксировать такой рабочий диапазон:

- **replacement fraction: `0.55–0.80`**

Смысл диапазона:

- нижняя часть диапазона — более консервативный сценарий;
- верхняя часть диапазона — более demanding scenario,
  но всё ещё без перехода к full replacement default.

Это не “идеальный физиологический процент для всех”,
а инженерный safety-first диапазон для продукта.

---

#### 13.4. Что влияет на replacement fraction внутри Branch A

Replacement fraction внутри known-sweat-rate branch может меняться под влиянием контекста.

Главные contextual modifiers:

- `temperature_c`
- `humidity_pct`
- `duration_min`
- `effort_level`

Вторичный modifier:

- `race_type`

Контекстные поля, которые по умолчанию лучше держать в warning / execution layer:

- `elevation_gain_m`
- `weight_kg`

Но важно:

- эти поля **не заменяют** `sweat_rate_lph`;
- они только помогают выбрать более нижнюю или верхнюю часть допустимого replacement range;
- влияние должно быть **умеренным и explainable**,
  а не выглядеть как “точная физиологическая формула”.

---

#### 13.5. Роль `temperature_c` внутри Branch A

`temperature_c` должен быть одним из главных modifiers replacement fraction.

Общий принцип:

- чем жарче условия,
  тем выше может быть practical replacement fraction внутри допустимого диапазона;
- но жара **не должна автоматически** вести к full replacement;
- даже в жаре модель должна сохранять anti-overdrinking orientation.

Практический смысл:

- температура помогает сдвигать intake вверх **внутри** допустимого conservative range;
- но не отменяет safety logic.

---

#### 13.6. Роль `humidity_pct` внутри Branch A

Если `humidity_pct` известен:

- он может дополнительно усиливать heat-stress context;
- он может поддерживать умеренный сдвиг replacement fraction вверх внутри допустимого range;
- он может усиливать warning layer.

Если `humidity_pct` неизвестен:

- Branch A всё равно должен работать;
- отсутствие влажности не должно ломать Branch A;
- в этом случае replacement fraction определяется по остальному контексту,
  но confidence может быть немного ниже.

---

#### 13.7. Роль `duration_min` внутри Branch A

`duration_min` в known-sweat-rate branch не должен напрямую заменять `sweat_rate_lph`,
но должен влиять на practical hydration logic.

Общий принцип:

- чем длиннее событие,
  тем важнее:
  - исполнимость плана,
  - anti-overdrinking protection,
  - честность confidence,
  - warning layer;
- длительность может поддерживать небольшой сдвиг replacement fraction вверх в demanding scenarios,
  но не должна автоматически вести к full replacement.

То есть:
- длинная гонка может требовать более внимательного hydration planning,
- но не оправдывает потерю консервативности.

---

#### 13.8. Роль `effort_level` внутри Branch A

Внутри текущего проекта `effort_level` следует трактовать через существующие значения:

- `easy`
- `steady`
- `race`

Общий принцип:

- `easy` → более консервативная часть replacement range
- `steady` → нейтральный default
- `race` → допускает умеренный сдвиг вверх внутри replacement range

Важно:

- `effort_level` — это **practical modifier**,
  а не физиологически точная формула;
- его влияние должно быть слабее, чем роль самого `sweat_rate_lph`;
- `effort_level` не должен сам по себе ломать anti-overdrinking logic.

---

#### 13.9. Роль `race_type` внутри Branch A

`race_type` можно использовать как **слабый contextual modifier**,
но осторожно.

Допустимый смысл:

- усиливать warning layer;
- учитывать practical execution context;
- в отдельных случаях слегка сдвигать replacement fraction внутри допустимого range,
  если это остаётся explainable и не ломает safety-first логику.

Недопустимый смысл:

- превращать `race_type` в главный driver fluid/hour;
- подменять им персональный `sweat_rate_lph`;
- использовать его как оправдание для агрессивного hydration target.

---

#### 13.10. Роль `elevation_gain_m` внутри Branch A

`elevation_gain_m` по умолчанию лучше использовать **не как прямой driver replacement fraction**,
а как contextual field для:

- warning layer;
- practical execution context;
- long trail / ultra interpretation.

Только в более поздней numeric-spec стадии можно отдельно решить,
нужен ли этому полю небольшой дополнительный effect внутри Branch A.

На текущем этапе главный принцип такой:

- `elevation_gain_m` может усиливать контекст;
- но не должен преждевременно выглядеть как сильный математический driver hydration target.

---

#### 13.11. Роль `weight_kg` внутри Branch A

`weight_kg` при известном `sweat_rate_lph` не должен становиться главным hydration driver.

Допустимый смысл:

- слабый contextual/safety input;
- дополнительный контекст для warnings;
- помощь в интерпретации fallback-less scenarios при дальнейшем развитии модели.

Недопустимый смысл:

- подменять персональный `sweat_rate_lph`;
- создавать псевдоперсонализацию поверх уже известного sweat rate;
- превращать массу тела в главный вычислительный фактор Branch A.

---

#### 13.12. Anti-overdrinking rule внутри Branch A

Это обязательное правило known-sweat-rate branch.

Hydration engine должен защищаться от сценария,
в котором итоговый target становится равен или выше `sweat_rate_lph`.

Главный принцип:

**если `sweat_rate_lph` известен, итоговый `fluid_per_hour_l` по умолчанию должен оставаться ниже `sweat_rate_lph`.**

Это нужно, чтобы:
- не превращать hydration block в full-replacement default;
- не повышать риск overdrinking;
- не делать из персонального sweat rate ложный повод “пить максимально много”.

Operational rule:

- если preliminary target поднимается слишком высоко,
  hydration engine обязан ограничить его ниже `sweat_rate_lph`.

---

#### 13.13. Как known-sweat-rate branch должен выглядеть по сравнению с v1.1

В текущем `v1.1` известный `sweat_rate_lph` фактически даёт простую логику:

- `fluid_per_hour_ml = sweat_rate_lph × 1000 × 0.7`

Для `v1.2` known-sweat-rate branch должен стать:

- более explainable;
- более contextual;
- более safety-aware;
- но не радикально “магическим”.

То есть:
- `v1.2` не должен ломать сам принцип Branch A;
- он должен улучшить его через:
  - conservative replacement range,
  - contextual modifiers,
  - explicit anti-overdrinking rule,
  - более честный confidence layer.

---

#### 13.14. Expected behavior for target cases

Для сценария с known sweat rate hydration block должен вести себя так:

- known sweat rate остаётся главным hydration input;
- результат не выглядит как weather-only estimate;
- confidence выше, чем у fallback branch;
- в длинных жарких сценариях warnings усиливаются;
- overdrinking risk легче surfaced, если target поднимается высоко.

Особенно важно для case типа:

- long / hot / humid / ultra
- `sweat_rate_lph` известен

В таком сценарии продукт должен:
- prioritise Branch A;
- усиливать safety language;
- не скрывать uncertainty в верхних сценариях;
- не делать sodium “защитой” от перепивания.

---

#### 13.15. Что пока не фиксируем в этом разделе

На этом шаге **ещё не фиксируем**:

- точные temperature bands
- точные humidity thresholds
- точные modifier increments
- final soft cap
- final hard cap
- exact warning thresholds
- interval/per-intake translation

Это пойдёт следующими подшагами.

Здесь фиксируем только:
- архитектуру known-sweat-rate math
- роль replacement fraction
- роль contextual modifiers
- обязательную anti-overdrinking protection

---

#### 13.16. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- при известном `sweat_rate_lph` это главный персональный hydration input
- hydration не должна строиться как automatic full replacement default
- overdrinking risk нужно учитывать отдельно
- итоговый intake не должен без причины стремиться к full replacement
- жара, влажность и длительность влияют на hydration context

**[MODEL-BASED]**
- replacement fraction range `0.55–0.80`
- использование contextual modifiers внутри replacement range
- трактовка `easy / steady / race` как practical modifier для Branch A
- operational rule для clamping результата ниже `sweat_rate_lph`
- осторожная роль `race_type` в Branch A
- вынесение `elevation_gain_m` и `weight_kg` в основном в warning/context layer на этом этапе

**[HYPOTHESIS / NEEDS CHECK]**
- точные numeric shifts replacement fraction по temperature/humidity/duration/effort
- нужна ли отдельная малая math-role для `elevation_gain_m` внутри Branch A
- нужен ли отдельный contextual effect от `weight_kg` внутри Branch A
- точный запас below-sweat-rate clamp
- точные thresholds, при которых warning layer должен резко усиливаться

---

### 14. Replacement fraction selection inside Branch A

#### 14.1. Главный принцип

Если выбран **Branch A — known sweat rate**,
hydration engine не должен использовать fixed universal fraction для всех условий.

Вместо этого в `v1.2` используется:

- **base replacement fraction**
- плюс/минус несколько **умеренных contextual adjustments**
- затем итоговая fraction ограничивается внутри допустимого conservative range

Главный принцип:
**fraction должна быть explainable, safety-first и ниже логики full replacement.**

---

#### 14.2. Base replacement fraction

Для known-sweat-rate branch базовый default:

- **base replacement fraction = `0.65`**

Почему именно так:

- это близко к текущему духу `v1.1`, где фактически используется `0.70`;
- это остаётся консервативным;
- это даёт пространство для небольших сдвигов вверх и вниз без ухода в full replacement;
- это хорошо согласуется с рабочим диапазоном `0.55–0.80`.

---

#### 14.3. Допустимый рабочий диапазон

Итоговая replacement fraction в Branch A должна быть ограничена так:

- **minimum = `0.55`**
- **maximum = `0.80`**

Operational rule:

`replacement_fraction = clamp(0.55, 0.80, adjusted_fraction)`

Смысл:

- ниже `0.55` для MVP-модели обычно уже слишком консервативно;
- выше `0.80` модель начинает слишком близко подходить к full replacement default;
- даже верхняя часть диапазона остаётся safety-first, а не “пить максимально много”.

---

#### 14.4. Какие поля реально двигают fraction

На этом этапе фиксируем такой набор modifiers внутри Branch A:

- `temperature_c`
- `humidity_pct`
- `duration_min`
- `effort_level`

Не включаем в direct fraction math на этом шаге:

- `race_type`
- `elevation_gain_m`
- `weight_kg`

Они остаются:
- warning/context fields
- или предметом отдельного решения позже

Это важно, чтобы не перегрузить Branch A псевдонаучной сложностью.

---

#### 14.5. Temperature adjustment

Температура — один из главных modifiers replacement fraction.

Правило:

- если `temperature_c >= 25` → `+0.05`
- если `temperature_c < 25` → `+0.00`
- если `temperature_c` неизвестна → `+0.00`

Смысл:

- жаркие условия допускают умеренное повышение replacement fraction;
- но не должны автоматически толкать модель к full replacement;
- неизвестная температура не должна ломать Branch A и не должна создавать фальшивую точность.

---

#### 14.6. Humidity adjustment

Если `humidity_pct` известен:

- если `humidity_pct >= 70` → `+0.05`
- иначе → `+0.00`

Если `humidity_pct` неизвестен:

- humidity adjustment = `+0.00`

Смысл:

- высокая влажность усиливает heat-stress context;
- при отсутствии влажности Branch A всё равно работает;
- unknown humidity не должна ломать модель и не должна заставлять придумывать фальшивую точность.

---

#### 14.7. Duration adjustment

Длительность может умеренно сдвигать replacement fraction вверх,
но не должна превращать hydration в full-replacement planning.

Правило:

- если `duration_min >= 240` → `+0.05`
- иначе → `+0.00`

Смысл:

- длинные события требуют более внимательного hydration planning;
- но длительность сама по себе не должна становиться оправданием агрессивного intake.

---

#### 14.8. Effort adjustment

Внутри текущего проекта используем текущие реальные значения:

- `easy`
- `steady`
- `race`

Правило:

- `easy` → `-0.05`
- `steady` → `+0.00`
- `race` → `+0.05`

Если `effort_level` отсутствует:
- default = `steady`
- adjustment = `+0.00`

Смысл:

- `easy` даёт более консервативный target;
- `steady` остаётся нейтральным;
- `race` допускает умеренный сдвиг вверх;
- влияние поля остаётся небольшим и explainable.

---

#### 14.9. Полная рабочая формула для fraction

На этом этапе `v1.2` может использовать такую spec-formula:

`adjusted_fraction = 0.65 + temp_adj + humidity_adj + duration_adj + effort_adj`

где:

- `temp_adj = +0.05`, если `temperature_c >= 25`, иначе `0.00`
- `humidity_adj = +0.05`, если `humidity_pct >= 70`, иначе `0.00`
- `duration_adj = +0.05`, если `duration_min >= 240`, иначе `0.00`
- `effort_adj = -0.05 / 0.00 / +0.05` для `easy / steady / race`

и затем:

`replacement_fraction = clamp(0.55, 0.80, adjusted_fraction)`

---

#### 14.10. Как это связано с итоговым fluid target

После выбора fraction hydration engine считает:

`preliminary_fluid_per_hour_l = sweat_rate_lph * replacement_fraction`

Но дальше всё равно обязаны сработать:

1. anti-overdrinking protection  
2. soft/hard caps  
3. warnings  
4. confidence layer

То есть:
**replacement fraction ещё не является final answer — это только центральная часть known-sweat-rate math.**

---

#### 14.11. Почему здесь нет `race_type`, `elevation_gain_m`, `weight_kg`

На этом шаге их лучше **не включать** в прямую fraction math по следующим причинам:

- `sweat_rate_lph` уже даёт главный персональный hydration signal;
- evidence pack просит использовать effort/elevation для hydration скорее как вторичные модификаторы, а не как сильные drivers;
- `weight_kg` в текущем проекте не является driver fluid math при known sweat rate;
- слишком много прямых modifiers создадут видимость точной физиологической формулы, которой у нас нет.

Поэтому на этом этапе:

- `race_type` → слабый context/warning field
- `elevation_gain_m` → execution/warning field
- `weight_kg` → safety/context field

---

#### 14.12. Expected behavior examples

Пример 1:
- `temperature_c = 10`
- `humidity_pct = 50`
- `duration_min = 120`
- `effort_level = steady`

Тогда:
- fraction = `0.65`

Пример 2:
- `temperature_c = 28`
- `humidity_pct = 75`
- `duration_min = 300`
- `effort_level = race`

Тогда:
- `0.65 + 0.05 + 0.05 + 0.05 + 0.05 = 0.85`
- после clamp:
- fraction = `0.80`

Пример 3:
- `temperature_c = 8`
- `humidity_pct = null`
- `duration_min = 90`
- `effort_level = easy`

Тогда:
- `0.65 - 0.05 = 0.60`

Пример 4:
- `temperature_c = null`
- `humidity_pct = 80`
- `duration_min = 260`
- `effort_level = steady`

Тогда:
- `0.65 + 0.00 + 0.05 + 0.05 + 0.00 = 0.75`

Эти примеры нужны не как user-facing output,
а как explainable backend logic и база для test cases.

---

#### 14.13. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- при известном `sweat_rate_lph` hydration должна опираться прежде всего на него
- hydration не должна строиться как full-replacement default
- жара, влажность, длительность и усилие влияют на hydration context
- overdrinking risk требует отдельной защиты

**[MODEL-BASED]**
- base replacement fraction = `0.65`
- working range `0.55–0.80`
- шаг modifiers по `0.05`
- thresholds:
  - `temperature_c >= 25`
  - `humidity_pct >= 70`
  - `duration_min >= 240`
- effort mapping:
  - `easy = -0.05`
  - `steady = 0.00`
  - `race = +0.05`

**[HYPOTHESIS / NEEDS CHECK]**
- точность именно таких thresholds для всех сценариев
- достаточность single-step temperature threshold
- нужен ли позже отдельный small effect от `race_type` или `elevation_gain_m`
- нужен ли более сложный humidity model для hot-humid ultra cases

---

### 15. Anti-overdrinking and cap layer inside Branch A

#### 15.1. Главный принцип

После того как в Branch A выбрана `replacement_fraction`,
hydration engine не должен сразу считать полученное число финальным ответом.

Нужен отдельный safety layer, который:

- не даёт hydration model превращаться в full-replacement default;
- защищает от слишком высокого hourly target;
- удерживает output в practical MVP-range;
- усиливает warnings в верхних сценариях.

Главный принцип:
**known sweat rate делает hydration более персонализированной, но не отменяет safety caps.**

---

#### 15.2. Порядок применения правил

Для Branch A используем такой порядок:

1. рассчитать  
   `raw_fluid_per_hour_l = sweat_rate_lph * replacement_fraction`

2. применить anti-overdrinking limit  
   `below_sweat_limit_l = sweat_rate_lph - 0.05`

3. взять более консервативное значение  
   `pre_cap_fluid_per_hour_l = min(raw_fluid_per_hour_l, below_sweat_limit_l)`

4. затем применить общий hard cap  
   `capped_fluid_per_hour_l = min(pre_cap_fluid_per_hour_l, 1.00)`

5. затем применить general floor `0.25 л/ч`,
   **но только если это не нарушает anti-overdrinking rule**

6. отдельно определить, нужен ли upper-scenario warning,
   если результат выходит в upper zone

---

#### 15.3. Anti-overdrinking rule

Это обязательное правило Branch A.

Если `sweat_rate_lph` известен,
итоговый target не должен равняться или превышать `sweat_rate_lph`.

На уровне `v1.2` фиксируем такой operational rule:

- **anti-overdrinking limit = `sweat_rate_lph - 0.05 л/ч`**

Смысл:

- intake должен оставаться **ниже** известного sweat rate;
- нужен небольшой safety gap, а не просто “не больше потерь”;
- это помогает не превращать hydration planning в скрытый full replacement.

---

#### 15.4. Почему используем именно небольшой gap below sweat rate

Этот gap нужен как practical safety-first правило для MVP:

- чтобы known-sweat-rate branch не подталкивал к агрессивному intake;
- чтобы даже в hot / long scenarios продукт не звучал как “пей максимально близко к потерям”;
- чтобы anti-overdrinking logic была встроена прямо в math, а не только в warnings.

Важно:
это **model-based protective rule**, а не утверждение,
что существует универсальный идеальный зазор для всех спортсменов.

---

#### 15.5. General floor

Для hydration MVP в целом на этом этапе фиксируем:

- **general floor = `0.25 л/ч`**

Смысл:

- hydration plan не должен по умолчанию уходить в слишком низкие значения;
- это соответствует общему MVP-floor для hydration;
- floor нужен как practical lower bound для выдаваемого плана.

Но для Branch A есть важное исключение:

**anti-overdrinking rule имеет приоритет над general floor.**

Если применение floor нарушает правило
`final_fluid_per_hour_l < sweat_rate_lph`,
то floor не применяется,
и результат может остаться ниже `0.25 л/ч`.

Это особенно важно для случаев
с очень низким, но валидным `sweat_rate_lph`.

---

#### 15.6. Hard cap

Для Branch A на этом этапе фиксируем:

- **hard cap = `1.00 л/ч`**

Смысл:

- выше этого уровня routine recommendation в MVP давать небезопасно без очень сильных оснований;
- hard cap нужен как защита от слишком агрессивных верхних сценариев;
- даже если known sweat rate высокий,
  продукт не должен автоматически рекомендовать очень большой intake как обычный план.

Это соответствует safety-first логике проекта:
**лучше быть консервативнее, чем недооценить risk of overdrinking.**

---

#### 15.7. Upper-scenario warning threshold

Кроме hard cap нужен ещё и более ранний threshold для warning/confidence layer.

Для Branch A на этом этапе фиксируем:

- **upper-scenario warning threshold starts at `> 0.80 л/ч`**

Важно:
- здесь `0.80 л/ч` используется **не как жёсткий clamp**;
- и не как буквальное повторение fallback soft-cap logic;
- в Branch A это именно **warning / confidence threshold** для верхнего сценария.

Итоговый смысл:

- `<= 0.80 л/ч` → обычный рабочий диапазон Branch A
- `> 0.80 л/ч` → upper scenario, нужен более осторожный язык и warnings
- `> 1.00 л/ч` → в выдаваемый план не пропускаем

---

#### 15.8. Что делать, если правила конфликтуют между собой

Если одновременно работают несколько ограничений,
используем такой приоритет:

1. anti-overdrinking rule  
2. hard cap  
3. general floor  
4. warnings / confidence layer

Operational logic:

1. `raw_fluid_per_hour_l = sweat_rate_lph * replacement_fraction`
2. `below_sweat_limit_l = sweat_rate_lph - 0.05`
3. `pre_cap_fluid_per_hour_l = min(raw_fluid_per_hour_l, below_sweat_limit_l)`
4. `capped_fluid_per_hour_l = min(pre_cap_fluid_per_hour_l, 1.00)`
5. если `capped_fluid_per_hour_l >= 0.25` →  
   `final_fluid_per_hour_l = capped_fluid_per_hour_l`
6. если `capped_fluid_per_hour_l < 0.25`:
   - если `0.25 < sweat_rate_lph` и floor не нарушает anti-overdrinking rule →  
     `final_fluid_per_hour_l = 0.25`
   - иначе →  
     `final_fluid_per_hour_l = capped_fluid_per_hour_l`

Главный принцип:
**general floor полезен как default, но не может ломать anti-overdrinking safety.**

---

#### 15.9. Как upper-scenario threshold влияет на warnings

Если итоговый `final_fluid_per_hour_l > 0.80`:

- warning layer должен усиливаться;
- confidence language должен становиться осторожнее;
- в длинных жарких сценариях должен появляться более явный акцент на:
  - индивидуальную вариативность,
  - исполнение плана,
  - риск слишком агрессивной гидратации.

Но threshold `0.80` **не означает**, что такой сценарий автоматически неверный.
Он означает:
**это уже upper scenario, который нужно объяснять осторожнее.**

---

#### 15.10. Expected behavior examples

Пример 1:
- `sweat_rate_lph = 1.2`
- `replacement_fraction = 0.65`

Тогда:
- `raw = 0.78`
- `below_sweat_limit = 1.15`
- `pre_cap = min(0.78, 1.15) = 0.78`
- `capped = min(0.78, 1.00) = 0.78`
- `final = 0.78`
- upper-scenario warning не нужен

Пример 2:
- `sweat_rate_lph = 1.2`
- `replacement_fraction = 0.80`

Тогда:
- `raw = 0.96`
- `below_sweat_limit = 1.15`
- `pre_cap = 0.96`
- `capped = 0.96`
- `final = 0.96`
- upper-scenario warning нужен
- hard cap не срабатывает

Пример 3:
- `sweat_rate_lph = 1.8`
- `replacement_fraction = 0.80`

Тогда:
- `raw = 1.44`
- `below_sweat_limit = 1.75`
- `pre_cap = 1.44`
- `capped = min(1.44, 1.00) = 1.00`
- `final = 1.00`
- hard cap срабатывает
- warning layer должен быть сильным

Пример 4:
- `sweat_rate_lph = 0.35`
- `replacement_fraction = 0.60`

Тогда:
- `raw = 0.21`
- `below_sweat_limit = 0.30`
- `pre_cap = 0.21`
- `capped = 0.21`
- floor можно применить, потому что `0.25 < 0.35`
- `final = 0.25`

Пример 5:
- `sweat_rate_lph = 0.27`
- `replacement_fraction = 0.80`

Тогда:
- `raw = 0.216`
- `below_sweat_limit = 0.22`
- `pre_cap = 0.216`
- `capped = 0.216`
- floor `0.25` применять нельзя, потому что это нарушит anti-overdrinking rule
- `final = 0.216`

Эти примеры нужны как база для future backend logic и tests.

---

#### 15.11. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- intake при known sweat rate не должен автоматически стремиться к full replacement
- overdrinking risk требует отдельной protective logic
- высокий hourly fluid target требует большей осторожности
- персональный sweat rate полезнее общего fallback, но не отменяет risk controls

**[MODEL-BASED]**
- anti-overdrinking gap `sweat_rate_lph - 0.05`
- general floor `0.25 л/ч`
- upper-scenario warning threshold `> 0.80 л/ч`
- hard cap `1.00 л/ч`
- применение `> 0.80 л/ч` как warning/confidence threshold, а не жёсткого clamp
- operational order:
  - replacement fraction
  - below-sweat limit
  - hard cap
  - conditional floor
  - warnings/confidence

**[HYPOTHESIS / NEEDS CHECK]**
- универсальность именно `0.05 л/ч` как optimal safety gap below sweat rate
- нужен ли later отдельный short/cool exception ниже общего floor
- нужен ли отдельный dynamic hard cap rule для extreme heat / very high sweat-rate cases

---

### 16. Warnings and confidence layer inside Branch A

#### 16.1. Главный принцип

Даже если `sweat_rate_lph` известен,
hydration result не должен подаваться как “точная физиологическая истина”.

Branch A даёт:
- более персонализированный результат, чем fallback;
- но не отменяет:
  - heat uncertainty,
  - execution difficulty,
  - upper-scenario risk,
  - overdrinking risk.

Главный принцип:
**known sweat rate повышает качество hydration estimate, но не делает его безусловно точным и безопасным во всех сценариях.**

---

#### 16.2. Что должен делать warning layer

Warning layer внутри Branch A должен:

- усиливать осторожность в верхних сценариях;
- явно показывать, когда hydration target уже выглядит demanding;
- отдельно показывать, когда известный sweat rate предполагает потери,
  заметно превышающие practical intake, который модель готова безопасно рекомендовать;
- не использовать псевдомедицинский “risk score”;
- не выдавать sodium как защиту от overdrinking;
- отделять:
  - обычный персонализированный сценарий,
  - demanding scenario,
  - upper-risk scenario.

То есть:
**в v1.2 нужен warnings-based logic, а не fake precision risk scoring.**

---

#### 16.3. Базовый принцип confidence

Если выбран Branch A:

- baseline confidence **выше, чем у fallback branch**,
  потому что используется персональный `sweat_rate_lph`;
- но baseline confidence **не равен автоматическому high confidence**.

На этом этапе удобно использовать 3 рабочие ступени:

- `higher`
- `moderate`
- `lower`

Смысл:

- `higher` = персональный sweat rate есть, и сценарий не выглядит слишком рискованным;
- `moderate` = sweat rate есть, но уже есть заметные факторы неопределённости или demanding context;
- `lower` = sweat rate есть, но сочетание условий требует явно более осторожного текста результата.

---

#### 16.4. Базовое значение confidence для Branch A

По умолчанию для Branch A:

- **baseline confidence = `higher`**

Но это значение должно понижаться,
если появляются факторы, которые делают сценарий менее надёжным или более рискованным по исполнению.

---

#### 16.5. Когда confidence понижается

На этом этапе фиксируем такие downgrade rules.

##### Downgrade trigger A — missing humidity context
Если:
- `humidity_pct` отсутствует

Тогда:
- confidence downgrade на 1 шаг

Почему:
- Branch A всё равно работает,
  но heat-stress context становится менее полным.

##### Downgrade trigger B — long hot scenario
Если одновременно:
- `duration_min >= 240`
- `temperature_c >= 25`

Тогда:
- confidence downgrade на 1 шаг

Почему:
- long + hot = более demanding hydration context,
  где даже при known sweat rate не стоит звучать слишком уверенно.

##### Downgrade trigger C — upper-scenario fluid target
Если:
- `final_fluid_per_hour_l > 0.80`

Тогда:
- confidence downgrade на 1 шаг

Почему:
- это уже upper scenario,
  где language должен становиться осторожнее.

##### Downgrade trigger D — protective limit actually changed the result
Если:
- `final_fluid_per_hour_l < raw_fluid_per_hour_l`

То есть:
- сработал `below_sweat_limit`
- или сработал `hard cap`
- или оба ограничения вместе

Тогда:
- confidence downgrade на 1 шаг

Почему:
- если safety layer уже вмешался,
  это значит, что “сырой” target был слишком агрессивным,
  и результат нужно объяснять осторожнее.

---

#### 16.6. Как получить итоговый confidence tier

Используем такой порядок:

1. стартуем с `higher`
2. считаем количество downgrade triggers
3. затем:
   - `0 triggers` → `higher`
   - `1 trigger` → `moderate`
   - `2+ triggers` → `lower`

Смысл:
- модель остаётся explainable;
- не нужен псевдомедицинский numeric score;
- confidence logic легко перенести в backend.

---

#### 16.7. Какие warning flags должны существовать в Branch A

На этом этапе фиксируем такие warning flags:

1. `upper_fluid_target`
2. `long_hot_context`
3. `hot_humid_context`
4. `protective_cap_applied`
5. `possible_overdrinking_risk`
6. `sweat_rate_known_but_context_demanding`
7. `known_sweat_loss_exceeds_practical_intake`

Это ещё не user-facing финальный текст.
Это backend-level warning structure.

---

#### 16.8. Правила активации warning flags

##### `upper_fluid_target`
Активируется, если:
- `final_fluid_per_hour_l > 0.80`

Смысл:
- hydration target уже в upper scenario zone.

##### `long_hot_context`
Активируется, если одновременно:
- `duration_min >= 240`
- `temperature_c >= 25`

Смысл:
- длинный и жаркий сценарий требует более осторожного текста.

##### `hot_humid_context`
Активируется, если одновременно:
- `temperature_c >= 25`
- `humidity_pct >= 70`

Смысл:
- heat stress context усиливается.

##### `protective_cap_applied`
Активируется, если:
- `final_fluid_per_hour_l < raw_fluid_per_hour_l`

Смысл:
- safety layer реально вмешался в результат.

##### `possible_overdrinking_risk`
Активируется, если выполняется хотя бы одно:
- `final_fluid_per_hour_l > 0.80`
- `protective_cap_applied = true`
- одновременно `duration_min >= 240` и `temperature_c >= 25`

Смысл:
- это не диагноз и не EAH score,
  а safety warning, что сценарий требует особенно осторожного обращения с fluid strategy.

##### `sweat_rate_known_but_context_demanding`
Активируется, если:
- `confidence != higher`

Смысл:
- sweat rate известен,
  но сценарий всё равно не должен звучать как “всё точно и просто”.

##### `known_sweat_loss_exceeds_practical_intake`
Активируется, если выполняется хотя бы одно:
- `final_fluid_per_hour_l = 1.00`
- `sweat_rate_lph - final_fluid_per_hour_l >= 0.30`

Смысл:
- пользовательский sweat rate указывает на потери,
  которые заметно выше того intake,
  который модель считает practical и safe для routine recommendation;
- это не означает “нужно пить ещё больше”;
- это означает, что результат нужно сопровождать более честным текстом
  про ограниченность safe intake и важность индивидуального исполнения плана.

---

#### 16.9. Что warning layer не должен делать

Branch A warning layer не должен:

1. превращаться в medical diagnosis
2. считать псевдоточный EAH score
3. говорить или подразумевать, что sodium защищает от overdrinking
4. скрывать, что upper scenario требует большей осторожности
5. делать вид, что known sweat rate полностью снимает uncertainty
6. использовать слишком спокойный язык, если safety layer уже ограничил результат

---

#### 16.10. Как должен звучать result language в разных сценариях

##### Если confidence = `higher`
Тон результата:
- персонализированный
- спокойный
- но без слов про “точный индивидуальный расчёт”

Смысл:
- sweat rate помог,
  и сценарий не выглядит слишком demanding.

##### Если confidence = `moderate`
Тон результата:
- персонализированный, но более осторожный
- с коротким акцентом на variability / execution

Смысл:
- sweat rate есть,
  но условия уже не совсем “простые”.

##### Если confidence = `lower`
Тон результата:
- заметно более осторожный
- с явным напоминанием,
  что even with known sweat rate long/hot/high-target scenario остаётся demanding

Смысл:
- не надо маскировать сложный сценарий под уверенный routine plan.

---

#### 16.11. Expected behavior examples

Пример 1:
- `final_fluid_per_hour_l = 0.70`
- `duration_min = 120`
- `temperature_c = 12`
- `humidity_pct = 50`
- cap не срабатывал

Тогда:
- triggers = 0
- confidence = `higher`
- warning flags = none

Пример 2:
- `final_fluid_per_hour_l = 0.86`
- `duration_min = 300`
- `temperature_c = 27`
- `humidity_pct = 75`

Тогда:
- triggers:
  - upper-scenario fluid target
  - long hot scenario
- confidence = `lower`
- warnings:
  - `upper_fluid_target`
  - `long_hot_context`
  - `hot_humid_context`
  - `possible_overdrinking_risk`
  - `sweat_rate_known_but_context_demanding`

Пример 3:
- `raw_fluid_per_hour_l = 1.10`
- `final_fluid_per_hour_l = 1.00`
- `sweat_rate_lph = 1.60`
- `duration_min = 260`
- `temperature_c = 28`
- `humidity_pct = null`

Тогда:
- triggers:
  - missing humidity context
  - long hot scenario
  - upper-scenario fluid target
  - protective cap applied
- confidence = `lower`
- warnings:
  - `upper_fluid_target`
  - `long_hot_context`
  - `protective_cap_applied`
  - `possible_overdrinking_risk`
  - `known_sweat_loss_exceeds_practical_intake`
  - `sweat_rate_known_but_context_demanding`

---

#### 16.12. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- even with known sweat rate hydration planning still has uncertainty
- long duration + hot conditions требуют более осторожного подхода
- very high fluid targets требуют отдельной safety-awareness
- overdrinking risk нельзя скрывать
- sodium не должен подаваться как защита от overdrinking

**[MODEL-BASED]**
- 3-tier confidence system:
  - `higher`
  - `moderate`
  - `lower`
- downgrade triggers
- warning flags list
- правило:
  - `0 triggers` → `higher`
  - `1 trigger` → `moderate`
  - `2+ triggers` → `lower`
- use of `>0.80 л/ч` as upper-scenario warning threshold
- use of `final < raw` as protective-cap warning signal
- separate warning for `known_sweat_loss_exceeds_practical_intake`

**[HYPOTHESIS / NEEDS CHECK]**
- достаточно ли именно этих downgrade triggers для всех Branch A scenarios
- нужен ли позже отдельный trigger для very high humidity without heat
- оптимален ли порог `0.30 л/ч` для `known_sweat_loss_exceeds_practical_intake`

---

### 17. Branch B — fallback logic overview

#### 17.1. Главный принцип

Если `sweat_rate_lph` отсутствует, невалиден или не подходит для core use,
hydration engine должен перейти в **Branch B — fallback**.

Главный принцип Branch B:

- это **не персональный sweat-test calculation**;
- это **консервативная engineering estimate**;
- она должна быть:
  - explainable,
  - safety-first,
  - честно менее уверенной, чем Branch A.

То есть:
**Branch B нужен не для фальшивой точности, а для практичного и честного hydration fallback.**

---

#### 17.2. Что Branch B обязан делать

Branch B в `v1.2` обязан:

1. работать без `sweat_rate_lph`
2. использовать понятные context drivers
3. выдавать practical hourly fluid target
4. сразу учитывать:
   - overdrinking risk
   - lower confidence
   - heat/execution uncertainty
5. не маскироваться под персонализированную физиологическую модель

Важно:
- Branch B **не обязан работать без `temperature_c`**;
- для текущего MVP `temperature_c` остаётся core input,
  и hydration fallback без температуры становится слишком грубым.

---

#### 17.3. Главные входы Branch B

В Branch B главными inputs становятся:

- `temperature_c`
- `duration_min`

Главные contextual inputs:

- `humidity_pct`
- `race_type`

Secondary/context inputs:

- `effort_level`
- `elevation_gain_m`
- `weight_kg`

На этом этапе важный принцип такой:

- `temperature_c` и `duration_min` — главные drivers fallback logic
- `humidity_pct` улучшает heat-context estimate, если известна
- `race_type` помогает в practical interpretation
- `effort_level`, `elevation_gain_m` и `weight_kg` не должны создавать ложную персонализацию

---

#### 17.4. Чего Branch B не должен делать

Branch B не должен:

1. делать вид, что знает персональный sweat rate
2. использовать overly precise formula, которую нельзя объяснить
3. звучать так же уверенно, как Branch A
4. автоматически стремиться к full replacement
5. автоматически повышать fluid target только потому, что сценарий “тяжёлый”
6. использовать sodium как защиту от overdrinking
7. превращать optional fields в псевдонаучную математику

---

#### 17.5. Базовая структура расчёта Branch B

На уровне архитектуры Branch B должен строиться так:

1. определить базовый fallback hydration zone
2. скорректировать её по контексту
3. получить preliminary fluid target
4. применить general caps/floor
5. отдельно сформировать warnings
6. отдельно сформировать confidence

Главный принцип:
**сначала simple fallback estimate, потом safety layer, потом warnings/confidence.**

---

#### 17.6. Что такое fallback hydration zone

На этом этапе под fallback hydration zone понимаем:

- не точную формулу потерь;
- а **рабочую practical zone fluid/hour**,
  которая выбирается по environmental и race context.

То есть Branch B пока должен мыслиться как:

- `cool / moderate / hot`
- плюс short / medium / long execution context
- а не как fake physiology formula с большим числом коэффициентов

---

#### 17.7. Роль `temperature_c` в Branch B

`temperature_c` — главный environmental driver fallback logic.

Общий принцип:

- чем жарче условия,
  тем выше может быть fallback fluid target;
- но температура не должна автоматически вести к агрессивной рекомендации.

Важное правило этого этапа:

- если `temperature_c` отсутствует или невалидна,
  hydration fallback **не должен тихо придумывать default weather context**;
- это должно считаться проблемой входных данных / validation layer,
  а не нормальным путём расчёта.

На следующем подшаге именно `temperature_c`
станет основой для построения fallback matrix.

---

#### 17.8. Роль `duration_min` в Branch B

`duration_min` — главный contextual driver fallback logic.

Общий принцип:

- чем длиннее событие,
  тем выше practical importance hydration planning;
- но длительность не должна автоматически означать максимальный intake;
- длительность должна влиять и на hourly target,
  и на warnings/confidence.

На следующем подшаге `duration_min`
станет второй главной осью fallback matrix.

---

#### 17.9. Роль `humidity_pct` в Branch B

Если `humidity_pct` известен:

- он должен усиливать heat-stress interpretation;
- он может сдвигать fallback estimate вверх в hot/humid scenarios;
- он должен усиливать warning layer.

Если `humidity_pct` неизвестен:

- Branch B всё равно работает;
- estimate становится менее точным;
- confidence должен быть ниже,
  чем в том же сценарии с известной влажностью.

---

#### 17.10. Роль `race_type` в Branch B

`race_type` в Branch B допустимо использовать как practical/context modifier.

Допустимый смысл:

- дорожка/трейл/ультра влияют на исполнимость hydration plan;
- длинный trail/ultra context может требовать более осторожного warning language;
- в отдельных случаях `race_type` может поддерживать небольшой contextual shift.

Недопустимый смысл:

- превращать `race_type` в главный driver fluid/hour;
- использовать его как суррогат персонального sweat rate.

---

#### 17.11. Роль `effort_level`, `elevation_gain_m`, `weight_kg` в Branch B

На этом этапе эти поля лучше держать как secondary/context inputs.

#### `effort_level`
- может слегка усиливать demanding-context interpretation
- если поле отсутствует, default = `race`
- но не должен становиться главным driver fluid/hour

#### `elevation_gain_m`
- может усиливать trail/ultra execution context
- но не должен без отдельной базы становиться прямым hydration formula driver

#### `weight_kg`
- может использоваться только очень осторожно
- не должен имитировать персональный sweat test
- лучше оставить его в зоне safety/context, а не в core fallback math на этом этапе

---

#### 17.12. Базовый confidence principle for Branch B

Branch B по умолчанию должен иметь **более низкую уверенность, чем Branch A**.

На этом этапе фиксируем:

- baseline confidence for Branch B < baseline confidence for Branch A

Даже в “простом” сценарии Branch B не должен звучать так,
как будто hydration estimate персонализирован.

Главный принцип:
**нет `sweat_rate_lph` → уверенность по умолчанию ниже.**

---

#### 17.13. Базовый warning principle for Branch B

Branch B должен предупреждать осторожнее, чем Branch A,
особенно если одновременно есть:

- жара
- длинная длительность
- высокая влажность
- upper-range fluid target

То есть:
- при одинаковом итоговом `fluid_per_hour_l`
  warning/confidence language в Branch B должен быть осторожнее,
  чем в Branch A.

---

#### 17.14. Что пока не фиксируем в этом разделе

На этом шаге **ещё не фиксируем**:

- точную fallback matrix
- numeric temperature bands
- numeric humidity effect
- numeric duration effect
- precise fallback caps/floor interaction
- interval/per-intake translation
- exact Branch B warning flags

Это пойдёт следующими подшагами.

Здесь фиксируем только:

- архитектуру Branch B
- главные и вторичные inputs
- честную роль fallback logic
- обязательную lower-confidence природу Branch B

---

#### 17.15. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- без персонального sweat rate hydration estimate менее точен
- температура и длительность реально влияют на hydration context
- высокая влажность усиливает heat-stress context
- fallback hydration planning должен быть осторожнее и менее уверенным, чем персонализированный расчёт

**[MODEL-BASED]**
- fallback branch architecture
- выбор `temperature_c` и `duration_min` как главных осей Branch B
- использование `humidity_pct` и `race_type` как contextual modifiers
- default `effort_level = race`, если поле отсутствует
- удержание `elevation_gain_m` и `weight_kg` в secondary/context role
- принцип lower-confidence-by-default для Branch B

**[HYPOTHESIS / NEEDS CHECK]**
- точная numeric fallback matrix
- нужен ли позже отдельный small effect от `weight_kg`
- нужен ли later отдельный effect от `elevation_gain_m` внутри fallback math

---

### 18. Temperature × duration fallback matrix inside Branch B

#### 18.1. Главный принцип

В Branch B базовый `fluid_per_hour_l` должен определяться через
**простую и explainable matrix** по двум главным осям:

- `temperature_c`
- `duration_min`

Почему именно так:

- `temperature_c` — главный environmental driver fallback hydration;
- `duration_min` — главный contextual driver;
- без `sweat_rate_lph` нельзя притворяться точной персональной физиологией;
- поэтому лучше использовать прозрачную ступенчатую matrix,
  а не “умное” псевдоточное уравнение.

Главный принцип:
**fallback matrix должна быть консервативной, объяснимой и не слишком агрессивной по длительности.**

---

#### 18.2. Temperature bands for Branch B

На этом этапе фиксируем такие temperature bands:

- **cool**: `<10°C`
- **moderate**: `10–19°C`
- **warm**: `20–24°C`
- **hot**: `25–29°C`
- **very_hot**: `>=30°C`

Смысл:

- температура задаёт базовую environmental severity;
- порог `>=25°C` остаётся важной границей для heat-related escalation;
- `>=30°C` — уже верхний горячий сценарий для fallback branch.

---

#### 18.3. Duration bands for Branch B

На этом этапе фиксируем такие duration bands:

- **short**: `<90 min`
- **medium**: `90–239 min`
- **long**: `>=240 min`

Смысл:

- короткий сценарий обычно требует менее агрессивного hourly target;
- средняя длительность = основной рабочий default;
- длинный сценарий допускает **только умеренное** повышение fallback target,
  но не должен слишком агрессивно разгонять `L/h`.

На этом этапе duration effect намеренно ограничен:
- переход `short → medium` даёт только небольшой шаг вверх;
- переход `medium → long` даёт только ещё один небольшой шаг вверх.

---

#### 18.4. Core fallback matrix

На этом этапе `v1.2` может использовать такую base matrix
для `fluid_per_hour_l` в Branch B:

- **cool**
  - short → `0.25`
  - medium → `0.30`
  - long → `0.35`

- **moderate**
  - short → `0.35`
  - medium → `0.40`
  - long → `0.45`

- **warm**
  - short → `0.45`
  - medium → `0.50`
  - long → `0.55`

- **hot**
  - short → `0.60`
  - medium → `0.65`
  - long → `0.70`

- **very_hot**
  - short → `0.70`
  - medium → `0.75`
  - long → `0.80`

Это именно **base fallback matrix**,
до humidity / race_type / effort / elevation adjustments.

---

#### 18.5. Почему matrix выглядит именно так

Эта matrix специально построена так, чтобы:

- оставаться внутри practical MVP logic;
- не опускаться ниже общего hydration floor;
- не поднимать fallback result выше `0.80 л/ч` уже на базовом уровне;
- держать длительность как **умеренный** modifier,
  а не как главный разгоняющий фактор;
- соответствовать идее,
  что без `sweat_rate_lph` typical planned intake чаще должен жить в conservative zone.

То есть:
- температура делает основную работу;
- длительность добавляет только маленький upward shift;
- верхние значения без sweat rate не должны выглядеть routine default.

---

#### 18.6. Operational rule for matrix lookup

Hydration engine в Branch B должен:

1. определить temperature band по `temperature_c`
2. определить duration band по `duration_min`
3. взять из matrix базовое значение `base_fluid_per_hour_l`
4. только после этого применять:
   - humidity adjustment
   - race_type adjustment
   - effort/elevation secondary adjustments
   - floor/cap logic
   - warnings/confidence

Главный принцип:
**сначала matrix, потом context adjustments, потом safety/warnings.**

---

#### 18.7. Что эта matrix пока не учитывает напрямую

На этом шаге matrix **ещё не включает напрямую**:

- `humidity_pct`
- `race_type`
- `effort_level`
- `elevation_gain_m`
- `weight_kg`

Причина:

- эти поля полезны,
  но их лучше добавлять как secondary/context modifiers;
- если включить их сразу в core matrix,
  fallback станет выглядеть как псевдоточная физиологическая формула.

На этом этапе:

- `humidity_pct` → отдельный следующий adjustment
- `race_type` → отдельный contextual adjustment
- `effort_level` → небольшой secondary adjustment
- `elevation_gain_m` → warning/context role
- `weight_kg` → safety/context role, не core matrix driver

---

#### 18.8. Expected behavior examples

Пример 1:
- `temperature_c = 8`
- `duration_min = 60`

Тогда:
- band = `cool + short`
- `base_fluid_per_hour_l = 0.25`

Пример 2:
- `temperature_c = 18`
- `duration_min = 180`

Тогда:
- band = `moderate + medium`
- `base_fluid_per_hour_l = 0.40`

Пример 3:
- `temperature_c = 22`
- `duration_min = 300`

Тогда:
- band = `warm + long`
- `base_fluid_per_hour_l = 0.55`

Пример 4:
- `temperature_c = 27`
- `duration_min = 150`

Тогда:
- band = `hot + medium`
- `base_fluid_per_hour_l = 0.65`

Пример 5:
- `temperature_c = 32`
- `duration_min = 360`

Тогда:
- band = `very_hot + long`
- `base_fluid_per_hour_l = 0.80`

Эти примеры нужны как backend-level basis,
а не как user-facing promise of precision.

---

#### 18.9. Как эта matrix связана с caps

На этом этапе matrix уже согласована с базовой safety-логикой Branch B:

- нижняя граница начинается от `0.25 л/ч`
- верхняя базовая граница до context adjustments не превышает `0.80 л/ч`

Это важно,
потому что для fallback branch без `sweat_rate_lph`:

- `0.25 л/ч` — practical lower bound for MVP
- `0.80 л/ч` — верхняя граница базовой matrix и порог,
  после которого дальше должен включаться upper-scenario / soft-cap logic
- `1.00 л/ч` — hard cap должен оставаться отдельным верхним пределом,
  а не нормой fallback matrix

---

#### 18.10. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- температура — главный environmental driver hydration context
- длительность влияет на hydration context и cumulative fluid deficit risk
- без персонального sweat rate fallback hydration estimate менее точен
- в жарких и длинных сценариях нужна большая осторожность

**[MODEL-BASED]**
- exact temperature bands
- exact duration bands
- exact numeric matrix values
- выбор `0.25–0.80 л/ч` как базового fallback matrix range
- принцип “temperature does most of the work, duration adjusts only moderately”

**[HYPOTHESIS / NEEDS CHECK]**
- оптимальны ли именно такие band boundaries
- оптимальны ли именно такие matrix values для всех target cases
- нужен ли позже ещё более консервативный short/cool exception

---

### 19. Humidity and race-type adjustments inside Branch B

#### 19.1. Главный принцип

После того как Branch B выбрал базовое значение `base_fluid_per_hour_l`
из temperature × duration matrix,
hydration engine может применить
**небольшие contextual adjustments**.

На этом этапе такими adjustments становятся:

- `humidity_pct`
- `race_type`

Главный принцип:

- `temperature_c` остаётся главным environmental driver;
- `duration_min` остаётся главным contextual driver;
- `humidity_pct` и `race_type` только **умеренно корректируют** базовый result;
- они не должны превращать Branch B в псевдоточную физиологическую модель.

---

#### 19.2. Роль `humidity_pct` в Branch B

`humidity_pct` в Branch B нужен для усиления heat-stress context,
если он известен.

Это соответствует общей логике проекта:

- влажность повышает точность heat-stress оценки;
- без неё Branch B всё ещё работает;
- но с ней fallback estimate становится немного более точным.

На этом этапе `humidity_pct`:
- **не создаёт отдельную базовую matrix**;
- а работает как additive adjustment поверх уже выбранного `base_fluid_per_hour_l`.

---

#### 19.3. Humidity adjustment rule

На этом этапе фиксируем такую рабочую логику:

- если `humidity_pct >= 70` → `humidity_adj = +0.05`
- если `humidity_pct < 70` → `humidity_adj = +0.00`
- если `humidity_pct` отсутствует → `humidity_adj = +0.00`

Смысл:

- высокая влажность усиливает heat-stress interpretation;
- но не должна сама по себе резко разгонять `fluid_per_hour_l`;
- если влажность неизвестна,
  модель не должна придумывать фальшивую точность.

---

#### 19.4. Когда humidity adjustment особенно уместен

Практически humidity adjustment наиболее уместен, если:

- температура уже находится в `hot` или `very_hot` band;
- сценарий не short;
- fallback target и так уже движется к верхней части диапазона.

Но на этом этапе adjustment остаётся простым:

- без дополнительных условий;
- без сложной nested logic;
- одним умеренным шагом `+0.05`.

Главный принцип:
**humidity усиливает, но не доминирует.**

---

#### 19.5. Роль `race_type` в Branch B

`race_type` в Branch B нужен как practical/context modifier.

Это соответствует архитектуре проекта:

- `race_type` — важный контекст для hydration and warnings;
- но его нельзя превращать в суррогат персонального `sweat_rate_lph`.

На этом этапе `race_type`:
- не должен создавать большую math-разницу сам по себе;
- должен помогать учесть,
  что trail/ultra часто сложнее по исполнению hydration plan;
- должен влиять умеренно и explainably.

---

#### 19.6. Race-type adjustment rule

На этом этапе фиксируем такую рабочую логику:

- `road` → `race_type_adj = +0.00`
- `trail` → `race_type_adj = +0.00`
- `ultra` → `race_type_adj = +0.05`

Смысл:

- `road` и `trail` по умолчанию не требуют отдельного math-shift уже на этом слое;
- `ultra` допускает один умеренный шаг вверх,
  потому что это более demanding execution context;
- но даже `ultra` не должен автоматически толкать fallback в агрессивную hydration strategy.

Важно:
это **model-based practical adjustment**,
а не “физиологическая истина”.

---

#### 19.7. Почему `trail` здесь не получает автоматический +0.05

На этом этапе лучше не давать `trail` автоматический сдвиг вверх,
потому что:

- часть trail-сценариев уже достаточно покрывается через
  `temperature_c`, `duration_min` и warnings;
- автоматический рост для любого trail может создать ложную точность;
- `elevation_gain_m` позже может отдельно усиливать trail-context
  в warning/execution layer,
  не раздувая fallback math слишком рано.

Итоговый принцип:

- `trail` сам по себе ещё не обязан повышать `fluid_per_hour_l`;
- `ultra` получает небольшой practical shift;
- остальной trail stress лучше отражать через warnings/context.

---

#### 19.8. Полная формула этого слоя

После matrix lookup на этом этапе используем:

`adjusted_fluid_per_hour_l = base_fluid_per_hour_l + humidity_adj + race_type_adj`

где:

- `humidity_adj = +0.05`, если `humidity_pct >= 70`, иначе `0.00`
- `race_type_adj = +0.05`, если `race_type = ultra`, иначе `0.00`

Это ещё **не final result**.

Важно:
- после этого слоя результат **может временно выйти выше `0.80 л/ч`**;
- но это ещё не означает, что такой target пойдёт в итоговый план без ограничений;
- дальше обязательно должны применяться:
  - Branch B soft-cap / upper-scenario logic
  - hard cap
  - warnings
  - confidence layer

---

#### 19.9. Expected behavior examples

Пример 1:
- `temperature_c = 18`
- `duration_min = 180`
- `humidity_pct = 50`
- `race_type = road`

Тогда:
- base = `0.40`
- humidity_adj = `0.00`
- race_type_adj = `0.00`
- adjusted = `0.40`

Пример 2:
- `temperature_c = 27`
- `duration_min = 150`
- `humidity_pct = 80`
- `race_type = road`

Тогда:
- base = `0.65`
- humidity_adj = `0.05`
- race_type_adj = `0.00`
- adjusted = `0.70`

Пример 3:
- `temperature_c = 22`
- `duration_min = 300`
- `humidity_pct = 60`
- `race_type = ultra`

Тогда:
- base = `0.55`
- humidity_adj = `0.00`
- race_type_adj = `0.05`
- adjusted = `0.60`

Пример 4:
- `temperature_c = 30`
- `duration_min = 360`
- `humidity_pct = 80`
- `race_type = ultra`

Тогда:
- base = `0.80`
- humidity_adj = `0.05`
- race_type_adj = `0.05`
- adjusted = `0.90`

Важно:
- это **pre-cap / pre-warning** значение;
- дальше его обязан обработать Branch B cap layer;
- такой сценарий уже должен считаться upper scenario,
  а не routine fallback recommendation.

Эти примеры нужны как backend-level logic illustration,
а не как final user-facing promise.

---

#### 19.10. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- высокая влажность усиливает heat-stress context
- `race_type` полезен как practical execution context
- без персонального sweat rate fallback должен оставаться менее точным и более осторожным

**[MODEL-BASED]**
- `humidity_adj = +0.05` при `humidity_pct >= 70`
- `race_type_adj = +0.05` для `ultra`
- `road = 0`, `trail = 0` на этом шаге
- additive structure:
  - matrix
  - humidity adjustment
  - race_type adjustment

**[HYPOTHESIS / NEEDS CHECK]**
- оптимален ли именно порог `70%`
- нужен ли позже отдельный небольшой `trail` adjustment
- нужен ли later более сильный humidity effect в `very_hot + long` scenarios

---

### 20. Effort and elevation secondary adjustments inside Branch B

#### 20.1. Главный принцип

После того как Branch B уже применил:

- temperature × duration matrix
- `humidity_pct` adjustment
- `race_type` adjustment

hydration engine может добавить
**ещё один очень умеренный secondary layer**:

- `effort_level`

А `elevation_gain_m` на этом этапе лучше держать прежде всего как:

- warning/context field

Главный принцип:

- это **не главные drivers** fallback hydration;
- это **не персонализация sweat rate**;
- `effort_level` может дать небольшой practical shift;
- `elevation_gain_m` лучше не превращать в прямую math-ось слишком рано.

---

#### 20.2. Почему эти поля должны быть вторичными

Это соответствует архитектуре `v1.2`:

- `temperature_c` и `duration_min` уже делают основную работу;
- `humidity_pct` и `race_type` дают умеренный context adjustment;
- `effort_level` и `elevation_gain_m` не должны превращаться в сильную math-ось без отдельной научной базы.

На этом этапе правильный продуктовый принцип такой:

**effort/elevation полезны как small practical modifiers и warning context, но не как главный engine fluid/hour.**

---

#### 20.3. Роль `effort_level` в Branch B

`effort_level` в Branch B можно использовать как небольшой practical modifier.

Для текущего проекта на этом этапе используем такие значения:

- `easy`
- `steady`
- `race`

Если `effort_level` отсутствует:
- default = `race`

Это соответствует уже зафиксированному fallback-подходу проекта.

---

#### 20.4. Effort adjustment rule

На этом этапе фиксируем такую рабочую логику:

- `easy` → `effort_adj = -0.05`
- `steady` → `effort_adj = +0.00`
- `race` → `effort_adj = +0.05`

Смысл:

- `easy` допускает немного более консервативный fallback target;
- `steady` остаётся нейтральным;
- `race` допускает один небольшой шаг вверх;
- влияние intentionally small, чтобы не перегрузить Branch B псевдоточностью.

---

#### 20.5. Роль `elevation_gain_m` в Branch B

`elevation_gain_m` в Branch B на этом этапе лучше использовать
**не как прямой math-adjustment**,
а как contextual field для:

- trail/ultra execution difficulty
- warning layer
- confidence layer
- интерпретации demanding scenario

Допустимый смысл:

- усиливать trail/ultra execution context;
- делать warning language осторожнее;
- помогать помечать сценарий как более demanding.

Недопустимый смысл:

- превращать набор высоты в самостоятельный hydration driver;
- делать агрессивный рост `L/h` только из-за высоты.

---

#### 20.6. Полная формула этого слоя

После предыдущих слоёв на этом этапе используем:

`secondary_adjusted_fluid_per_hour_l = adjusted_fluid_per_hour_l + effort_adj`

где:

- `effort_adj = -0.05 / 0.00 / +0.05` для `easy / steady / race`

`elevation_gain_m` на этом шаге **не меняет напрямую fluid_per_hour_l**.

После этого слоя дальше всё равно должны применяться:

- Branch B cap / floor layer
- Branch B warnings
- Branch B confidence logic

---

#### 20.7. Почему здесь нет прямой elevation math-логики

На этом этапе мы **не делаем**:

- несколько ступеней по высоте
- отдельные формулы по steepness
- прямой `elevation_adj = +0.05`
- weight-based correction

Причина:

- без `sweat_rate_lph` fallback уже остаётся engineering estimate;
- перегружать его дополнительной “умной” математикой сейчас неправильно;
- в опорных материалах `elevation_gain_m` для hydration лучше выглядит как context/warnings field, а не как обязательный core-math driver.

---

#### 20.8. Expected behavior examples

Пример 1:
- `base after previous layers = 0.40`
- `effort_level = easy`

Тогда:
- `effort_adj = -0.05`
- `secondary_adjusted = 0.35`

Пример 2:
- `base after previous layers = 0.65`
- `effort_level = race`

Тогда:
- `effort_adj = +0.05`
- `secondary_adjusted = 0.70`

Пример 3:
- `base after previous layers = 0.60`
- `effort_level = steady`
- `race_type = trail`
- `elevation_gain_m = 1800`

Тогда:
- `effort_adj = 0.00`
- `secondary_adjusted = 0.60`

Важно:
- здесь `elevation_gain_m` ещё не повышает `fluid_per_hour_l`;
- но такой сценарий дальше должен усиливать warnings/confidence layer.

Пример 4:
- `base after previous layers = 0.80`
- `effort_level = race`
- `race_type = ultra`
- `elevation_gain_m = 2200`

Тогда:
- `effort_adj = +0.05`
- `secondary_adjusted = 0.85`

Важно:
- это ещё pre-cap значение;
- дальше его должен обработать Branch B cap layer;
- высокий `elevation_gain_m` здесь должен усилить demanding-scenario warnings,
  а не сам по себе разгонять математику ещё сильнее.

---

#### 20.9. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- прямой строгой универсальной формулы для effort/elevation → fluid/hour нет
- effort и elevation могут усиливать demanding-context interpretation
- без персонального sweat rate такие поля нужно использовать осторожно

**[MODEL-BASED]**
- `effort_adj = -0.05 / 0.00 / +0.05`
- `default effort_level = race`
- вынесение `elevation_gain_m` из прямой math-логики в warning/context layer
- secondary-layer architecture поверх matrix + humidity + race_type

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли позже отдельный very small elevation effect в fallback math
- оптимален ли именно шаг `0.05` для effort
- нужно ли позже отдельное усиление для более агрессивного future effort vocabulary

---

### 21. Caps, floor and upper-scenario layer inside Branch B

#### 21.1. Главный принцип

После того как Branch B собрал fallback target через:

- temperature × duration matrix
- `humidity_pct` adjustment
- `race_type` adjustment
- `effort_level` secondary adjustment

hydration engine обязан применить отдельный safety layer.

Главный принцип:

- без `sweat_rate_lph` fallback branch не должен звучать агрессивно;
- у него должен быть:
  - practical floor,
  - conservative soft cap,
  - hard cap,
  - upper-scenario warning logic.

---

#### 21.2. Что фиксируем на этом этапе

Для Branch B на этом этапе фиксируем:

- **floor = `0.25 л/ч`**
- **soft cap = `0.80 л/ч`**
- **hard cap = `1.00 л/ч`**

Смысл:

- `0.25 л/ч` — общий нижний practical bound для hydration `v1.2`
- `0.80 л/ч` — верх routine fallback zone без `sweat_rate_lph`
- `1.00 л/ч` — верхний абсолютный предел в выдаваемом плане `v1.2`

---

#### 21.3. Почему Branch B требует более жёсткого cap-layer

Это связано с самой природой fallback branch:

- нет персонального `sweat_rate_lph`
- weather/context estimate менее точен
- риск overconfidence выше
- при жаре и длинных событиях продукт должен быть честнее, а не агрессивнее

Поэтому:

- без `sweat_rate_lph` `0.80 л/ч` уже считается upper scenario,
- а значения выше этого уровня не должны звучать как routine recommendation.

---

#### 21.4. Operational order

Для Branch B используем такой порядок:

1. рассчитать `secondary_adjusted_fluid_per_hour_l`
2. применить soft-cap interpretation
3. применить hard cap
4. убедиться, что результат не ниже floor
5. отдельно сформировать warnings/confidence

Operational rule:

`pre_warning_fluid_per_hour_l = clamp(0.25, 1.00, secondary_adjusted_fluid_per_hour_l)`

Но отдельно фиксируем:

- если `pre_warning_fluid_per_hour_l > 0.80`,
  это уже upper-scenario zone
- если значение было срезано hard cap,
  warning layer обязан это отразить

---

#### 21.5. Floor rule

Если после fallback math и secondary adjustments получилось значение ниже `0.25 л/ч`:

- final fallback target поднимается до `0.25 л/ч`

Смысл:

- hydration plan не должен уходить в слишком низкие routine values;
- для MVP это practical minimum,
  пока мы не проектируем отдельные short/cool exceptions глубже.

На этом этапе Branch B использует floor жёстче,
чем Branch A,
потому что здесь нет персонального sweat rate,
который мог бы оправдать более низкий итоговый intake.

---

#### 21.6. Soft cap rule

Если после fallback math получилось значение:

- `<= 0.80 л/ч` → это обычная рабочая зона Branch B
- `> 0.80 л/ч` → это upper scenario

Важно:

- soft cap на этом этапе **не обязан сразу жёстко обрезать значение до `0.80`**
- но должен:
  - усиливать warnings,
  - понижать confidence,
  - делать language заметно осторожнее

То есть:

**`0.80 л/ч` в Branch B — это прежде всего граница routine fallback zone.**

---

#### 21.7. Hard cap rule

Если после fallback math получилось значение выше `1.00 л/ч`:

- итоговый result в plan не должен превышать `1.00 л/ч`

Operational rule:

- если `secondary_adjusted_fluid_per_hour_l > 1.00`
  → `final_fluid_per_hour_l = 1.00`

Смысл:

- без персонального sweat rate рекомендовать routine plan выше `1.00 л/ч` небезопасно;
- hard cap нужен как отдельный верхний safety limit.

---

#### 21.8. Полная формула этого слоя

На этом этапе можно зафиксировать так:

`final_fluid_per_hour_l = clamp(0.25, 1.00, secondary_adjusted_fluid_per_hour_l)`

Но с обязательной интерпретацией:

- `0.25–0.80` → обычная fallback working zone
- `>0.80–1.00` → upper scenario
- `>1.00` → не пропускаем в итоговый plan

---

#### 21.9. Expected behavior examples

Пример 1:
- `secondary_adjusted = 0.20`

Тогда:
- `final = 0.25`
- floor срабатывает

Пример 2:
- `secondary_adjusted = 0.70`

Тогда:
- `final = 0.70`
- обычная рабочая fallback zone

Пример 3:
- `secondary_adjusted = 0.85`

Тогда:
- `final = 0.85`
- soft cap не режет число,
  но это уже upper scenario
- warnings/confidence должны усиливаться

Пример 4:
- `secondary_adjusted = 1.10`

Тогда:
- `final = 1.00`
- hard cap срабатывает
- warning layer обязан это явно отразить

---

#### 21.10. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- без персонального sweat rate hydration estimate менее точен
- very high fluid targets требуют большей осторожности
- overdrinking risk нельзя игнорировать

**[MODEL-BASED]**
- `floor = 0.25 л/ч`
- `soft cap = 0.80 л/ч` для Branch B
- `hard cap = 1.00 л/ч`
- use of `0.80–1.00 л/ч` as upper-scenario zone
- clamp-based safety layer for fallback branch

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли позже отдельный short/cool exception ниже `0.25 л/ч`
- нужно ли позже жёстче резать `>0.80 л/ч` уже на уровне math, а не только warnings

---

### 22. Warnings and confidence layer inside Branch B

#### 22.1. Главный принцип

Даже если Branch B выдает practical fallback target,
результат не должен подаваться как персонализированная физиологическая истина.

Главный принцип Branch B:

- нет `sweat_rate_lph` → нет персонального hydration signal;
- fallback estimate по определению менее точен, чем Branch A;
- при жаре, длинной длительности и верхних fluid targets язык результата должен становиться ещё осторожнее.

То есть:
**Branch B обязан быть более warning-driven и всегда менее уверенным, чем Branch A.**

---

#### 22.2. Что warning layer обязан делать

Warning/confidence layer внутри Branch B должен:

- явно показывать, что это fallback without sweat rate;
- сразу маркировать результат как **lower confidence**;
- усиливать осторожность в жаре;
- усиливать осторожность при very high hourly fluid target;
- отдельно отмечать long hot / ultra-long hot scenarios;
- отдельно surface possible overdrinking risk;
- не использовать sodium как защиту от overdrinking;
- не использовать fake precision risk score.

---

#### 22.3. Базовый confidence principle for Branch B

Для Branch B на этом этапе фиксируем:

- **confidence = `lower` by default**
- **tier `higher` в Branch B не используется**
- **tier `moderate` в Branch B на этом этапе не используется**

Смысл:

- даже в “спокойном” fallback-сценарии без `sweat_rate_lph`
  результат остаётся менее надёжным, чем персональный sweat-rate branch;
- это соответствует принципу:
  **hydration without sweat rate = weather fallback = lower confidence**.

---

#### 22.4. Что влияет на language severity внутри Branch B

Хотя confidence tier в Branch B остаётся `lower`,
сами warnings и тон текста должны становиться ещё осторожнее,
если появляются demanding factors.

На этом этапе фиксируем такие severity triggers:

##### Trigger A — heat + no sweat rate
Если:
- `temperature_c >= 25`

Смысл:
- в жаре без персонального sweat rate продукт должен звучать ещё осторожнее.

##### Trigger B — upper fluid target
Если:
- `final_fluid_per_hour_l > 0.80`

Смысл:
- upper fallback target without sweat rate не должен звучать как routine certainty.

##### Trigger C — ultra-long hot scenario
Если одновременно:
- `race_type = ultra`
- `duration_min >= 240`
- `temperature_c >= 25`

Смысл:
- это один из самых demanding fallback scenarios.

##### Trigger D — hard cap applied
Если:
- `final_fluid_per_hour_l = 1.00`
- и `secondary_adjusted_fluid_per_hour_l > 1.00`

Смысл:
- safety layer реально вмешался,
  значит исходный fallback result уже был слишком высоким для routine plan.

##### Trigger E — humidity missing in heat
Если одновременно:
- `temperature_c >= 25`
- `humidity_pct` отсутствует

Смысл:
- в жаре отсутствие humidity context делает fallback ещё менее надёжным.

---

#### 22.5. Итоговое правило confidence

Для Branch B на этом этапе используем простое правило:

- **confidence всегда остаётся `lower`**

Severity triggers:
- **не понижают confidence ещё ниже**,
- а усиливают:
  - warning set,
  - wording severity,
  - degree of caution in result text.

Главный принцип:
**в Branch B меняется не tier confidence, а степень осторожности текста и warnings поверх уже lower-confidence модели.**

---

#### 22.6. Какие warning flags должны существовать в Branch B

На этом этапе фиксируем такие warning flags:

1. `no_sweat_rate_fallback`
2. `heat_no_sweat_rate`
3. `upper_fluid_target_no_sweat_rate`
4. `ultra_long_hot_context`
5. `possible_overdrinking_risk`
6. `hard_cap_applied`
7. `humidity_missing_in_heat`
8. `trail_elevation_execution_risk`

Это backend-level structure,
а не финальный user-facing текст.

---

#### 22.7. Правила активации warning flags

##### `no_sweat_rate_fallback`
Активируется всегда в Branch B.

Смысл:
- результат построен без персонального sweat rate.

##### `heat_no_sweat_rate`
Активируется, если:
- `temperature_c >= 25`

Смысл:
- горячий сценарий без sweat test требует более честного текста.

##### `upper_fluid_target_no_sweat_rate`
Активируется, если:
- `final_fluid_per_hour_l > 0.80`

Смысл:
- fallback result уже в upper-scenario zone.

##### `ultra_long_hot_context`
Активируется, если одновременно:
- `race_type = ultra`
- `duration_min >= 240`
- `temperature_c >= 25`

Смысл:
- это тяжёлый long hot fallback scenario.

##### `possible_overdrinking_risk`
Активируется, если выполняется хотя бы одно:
- `final_fluid_per_hour_l > 0.80`
- `hard_cap_applied = true`
- одновременно `temperature_c >= 25` и `duration_min >= 240`

Смысл:
- это не diagnosis,
  а safety warning для high-intake fallback scenario.

##### `hard_cap_applied`
Активируется, если:
- `secondary_adjusted_fluid_per_hour_l > 1.00`
- и итоговый result был срезан до `1.00`

##### `humidity_missing_in_heat`
Активируется, если одновременно:
- `temperature_c >= 25`
- `humidity_pct` отсутствует

Смысл:
- heat scenario есть,
  но humidity context неполный.

##### `trail_elevation_execution_risk`
Активируется, если одновременно:
- `race_type = trail` или `race_type = ultra`
- `elevation_gain_m >= 1500`

Смысл:
- trail/elevation context должен быть отражён честнее,
  даже если он не разгоняет fluid math напрямую.

---

#### 22.8. Что warning layer не должен делать

Branch B warning/confidence layer не должен:

1. делать вид, что fallback равен по качеству персональному sweat-rate branch
2. использовать medical diagnosis language
3. считать fake EAH score
4. говорить или подразумевать, что sodium защищает от overdrinking
5. звучать слишком спокойно в hot / long / upper-scenario cases
6. скрывать, что humidity missing снижает точность hot fallback

---

#### 22.9. Как должен звучать result language в Branch B

Поскольку `confidence = lower` во всех Branch B scenarios,
текст результата должен всегда явно звучать как fallback estimate.

##### Базовый fallback scenario
Тон результата:
- practical
- спокойный
- но с прямой пометкой,
  что это lower-confidence estimate without personal sweat rate

##### Demanding fallback scenario
Если есть severity triggers:
- тон становится заметно осторожнее
- усиливается акцент на uncertainty, execution difficulty и safety
- upper/hot/ultra-long scenarios не должны звучать как routine certainty

Главный принцип:
**Branch B всегда должен звучать честнее, чем “точный персональный расчёт”.**

---

#### 22.10. Expected behavior examples

Пример 1:
- `final_fluid_per_hour_l = 0.40`
- `temperature_c = 15`
- `duration_min = 120`
- `race_type = road`
- `humidity_pct = 60`

Тогда:
- `confidence = lower`
- warnings:
  - `no_sweat_rate_fallback`

Пример 2:
- `final_fluid_per_hour_l = 0.70`
- `temperature_c = 27`
- `duration_min = 150`
- `race_type = road`
- `humidity_pct = 80`

Тогда:
- `confidence = lower`
- warnings:
  - `no_sweat_rate_fallback`
  - `heat_no_sweat_rate`

Пример 3:
- `final_fluid_per_hour_l = 0.90`
- `temperature_c = 30`
- `duration_min = 360`
- `race_type = ultra`
- `humidity_pct = 80`

Тогда:
- `confidence = lower`
- warnings:
  - `no_sweat_rate_fallback`
  - `heat_no_sweat_rate`
  - `upper_fluid_target_no_sweat_rate`
  - `ultra_long_hot_context`
  - `possible_overdrinking_risk`

Пример 4:
- `secondary_adjusted_fluid_per_hour_l = 1.10`
- `final_fluid_per_hour_l = 1.00`
- `temperature_c = 28`
- `duration_min = 300`
- `race_type = road`
- `humidity_pct = null`

Тогда:
- `confidence = lower`
- warnings:
  - `no_sweat_rate_fallback`
  - `heat_no_sweat_rate`
  - `upper_fluid_target_no_sweat_rate`
  - `hard_cap_applied`
  - `possible_overdrinking_risk`
  - `humidity_missing_in_heat`

Пример 5:
- `final_fluid_per_hour_l = 0.60`
- `temperature_c = 18`
- `duration_min = 360`
- `race_type = trail`
- `humidity_pct = 60`
- `elevation_gain_m = 1800`

Тогда:
- `confidence = lower`
- warnings:
  - `no_sweat_rate_fallback`
  - `trail_elevation_execution_risk`

---

#### 22.11. Что в этом разделе science-based, а что model-based

**[SCIENCE-BASED]**
- без персонального sweat rate hydration estimate менее точен
- heat + no sweat rate требует большей осторожности
- very high fluid targets требуют safety-awareness
- overdrinking risk нельзя скрывать
- sodium не должен подаваться как защита от overdrinking

**[MODEL-BASED]**
- `confidence = lower` by default for all Branch B scenarios
- `higher` и `moderate` не используются в Branch B на этом этапе
- severity triggers усиливают warnings/text severity, а не меняют tier ещё ниже
- warning flags list
- special flags for:
  - `heat_no_sweat_rate`
  - `upper_fluid_target_no_sweat_rate`
  - `ultra_long_hot_context`
  - `possible_overdrinking_risk`
  - `trail_elevation_execution_risk`

**[HYPOTHESIS / NEEDS CHECK]**
- достаточно ли fixed lower-confidence policy для всех fallback scenarios
- нужен ли позже отдельный warning для very humid but not hot scenario
- нужен ли later отдельный stronger trail warning для long technical races

---

### 23. Expected behavior on target cases and overall evidence map for HYDRATION

#### 23.1. Зачем нужен этот раздел

HYDRATION block в `v1.2` должен быть не просто набором правил,
а explainable engine, который можно руками проверить на типовых сценариях.

Этот раздел нужен, чтобы:

- проверить, что `Branch A` и `Branch B` ведут себя по-разному;
- проверить, что жара / длительность / отсутствие `sweat_rate_lph`
  реально меняют confidence и warnings;
- зафиксировать,
  что в hydration block является science-based,
  а что остаётся engineering model.

---

#### 23.2. Expected behavior — calm fallback case

Если сценарий:

- без `sweat_rate_lph`
- температура умеренная или прохладная
- длительность не очень большая
- итоговый `fluid_per_hour_l` в обычной рабочей зоне

Тогда ожидаем:

- включается `Branch B`
- результат выглядит как conservative fallback estimate
- confidence остаётся `lower`
- warnings минимальны, но:
  - `no_sweat_rate_fallback` обязателен
- язык результата спокойный,
  но без pretending personalized precision

---

#### 23.3. Expected behavior — hot fallback case without sweat rate

Если сценарий:

- `sweat_rate_lph` отсутствует
- `temperature_c >= 25`
- особенно если длительность заметная

Тогда ожидаем:

- fallback target растёт по weather matrix / adjustments,
  но остаётся conservative;
- confidence остаётся `lower`;
- warnings усиливаются;
- обязательно появляются:
  - `no_sweat_rate_fallback`
  - `heat_no_sweat_rate`
- если humidity тоже высокая,
  language должен становиться ещё осторожнее

Главный смысл:
**жара без sweat rate не должна звучать уверенно.**

---

#### 23.4. Expected behavior — upper fallback target case

Если в Branch B итоговый `fluid_per_hour_l > 0.80`:

Тогда ожидаем:

- сценарий считается upper fallback scenario
- это не routine recommendation
- confidence остаётся `lower`
- warning layer усиливается
- обязательно появляются:
  - `upper_fluid_target_no_sweat_rate`
  - `possible_overdrinking_risk`

Если target дошёл до hard cap:
- должен появляться `hard_cap_applied`

Главный смысл:
**без `sweat_rate_lph` high fluid target требует особенно честного safety language.**

---

#### 23.5. Expected behavior — ultra-long hot fallback case

Если одновременно:

- `race_type = ultra`
- `duration_min >= 240`
- `temperature_c >= 25`
- `sweat_rate_lph` отсутствует

Тогда ожидаем:

- fallback branch остаётся активным
- fluid target может оказаться в верхней зоне,
  но не должен звучать как routine certainty
- confidence остаётся `lower`
- warnings становятся максимально выраженными для Branch B
- обязательно появляются:
  - `no_sweat_rate_fallback`
  - `heat_no_sweat_rate`
  - `ultra_long_hot_context`
  - `possible_overdrinking_risk`

Главный смысл:
**ultra + long + hot + no sweat rate = один из самых осторожных hydration scenarios в продукте.**

---

#### 23.6. Expected behavior — known sweat-rate case

Если `sweat_rate_lph` известен и валиден:

Тогда ожидаем:

- включается `Branch A`
- именно `sweat_rate_lph` становится главным hydration input
- результат не выглядит как weather-only estimate
- confidence выше, чем у Branch B
- но high heat / long duration / upper target
  всё равно усиливают warnings и делают language осторожнее

Главный смысл:
**known sweat rate улучшает персонализацию, но не отменяет safety logic.**

---

#### 23.7. Expected behavior — known sweat rate vs no sweat rate at similar weather

Если условия по температуре примерно одинаковые,
но в одном кейсе `sweat_rate_lph` известен,
а в другом нет,

то ожидаем:

- у known-sweat-rate athlete результат строится через Branch A
- у unknown-sweat-rate athlete результат строится через Branch B
- outputs могут быть близкими по числу,
  но должны различаться:
  - по логике расчёта,
  - по confidence,
  - по warnings,
  - по explainability

Главный смысл:
**двум спортсменам при похожей погоде можно дать похожие числа,
но нельзя делать вид, что уровень уверенности у них одинаковый.**

---

#### 23.8. Expected behavior — trail / elevation context

Если сценарий:

- `race_type = trail` или `ultra`
- `elevation_gain_m` высокий

Тогда ожидаем:

- elevation context усиливает warnings / execution difficulty interpretation
- но не должен автоматически делать hydration math агрессивнее сам по себе
- особенно в Branch B elevation остаётся прежде всего warning/context layer

Главный смысл:
**trail/elevation должны быть отражены честно, но без псевдонаучной переоценки.**

---

#### 23.9. Общий вывод по expected behavior

HYDRATION block в `v1.2` должен приводить к таким продуктовым различиям:

1. known sweat rate ≠ fallback without sweat rate  
2. hot + long + uncertain = more warnings + lower confidence language  
3. very high fluid targets never sound casual  
4. sodium never acts as protection from overdrinking  
5. trail/elevation affect context more than they drive direct math

---

#### 23.10. Что в HYDRATION block считаем science-based

**[SCIENCE-BASED]**
- персональный `sweat_rate_lph` предпочтительнее weather fallback
- hydration не должна строиться как full-replacement default
- excessive fluid intake / overdrinking — ключевой safety risk
- long duration + hot conditions + uncertainty требуют большей осторожности
- высокая влажность усиливает heat-stress context
- without sweat rate hydration estimate менее точен
- sodium не должен подаваться как защита от overdrinking

---

#### 23.11. Что в HYDRATION block считаем model-based

**[MODEL-BASED]**
- two-branch architecture:
  - `Branch A = known sweat rate`
  - `Branch B = fallback`
- replacement fraction range `0.55–0.80` inside Branch A
- base replacement fraction `0.65`
- anti-overdrinking rule через intake below sweat rate
- `below_sweat_limit = sweat_rate_lph - 0.05`
- Branch A hard cap `1.00 л/ч`
- Branch A upper-scenario threshold `>0.80 л/ч`
- Branch B temperature × duration fallback matrix
- Branch B humidity and race-type adjustments
- small effort adjustment in Branch B
- Branch B floor `0.25 л/ч`
- Branch B soft cap `0.80 л/ч`
- Branch B hard cap `1.00 л/ч`
- warnings-based logic вместо fake risk score
- lower-confidence-by-default policy for Branch B

---

#### 23.12. Что в HYDRATION block пока считаем hypothesis / needs check

**[HYPOTHESIS / NEEDS CHECK]**
- точные numeric boundaries всех temperature bands
- точные matrix values для всех fallback scenarios
- оптимальность humidity threshold `70%`
- оптимальность duration threshold `240 min`
- оптимальность small step `0.05` для adjustments
- оптимальность gap `sweat_rate_lph - 0.05`
- нужен ли later very small direct role для `weight_kg`
- нужен ли later very small direct role для `elevation_gain_m`
- нужен ли позже отдельный short/cool exception ниже `0.25 л/ч`
- нужно ли позже жёстче clamp’ить `>0.80 л/ч` уже в math, а не только в warnings

---

#### 23.13. Итог HYDRATION блока одной фразой

HYDRATION `v1.2` — это safety-first rule engine,
где:
- при known sweat rate используется более персональный путь,
- без sweat rate используется weather fallback,
- а very high fluid targets, жаркие длинные сценарии и uncertainty
всегда ведут к более честным warnings и менее уверенному тексту результата.

---

## SODIUM — formula spec v1.2 draft

### 1. Цель блока

Sodium block в `v1.2` должен выдавать **честный, ограниченный и practically useful** ориентир по натрию на гонку.

Цель блока:
- считать **только sodium**, а не полный electrolyte model;
- не делать вид, что существует одна точная персональная формула для всех;
- связывать sodium logic с уже рассчитанным `fluid_per_hour_l`, а не считать sodium в отрыве от hydration strategy;
- не подавать sodium как защиту от overdrinking / EAH;
- делать output более осторожным, если `sodium_loss_profile` неизвестен.

Ключевой принцип:
**лучше консервативный и explainable sodium plan, чем агрессивная псевдоточная персонализация.**

---

### 2. Главные принципы блока

#### 2.1. [SCIENCE-BASED] В MVP считаем только sodium

В `v1.2` считаем только sodium, без отдельного magnesium / potassium / calcium model.

#### 2.2. [SCIENCE-BASED] Sodium не решает проблему overdrinking

Sodium сам по себе не является защитой от overdrinking-related EAH.

#### 2.3. [SCIENCE-BASED] Потери натрия между спортсменами сильно вариативны

Поэтому sodium block не должен выглядеть как “одна точная физиологическая формула для всех”.

#### 2.4. [MODEL-BASED] Sodium block должен быть завязан на fluid block

Практическая логика:
1. сначала определяется `fluid_per_hour_l`,
2. затем определяется `sodium_concentration_mg_l`,
3. затем считаются:
   - `sodium_per_hour_mg`,
   - `sodium_total_mg`,
   - `sodium_interval_min`,
   - `sodium_per_intake_mg`.

#### 2.5. [MODEL-BASED] Sodium strategy должна активироваться по контексту

Натрий не должен всегда выглядеть одинаково значимым.  
Short cool low-fluid scenario и long hot high-fluid scenario должны вести себя по-разному.

---

### 3. Роль входных полей

#### 3.1. Главные drivers
- `fluid_per_hour_l`
- `duration_min`
- `temperature_c`
- `sodium_loss_profile`

#### 3.2. Главные context inputs
- `humidity_pct`
- `race_type`

#### 3.3. Secondary/context only
- `sweat_rate_lph` — только косвенно, через hydration branch и `fluid_per_hour_l`
- `weight_kg`
- `effort_level`
- `elevation_gain_m`
- `fuel_format`
- `gi_tolerance_level`

#### 3.4. Важно
- `sweat_rate_lph` не должен напрямую задавать sodium math отдельно от fluid block;
- `weight_kg` не должен становиться sodium driver;
- `unknown` нельзя silently превращать в `medium`.

---

### 4. Состояния `sodium_loss_profile`

В `v1.2` фиксируем 4 рабочих состояния:

- `unknown`
- `low`
- `medium`
- `high`

#### 4.1. `unknown`
- профиль потерь натрия неизвестен;
- это не то же самое, что `medium`;
- confidence должен быть ниже;
- ceiling для агрессивной sodium strategy должен быть осторожнее.

#### 4.2. `low`
- более низкий operational sodium tier;
- подходит только если остальной контекст не требует escalation.

#### 4.3. `medium`
- нейтральный рабочий default, **но только если профиль реально указан как `medium`**;
- не использовать как маску для `unknown`.

#### 4.4. `high`
- salty sweater / high sodium loss context;
- допускает более высокий sodium concentration tier;
- требует более явных warnings в demanding scenarios.

---

### 5. `null` / `empty` / `unknown` behavior

#### 5.1. Если поле отсутствует / пустое / `null`
- трактуем это как `unknown`;
- не как `medium`.

#### 5.2. Если профиль = `unknown`
- sodium block продолжает работать;
- confidence снижается;
- upper-tier recommendations становятся осторожнее;
- warning layer усиливается.

#### 5.3. Что нельзя делать
Нельзя:
- silently трактовать `unknown` как `medium`;
- звучать так, как будто sodium plan персонализирован, если профиль неизвестен.

---

### 6. Sodium strategy activation

#### 6.1. Главный принцип

В `v1.2` вводим явную логику:

- `sodium_strategy_active`

Sodium strategy не обязана быть активной в каждом сценарии.

#### 6.2. Когда sodium strategy inactive

По умолчанию sodium strategy может оставаться **inactive**, если одновременно выполняется всё ниже:

- `duration_min < 90`
- `temperature_c < 20`
- `humidity_pct < 70` или `humidity_pct` неизвестна
- `fluid_per_hour_l < 0.50`
- `race_type != "ultra"`
- `sodium_loss_profile != "high"`

Operational result:
- `sodium_strategy_active = false`
- `sodium_concentration_mg_l = 0`
- `sodium_per_hour_mg = 0`
- `sodium_total_mg = 0`

#### 6.3. Когда sodium strategy active

Sodium strategy активируется, если выполняется **хотя бы одно** из условий:

- `duration_min >= 90`
- `temperature_c >= 20`
- `humidity_pct >= 70`
- `fluid_per_hour_l >= 0.50`
- `race_type = "ultra"`
- `sodium_loss_profile = "high"`

Operational result:
- `sodium_strategy_active = true`

---

### 7. Sodium concentration tier logic

#### 7.1. Общий принцип

Если `sodium_strategy_active = true`, sodium target сначала задаётся как:

- `sodium_concentration_mg_l`

А уже потом считается:
- `sodium_per_hour_mg = fluid_per_hour_l * sodium_concentration_mg_l`

#### 7.2. Base concentration by profile

Если sodium strategy active:

- `low` → `400 mg/L`
- `medium` → `600 mg/L`
- `high` → `900 mg/L`
- `unknown` → `500 mg/L`

Важно:
- `unknown = 500 mg/L` — это отдельный осторожный tier;
- это **не означает**, что `unknown = medium`.

#### 7.3. Context escalation

После base tier применяем **умеренный escalation**.

Если выполняется хотя бы одно из условий:
- `duration_min >= 180`
- `temperature_c >= 25`
- `humidity_pct >= 70`
- `fluid_per_hour_l >= 0.70`
- `race_type = "ultra"`

то:
- `sodium_concentration_mg_l += 200`

#### 7.4. Additional high-sweat escalation

Дополнительное повышение допускается только если:

- `sodium_loss_profile = "high"`
- (`temperature_c >= 25` или `fluid_per_hour_l >= 0.90`)

Тогда:
- `sodium_concentration_mg_l = 1200`

Это верхний aggressive operational tier для salty sweater scenario.  
Он не должен становиться default.

#### 7.5. Unknown profile safety rule

Если `sodium_loss_profile = "unknown"`:
- sodium concentration не должна подниматься выше `700 mg/L`.

На текущем этапе:
- `unknown` base = `500 mg/L`
- после escalation максимум = `700 mg/L`

#### 7.6. Clamp

После всех шагов:

- minimum = `0 mg/L`
- practical active floor = `300 mg/L`
- hard cap = `1200 mg/L`

Operational rule:
- если strategy inactive → `0`
- если strategy active → clamp в диапазон `300..1200`
- но для `unknown` → дополнительный cap `700`

---

### 8. Перевод в hourly / total outputs

#### 8.1. Sodium per hour

` sodium_per_hour_mg = round(fluid_per_hour_l * sodium_concentration_mg_l) `

#### 8.2. Sodium total

` sodium_total_mg = round(sodium_per_hour_mg * duration_h) `

где:
- `duration_h = duration_min / 60`

#### 8.3. Hourly cap

` sodium_per_hour_mg ` ограничиваем:

- floor = `0`
- hard cap = `1500`

Operational rule:
- если strategy inactive → `0`
- если strategy active и расчёт даёт очень высокое число → clamp до `1500`

Важно:
- `300 мг/ч` остаётся **practical low-end reference for active strategy**, а не жёстким floor для каждого сценария.

---

### 9. Interval and per-intake translation

#### 9.1. Sodium interval

На текущем этапе:

- `sodium_interval_min = fluid_interval_min`

Это простой и explainable default:
- sodium rhythm привязывается к hydration rhythm;
- не появляется лишняя отдельная частота без необходимости.

#### 9.2. Sodium per intake

` sodium_per_intake_mg = round(sodium_per_hour_mg * sodium_interval_min / 60) `

#### 9.3. Practical note

Если позже появятся salt capsules / separate sodium products layer,
тогда можно будет добавить grouping rules.  
Но для текущего MVP это пока не нужно.

---

### 10. Warnings and confidence

#### 10.1. Обязательный sodium warning

Если sodium strategy active:
- добавить warning:
  - `Натрий — это ориентир, а не защита от перепивания.`

#### 10.2. Unknown profile warning

Если `sodium_loss_profile = "unknown"`:
- warning:
  - `Профиль потерь натрия неизвестен, поэтому план по натрию менее персонализирован и его лучше проверить на тренировке.`

#### 10.3. High target warning

Если:
- `sodium_per_hour_mg >= 700`

добавить warning:
- `План по натрию уже находится в верхней части рабочего диапазона. Его лучше заранее проверить на тренировке.`

Если:
- `sodium_per_hour_mg >= 1000`

добавить более сильный warning:
- `Это уже высокий план по натрию. Без подтверждённой индивидуальной потребности не стоит воспринимать его как универсальную норму.`

#### 10.4. Hot long scenario warning

Если одновременно:
- `duration_min >= 240`
- `temperature_c >= 25`

добавить warning:
- `В длинной жаркой гонке расчёт по натрию особенно зависит от вашей реальной переносимости, питьевого плана и индивидуальных потерь.`

#### 10.5. Confidence logic

Confidence по sodium должен быть ниже, если:
- `sodium_loss_profile = "unknown"`
- hot / long scenario
- sodium target высокий
- hydration branch сам lower-confidence fallback

Главный принцип:
**sodium confidence не может быть выше confidence hydration block, потому что sodium math строится поверх fluid plan.**

---

### 11. Expected behavior on target cases

#### `CASE_001` — short road cool basic
- sodium strategy может оставаться inactive или очень консервативной;
- `unknown` не должен выглядеть как fully personalized sodium plan;
- output должен быть простым.

#### `CASE_003` — hot road marathon drink only
- sodium должен стать более контекстным;
- warnings должны усилиться;
- sodium не должен звучать как “страховка” от heat / overdrinking risk.

#### `CASE_004` — trail long race with elevation
- sodium strategy должна быть active;
- `high` profile должен реально повышать target;
- trail / long context должен быть отражён честнее, чем в `v1.1`.

#### `CASE_005` — ultra hot humid with known sweat rate + unknown sodium
- sodium должен опираться на уже выбранный fluid plan;
- `unknown` должен снижать уверенность;
- warnings должны быть сильнее;
- результат не должен выглядеть как персонально точная sodium prescription.

---

### 12. Что в этом блоке science-based, а что model-based

#### [SCIENCE-BASED]
- считаем только sodium, без полного electrolyte model
- sodium не защищает от overdrinking-related EAH
- потери натрия вариативны
- high sodium recommendations требуют осторожности

#### [MODEL-BASED]
- `sodium_strategy_active`
- activation rules
- tier-based sodium concentration model
- numeric tiers `400 / 500 / 600 / 900 / 1200 mg/L`
- separate cap for `unknown`
- `sodium_interval_min = fluid_interval_min`
- hourly hard cap `1500 mg/h`

#### [HYPOTHESIS / NEEDS CHECK]
- точность выбранных numeric tiers для `unknown` / `medium` / `high`
- нужен ли в будущем отдельный modifier от `effort_level`
- нужен ли в будущем отдельный modifier от `elevation_gain_m`
- стоит ли для `unknown` держать max `700` или позже расширять до `800`

---

### 13. Операционный итог для будущего backend

Порядок расчёта SODIUM block в `v1.2`:

1. взять `fluid_per_hour_l` из hydration block
2. определить `sodium_loss_profile` (`null` / `empty` → `unknown`)
3. определить `sodium_strategy_active`
4. если inactive → все sodium outputs = `0`
5. если active → определить `sodium_concentration_mg_l`
6. применить context escalation
7. применить `unknown` safety cap и общий clamp
8. посчитать:
   - `sodium_per_hour_mg`
   - `sodium_total_mg`
   - `sodium_interval_min`
   - `sodium_per_intake_mg`
9. добавить warnings
10. понизить confidence, если профиль неизвестен или hydration branch сам lower-confidence

---

## PLAN — formula spec v1.2 draft

### 1. Цель блока

PLAN block в `v1.2` должен собирать уже рассчитанные блоки:

- `CARBS`
- `HYDRATION`
- `SODIUM`

в **один practically executable race plan**.

Цель блока:
- не придумывать новую физиологическую математику поверх готовых блоков;
- а переводить уже выбранные hourly / total targets в понятный и выполнимый план на гонку;
- собирать единый intake rhythm там, где это возможно;
- делать итог более удобным для выполнения пользователем;
- не скрывать ограничения feasibility и confidence, пришедшие из upstream blocks.

Ключевой принцип:
**PLAN block — это assembly layer, а не новый physiological calculation block.**

---

### 2. Что PLAN block обязан делать

PLAN block в `v1.2` обязан:

1. собрать итоговые результаты из:
   - carbs block
   - hydration block
   - sodium block

2. перевести их в practical execution layer:
   - `intake_interval_min`
   - `total_intake_count`
   - `recommendation_summary`
   - `plan_steps`

3. по возможности синхронизировать:
   - carbs intake rhythm
   - fluid intake rhythm
   - sodium intake rhythm

4. если идеальная синхронизация невозможна:
   - выбирать practical execution-first solution,
   - а не псевдоидеальную математическую схему

5. отражать ограничения:
   - `fuel_format`
   - `gi_tolerance_level`
   - hydration confidence
   - sodium confidence
   - demanding race context

---

### 3. Что PLAN block не должен делать

PLAN block не должен:

1. заново пересчитывать `carbs_per_hour_g`
2. заново пересчитывать `fluid_per_hour_l`
3. заново пересчитывать `sodium_per_hour_mg`
4. делать вид, что все intake’и обязаны идеально совпадать по минутам
5. ломать safety limits, уже применённые upstream blocks
6. маскировать low-confidence scenario под “точный персональный план”

---

### 4. Какие inputs PLAN block получает от upstream logic

PLAN block должен использовать уже собранные output values из предыдущих блоков.

#### 4.1. Из CARBS block
- `carbs_per_hour_g`
- `carbs_total_g`
- `carb_interval_min`
- `carbs_per_intake_g`

#### 4.2. Из HYDRATION block
- `fluid_per_hour_l`
- `fluid_total_l`
- `fluid_interval_min`
- `fluid_per_intake_ml`

#### 4.3. Из SODIUM block
- `sodium_strategy_active`
- `sodium_per_hour_mg`
- `sodium_total_mg`
- `sodium_interval_min`
- `sodium_per_intake_mg`

#### 4.4. Контекстные поля
- `duration_min`
- `fuel_format`
- `race_type`
- `gi_tolerance_level`

---

### 5. Какие outputs PLAN block обязан собрать

PLAN block должен выдавать как минимум:

- `intake_interval_min`
- `total_intake_count`
- `when_to_start`
- `missed_intake_fallback`
- `recommendation_summary`
- `plan_steps`

Дополнительно later допустимо использовать:
- `execution_notes`
- `plan_complexity`
- `schedule_type`

Но для текущего состояния спецификации главное —
зафиксировать minimum assembled practical outputs,
которые уже согласованы с final PLAN output shape ниже.

---

### 6. Главная роль PLAN block одной фразой

PLAN `v1.2` — это слой, который превращает отдельные расчёты углеводов, жидкости и натрия в один понятный и выполнимый план действий на гонку.

---

### 7. Что в этом блоке science-based, а что model-based

**[SCIENCE-BASED]**
- practical race fueling лучше выдавать не только как totals, но и как hourly targets, intervals и dose-per-intake logic
- итоговый план должен учитывать practical feasibility, а не только числовые target values
- чем ниже уверенность upstream blocks, тем осторожнее должен звучать итоговый plan layer

**[MODEL-BASED]**
- сборка единого `intake_interval_min` из нескольких rhythms
- логика `total_intake_count`
- формат `recommendation_summary`
- структура `plan_steps`
- правила приоритета practical execution over perfect synchronization

**[HYPOTHESIS / NEEDS CHECK]**
- какой именно rhythm делать master по умолчанию:
  - minimum interval
  - fluid-led
  - carbs-led
  - grouped schedule
- нужен ли отдельный `schedule_type`
- насколько детальным должен быть `missed_intake_fallback` уже в `v1.2`

---

### 8. Что пока не фиксируем в этом разделе

На этом шаге **ещё не фиксируем**:

- точное правило выбора `master interval`
- точную формулу `total_intake_count`
- точную структуру каждого элемента внутри `plan_steps`
- окончательный текст `recommendation_summary`
- exact rules для `when_to_start`
- exact rules для `missed_intake_fallback`

Это пойдёт следующими подшагами.

Здесь фиксируем только:
- роль PLAN block
- его границы
- его входы
- его обязательные выходы
- его место в общей архитектуре `v1.2`

---

### 9. Master interval selection

#### 9.1. Зачем нужен `intake_interval_min`

PLAN block должен собрать один **master reminder interval**:

- для фронтенда
- для bot reminders
- для общего race rhythm

Это не значит, что каждый intake обязан быть абсолютно одинаковым по содержанию.
Это значит, что пользователю нужен **один основной ритм напоминаний**, вокруг которого уже собирается practical plan.

---

#### 9.2. Главный принцип выбора

Если у нас есть несколько intake rhythms:

- `carb_interval_min`
- `fluid_interval_min`
- `sodium_interval_min`

то `intake_interval_min` должен выбираться как:

- **самый частый practical interval**
- то есть **минимальный из валидных положительных interval values**

Draft rule:

`intake_interval_min = min(active_positive_intervals)`

где `active_positive_intervals` — это список из:
- `carb_interval_min`, если он задан и `> 0`
- `fluid_interval_min`, если он задан и `> 0`
- `sodium_interval_min`, если:
  - `sodium_strategy_active = true`
  - и `sodium_interval_min > 0`

---

#### 9.3. Почему берём minimum interval

Этот подход нужен потому, что:

- reminders лучше строить по более частому practical rhythm,
- крупный interval может пропустить более частые small-dose actions,
- master rhythm должен поддерживать practical execution,
  а не только красивую упаковку totals.

Ключевой operational смысл:
**лучше иметь один более частый и выполнимый master rhythm, чем редкий interval, который ломает часть плана.**

---

#### 9.4. Как обращаться с sodium rhythm

В текущем `SODIUM` spec уже зафиксировано:

- `sodium_interval_min = fluid_interval_min`

Это значит:
- sodium обычно не создаёт новый отдельный rhythm;
- sodium в нормальном сценарии наследует hydration rhythm;
- но в PLAN block всё равно полезно явно описать правило,
  что sodium interval участвует только если sodium strategy active.

Operational rule:
- если `sodium_strategy_active = false`,
  sodium rhythm не участвует в выборе `intake_interval_min`.

---

#### 9.5. Null behavior

Если:
- ни один валидный positive interval не собран,

то:
- `intake_interval_min = null`

и later warning / confidence layer должен пометить plan assembly как incomplete.

Если валиден только один interval,
то именно он и становится `intake_interval_min`.

---

#### 9.6. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- practical fueling plan лучше делать с повторяемым ритмом, а не только с totals
- дробные intake patterns полезнее для исполнения плана, чем редкие крупные болюсы

**[MODEL-BASED]**
- выбор master interval через minimum active positive interval
- исключение inactive sodium interval из master selection
- трактовка `intake_interval_min` как master reminder rhythm

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли позже grouped schedule вместо strict minimum-interval model
- нужно ли отдельно различать reminder rhythm и exact execution rhythm

---

### 10. `total_intake_count`

#### 10.1. Главный принцип

После выбора `intake_interval_min`
PLAN block должен собрать:

- `total_intake_count`

Это число показывает,
сколько reminder slots приходится на всю гонку.

Draft rule:

`total_intake_count = floor(duration_min / intake_interval_min)`

---

#### 10.2. Почему используем `floor`, а не `ceil`

На текущем этапе используем `floor`, потому что:

- это простой и explainable operational rule,
- он не создаёт “лишний” intake slot после реального конца duration,
- он хорошо подходит для reminder / schedule layer MVP.

---

#### 10.3. Ограничения этого подхода

Важно:
- `total_intake_count` — это не обещание,
  что carbs / fluid / sodium всегда идеально делятся на одинаковые части;
- это число для practical scheduling layer,
  а не физиологическая истина.

То есть:
- plan может использовать один master interval,
- но конкретное содержимое intake step всё равно может отличаться.

---

#### 10.4. Null behavior

Если:
- `intake_interval_min = null`
- или `intake_interval_min <= 0`

то:
- `total_intake_count = null`

и plan layer later должен помечать такой сценарий как incomplete assembly.

---

#### 10.5. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- practical plan должен быть переведён в повторяемую execution structure

**[MODEL-BASED]**
- `floor(duration_min / intake_interval_min)` как standard reminder-slot count
- трактовка `total_intake_count` именно как planning field, а не physiological metric

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный финальный intake near finish
- нужно ли later считать отдельные counts:
  - `carb_intake_count`
  - `fluid_intake_count`
  - `sodium_intake_count`

---

### 11. Промежуточный вывод после этого шага

После фиксации разделов `9–10` PLAN block уже будет иметь:

- понятную роль
- понятные входы и выходы
- правило выбора master interval
- правило сборки total intake count

Это уже делает его не просто “описанием идеи”,
а началом реального assembly engine.

---

### 12. `recommendation_summary`

#### 12.1. Роль поля

PLAN block должен собирать одно короткое итоговое поле:

- `recommendation_summary`

Это поле нужно для того, чтобы пользователь сразу понял:

- какой общий ритм плана,
- какие ключевые hourly ориентиры выбраны,
- насколько план выглядит обычным / осторожным / условным.

`recommendation_summary` — это **не полный план**.
Это короткий human-readable итог перед деталями.

---

#### 12.2. Что должно быть внутри

В `v1.2` `recommendation_summary` должен в короткой форме отражать:

1. duration context
2. carbs/hour
3. fluid/hour
4. sodium/hour — только если sodium strategy active
5. главный practical principle:
   - early start
   - steady rhythm
   - cautious execution при lower confidence

---

#### 12.3. Чего в `recommendation_summary` быть не должно

`recommendation_summary` не должен:

1. дублировать весь `plan_steps`
2. выглядеть как medical claim
3. обещать точную персональную физиологию
4. скрывать lower-confidence scenario
5. превращаться в длинный абзац из 5–7 предложений

---

#### 12.4. Draft structure

Для MVP `v1.2` `recommendation_summary` лучше держать как:

- одну короткую строку
или
- 1–2 коротких предложения

Draft content pattern:

- `На гонку длительностью X ориентир: около A г углеводов/ч, B л жидкости/ч`
- если sodium active:
  - `и около C мг натрия/ч`
- завершающий practical line:
  - `Начинай рано и держи ровный ритм напоминаний каждые Y мин`

---

#### 12.5. Поведение при lower confidence

Если хотя бы один из блоков даёт lower-confidence scenario,
`recommendation_summary` должен звучать осторожнее.

Примеры направления wording:
- `ориентир`
- `примерный план`
- `начни консервативно`
- `тестируй на тренировке`

Не использовать wording в стиле:
- `точно нужно`
- `оптимально для тебя`
- `персонально рассчитано с высокой точностью`

---

#### 12.6. Совместимость с текущим backend

В текущем `v1.1` backend возвращает:
- `plan.summary`
- `plan_steps`

Для `v1.2` paper-spec целевым полем считаем:
- `recommendation_summary`

Migration note:
- на этапе реализации допустимо временно держать compatibility alias:
  - `summary = recommendation_summary`

чтобы не ломать frontend слишком рано.

---

#### 12.7. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- practical output должен быть понятным и не маскировать неопределённость
- lower-confidence scenarios должны звучать осторожнее

**[MODEL-BASED]**
- само поле `recommendation_summary`
- его краткий формат
- конкретный шаблон phrasing
- compatibility alias `summary = recommendation_summary`

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный `key_takeaway`
- нужен ли later split на short summary и detailed summary

---

### 13. `plan_steps`

#### 13.1. Роль поля

`plan_steps` должен быть главным practical execution output.

Если `recommendation_summary` отвечает на вопрос
**“какой общий ориентир?”**,

то `plan_steps` отвечает на вопрос
**“что именно делать по ходу гонки?”**

---

#### 13.2. Базовый принцип

Для MVP `v1.2` `plan_steps` должен оставаться:

- простым,
- explainable,
- пригодным для прямого вывода во frontend,
- без лишней вложенной сложности.

Draft format for MVP:
- массив строк в логическом порядке выполнения

То есть пока **не обязателен** object-based step schema.

---

#### 13.3. Как `plan_steps` соотносится с master interval

Важно явно зафиксировать:

- `intake_interval_min` — это **master reminder rhythm**
- но отдельные шаги внутри `plan_steps` всё ещё могут ссылаться на:
  - `carb_interval_min`
  - `fluid_interval_min`
  - `sodium_interval_min`

То есть:
- один общий reminder rhythm нужен для assembly layer,
- но practical instructions по отдельным блокам могут сохранять свой block-specific interval.

Это не противоречие.

---

#### 13.4. Обязательные типы шагов

В нормальном assembled plan `plan_steps` должен включать:

1. **start step**
   - когда начинать питание / питьё

2. **carbs step**
   - interval
   - grams per intake

3. **fluid step**
   - interval
   - ml per intake

4. **sodium step**
   - только если `sodium_strategy_active = true`
   - mg per intake
   - обычно в rhythm, привязанном к fluid plan

5. **totals recap step**
   - total carbs
   - total fluid
   - total sodium, если active

---

#### 13.5. Логический порядок `plan_steps`

Draft order:

1. early start instruction
2. carbs execution step
3. fluid execution step
4. sodium execution step, если active
5. total recap step

Это хорошо стыкуется и с текущим `v1.1` backend pattern,
где уже есть summary + ordered plan steps.

---

#### 13.6. Что делать с sodium inactive

Если:
- `sodium_strategy_active = false`

то:
- отдельный sodium step не добавляется в `plan_steps`

Нельзя вставлять sodium step “для вида”,
если sodium block не активирован как practical strategy.

---

#### 13.7. Что пока не делаем

На текущем шаге `plan_steps` **ещё не должен**:

- превращаться в minute-by-minute full schedule
- учитывать aid stations
- учитывать carry capacity
- строить разные steps для каждого часа гонки
- собирать logistics layer trail/ultra execution

Это уже later execution layer,
а не core `PLAN` block MVP.

---

#### 13.8. Почему пока массив строк, а не objects

Для `v1.2` paper-spec разумно оставить MVP-формат:

- `plan_steps: string[]`

Почему:
- это совместимо с текущим frontend и backend shape
- это проще для первого переноса в `server.js`
- это не мешает later перейти к object-based schedule,
  если понадобится

Later extension допустима:
- `plan_steps_detailed`
или
- массив structured objects

Но сейчас это не обязательно.

---

#### 13.9. Draft example shape

Пример ожидаемого порядка без фиксации точного wording:

1. `Начни питание и питьё рано, не жди сильной жажды или упадка энергии.`
2. `Принимай углеводы каждые X мин: около Y г за приём.`
3. `Пей каждые Z мин: около N мл за приём.`
4. `Старайся получать около M мг натрия за приём.` — только если active
5. `Всего за гонку ориентир такой: ...`

Это пример формы,
а не окончательно зафиксированный production wording.

---

#### 13.10. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- practical plan должен переводить totals/hourly targets в исполнимые repeated actions
- sodium не должен показываться как обязательная часть плана, если strategy inactive

**[MODEL-BASED]**
- массив строк как MVP shape
- порядок шагов
- включение / исключение sodium step
- totals recap как отдельный финальный step
- coexistence master interval + block-specific intervals

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later object-based schema
- нужен ли later hourly schedule view
- нужно ли later разделять reminders и actions

---

### 14. Промежуточный вывод после этого шага

После фиксации разделов `12–13`
PLAN block уже будет иметь:

- роль assembly layer
- inputs / outputs
- master interval logic
- total intake count logic
- summary layer
- execution steps layer

То есть после этого PLAN block станет уже почти прямым каркасом
для будущего переноса в backend.

---

### 15. `when_to_start`

#### 15.1. Зачем нужно отдельное поле

PLAN block должен иметь отдельное поле:

- `when_to_start`

Причина:
- пользователю нужен не только hourly target,
- но и понятный ответ на вопрос:
  **когда начинать выполнять план на гонке.**

В `v1.1` это было только частью фиксированного текста.
В `v1.2` это должно стать отдельным правилом plan layer.

---

#### 15.2. Главный принцип

Для MVP `v1.2` используем **early-start principle**:

- не ждать сильной жажды,
- не ждать упадка энергии,
- не откладывать первые intake actions слишком поздно.

Draft rule:
- если assembled plan активен,
  `when_to_start = "start_early"`

Human meaning:
- начать питание / питьё **в первые 15–30 минут** гонки,
  а не “когда станет тяжело”.

---

#### 15.3. Почему early start — default

Этот принцип нужен потому, что:

- practical race fueling обычно работает лучше как ранний и ровный ритм,
- поздний старт хуже сочетается с дробным intake pattern,
- plan layer должен поощрять стабильное выполнение,
  а не late catch-up behavior.

---

#### 15.4. Что пока не делаем

На текущем шаге не делаем сложную персонализацию `when_to_start` по:

- `race_type`
- `fuel_format`
- `gi_tolerance_level`
- `temperature_c`

Это можно уточнять later,
но для MVP `v1.2` early-start default уже полезнее,
чем отсутствие отдельного правила.

---

#### 15.5. Null / inactive behavior

Если assembled plan по какой-то причине incomplete,
то:
- `when_to_start = null`

Если plan собран нормально,
то:
- `when_to_start` должен возвращаться явно,
  а не только скрываться внутри текста одного из steps.

---

#### 15.6. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- practical fueling лучше начинать рано, а не после выраженной усталости / жажды
- repeated intake strategy лучше сочетается с ранним стартом, чем с поздним крупным догоном

**[MODEL-BASED]**
- отдельное поле `when_to_start`
- default wording `start_early`
- operational трактовка как `первые 15–30 минут`

**[HYPOTHESIS / NEEDS CHECK]**
- нужно ли later делать разные `when_to_start` profiles для:
  - short duration
  - hot races
  - low GI tolerance
  - drink_only scenarios

---

### 16. `missed_intake_fallback`

#### 16.1. Зачем нужен отдельный fallback

PLAN block должен иметь отдельное правило:

- `missed_intake_fallback`

Причина:
- на реальной гонке пользователь нередко пропускает intake,
- practical plan без fallback выглядит хрупким,
- backend должен давать не только “идеальный сценарий”,
  но и базовое правило восстановления ритма.

---

#### 16.2. Главный принцип fallback

Для MVP `v1.2` используем **resume-don’t-overcorrect principle**:

- если один intake пропущен,
  не пытаться агрессивно “догнать всё сразу”;
- вместо этого:
  - вернуться к следующему planned interval,
  - при необходимости частично распределить недобор мягко,
    а не одним большим болюсом.

Коротко:
**не делать large catch-up bolus по carbs / fluid / sodium.**

---

#### 16.3. Почему не делаем aggressive catch-up

Это нужно потому, что:

- large catch-up по углеводам может повышать GI risk,
- large catch-up по жидкости может ухудшать practical tolerability,
- sodium сам по себе не должен превращаться в “аварийный болюс”,
- plan layer должен быть safety-first,
  а не mathematically obsessive.

---

#### 16.4. Draft fallback behavior

Если пользователь пропустил один intake,
то базовое правило такое:

1. **не удваивать** следующий intake автоматически;
2. **вернуться к следующему planned interval**;
3. если race context ещё длинный и tolerability позволяет,
   можно **частично** распределить недобор на следующие 1–2 intake slots;
4. если контекст и так fragile,
   лучше просто вернуться к обычному ритму без aggressive compensation.

---

#### 16.5. Когда fallback должен быть особенно консервативным

`missed_intake_fallback` должен быть осторожнее, если:

- `gi_tolerance_level = low`
- `fuel_format = drink_only`
- hydration confidence низкий
- sodium confidence низкий
- hot / long race context
- assembled plan и так near upper limits

В таких сценариях preferred rule:
- **resume schedule without catch-up**

---

#### 16.6. Что пока не делаем

На текущем шаге не фиксируем:

- отдельный fallback по каждому `fuel_format`
- отдельный fallback для aid stations
- minute-by-minute catch-up algorithm
- exact percentage “сколько можно мягко догнать позже”

Это уже later execution detail,
а не обязательный MVP core spec.

---

#### 16.7. Output shape

Для MVP `v1.2` достаточно считать,
что `missed_intake_fallback` — это:

- короткое structured field
или
- short backend phrase

Draft semantic value:
- `resume_next_interval_no_double_dose`

Human meaning:
- `Если пропустил один приём, не пытайся резко догнать всё сразу; вернись к следующему интервалу и продолжай план.`

---

#### 16.8. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- aggressive catch-up может ухудшать practical tolerability
- high-carb / high-fluid execution требует осторожности, а не больших аварийных доз

**[MODEL-BASED]**
- отдельное поле `missed_intake_fallback`
- правило `resume_next_interval_no_double_dose`
- идея мягкого частичного перераспределения на 1–2 следующих intake slots

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный fallback по `gels` / `drink_only` / `combo`
- нужно ли later задавать numeric catch-up limits
- нужен ли later different fallback for late-race missed intake

---

### 17. Промежуточный вывод после этого шага

После фиксации разделов `15–16`
PLAN block уже будет покрывать:

- role and boundaries
- inputs / outputs
- master interval
- total intake count
- recommendation summary
- plan steps
- when to start
- missed-intake fallback

То есть после этого у PLAN block уже будет почти весь минимальный MVP-каркас
для будущего переноса в backend.

---

### 18. Role of `fuel_format` in PLAN generation

#### 18.1. Почему это нужно фиксировать отдельно

В `v1.2` `fuel_format` должен влиять не только на carbs logic,
но и на то,
**как assembled plan выглядит в исполнении.**

Причина:
- одинаковый hourly carbs target может быть
  по-разному выполним при:
  - `drink_only`
  - `gels`
  - `combo`
- practical plan должен учитывать не только target number,
  но и способ доставки углеводов.

Ключевой принцип:
**`fuel_format` — это не декоративное поле, а реальный driver plan generation.**

---

#### 18.2. Что именно должен менять `fuel_format`

Внутри PLAN block `fuel_format` должен влиять на:

1. wording `recommendation_summary`
2. структуру `plan_steps`
3. practical feasibility tone
4. приоритет между carb rhythm и fluid rhythm
5. осторожность fallback / execution language
6. interpretation of gel-equivalent style guidance

При этом:
- `fuel_format` не должен заново пересчитывать hydration math внутри PLAN block;
- он должен менять именно **упаковку и исполнение плана**.

---

#### 18.3. `drink_only`

Если:
- `fuel_format = drink_only`

то PLAN block должен исходить из того,
что carbs delivery и fluid delivery сильно связаны между собой.

Operational consequences:
1. plan должен звучать более консервативно,
   если carbs target выглядит трудно выполнимым только через напиток;
2. fluid rhythm становится главным execution rhythm;
3. carbs step и fluid step могут быть тесно связаны по смыслу;
4. plan не должен делать вид,
   что high-carb strategy через drink-only всегда одинаково проста.

Practical wording direction:
- `начни консервативно`
- `держи ровный ритм питья`
- `если пить такой объём тяжело, не пытайся резко догнать позже`

---

#### 18.4. `gels`

Если:
- `fuel_format = gels`

то PLAN block должен исходить из того,
что carbs delivery идёт в основном через discrete carb doses,
а hydration остаётся отдельным слоем.

Operational consequences:
1. carbs step должен быть явно отдельным и заметным;
2. fluid step не должен смешиваться с carb step “для вида”;
3. plan может проще объяснять dose-per-intake по углеводам;
4. hydration rhythm остаётся самостоятельным,
   даже если master reminder interval общий.

Practical meaning:
- гели = более дискретный carbs execution pattern,
- питьё = отдельная линия выполнения плана.

---

#### 18.5. `combo`

Если:
- `fuel_format = combo`

то PLAN block должен считать это
самым гибким practical execution scenario из трёх.

Operational consequences:
1. plan может звучать менее жёстко по feasibility;
2. carbs delivery можно распределять между:
   - drink
   - gels
3. assembled plan может выглядеть наиболее выполнимым
   при тех же target values;
4. combo не должен автоматически означать “максимально агрессивный план”,
   но обычно даёт больше practical flexibility.

Practical meaning:
- `combo` улучшает выполнимость,
  но не отменяет ceilings, warnings и confidence limits.

---

#### 18.6. Как это должно отражаться в `recommendation_summary`

`recommendation_summary` должен учитывать `fuel_format` неявно или явно.

Примеры направления:
- для `drink_only`:
  - больше cautious feasibility wording
- для `gels`:
  - больший акцент на carb doses
- для `combo`:
  - больший акцент на flexibility и practical execution

Но summary не должен превращаться
в длинное объяснение всей логики `fuel_format`.

---

#### 18.7. Как это должно отражаться в `plan_steps`

`plan_steps` должен реально отличаться по структуре:

##### для `drink_only`
- carbs и fluid steps могут звучать тесно связанно;
- основной акцент — на стабильный rhythm drinking execution.

##### для `gels`
- carbs step должен быть отдельным и явным;
- fluid step должен оставаться отдельным.

##### для `combo`
- steps могут показывать,
  что часть carbs можно закрывать напитком,
  а часть — гелями;
- wording может быть самым practical и гибким из трёх сценариев.

---

#### 18.8. Роль gel equivalent внутри PLAN block

Если в assembled plan используется `gel equivalent`
или похожий translator,
то в `v1.2` он должен трактоваться так:

- это **упрощённый practical translator**,
- а не физиологическая истина,
- и не единственный допустимый способ исполнения carb plan.

Operational rule:
- `gel equivalent` можно использовать,
  чтобы помочь пользователю быстро понять масштаб carb target;
- но PLAN block не должен делать вид,
  что весь carbs plan обязан исполняться только через эквивалент в гелях.

Особенно важно:
- для `drink_only` gel equivalent может быть только приблизительным ориентиром;
- для `combo` он не должен скрывать,
  что carbs могут приходить из нескольких источников.

---

#### 18.9. Что не делаем на этом шаге

На этом шаге **не фиксируем**:

- exact grams from drink vs grams from gels
- exact concentration model внутри PLAN block
- exact distribution percentages for `combo`
- object schema для источника каждого intake
- detailed logistics by aid stations / carrying capacity
- exact formula для gel equivalent translator

Это уже later execution detail,
а не обязательный MVP-rule layer.

---

#### 18.10. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- способ доставки углеводов влияет на practical feasibility
- high intake targets имеют смысл только при подходящем формате и tolerability
- drink-only execution обычно требует более осторожной practical интерпретации

**[MODEL-BASED]**
- exact plan-generation rules для:
  - `drink_only`
  - `gels`
  - `combo`
- степень “гибкости” у `combo`
- wording differences в summary / steps
- приоритет fluid-led execution для `drink_only`
- трактовка gel equivalent как practical translator

**[HYPOTHESIS / NEEDS CHECK]**
- нужно ли later фиксировать minimum / maximum share from drink in `combo`
- нужен ли later отдельный field:
  - `carb_source_strategy`
- нужно ли later сильнее различать `gels` и `chews` / `bars`

---

### 19. Промежуточный вывод после этого шага

После фиксации роли `fuel_format`
PLAN block будет уже учитывать:

- не только numeric targets,
- но и способ их практического исполнения.

Это важно,
потому что assembled plan должен быть
не просто “математически собранным”,
а реально выполнимым для разных сценариев питания.

---

### 20. Role of `gi_tolerance_level` in PLAN generation

#### 20.1. Почему это нужно фиксировать отдельно

В `v1.2` `gi_tolerance_level` должен влиять не только на carbs math,
но и на то,
**насколько агрессивно или консервативно assembled plan выглядит в исполнении.**

Причина:
- одинаковый carbs/hour target может быть
  по-разному выполним при разной переносимости ЖКТ;
- practical plan должен учитывать
  не только число `g/h`,
  но и tolerability risk;
- GI tolerance в этой версии —
  это не cosmetic field,
  а real safety modulator.

Ключевой принцип:
**`gi_tolerance_level` должен менять plan execution tone, dose practicality и confidence language.**

---

#### 20.2. Что именно должен менять `gi_tolerance_level`

Внутри PLAN block `gi_tolerance_level` должен влиять на:

1. wording `recommendation_summary`
2. tone и осторожность `plan_steps`
3. tolerability emphasis
4. отношение к missed-intake catch-up behavior
5. confidence language плана

При этом:
- `gi_tolerance_level` не должен заново пересчитывать `carbs_per_hour_g` внутри PLAN block;
- PLAN block не должен придумывать новую отдельную GI-math модель поверх carbs block;
- он должен менять именно **исполнение и подачу плана**.

---

#### 20.3. Связь с upstream carbs block

Важно явно зафиксировать:

- основная GI-логика по:
  - ceiling
  - dose per intake
  - preferred interval

уже задаётся в `CARBS` block;

- PLAN block не пересчитывает эти значения заново,
  а использует их для practical execution wording.

Operational meaning:
- если upstream carbs block уже выбрал
  более осторожную дозу и интервал для `low`,
  то PLAN block должен отражать это
  более осторожным execution language;
- если upstream carbs block допускает
  более высокий ceiling для `high`,
  PLAN block может звучать менее ограничивающе,
  но без ложной агрессивности.

---

#### 20.4. `low`

Если:
- `gi_tolerance_level = low`

то PLAN block должен исходить из того,
что tolerability risk выше,
а plan execution должен быть заметно осторожнее.

Operational consequences:
1. wording summary должен быть более консервативным;
2. в `plan_steps` должен быть акцент на smaller / steadier intake behavior;
3. missed-intake fallback должен трактоваться особенно осторожно;
4. plan не должен звучать как aggressive fueling prescription;
5. при upper-end targets warning language должен усиливаться.

Practical wording direction:
- `начни консервативно`
- `тестируй на тренировке`
- `не пытайся резко догонять пропущенное`
- `держи ровный ритм небольших приёмов`

---

#### 20.5. `medium`

Если:
- `gi_tolerance_level = medium`

то PLAN block должен считать это
рабочим default scenario.

Operational consequences:
1. summary может использовать нейтральный practical wording;
2. `plan_steps` не требуют extra-conservative language по умолчанию;
3. fallback остаётся standard,
   без лишней агрессии и без избыточной осторожности.

Practical meaning:
- `medium` = базовый MVP-сценарий,
  от которого отклонения вверх/вниз должны быть explainable.

---

#### 20.6. `high`

Если:
- `gi_tolerance_level = high`

то PLAN block может звучать
менее ограничивающе по practical execution,
но не должен автоматически становиться “агрессивным”.

Operational consequences:
1. summary может звучать увереннее,
   если остальные блоки тоже не конфликтуют;
2. plan_steps могут допускать
   более амбициозный rhythm without extra caution wording;
3. high GI tolerance не отменяет:
   - ceilings
   - fuel_format limitations
   - hydration limitations
   - confidence limits других блоков

Ключевое правило:
- `high` = **разрешение двигаться выше при подходящих условиях**,
  а не обязанность делать plan aggressive.

---

#### 20.7. Как это должно отражаться в `recommendation_summary`

`recommendation_summary` должен учитывать `gi_tolerance_level`
через tone and caution level.

Направление:

- `low`:
  - больше cautious wording
  - больше акцента на testing / conservative execution

- `medium`:
  - нейтральный рабочий тон

- `high`:
  - можно менее осторожный тон,
    но без ложной сверхточности и без implied “90 г/ч всем”

---

#### 20.8. Как это должно отражаться в `plan_steps`

`plan_steps` должен реально различаться по language:

##### для `low`
- акцент на smaller / steadier doses
- более осторожный fallback language
- больше tolerability emphasis

##### для `medium`
- обычный practical execution wording

##### для `high`
- можно меньше ограничивающего wording,
  если:
  - `fuel_format` подходит
  - carbs block не near ceiling
  - confidence не снижен другими блоками

Важно:
- даже при `high` шаги не должны обещать,
  что high target обязательно будет легко переноситься.

---

#### 20.9. Связь с confidence

`gi_tolerance_level` должен влиять
не только на warnings,
но и на то,
как plan звучит по уверенности.

Operational principle:
- lower tolerability scenarios
  не должны получать language,
  похожий на “stable high-confidence aggressive plan”.

То есть:
- `low` чаще требует softer language;
- `medium` = default;
- `high` может поддерживать stronger plan language,
  но только если другие blocks это позволяют.

---

#### 20.10. Что не делаем на этом шаге

На этом шаге **не фиксируем**:

- отдельные numeric dose tables внутри PLAN block
- отдельный GI symptom questionnaire
- отдельные GI-specific medical red flags
- exact confidence score formula от `gi_tolerance_level`
- exact wording library для каждого состояния

Это already covered partly upstream
или относится к later integration layer.

---

#### 20.11. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- GI tolerance / gut training реально влияют на переносимость race fueling
- high-carb strategies требуют большей tolerability readiness
- low tolerability должна вести к более осторожной practical подаче плана

**[MODEL-BASED]**
- exact variation of wording by `low / medium / high`
- связь GI tolerance с tone of `recommendation_summary`
- связь GI tolerance с execution language в `plan_steps`
- влияние GI tolerance на fallback caution level
- правило, что PLAN layer наследует GI dosing logic из carbs block, а не создаёт новую math-модель

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный field для gut training history
- нужна ли later более детальная GI-specific confidence model
- нужен ли later отдельный plan modifier для prior GI symptoms

---

### 21. Промежуточный вывод после этого шага

После фиксации роли `gi_tolerance_level`
PLAN block будет учитывать:

- не только numeric targets,
- но и реальную tolerability side of execution.

Это важно,
потому что assembled plan должен быть
не просто математически собранным,
а выполнимым без ложной агрессивности
в low-tolerance scenarios.

---

### 22. Role of `effort_level`, `race_type` and `elevation_gain_m` in PLAN generation

#### 22.1. Почему эти поля нужно фиксировать в PLAN block

В `v1.2` эти поля не должны превращаться
в новую псевдоточную math-модель внутри PLAN block.

Но они должны влиять на то,
**как assembled plan подаётся и исполняется на практике**.

Главный принцип:
- `effort_level`
- `race_type`
- `elevation_gain_m`

это **secondary execution/context modifiers**,
а не главные drivers итогового плана.

То есть:
- они не должны заново считать `carbs_per_hour_g`
- они не должны заново считать `fluid_per_hour_l`
- они не должны заново считать `sodium_per_hour_mg`

Но они должны влиять на:
- tone of `recommendation_summary`
- execution language в `plan_steps`
- practical caution level
- consistency / simplicity emphasis
- warning-ready interpretation later

---

#### 22.2. Общий operational principle

PLAN block должен использовать эти поля так:

1. сначала взять уже готовые outputs из:
   - CARBS
   - HYDRATION
   - SODIUM

2. потом использовать:
   - `effort_level`
   - `race_type`
   - `elevation_gain_m`

как **execution-context layer**

3. эта execution-context layer может:
   - усиливать осторожность
   - усиливать emphasis on consistency
   - усиливать practicality language
   - усиливать reminders about terrain / long-race execution

4. но не должна:
   - пробивать ceilings
   - обходить caps
   - делать вид,
     что у нас есть точная физиологическая формула “сложности гонки”

---

#### 22.3. Правило no double counting

Важно явно зафиксировать:

- `effort_level`, `race_type` и `elevation_gain_m`
  уже могут участвовать upstream
  в выборе target / zone / contextual adjustment;

- PLAN block не должен второй раз
  сдвигать из-за них:
  - `carbs_per_hour_g`
  - `fluid_per_hour_l`
  - `sodium_per_hour_mg`

Operational meaning:
- если upstream block уже учёл эти поля,
  PLAN block использует это
  только для practical wording и execution framing;
- PLAN block не создаёт второй скрытый слой
  перерасчёта тех же modifiers.

---

#### 22.4. Role of `effort_level`

В текущем `v1.2` carbs-spec для `effort_level`
использует рабочие значения:

- `easy`
- `steady`
- `race`

PLAN block должен использовать те же значения
для execution tone.

##### `easy`
Если:
- `effort_level = easy`

то plan должен звучать более спокойно и консервативно.

Operational consequences:
- summary может быть мягче по тону;
- steps могут сильнее подчёркивать steady execution;
- missed-intake fallback лучше трактовать особенно без агрессии;
- plan не должен выглядеть как upper-end aggressive fueling script.

##### `steady`
Если:
- `effort_level = steady`

то это нейтральный practical scenario.

Operational consequences:
- normal working tone;
- без дополнительного conservative shift;
- без дополнительного aggressive shift.

##### `race`
Если:
- `effort_level = race`

то plan может звучать чуть более собранно
и performance-oriented,
но без ложной жёсткости.

Operational consequences:
- summary может быть чуть увереннее,
  если другие блоки не конфликтуют;
- steps могут меньше акцентировать conservative language;
- но `race` не отменяет:
  - GI limits
  - fuel-format limits
  - hydration confidence limits
  - sodium confidence limits

Главное правило:
- `effort_level` влияет на **execution tone**,
  а не создаёт новый hidden engine.

---

#### 22.5. Role of `race_type`

`race_type` в PLAN block нужен
как practical execution context.

Рабочие значения:
- `road`
- `trail`
- `ultra`

##### `road`
- baseline scenario;
- neutral execution context;
- без extra complexity language по умолчанию.

##### `trail`
- plan должен сильнее учитывать execution complexity;
- wording может чуть больше подчёркивать,
  что важно не выпадать из ритма на рельефе и техничных участках;
- но `trail` сам по себе не должен автоматически делать plan “более высокий по дозам”.

##### `ultra`
- plan должен звучать более осторожно
  и больше подчёркивать устойчивость выполнения;
- ultra не должен автоматически означать
  “ещё более агрессивный intake”;
- practical emphasis:
  - simple rhythm
  - early start
  - avoiding collapses in consistency

Главное правило:
- `race_type` должен менять **execution context**,
  а не притворяться точной физиологической осью.

---

#### 22.6. Role of `elevation_gain_m`

`elevation_gain_m` в PLAN block
должен использоваться прежде всего как:

- execution complexity field
- warning/context field

а не как прямой numeric driver plan targets.

Operational consequences:
1. большой набор может усиливать wording про:
   - сложность удержания ритма
   - важность не пропускать intake repeatedly
   - важность simple / repeatable execution
2. на `trail/ultra` высокий `elevation_gain_m`
   может усиливать practical caution language;
3. но `elevation_gain_m` не должен сам по себе:
   - резко поднимать carbs target
   - резко поднимать fluid target
   - резко менять sodium target внутри PLAN block

Главный принцип:
**elevation усиливает execution difficulty,
но не должен создавать fake precision in plan math.**

---

#### 22.7. Как это должно отражаться в `recommendation_summary`

`recommendation_summary` должен учитывать эти поля
через общий tone:

- `easy` → спокойнее / консервативнее
- `steady` → нейтрально
- `race` → чуть собраннее, если остальные блоки позволяют

- `road` → baseline
- `trail` → чуть больше акцента на consistency under terrain
- `ultra` → больше акцента на устойчивость и простоту выполнения

- high `elevation_gain_m` → больше акцента на
  repeatable execution и недопустимость хаотичного питания

Но:
- summary не должен превращаться
  в длинный комментарий про профиль трассы.

---

#### 22.8. Как это должно отражаться в `plan_steps`

`plan_steps` может учитывать эти поля
через wording and execution emphasis.

Примеры направления:

- для `trail` / `ultra`:
  - сильнее подчёркивать необходимость
    заранее держать ритм и не ждать “удобного момента”

- для high `elevation_gain_m`:
  - сильнее подчёркивать simple repeatable strategy,
    а не сложную многослойную схему

- для `easy`:
  - более спокойный execution wording

- для `race`:
  - чуть более прямой performance-oriented wording,
    но без ложной агрессии

Важно:
- это language/context layer,
  а не новый dosing algorithm.

---

#### 22.9. Что не делаем на этом шаге

На этом шаге **не фиксируем**:

- отдельную numeric formula для `effort_level` inside PLAN
- отдельную numeric formula для `race_type` inside PLAN
- отдельный direct math modifier от `elevation_gain_m`
- terrain-specific logistics
- aid-station logic
- carry-capacity logic
- full trail-specific schedule engine

Это later execution detail
или warning/confidence integration layer.

---

#### 22.10. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- effort, race context и рельеф влияют на practical execution difficulty
- такие поля полезнее использовать как context modifiers,
  чем как псевдоточные физиологические драйверы
- high-complexity scenarios требуют более осторожного result language

**[MODEL-BASED]**
- exact interpretation of:
  - `easy`
  - `steady`
  - `race`
- exact wording shifts for:
  - `road`
  - `trail`
  - `ultra`
- вынесение `elevation_gain_m` в execution/context role внутри PLAN
- усиление consistency language для trail/ultra/high elevation scenarios
- правило no double counting внутри PLAN layer

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный trail-specific execution mode
- нужен ли later very small direct role of elevation in plan timing
- нужен ли later split between:
  - race execution complexity
  - terrain logistics complexity

---

### 23. Промежуточный вывод после этого шага

После фиксации роли:

- `effort_level`
- `race_type`
- `elevation_gain_m`

PLAN block будет учитывать
не только targets и main feasibility modifiers,
но и context of execution.

Это важно,
потому что practical race plan должен быть
не просто собранным по цифрам,
а ещё и реалистичным по способу выполнения в разных типах гонки.

---

### 24. Role of `weight_kg` and `distance_km` in PLAN generation

#### 24.1. Почему эти поля нужно зафиксировать отдельно

В `v1.2` важно не оставлять поля
в статусе “есть в продукте, но непонятно зачем”.

Для PLAN block это особенно важно для:

- `weight_kg`
- `distance_km`

Причина:
- они могут быть полезны,
- но их нельзя превращать
  в псевдоточные drivers assembled plan,
  если для этого нет достаточной базы.

Главный принцип:
- `weight_kg` и `distance_km` внутри PLAN block —
  это прежде всего **context / sanity / safety-support fields**,
  а не главные drivers plan targets.

---

#### 24.2. Общий operational principle

PLAN block должен использовать эти поля так:

1. сначала взять уже собранные outputs из:
   - CARBS
   - HYDRATION
   - SODIUM

2. потом использовать:
   - `weight_kg`
   - `distance_km`

как **supporting context layer**

3. эта supporting context layer может:
   - помогать wording
   - помогать plausibility interpretation
   - помогать warning generation later
   - помогать practical summary
   - помогать distance-duration sanity checks

4. но не должна:
   - заново пересчитывать `carbs_per_hour_g`
   - заново пересчитывать `fluid_per_hour_l`
   - заново пересчитывать `sodium_per_hour_mg`
   - создавать видимость “более научной точности”, чем реально есть

---

#### 24.3. Role of `weight_kg`

На текущем этапе `weight_kg` не должен становиться
главным driver assembled plan.

Это особенно важно,
потому что в evidence / expert frame прямо зафиксировано:
- `weight_kg` нельзя делать главным driver within-race carbs/hour по умолчанию;
- его более честная роль —
  supporting safety / hydration-context input.

Для PLAN block operational meaning такой:

- `weight_kg` не должен менять готовый carbs target;
- `weight_kg` не должен создавать новый скрытый plan modifier;
- `weight_kg` может использоваться как
  слабый contextual / safety input,
  если это нужно later для:
  - warnings
  - plausibility language
  - hydration interpretation
  - hydration fallback explanation

Но на текущем шаге:
- не делаем из массы тела главный объяснитель плана.

---

#### 24.4. Role of `distance_km`

`distance_km` в PLAN block полезен,
но его роль должна быть ограниченной и честной.

Evidence-based operational meaning:
- `distance_km` не должен подменять `duration_min`
  как главный driver within-race fueling;
- `distance_km` полезнее использовать для:
  - context
  - cross-check
  - sanity check
  - wording
  - warning interpretation
  - distance-duration plausibility

То есть:
- длительность отвечает на вопрос
  **как долго длится нагрузка**;
- дистанция помогает понять
  **насколько реалистично выглядят контекст и pacing assumptions**.

---

#### 24.5. Distance-duration plausibility role

Важно явно зафиксировать:

- `distance_km` особенно полезен
  не как metabolic driver,
  а как **plausibility companion** к `duration_min`.

Operational meaning:
- если `distance_km` и `duration_min` вместе дают
  очень необычный ожидаемый средний темп / скорость,
  это должно усиливать:
  - sanity interpretation
  - later warnings
  - confidence caution language

Но:
- даже при странном сочетании
  `distance_km + duration_min`
  PLAN block не должен автоматически
  пересчитывать carbs / fluid / sodium math
  через distance itself.

---

#### 24.6. Правило no pseudo-precision

Важно явно зафиксировать:

- `weight_kg` и `distance_km`
  не должны создавать новую hidden precision layer внутри PLAN block.

Недопустимый смысл:

- `вес высокий → значит план автоматически должен быть выше`
- `дистанция длинная → значит carbs/hour автоматически выше,
  даже если duration уже это отражает`
- `distance_km` как замена duration-driven logic
- `weight_kg` как faux-scientific multiplier для assembled plan

Допустимый смысл:

- warnings
- context
- plausibility checks
- short explanatory language
- hydration-related safety/context support

---

#### 24.7. Как это должно отражаться в `recommendation_summary`

`recommendation_summary` может использовать эти поля
только мягко и контекстно.

Допустимые примеры направления:

- `для такой длительности и контекста гонки`
- `учитывая длинный ожидаемый сценарий`
- `ориентир стоит проверять на тренировке,
  особенно если расчёт строится на приближённой модели`
- `если ожидаемая длительность и дистанция сильно расходятся по реалистичности,
  план стоит трактовать осторожнее`

Но summary не должен:
- ссылаться на `weight_kg` как на главный драйвер carbs plan;
- звучать так,
  будто distance сам по себе пересчитал физиологию.

---

#### 24.8. Как это должно отражаться в `plan_steps`

`plan_steps` не должен отдельно перестраиваться
по `weight_kg` или `distance_km`
как по сильным modifiers.

Допустимый смысл:
- distance может later поддерживать
  sanity / logistics wording;
- distance + duration могут later усиливать plausibility warning language;
- weight может later поддерживать
  safety/context wording в hydration-related cases.

Но на текущем этапе:
- ни `weight_kg`,
- ни `distance_km`
не должны создавать новый dosing algorithm внутри PLAN block.

---

#### 24.9. Что не делаем на этом шаге

На этом шаге **не фиксируем**:

- прямую numeric role `weight_kg` в PLAN math
- direct multiplier from `weight_kg`
- direct multiplier from `distance_km`
- logistics model by checkpoints
- pace model from distance + duration как отдельный driver math
- carry-capacity logic
- aid-station logic

Это later validation / execution / warning layer,
а не core PLAN assembly step.

---

#### 24.10. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- duration важнее distance как driver within-race fueling
- `weight_kg` не должен по умолчанию становиться главным driver within-race carbs/hour
- `distance_km` полезнее как context / plausibility field, а не как главный metabolic driver

**[MODEL-BASED]**
- вынесение `weight_kg` в supporting context / safety role внутри PLAN
- вынесение `distance_km` в context / sanity / warning role внутри PLAN
- отдельная роль distance-duration plausibility
- правило no pseudo-precision для этих двух полей
- ограничение их роли в summary / steps

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later более явный distance-duration plausibility layer
- нужен ли later небольшой contextual role of weight in hydration wording
- нужен ли later отдельный logistics layer for long trail/ultra plans

---

### 25. Промежуточный вывод после этого шага

После фиксации роли:

- `weight_kg`
- `distance_km`

PLAN block будет честнее
относиться к полям,
которые легко сделать “умными на вид”,
но трудно обосновать как сильные drivers.

Это важно,
потому что `v1.2` должен не только улучшать план,
но и убирать ложную научность там,
где поле лучше оставить в context / warning / plausibility role.

---

### 26. Role of `temperature_c`, `humidity_pct`, `sweat_rate_lph` and `sodium_loss_profile` in PLAN generation

#### 26.1. Почему эти поля нужно фиксировать в PLAN block отдельно

На этапе assembled plan важно честно зафиксировать,
что эти поля уже влияют upstream на hydration / sodium logic,
но в PLAN block они тоже должны менять
**tone, confidence language и practical execution framing**.

Главный принцип:
- `temperature_c`
- `humidity_pct`
- `sweat_rate_lph`
- `sodium_loss_profile`

внутри PLAN block — это прежде всего
**environmental / personalization / confidence-context fields**,
а не новая скрытая math-модель.

---

#### 26.2. Правило no double counting

Важно явно зафиксировать:

- `temperature_c`, `humidity_pct` и `sweat_rate_lph`
  уже участвуют upstream в hydration logic;
- `sodium_loss_profile`
  уже участвует upstream в sodium logic;
- PLAN block не должен второй раз пересчитывать из-за них:
  - `fluid_per_hour_l`
  - `fluid_total_l`
  - `sodium_per_hour_mg`
  - `sodium_total_mg`

Operational meaning:
- PLAN block использует эти поля
  для practical wording, confidence framing и execution emphasis;
- но не создаёт второй скрытый слой math.

---

#### 26.3. Role of `sweat_rate_lph`

`sweat_rate_lph` в PLAN block нужен прежде всего
для честной интерпретации hydration branch quality.

Если hydration собран через **Branch A — known sweat rate**:
- plan может звучать более персонализированно;
- hydration language может быть спокойнее;
- confidence tone может быть выше,
  чем у fallback scenario;
- но без ложной сверхточности.

Если hydration собран через **Branch B — fallback without sweat rate**:
- plan должен звучать осторожнее;
- в hot / long context это должно быть особенно заметно;
- можно честно усиливать wording про estimate / approximation;
- fallback не должен маскироваться
  под полноценный personalized hydration plan.

Главный смысл:
- `sweat_rate_lph` в PLAN layer нужен
  не как новый driver,
  а как **branch-quality / confidence signal**.

---

#### 26.4. Role of `temperature_c`

`temperature_c` в PLAN block должен использоваться
как главный environmental demandingness field.

Operational meaning:
- чем жарче контекст,
  тем сильнее plan language должен:
  - подчёркивать importance of steady drinking execution,
  - усиливать hydration caution,
  - усиливать heat-stress awareness,
  - делать result language менее беспечным.

Но:
- `temperature_c` не должен внутри PLAN block
  заново пересчитывать fluid math;
- жара не должна превращаться
  в оправдание для агрессивного universal plan wording.

---

#### 26.5. Role of `humidity_pct`

`humidity_pct` в PLAN block должен использоваться
как **secondary heat-stress context field**.

Operational meaning:
- если влажность известна и высокая,
  plan language может сильнее подчёркивать
  demanding hot / humid execution context;
- если `humidity_pct` неизвестен,
  plan не должен ломаться,
  но confidence tone может быть немного осторожнее,
  чем в том же сценарии с известной влажностью;
- влажность должна **уточнять** context language,
  а не конкурировать с температурой
  как отдельный главный environmental driver.

Главный принцип:
- температура остаётся главной heat axis,
- влажность помогает точнее интерпретировать heat-stress context,
  но не строит новую hidden fluid formula внутри PLAN block.

---

#### 26.6. Role of `sodium_loss_profile`

`sodium_loss_profile` в PLAN block
должен использоваться прежде всего
для sodium-specific wording and confidence framing.

##### Если `sodium_strategy_active = false`
- sodium profile не должен artificially раздувать plan language;
- sodium step может отсутствовать;
- summary не должен выглядеть
  как будто sodium всё равно является главным execution axis.

##### Если `sodium_strategy_active = true`
- `low / medium / high / unknown`
  должны реально менять tone of sodium guidance.

Operational meaning by profile:

- `low`
  - sodium wording может быть более спокойным;
  - без unnecessary aggressive sodium tone.

- `medium`
  - neutral practical sodium wording.

- `high`
  - sodium wording может быть более заметным,
    но без medical-claim style.

- `unknown`
  - plan обязан звучать осторожнее;
  - `unknown` нельзя маскировать под `medium`;
  - sodium guidance не должна выглядеть
    как fully personalized sodium prescription.

---

#### 26.7. Связь sodium wording с hydration confidence

Важно явно зафиксировать:

- sodium plan в `v1.2` строится поверх fluid plan;
- поэтому sodium wording inside PLAN block
  не может звучать увереннее,
  чем hydration branch underneath.

Operational meaning:
- если hydration branch = fallback lower-confidence scenario,
  sodium line тоже должна звучать осторожнее;
- если `sodium_loss_profile = unknown`,
  осторожность усиливается ещё сильнее;
- even with `high` sodium profile,
  sodium guidance не должна звучать
  как high-confidence personalized prescription,
  если hydration foundation itself uncertain.

---

#### 26.8. Как это должно отражаться в `recommendation_summary`

`recommendation_summary` должен учитывать эти поля
через общий tone and confidence language.

Направление:

- known `sweat_rate_lph`
  - можно чуть спокойнее hydration wording

- no valid `sweat_rate_lph`
  - больше estimate / cautious language

- hot / humid scenario
  - больше акцента на hydration execution difficulty

- `sodium_loss_profile = unknown`
  - sodium line должна звучать осторожнее,
    если sodium strategy active

Но:
- summary не должен превращаться
  в длинный weather report
  или в псевдоперсональный physiological claim.

---

#### 26.9. Как это должно отражаться в `plan_steps`

`plan_steps` может учитывать эти поля
через execution emphasis:

- hot / humid context
  - сильнее подчёркивать стабильный drinking rhythm
  - не откладывать питьё слишком поздно

- fallback hydration branch
  - language должен быть осторожнее,
    чем при known sweat rate

- `sodium_loss_profile = unknown`
  - sodium step, если он есть,
    должен звучать как ориентир,
    а не как точная персональная prescription

- `sodium_loss_profile = high`
  - sodium step может быть более заметным,
    но без ложной уверенности

Важно:
- это context / wording layer,
  а не новый sodium / fluid dosing algorithm.

---

#### 26.10. Что не делаем на этом шаге

На этом шаге **не фиксируем**:

- новые numeric weather modifiers inside PLAN
- новую humidity formula inside PLAN
- новую sweat-rate math inside PLAN
- отдельный sodium algorithm by profile inside PLAN
- отдельный heat score
- отдельный medical-risk score

Это уже covered upstream
или относится к later warnings / confidence integration layer.

---

#### 26.11. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- персональный `sweat_rate_lph` повышает качество hydration interpretation
- weather context влияет на hydration demandingness
- высокая температура и влажность повышают practical execution difficulty
- sodium profile variability реальна,
  а `unknown` не должен выглядеть как fully personalized sodium input

**[MODEL-BASED]**
- трактовка `sweat_rate_lph` как branch-quality / confidence signal внутри PLAN
- wording shifts for hot / humid context
- wording shifts for known vs fallback hydration branch
- wording shifts for `low / medium / high / unknown` sodium profile
- правило no double counting внутри PLAN layer
- правило, что sodium wording не может быть увереннее, чем hydration foundation underneath

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный heat-context flag inside PLAN
- нужен ли later отдельный hydration_branch field in final output
- нужен ли later sodium-guidance mode for capsules vs drink sodium

---

### 27. Промежуточный вывод после этого шага

После фиксации роли:

- `temperature_c`
- `humidity_pct`
- `sweat_rate_lph`
- `sodium_loss_profile`

PLAN block будет учитывать
не только targets и practical modifiers,
но и quality of hydration / sodium personalization.

Это важно,
потому что assembled plan должен быть
не просто собран по цифрам,
а ещё и честно показывать,
насколько результат персонализирован
или остаётся более приблизительным estimate.

---

### 28. Final output shape of PLAN block

#### 28.1. Зачем фиксировать output shape отдельно

К этому моменту PLAN block уже получил:

- role and boundaries
- inputs
- master interval logic
- total intake count logic
- recommendation summary
- plan steps
- when to start
- missed-intake fallback
- execution modifiers

Теперь нужно явно зафиксировать,
**какой минимальный assembled output он обязан отдавать как block**.

Это важно потому, что:
- backend потом должен возвращать не абстрактную “идею плана”,
  а стабильный structured result;
- frontend должен иметь понятный объект для отображения;
- без output shape PLAN spec останется слишком описательной.

---

#### 28.2. Минимальный обязательный output PLAN block

Для MVP `v1.2` PLAN block должен собирать как минимум такой набор полей:

- `intake_interval_min`
- `total_intake_count`
- `when_to_start`
- `missed_intake_fallback`
- `recommendation_summary`
- `plan_steps`

Это и есть минимальный assembled practical plan,
который уже можно отдавать из backend.

---

#### 28.3. Draft PLAN object shape

На уровне backend / response-contract
минимальный assembled plan object должен выглядеть так:

```json
{
  "intake_interval_min": 20,
  "total_intake_count": 12,
  "when_to_start": "start_early",
  "missed_intake_fallback": "resume_next_interval_no_double_dose",
  "recommendation_summary": "На гонку длительностью около 4 часов ориентир: примерно 60 г углеводов/ч, 0.6 л жидкости/ч и около 500 мг натрия/ч. Начинай рано и держи ровный ритм.",
  "plan_steps": [
    "Начни питание и питьё в первые 15–30 минут гонки.",
    "Принимай углеводы каждые 20 минут: около 20 г за приём.",
    "Пей каждые 15–20 минут: около 150 мл за приём.",
    "Если натрий активен, старайся получать его в ритме, привязанном к питью.",
    "Держи общий план ровно и не пытайся резко догонять пропущенное."
  ]
}
```

#### 28.4. Что должно оставаться внутри `plan`, а что нет

Внутри `plan` должны жить:

- assembly outputs
- execution instructions
- user-facing practical fields

То есть:
- `recommendation_summary`
- `plan_steps`
- interval
- count
- start rule
- missed-intake fallback

Внутри `plan` не обязаны жить:

- raw upstream math fields:
  - `carbs_per_hour_g`
  - `fluid_per_hour_ml`
  - `sodium_per_hour_mg`
- raw upstream dose fields:
  - `carbs_per_intake_g`
  - `fluid_per_intake_ml`
  - `sodium_per_intake_mg`
- branch internals
- hidden scoring internals
- raw engineering intermediate values

Главный принцип:
**`plan` — это execution object, а не dump всех промежуточных формул.**

---


#### 28.5. Где должен оставаться source of truth для dose-per-intake

Важно явно зафиксировать:

- Day 48 требует стандартизировать plan block,
  включая dose-per-intake logic;
- но это не обязует дублировать все dose fields
  внутрь minimum `plan` object.

Для MVP `v1.2` source of truth для доз может оставаться в upstream result blocks:

- `result.carbs.carbs_per_intake_g`
- `result.fluid.fluid_per_intake_ml`
- `result.sodium.sodium_per_intake_mg`

А `plan_steps` и `recommendation_summary`
могут уже human-readable образом ссылаться на эти значения.

Operational meaning:
- `result` хранит structured numeric dosing outputs;
- `plan` хранит user-facing assembled execution layer.

---

#### 28.6. Совместимость с текущим `v1.1`

В `v1.1` backend уже возвращает:
- `plan.summary`
- `plan.plan_steps`

Для плавного перехода к `v1.2` допустима временная совместимость:

- `summary = recommendation_summary`
- `plan_steps` остаётся массивом строк

Но целевой assembled object в `v1.2` должен быть богаче
и включать дополнительные поля:

- `intake_interval_min`
- `total_intake_count`
- `when_to_start`
- `missed_intake_fallback`

---

#### 28.7. Что пока не включаем в final PLAN object

На этом шаге **не включаем** в обязательный minimum PLAN object:

- `confidence_level`
- `rule_ids_applied`
- detailed warning objects
- hydration branch marker
- schedule_type
- plan_complexity
- object-based steps
- aid-station / carry-capacity logistics
- duplicated dose fields from upstream result blocks

Причина:
- это уже относится к:
  - WARNINGS / CONFIDENCE integration
  - response-contract polishing
  - later execution extensions

То есть:
- сейчас фиксируем **minimum practical plan object**,
- а не всю финальную архитектуру ответа `/api/calc`.

---

#### 28.8. Связь с будущим `response-contract-v1.2.json`

Этот раздел нужен как мост между:

- `formula-spec-v1.2.md`
и
- будущим `response-contract-v1.2.json`

Operational meaning:
- всё, что здесь зафиксировано как minimum PLAN output,
  потом должно быть перенесено
  в отдельный response-contract документ;
- при этом общий response contract должен сохранить
  разделение между:
  - `result` как numeric source layer
  - `plan` как assembled execution layer

---

#### 28.9. Что в этом правиле science-based, а что model-based

**[SCIENCE-BASED]**
- user-facing race plan должен быть practical execution output,
  а не только набором totals

**[MODEL-BASED]**
- exact minimum shape of `plan`
- choice of field names
- сохранение `plan_steps: string[]`
- compatibility alias `summary = recommendation_summary`
- вынесение raw math fields за пределы assembled `plan`
- вынесение dose-per-intake source of truth в `result.*`, а не внутрь minimum `plan`

**[HYPOTHESIS / NEEDS CHECK]**
- нужен ли later отдельный `plan_metadata`
- нужен ли later object-based `plan_steps`
- нужен ли later explicit `schedule_type`
- нужен ли later explicit `hydration_branch` inside plan

---

### 29. Промежуточный вывод после этого шага

После фиксации final output shape
PLAN block будет уже почти полностью готов как paper-spec.

То есть:
- у него есть роль,
- входы,
- правила сборки,
- practical modifiers,
- и теперь ещё и минимальный assembled output object,
  пригодный для переноса в backend.
