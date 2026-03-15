# Formula Audit — v1.1

## Цель
Зафиксировать, как текущее ядро `v1.1` реально считает результат в `/api/calc`, до любых изменений формул.

## Что входит в аудит
- carbs block
- fluid block
- sodium block
- plan block

---

## 1) Carbs block — фактическая логика v1.1

### Какие output сюда входят
- `carbs_per_hour_g`
- `carbs_total_g`
- `carb_interval_min`
- `carbs_per_intake_g`
- `gels_per_hour_est`
- `gels_total_est`

### От чего block реально зависит
**Прямое влияние на carbs math:**
- `duration_min`
- `gi_tolerance_level`
- `effort_level`
- `elevation_gain_m` — только через `getElevationCarbModifier()`
- `race_type` — только потому что modifier по высоте работает лишь для `trail/ultra`

**Косвенное влияние / не на math, а на warnings рядом с carbs:**
- `fuel_format`
- `distance_km`

### Что делает каждое поле внутри carbs block

#### `duration_min`
Главный базовый драйвер.
- `< 60 мин`:
  - low = 0
  - medium = 15
  - high = 30
- `60–150 мин`:
  - low = 30
  - medium = 45
  - high = 60
- `> 150 мин`:
  - low = 60
  - medium = 75
  - high = 90

#### `gi_tolerance_level`
Главный переключатель ступени carbs/hour внутри выбранного диапазона длительности.

#### `effort_level`
Модификатор после базового выбора:
- `easy` => `-15 g/h`
- `steady` => `0`
- `race` => `+15 g/h`

#### `elevation_gain_m`
Даёт дополнительный carb modifier только если:
- `race_type` = `trail` или `ultra`

Логика:
- `< 500 m` => `+0`
- `>= 500 m` => `+5`
- `>= 1500 m` => `+10`

#### `race_type`
Сам по себе carbs/hour не задаёт.  
Но влияет косвенно, потому что elevation modifier отключён для `road`.

### Ограничения и ceilings
После всех модификаторов:
- если `< 0` => становится `0`
- если `> 90` => становится `90`

### Как выбирается интервал приёма углеводов
- если `carbs_per_hour <= 45` => `30 мин`
- если `carbs_per_hour > 45` и `<= 75` => `20 мин`
- если `carbs_per_hour > 75` => `15 мин`

### Как считаются остальные carb outputs
- `carbs_total_g = carbs_per_hour_g * duration_hours`
- `carbs_per_intake_g = carbs_per_hour_g / (60 / carb_interval_min)`
- `gel_basis_g = 25`
- `gels_per_hour_est = carbs_per_hour_g / 25`
- `gels_total_est = carbs_total_g / 25`

### Что не влияет на carbs math
Эти поля сейчас не меняют сам carbs calculation:
- `weight_kg`
- `temperature_c`
- `humidity_pct`
- `sweat_rate_lph`
- `sodium_loss_profile`

### Что влияет только через warnings, а не через carbs math
- `fuel_format`: warning для `drink_only`, если `carbs_per_hour > 60`
- `distance_km`: warnings через проверку средней скорости
- `race_type + distance_km + duration_min`: road-warning для необычного сценария

### Вывод по carbs block
Текущее ядро `v1.1` делает carbs block в основном через:
`duration_min + gi_tolerance_level + effort_level + elevation_gain_m(trail/ultra only)`.

Из важных продуктовых расхождений:
- `fuel_format` выглядит важным для практического плана, но почти не участвует в math;
- `race_type` выглядит важным полем, но его влияние на carbs ограничено;
- `weight_kg` вообще не участвует в carbs block.

---

## 2) Fluid block — фактическая логика v1.1

### Какие output сюда входят
- `fluid_per_hour_ml`
- `fluid_total_ml`
- `fluid_interval_min`
- `fluid_per_intake_ml`

### От чего block реально зависит
**Прямое влияние на fluid math:**
- `sweat_rate_lph`
- `temperature_c`
- `humidity_pct` — только если `sweat_rate_lph` не задан
- `duration_min` — только для `fluid_total_ml`

**Косвенное влияние / не на math, а на warnings рядом с fluid:**
- `sweat_rate_lph`
- `temperature_c`
- `duration_min`

### Как работает текущая логика

#### Ветка 1 — если задан `sweat_rate_lph`
Если `sweat_rate_lph` передан и прошёл validation, то:
- `fluid_per_hour_ml = sweat_rate_lph * 1000 * 0.7`

То есть текущая логика берёт 70% от заявленной потливости и на этом заканчивается.

#### Ветка 2 — если `sweat_rate_lph` не задан
Включается temperature-based fallback:

- `temperature_c < 10` => `400 ml/h`
- `10..19` => `500 ml/h`
- `20..29` => `650 ml/h`
- `>= 30` => `800 ml/h`

#### Роль `humidity_pct`
Влажность влияет только во fallback-ветке:

- `humidity_pct >= 80` => modifier `1.10`
- `humidity_pct >= 60` => modifier `1.05`
- `humidity_pct <= 30` => modifier `0.95`
- иначе => modifier `1.00`

Итог:
- `fluid_per_hour_ml = round(baseFluidMlPerHour * humidityModifier)`

Если `humidity_pct` не задан, возвращается просто temperature-based base без модификатора.

### Как считаются остальные fluid outputs
- `fluid_total_ml = fluid_per_hour_ml * duration_hours`
- `fluid_interval_min = 15`
- `fluid_per_intake_ml = fluid_per_hour_ml / 4`

### Что сейчас НЕ влияет на fluid math
Эти поля в текущем v1.1 не участвуют в расчёте `fluid_per_hour_ml`:
- `weight_kg`
- `race_type`
- `effort_level`
- `distance_km`
- `elevation_gain_m`
- `fuel_format`
- `gi_tolerance_level`
- `sodium_loss_profile`

### Что влияет только через warnings, а не через fluid math
- если `sweat_rate_lph === null` и `temperature_c >= 20` => warning про более низкую точность расчёта жидкости
- если `duration_min > 720` => общий warning про очень длинную гонку

### Вывод по fluid block
Текущее ядро `v1.1` строит hydration block почти полностью через:
- `sweat_rate_lph`, если он есть;
- иначе через грубый fallback по `temperature_c` и `humidity_pct`.

Главные расхождения:
- `weight_kg` обязателен в форме, но вообще не участвует в fluid math;
- `effort_level` и `elevation_gain_m` выглядят полезными для hydration-контекста, но не участвуют;
- `fluid_interval_min` сейчас всегда жёстко равен `15`, без адаптации к реальному объёму питья.

---

## 3) Sodium block — фактическая логика v1.1

### Какие output сюда входят
- `sodium_per_hour_mg`
- `sodium_total_mg`
- `sodium_interval_min`
- `sodium_per_intake_mg`

### От чего block реально зависит
**Прямое влияние на sodium math:**
- `fluid_per_hour_ml`
- `temperature_c`
- `sodium_loss_profile`
- `duration_min` — только для `sodium_total_mg`

**Косвенное влияние:**
- `sweat_rate_lph`
- `humidity_pct` — только косвенно через fluid fallback

### Как работает текущая логика

#### Шаг 1 — определяется sodium concentration
Текущий сервер вызывает:

`getSodiumConcentrationMgL(temperature_c, sodium_loss_profile)`

То есть основа sodium block сейчас строится только на:
- температуре
- профиле потерь натрия

#### Шаг 2 — считается sodium в час
Формула:
- `sodium_per_hour_mg = (fluid_per_hour_ml / 1000) * sodium_concentration_mg_l`

То есть sodium/hour зависит от уже рассчитанного fluid/hour.

#### Шаг 3 — считается sodium total
- `sodium_total_mg = sodium_per_hour_mg * duration_hours`

#### Шаг 4 — задаётся ритм приёма
- `sodium_interval_min = 15`
- `sodium_per_intake_mg = sodium_per_hour_mg / 4`

### Что сейчас НЕ влияет напрямую на sodium math
Эти поля в текущем v1.1 не участвуют напрямую:
- `weight_kg`
- `race_type`
- `fuel_format`
- `gi_tolerance_level`
- `effort_level`
- `distance_km`
- `elevation_gain_m`

### Что влияет только косвенно
- `sweat_rate_lph` влияет только через `fluid_per_hour_ml`
- `humidity_pct` влияет только через fluid fallback, если нет `sweat_rate_lph`

### Что есть в warning-логике рядом
Сейчас отдельно добавляется warning:
- `Натрий — это ориентир, а не защита от перепивания.`

### Главные ограничения текущего sodium block
- нет отдельного `sodium_strategy_active`
- нет floor / cap логики как отдельного слоя
- нет специальной обработки short / cool race
- нет явного различия `unknown` vs `medium`, если функция внутри это не различает
- `sodium_interval_min` всегда жёстко равен `15`

### Вывод по sodium block
Текущее ядро `v1.1` делает sodium block по простой схеме:

`fluid_per_hour_ml`  
→ `sodium_concentration_mg_l` из `temperature_c + sodium_loss_profile`  
→ `sodium_per_hour_mg`  
→ `sodium_total_mg`

Главные продуктовые расхождения:
- sodium сейчас не имеет отдельной стратегии активации;
- `race_type`, `duration_min` и heat context выглядят важными для sodium layer, но участвуют слабее, чем ожидается;
- `unknown` profile потенциально маскируется под обычный сценарий, что надо отдельно проверить в `v1.2`.

---

## 4) Plan block — фактическая логика v1.1

### Какие output сюда входят
- `plan.summary`
- `plan.plan_steps[0]`
- `plan.plan_steps[1]`
- `plan.plan_steps[2]`
- `plan.plan_steps[3]`
- `plan.plan_steps[4]`

### Главный вывод по блоку
В текущем `v1.1` plan block — это не отдельный plan engine, а текстовая упаковка уже готовых расчётов.

То есть backend:
1. сначала считает `carbs`,
2. потом `fluid`,
3. потом `sodium`,
4. и только после этого собирает `summary` и `plan_steps`.

### От чего block реально зависит
**Прямое влияние на plan text:**
- `duration_min` — через `durationHuman`
- `carbs_per_hour_g`
- `carbs_per_intake_g`
- `carb_interval_min`
- `carbs_total_g`
- `fluid_per_hour_ml`
- `fluid_per_intake_ml`
- `fluid_interval_min`
- `fluid_total_ml`
- `sodium_per_hour_mg`
- `sodium_per_intake_mg`
- `sodium_total_mg`

**Фактически plan block зависит не от raw input напрямую, а от уже рассчитанных output блоков.**

### Как собирается `summary`
Текущий шаблон summary такой:

`На {durationHuman} тебе нужен план: около {carbs_per_hour} г углеводов в час, {fluid_per_hour} мл жидкости в час и {sodium_per_hour} мг натрия в час.`

### Как собираются `plan_steps`
Сейчас backend всегда возвращает 5 шагов:

1. Старт питания:
   - фиксированная фраза про начало в первые `20–30 минут`
   - не зависит от типа гонки, fuel format или GI

2. Шаг по углеводам:
   - зависит от `carb_interval_min`
   - зависит от `carbs_per_intake_g`

3. Шаг по жидкости:
   - зависит от `fluid_interval_min`
   - зависит от `fluid_per_intake_ml`

4. Шаг по натрию:
   - зависит от `sodium_per_intake_mg`
   - не использует отдельный sodium interval в тексте
   - по смыслу привязан к общему ритму приёма

5. Финальный total-step:
   - зависит от `carbs_total_g`
   - зависит от `fluid_total_ml`
   - зависит от `sodium_total_mg`

### Что сейчас НЕ влияет на plan block напрямую
Эти поля не участвуют в отдельной plan-логике как самостоятельные факторы:
- `fuel_format`
- `gi_tolerance_level`
- `race_type`
- `weight_kg`
- `temperature_c`
- `humidity_pct`
- `distance_km`
- `sweat_rate_lph`
- `elevation_gain_m`
- `sodium_loss_profile`

Они могут менять план только косвенно — если до этого уже изменили `carbs/fluid/sodium` outputs.

### Главные ограничения текущего plan block
- нет отдельного master interval
- нет count of intakes
- нет `when_to_start` как отдельного поля
- нет `missed_intake_fallback`
- нет адаптации под `fuel_format`
- нет различий между `gels`, `drink_only`, `combo`
- нет связи с carry capacity / aid stations
- `plan_steps` всегда одного и того же формата

### Вывод по plan block
Текущее ядро `v1.1` не строит настоящий practical execution plan.

Сейчас это скорее:
- summary layer
- reminder text layer
- human-readable packaging поверх уже посчитанных чисел

Главное продуктовое расхождение:
пользователь видит “план”, но по факту backend пока не делает отдельную plan-логику, а только текстово пересобирает outputs из `carbs/fluid/sodium`.

---

## 5) Mismatch Map — form vs server / expected vs actual

### Цель блока
Собрать в одном месте поля и части результата, которые в текущем `v1.1` выглядят важнее, чем реально влияют на расчёт.

| item | how it looks in product | expected importance | actual v1.1 effect | mismatch level | note |
|---|---|---|---|---|---|
| `weight_kg` | базовое обязательное поле | medium | validation only | high | выглядит как реальный физиологический драйвер, но не участвует в carbs/fluid/sodium |
| `fuel_format` | базовое обязательное поле | medium | validation + one warning only | high | не меняет carbs target, interval, dose size, practical plan |
| `distance_km` | useful advanced field | medium | validation + warnings only | high | не влияет на math blocks |
| `race_type` | базовое поле с сильным смыслом | high | weak carb context + warnings | medium/high | почти не влияет на fluid/sodium |
| `humidity_pct` | advanced field для точности | high | fluid fallback only | medium | не даёт отдельной sodium/warning logic |
| `effort_level` | advanced performance field | medium | carbs modifier only | medium | не влияет на hydration/sodium |
| `elevation_gain_m` | advanced trail context | medium | small carbs modifier only | medium | не влияет на hydration/sodium/plan напрямую |
| `sodium_loss_profile` | advanced personalization field | medium | sodium math only | medium | нет отдельной logic for `unknown`, safety, activation |
| `plan` | выглядит как practical execution plan | high | text packaging layer | high | backend пока не строит отдельный plan engine |
| `gi_tolerance_level` | базовое обязательное поле | medium | strong carbs driver | low | одно из немногих полей, которое реально влияет заметно |
| `sweat_rate_lph` | advanced personalization field | high | strong fluid driver | low | одно из самых честно работающих полей в текущем v1.1 |
| `temperature_c` | базовое обязательное поле | high | fluid fallback + sodium driver + warnings | low/medium | реально влияет, но hydration block пока грубый |

### Главные расхождения версии v1.1
1. В форме есть поля, которые выглядят “умными”, но почти не двигают расчёт:
   - `weight_kg`
   - `fuel_format`
   - `distance_km`

2. Есть поля, которые влияют, но слабее, чем пользователь ожидает:
   - `race_type`
   - `humidity_pct`
   - `effort_level`
   - `elevation_gain_m`

3. Самые “честные” поля текущего ядра:
   - `duration_min`
   - `gi_tolerance_level`
   - `sweat_rate_lph`
   - `temperature_c`
   - `sodium_loss_profile` (частично)

4. Главное продуктовое расхождение:
   пользователь видит “практический план”, но backend пока в основном отдаёт
   summary + fixed text steps, а не отдельный execution engine.