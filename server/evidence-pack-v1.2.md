# Evidence Pack — v1.2

## Цель документа

Зафиксировать научные опоры и инженерные допущения для перехода от `formula_version = v1.1` к будущему `v1.2-science`.

Этот файл **не является кодом** и **не является готовой формулой**.
Это source pack, на который дальше будут опираться:

- `server/formula-spec-v1.2.md`
- `server/input-role-map-v1.2.md`
- `server/validation-spec-v1.2.md`
- обновлённый `server/server.js`

---

## Правила чтения этого документа

### Типы тегов

- `[SCIENCE-BASED]` — правило напрямую опирается на consensus / review / устойчивую практику спортивного питания.
- `[MODEL-BASED]` — это инженерное правило продукта, построенное поверх science range.
- `[HYPOTHESIS / NEEDS CHECK]` — правило выглядит правдоподобно, но требует отдельной проверки перед внедрением в core algorithm.

### Жёсткий принцип фазы

Если science и удобство продукта конфликтуют:
**верим science и снижаем ложную точность**.

---

# 1. CARBS

## 1.1. Что считаем научной опорой

### [SCIENCE-BASED] Длительность — главный driver внутригоночного carbs target

Для внутрисоревновательного потребления углеводов practical recommendations в endurance обычно строятся прежде всего по **длительности нагрузки**, а не по универсальной формуле через массу тела.

### [SCIENCE-BASED] Базовые диапазоны по длительности

- До ~60 минут:
  - carbs during exercise часто не являются обязательными;
  - в части сценариев достаточно mouth rinse / small intake.

- Около 1–2.5 часа:
  - рабочий practical target обычно находится в диапазоне **30–60 г/ч**.

- Более ~2.5 часа:
  - target может подниматься к **60–90 г/ч**,
  - но только если формат питания и переносимость это реально позволяют.

### [SCIENCE-BASED] Intake rates выше ~60 г/ч лучше работают при mixed / multiple transportable carbohydrates

Если intake высокий, комбинации углеводов с разными транспортёрами обычно предпочтительнее одиночного источника.

### [SCIENCE-BASED] Высокие intake rates имеют смысл только при GI readiness / gut training

Переход к `75–90 г/ч` не должен считаться “обычной настройкой по умолчанию”.
Чем выше intake, тем важнее предварительная адаптация ЖКТ и практическое тестирование на тренировках.

### [SCIENCE-BASED] GI tolerance имеет прямое значение для practical target

Низкая переносимость ЖКТ — это не просто UX-поле.
Она должна ограничивать амбициозность carbs plan и размер одной дозы.

### [SCIENCE-BASED] Масса тела не является обязательным драйвером within-race carbs target в MVP

Для внутрисоревновательного practical fueling основная опора — duration, format, tolerability и контекст гонки.
Поэтому `weight_kg` не нужно автоматически превращать в главный драйвер carbs/hour без отдельной сильной базы.

---

## 1.2. Что считаем инженерной моделью продукта

### [MODEL-BASED] Duration band model для backend

Для v1.2 допустимо использовать простую band-логику:

- `< 60 min`
- `60–150 min`
- `> 150 min`

Почему:
- это прозрачно;
- это соответствует typical practical guidance;
- это проще объяснить пользователю и тестировать в golden cases.

### [MODEL-BASED] Внутри band выбор делать не “по магической формуле”, а по score system

Пример логики:
- `gi_tolerance_level`
- `fuel_format`
- `effort_level`
- `race_type`
- частично `elevation_gain_m`

не пересчитывают carbs через “физиологически точное уравнение”,
а помогают выбрать:
- нижнюю часть диапазона,
- середину,
- верхнюю часть диапазона.

### [MODEL-BASED] `gi_tolerance_level` влияет на:
- ceiling,
- размер одной дозы,
- интервал,
- warning-тексты.

### [MODEL-BASED] `fuel_format` влияет не только на warnings, но и на feasibility

Ожидаемая логика:
- `gels` → обычно проще выйти на высокий target;
- `combo` → самый гибкий practical вариант;
- `drink_only` → требует отдельной проверки feasibility.

### [MODEL-BASED] `effort_level` — это practical modifier, а не физиологическая формула

Допустимый смысл:
- `completion` → более консервативный target;
- `race` → neutral;
- `aggressive` → можно смещаться вверх в пределах допустимого диапазона.

### [MODEL-BASED] `race_type = ultra` не обязан автоматически значить “больше carbs/hour”

Для части пользователей ultra скорее требует:
- осторожности,
- устойчивости плана,
- меньшего риска GI collapse.

Поэтому ultra может иногда вести не к верхнему default, а к более консервативному practical target.

---

## 1.3. Что пока не считаем доказанным для core algorithm

### [HYPOTHESIS / NEEDS CHECK] Автоматически поднимать core target выше `90 г/ч`

Это возможно только для части атлетов и требует:
- gut training,
- правильного fuel format,
- подтверждённой переносимости,
- более сильной научной и продуктовой базы.

Для текущего MVP-ядра это не должно быть default behaviour.

### [HYPOTHESIS / NEEDS CHECK] Использовать `weight_kg` как прямой множитель для carbs/hour

Для текущей архитектуры продукта это скорее создаёт видимость научности, чем реально улучшает модель.

---

## 1.4. Вывод для будущего formula spec

CARBS в `v1.2` должны строиться в первую очередь от:
- `duration_min`
- `gi_tolerance_level`
- `fuel_format`

Вторично:
- `effort_level`
- `race_type`
- `elevation_gain_m`

Не использовать как основной driver без отдельной сильной базы:
- `weight_kg`

---

# 2. HYDRATION

## 2.1. Что считаем научной опорой

### [SCIENCE-BASED] Индивидуальный sweat rate предпочтительнее общего weather fallback

Потери жидкости сильно различаются между людьми.
Если у спортсмена есть свой `sweat_rate_lph`, это должен быть главный вход для hydration block.

### [SCIENCE-BASED] Во время endurance exercise опасны и dehydration, и overhydration

Гидратация — это не задача “как можно ближе к 100% replacement”.
Важен баланс между:
- недопитием,
- перепиванием.

### [SCIENCE-BASED] Fixed universal fluid target для всех — плохая идея

Одинаковый hourly target для разных людей и условий создаёт ложную точность.
Особенно рискованно это в жаре и на длительных событиях.

### [SCIENCE-BASED] Overdrinking повышает риск exercise-associated hyponatremia

Поэтому hydration engine должен иметь отдельную anti-overdrinking логику,
а не просто “больше жара = всегда больше пить”.

### [SCIENCE-BASED] Weather matters, но без sweat rate это lower-confidence estimation

Температура и влажность действительно влияют на вероятные потери жидкости,
но без персонального sweat rate это лишь приблизительный fallback.

---

## 2.2. Что считаем инженерной моделью продукта

### [MODEL-BASED] В v1.2 должно быть 2 ветки hydration calculation

#### Ветка A — персональная
Если есть `sweat_rate_lph`:
- использовать её как главный вход;
- рассчитывать fluid target как **долю от sweat loss**, а не как full replacement.

#### Ветка B — fallback
Если `sweat_rate_lph` нет:
- использовать conservative matrix по
  - `temperature_c`
  - `humidity_pct`
  - `duration_min`
  - `race_type`
- и явно маркировать lower confidence.

### [MODEL-BASED] Replacement fraction должна быть консервативной

Полный replacement по умолчанию в MVP не нужен.
Продукт должен скорее избегать перепивания, чем имитировать лабораторную точность.

### [MODEL-BASED] Нужны hard и soft ceilings

Hydration engine должен явно иметь:
- practical floor,
- conservative soft cap,
- hard cap,
- warnings при верхних сценариях.

### [MODEL-BASED] Heat + no sweat rate = отдельный warning

В жарких условиях без персонального sweat test калькулятор должен быть честнее и осторожнее.

---

## 2.3. Что пока не считаем доказанным для core algorithm

### [HYPOTHESIS / NEEDS CHECK] Точная математическая матрица fluid/hour только по weather variables

Без персонального sweat rate такая матрица всё равно остаётся инженерным приближением.
Её можно использовать в продукте,
но нельзя выдавать как персонально точную физиологию.

### [HYPOTHESIS / NEEDS CHECK] Универсальный “идеальный” % replacement для всех

Разные пользователи, погода, темп, высота, доступ к пунктам питания и GI-факторы делают такую точность сомнительной.

---

## 2.4. Вывод для будущего formula spec

HYDRATION в `v1.2` должны строиться так:

1. Если есть `sweat_rate_lph`:
   - это главный путь.
2. Если `sweat_rate_lph` нет:
   - используется conservative weather fallback.
3. Отдельно встроить:
   - anti-overdrinking warnings,
   - hot/no-sweat-rate warnings,
   - very high fluid target warnings.

---

# 3. SODIUM

## 3.1. Что считаем научной опорой

### [SCIENCE-BASED] В рамках MVP считаем только sodium, а не полный electrolyte model

Это допустимое упрощение продукта.
Но его нужно проговорить честно.

### [SCIENCE-BASED] Потери натрия между спортсменами сильно варьируют

Поэтому sodium strategy не должна выглядеть как “одна точная формула для всех”.

### [SCIENCE-BASED] Sodium intake может быть practically useful, но не решает проблему overdrinking

Соль сама по себе не предотвращает EAH, если человек перепивает.
Это нужно жёстко встроить в warnings и документацию.

### [SCIENCE-BASED] High sodium recommendations требуют осторожности

Чем агрессивнее sodium strategy,
тем выше риск ложной уверенности и ненужной сложности для пользователя.

---

## 3.2. Что считаем инженерной моделью продукта

### [MODEL-BASED] `sodium_loss_profile` должен стать реальным входом, а не декоративным полем

Для v1.2 логично иметь состояния:
- `unknown`
- `low`
- `medium`
- `high`

### [MODEL-BASED] `unknown` нельзя маскировать под `medium`

Если профиль потерь натрия неизвестен,
это должно снижать уверенность модели,
а не silently превращаться в “среднего пользователя”.

### [MODEL-BASED] Sodium block логично связывать с fluid block

Практическая логика:
- сначала определить fluid strategy,
- затем выразить sodium через mg/L и mg/h,
- затем перевести в total и per-intake.

### [MODEL-BASED] В MVP допустим tier-based approach вместо псевдоточной формулы

Примерный смысл:
- low need
- moderate need
- high need
- very high / hot / salty sweater

Но диапазоны должны быть поданы как operational tiers, а не как “медицински точное число”.

### [MODEL-BASED] Натрий должен активироваться по контексту, а не всегда автоматически

Полезная логика активации:
- длинная гонка,
- высокая температура,
- высокий fluid target,
- высокий sodium loss profile,
- длительный hot/ultra сценарий.

---

## 3.3. Что пока не считаем доказанным для core algorithm

### [HYPOTHESIS / NEEDS CHECK] Агрессивные sodium targets как default

Без подтверждённой индивидуальной потребности это выглядит слишком уверенно.

### [HYPOTHESIS / NEEDS CHECK] Представлять sodium как “защиту от судорог” или “страховку от EAH”

Это слишком сильные обещания для текущей базы.

---

## 3.4. Вывод для будущего formula spec

SODIUM в `v1.2` должны быть:
- ограниченными,
- контекстными,
- честно привязанными к fluid plan,
- с отдельным предупреждением, что sodium не заменяет контроль жидкости.

---

# 4. GUT TRAINING / GI TOLERANCE

## 4.1. Что считаем научной опорой

### [SCIENCE-BASED] Gut training — реальный фактор переносимости race fueling

ЖКТ можно адаптировать к приёму углеводов и жидкости во время нагрузки.
Это влияет на practical tolerability и снижает риск GI problems.

### [SCIENCE-BASED] Чем выше carbs/hour, тем важнее gut training

Особенно это актуально, если:
- target идёт к `>60 г/ч`,
- план включает mixed carbs,
- у пользователя уже были GI symptoms,
- гонка длинная и интенсивная.

### [SCIENCE-BASED] Низкая GI tolerance должна влиять на выдачу плана

При low GI tolerance калькулятор должен быть более осторожным:
- меньшие дозы,
- чаще интервалы,
- меньше амбициозность target,
- больше предупреждений о необходимости тестирования на тренировке.

---

## 4.2. Что считаем инженерной моделью продукта

### [MODEL-BASED] Поле `gi_tolerance_level` можно использовать как operational proxy

Это не medical diagnosis и не лабораторный показатель.
Но как practical backend signal поле полезно.

### [MODEL-BASED] `gi_tolerance_level` должно влиять одновременно на:

- carbs/hour ceiling
- carbs per intake
- interval
- warnings
- confidence level плана

### [MODEL-BASED] При `high` нельзя автоматически выдавать “90 г/ч всем”

High GI tolerance = возможность двигаться выше,
но только если:
- длительность оправдывает это,
- формат топлива подходит,
- нет других конфликтов.

---

## 4.3. Что пока не считаем доказанным для core algorithm

### [HYPOTHESIS / NEEDS CHECK] Простая self-reported шкала GI tolerance полностью отражает реальную готовность ЖКТ

Это удобное поле продукта,
но не строгая физиологическая истина.
Поэтому влияние поля должно быть заметным, но ограниченным.

---

## 4.4. Вывод для будущего formula spec

GI tolerance в `v1.2` — это не cosmetic field.
Оно должно влиять на:
- carbs target,
- practical dosing,
- risk messaging,
- confidence.

---

# 5. HYPONATREMIA / OVERDRINKING RISK

## 5.1. Что считаем научной опорой

### [SCIENCE-BASED] Главный риск EAH — excessive fluid intake / overdrinking

Это один из самых важных safety points для всей новой версии ядра.

### [SCIENCE-BASED] Sodium не компенсирует перепивание

Даже при sodium intake риск EAH остаётся,
если стратегия жидкости избыточна.

### [SCIENCE-BASED] Universal advice “пить как можно больше” опасен

Hydration engine обязан быть safety-first.

### [SCIENCE-BASED] Long duration + hot conditions + uncertainty = lower confidence scenario

Чем длиннее и жарче событие,
тем больше нужен консервативный подход и тем меньше допустима ложная точность калькулятора.

---

## 5.2. Что считаем инженерной моделью продукта

### [MODEL-BASED] В hydration block должен быть отдельный overdrinking risk layer

Нужны отдельные warnings, если:
- fluid target очень высокий,
- известный sweat rate уже перекрывается слишком агрессивно,
- длительность большая,
- жарко,
- sodium strategy может создать у пользователя ложное чувство безопасности.

### [MODEL-BASED] Нужна lower-confidence маркировка

Для сочетаний:
- no sweat rate
- long event
- hot weather
- unknown sodium profile
- aggressive fueling target

калькулятор должен быть честнее в тексте результата.

---

## 5.3. Что пока не считаем доказанным для core algorithm

### [HYPOTHESIS / NEEDS CHECK] Простое автоматическое вычисление риска EAH в виде “score = X”

Для MVP полезнее warnings-based logic,
а не псевдомедицинский risk score.

---

## 5.4. Вывод для будущего formula spec

Hyponatremia / overdrinking logic в `v1.2` должна быть реализована прежде всего как:
- safety warnings,
- conservative caps,
- lower-confidence flags,
- отказ от агрессивных universal fluid targets.

---

# 6. Поля и их ожидаемая роль в v1.2

## 6.1. Основные поля

### `duration_min`
- [SCIENCE-BASED] главный driver carbs logic
- [SCIENCE-BASED] важный driver hydration и sodium context

### `fuel_format`
- [MODEL-BASED] главный practical driver feasibility
- [MODEL-BASED] влияет на plan generation

### `gi_tolerance_level`
- [SCIENCE-BASED + MODEL-BASED] влияет на tolerability ceiling и practical dosing

### `temperature_c`
- [SCIENCE-BASED] влияет на hydration context
- [MODEL-BASED] влияет на fallback and warnings

### `sweat_rate_lph`
- [SCIENCE-BASED] главный персональный hydration input

### `sodium_loss_profile`
- [SCIENCE-BASED + MODEL-BASED] нужен как контекстный sodium input, если известен

---

## 6.2. Поля, которые нельзя делать псевдонаучно важными без отдельной базы

### `weight_kg`
- не делать главным driver внутригоночного carbs/hour по умолчанию

### `distance_km`
- не путать с главным metabolic driver
- чаще полезно для warnings / context / sanity check

### `effort_level`
- использовать как modifier внутри range, а не как “физиологическую истину”

### `elevation_gain_m`
- использовать осторожно
- скорее как contextual modifier, чем как основной прямой driver

---

# 7. Жёсткие продуктовые принципы для v1.2

1. Не обещать точность там, где есть только engineering estimate.
2. Не маскировать `unknown` под `medium`.
3. Не выдавать sodium как защиту от EAH.
4. Не строить hydration как full-replacement default.
5. Не превращать optional field в “умный декор”, если оно почти не влияет на расчёт.
6. Если `fuel_format` или `GI tolerance` меняются, carbs result должен реально меняться.
7. Чем ниже уверенность модели, тем честнее должен быть result text.

---

# 8. Что это значит для следующих дней

## Day 39
На основе этого файла собрать:
- `server/golden-cases.v1.1.json`
- `server/golden-cases.v1.2.target.json`

## Day 40
Собрать paper spec по carbs:
- duration bands
- role of GI
- role of fuel format
- role of effort/race type
- ceilings and warnings

## Day 42
Собрать hydration spec:
- sweat-rate branch
- fallback branch
- anti-overdrinking logic

## Day 44
Собрать sodium spec:
- activation rules
- tiers
- unknown state
- warnings

---

# 9. Источники для этой версии evidence pack

## Primary / high-value sources

1. Burke LM, Hawley JA, Wong SHS, Jeukendrup AE.
   **Carbohydrates for training and competition.**
   Journal of Sports Sciences. 2011.

2. Jeukendrup AE.
   **Carbohydrate Intake During Exercise.**
   Sports Medicine. 2014.

3. Wilson PB, Ingraham SJ.
   **Multiple Transportable Carbohydrates During Exercise.**
   Current Sports Medicine Reports. 2015.

4. Jeukendrup AE.
   **Training the Gut for Athletes.**
   Sports Medicine. 2017.

5. Sawka MN et al.
   **American College of Sports Medicine position stand: Exercise and Fluid Replacement.**
   2007.

6. Armstrong LE, Johnson EC, McKenzie AL.
   **Rehydration during Endurance Exercise.**
   Nutrients. 2021.

7. Rosner MH, Kirven J.
   **Exercise-associated hyponatremia.**
   Clinical Journal of the American Society of Nephrology. 2007/2008 review line.

8. Hew-Butler T et al.
   **Exercise-Associated Hyponatremia: 2017 Update.**
   Frontiers in Medicine. 2017.

9. Veniamakis E et al.
   **Effects of Sodium Intake on Health and Performance in Endurance and Ultra-Endurance Sports.**
   2022 review.

10. Mlinaric J et al.
    **Nutritional strategies for minimizing gastrointestinal symptoms in endurance exercise.**
    2025 systematic review.

11. Martinez IG et al.
    **The Effect of Gut-Training and Feeding-Challenge on Markers of Gastrointestinal Status and Function in Endurance Exercise.**
    2023 systematic review.

---

# 10. Финальный вывод документа

Для `v1.2-science` научно оправдано:

- строить carbs прежде всего от длительности и tolerability;
- делать sweat rate главным hydration input;
- считать sodium ограниченно и честно;
- жёстко учитывать overdrinking risk;
- отделять science rules от engineering rules.

Для `v1.2-science` пока **не оправдано**:

- делать вид, что у нас есть точная персональная физиологическая модель;
- автоматически использовать вес как главный carbs driver;
- продавать sodium как защиту от EAH;
- скрывать низкую уверенность fallback-моделей.