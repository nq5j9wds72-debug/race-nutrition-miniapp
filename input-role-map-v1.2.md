# Input Role Map — v1.2

## Цель

Зафиксировать все input-поля текущего `/api/calc` и их **фактическую роль в текущем backend `v1.2`**.

Важно:
- источник истины для этого документа — **текущий `server.js`**
- `formula-spec-v1.2.md` используется здесь только как контекст для пометки расхождений
- задача документа — честно показать:
  - что реально влияет на math
  - что влияет только на warnings
  - что влияет только на validation
  - что выглядит важнее, чем есть на самом деле

---

## Поля, которые сейчас отправляет frontend

| field | from form | current validation status | notes |
|---|---|---:|---|
| race_type | basic | required | |
| duration_min | basic | required | |
| weight_kg | basic | required | |
| temperature_c | basic | required | |
| fuel_format | basic | required | |
| gi_tolerance_level | basic | required | |
| effort_level | advanced | optional | |
| humidity_pct | advanced | optional | |
| distance_km | advanced | optional | |
| sweat_rate_lph | advanced | optional | |
| elevation_gain_m | advanced | optional | |
| sodium_loss_profile | advanced | optional | |

---

## Что будем фиксировать для каждого поля

- required / optional
- влияет на `core math` / `warnings only` / `validation only` / `future`
- что происходит при `null`
- что происходит на крайних значениях
- ожидаемая важность
- реальное влияние в текущем backend
- комментарий по расхождению

---

## Часть 1 — базовые обязательные поля

| field | required? | expected role | actual current v1.2 role | if null | edge values | discrepancy |
|---|---|---|---|---|---|---|
| race_type | yes | carbs + hydration + sodium + warnings + plan context | validation + carbs math + fallback hydration math + sodium activation/tier + warnings | calc stops with validation error | outside `road/trail/ultra` => error | стало честнее, но в hydration влияет только в fallback-ветке и через sodium/context |
| duration_min | yes | главный driver всех блоков | validation + carbs bands + hydration branch logic + sodium activation/tier + totals + warnings + plan text | calc stops with validation error | `<30` or `>2160` => error | соответствует ожиданиям |
| weight_kg | yes | hydration + warnings + safety context | validation only | calc stops with validation error | `<35` or `>150` => error | критичное расхождение: обязательное поле, но не влияет на result math/warnings/plan |
| temperature_c | yes | hydration + sodium + warnings | validation + hydration math + sodium activation/tier + warnings | calc stops with validation error | `<-20` or `>45` => error | соответствует ожиданиям |
| fuel_format | yes | carbs + schedule + warnings + feasibility | validation + carbs math via cap + warnings | calc stops with validation error | outside `drink_only/gels/combo` => error | большое улучшение vs v1.1; всё ещё не влияет напрямую на hydration/sodium/plan assembly |
| gi_tolerance_level | yes | carbs + schedule + warnings | validation + carbs zone shift + GI ceiling + carb interval/dose logic | calc stops with validation error | outside `low/medium/high` => error | соответствует ожиданиям для carbs; не влияет на hydration/sodium |

---

## Notes — базовые поля

### `race_type`
Сейчас реально влияет на backend сильнее, чем в `v1.1`:
- в carbs:
  - `ultra` в long duration даёт более консервативный zone shift `-1`
  - `trail/ultra` разрешают elevation shift при `>=1500 m`
- в hydration fallback:
  - `ultra` даёт `+0.05 l/h`
- в sodium:
  - участвует в activation rules
  - участвует в tier escalation
- в warnings:
  - участвует в `road` sanity-warning при необычном сценарии

Итог:
`race_type` теперь уже не декоративное поле, но его роль всё ещё больше контекстная, чем “главный числовой драйвер”.

### `duration_min`
Это главный общий driver текущего ядра:
- carbs:
  - `<60`
  - `60–150`
  - `>150`
- hydration:
  - known sweat rate branch: `>=240` даёт duration adjustment
  - fallback: выбирает `short / medium / long`
- sodium:
  - activation rule
  - escalation rule
  - totals
- warnings:
  - very long race
  - long hot scenario
- plan:
  - summary text
  - total values

### `weight_kg`
Сейчас после validation нигде не используется:
- не влияет на carbs
- не влияет на hydration
- не влияет на sodium
- не влияет на warnings
- не влияет на plan

Итог:
это главное оставшееся нечестное поле текущего `v1.2`.

### `temperature_c`
Сейчас реально влияет на:
- hydration known-sweat branch:
  - `>=25` => `+0.05` к replacement fraction
- hydration fallback:
  - определяет temperature band
- sodium:
  - activation
  - escalation
  - high-sodium scenario
- warnings:
  - heat without sweat rate
  - ultra long hot scenario
  - long hot sodium guidance

### `fuel_format`
В `v1.2` это уже реальный math-field:
- `combo` => cap `90`
- `gels` => cap `75`
- `drink_only` => cap `60`
- при `drink_only` есть отдельный warning по feasibility

Итог:
это одно из ключевых исправлений относительно `v1.1`.

### `gi_tolerance_level`
Сейчас реально влияет на:
- carbs zone shift:
  - `low` => `-1 zone`
- GI ceiling:
  - medium duration: `45 / 60 / 60`
  - long duration: `60 / 75 / 90`
- carb dose logic:
  - target dose per intake
  - max dose per intake
  - preferred interval

Итог:
это сильный core-math field, но только для carbs.

---

## Часть 2 — advanced-поля

| field | required? | expected role | actual current v1.2 role | if null | edge values | discrepancy |
|---|---|---|---|---|---|---|
| effort_level | no | carbs + hydration + warnings | validation + carbs math + hydration math | calc continues | outside `easy/steady/race` => error | роль усилилась vs v1.1; в sodium напрямую не участвует |
| humidity_pct | no | hydration + sodium + warnings | validation + hydration math + sodium activation/tier | calc continues | outside `0..100` => error | стало сильнее и честнее |
| distance_km | no | context + warnings + plausibility + plan realism | validation + warnings only | calc continues | outside `1..300` => error | сильное расхождение: на result math не влияет |
| sweat_rate_lph | no | hydration + sodium + warnings | validation + hydration branch selector + главный hydration input | calc continues, fallback branch is used | outside `0.2..2.5` => error | соответствует ожиданиям; на sodium влияет косвенно через fluid |
| elevation_gain_m | no | carbs + hydration + schedule + warnings | validation + carbs math only in trail/ultra `>=1500 m` | calc continues | outside `0..20000` => error | всё ещё слабее ожиданий |
| sodium_loss_profile | no | sodium + warnings + safety | validation + sodium normalization + sodium activation/tier + warnings | calc continues, null/empty => `unknown` | outside `low/medium/high/unknown` => error | стало честнее, особенно для `unknown` |

---

## Notes — advanced поля

### `effort_level`
Сейчас влияет на 2 блока:
- carbs:
  - short race behavior
  - zone shift:
    - `easy = -1`
    - `steady = 0`
    - `race = +1`
- hydration:
  - known sweat branch:
    - `easy = -0.05`
    - `race = +0.05`
  - fallback branch:
    - `easy = -0.05`
    - `race = +0.05`
  - если null в fallback:
    - default = `race`

Итог:
`effort_level` уже нельзя считать warning-only полем.

### `humidity_pct`
Сейчас влияет на:
- hydration known sweat branch:
  - `>=70` => `+0.05`
- hydration fallback:
  - `>=70` => `+0.05`
- sodium:
  - activation
  - escalation
- warnings:
  - косвенно через hot / upper / overdrinking scenarios

Итог:
это уже полезный accuracy-upgrade field, а не декоративный optional.

### `distance_km`
Сейчас не участвует в math.
Используется только для:
- расчёта средней скорости
- warnings:
  - слишком низкая скорость
  - слишком высокая скорость
  - странный `road`-сценарий

Итог:
`distance_km` остаётся context / sanity field.

### `sweat_rate_lph`
Это главный hydration upgrade field:
- если значение валидно:
  - включается known-sweat branch
- если `null`:
  - используется fallback hydration branch
- через fluid plan влияет и на sodium/hour

Итог:
одно из самых полезных optional-полей текущего `v1.2`.

### `elevation_gain_m`
Сейчас используется только в carbs:
- только если `race_type = trail` или `ultra`
- только если `elevation_gain_m >= 1500`
- тогда даёт `+1 zone`

В hydration и sodium direct-role пока нет.

Итог:
поле полезное, но его текущая фактическая роль уже, чем ожидается по форме.

### `sodium_loss_profile`
Сейчас логика честнее, чем в `v1.1`:
- `null / empty` => `unknown`
- `unknown` не маскируется под `medium`
- влияет на:
  - sodium activation
  - base sodium concentration
  - upper cap for unknown
  - warning language

Итог:
это уже не декоративный optional, а реальный sodium-context field.

---

## Часть 3 — группировка по реальной роли

### A. Core math fields
Поля, которые реально меняют numeric result хотя бы в одном блоке:

- `race_type`
- `duration_min`
- `temperature_c`
- `fuel_format`
- `gi_tolerance_level`
- `effort_level`
- `humidity_pct`
- `sweat_rate_lph`
- `elevation_gain_m`
- `sodium_loss_profile`

### B. Warnings / context only
Поля, которые не меняют numeric result, но реально влияют на sanity / honesty layer:

- `distance_km`

### C. Validation only
Поля, которые сейчас обязательны или валидируются, но не влияют на расчёт:

- `weight_kg`

### D. Future / unresolved honesty problem
Поля, которые присутствуют в продукте, но требуют отдельного решения в следующих днях:

- `weight_kg`
- `distance_km`
- частично `elevation_gain_m` для hydration / plan execution
- частично `fuel_format` для настоящего assembled plan, а не только numeric cap

---

## Часть 4 — главные отличия v1.2 от v1.1

### Улучшения
1. `fuel_format` теперь реально влияет на carbs math, а не только на warning.
2. `effort_level` теперь влияет не только на carbs, но и на hydration.
3. `humidity_pct` теперь влияет не только на hydration fallback, но и на sodium activation/escalation.
4. `race_type` теперь реально участвует в carbs / hydration fallback / sodium.
5. `sodium_loss_profile = unknown` больше не маскируется под `medium`.

### Что всё ещё остаётся проблемой
1. `weight_kg` остаётся required field без фактической роли в result.
2. `distance_km` остаётся в основном sanity-only field.
3. `elevation_gain_m` всё ещё играет более узкую роль, чем пользователь может ожидать.
4. PLAN layer в текущем backend ещё не доведён до полной формы `response-contract-v1.2`.

---

## Часть 5 — вывод Day 46

На текущем этапе `v1.2` уже стал честнее, чем `v1.1`:

- меньше декоративных “умных” полей
- больше реального влияния у `fuel_format`, `effort_level`, `humidity_pct`, `race_type`, `sodium_loss_profile`
- sodium unknown handling стал правильнее

Но Day 46 ещё явно показывает 2 оставшихся слабых места:

1. **`weight_kg`**
   - либо нужно реально встроить в hydration/warnings layer,
   - либо честно ослабить его продуктовую важность

2. **`distance_km`**
   - либо оставить как sanity/context field,
   - либо не делать вид, что это сильный driver расчёта

---

## Definition of Done для Day 46

День можно считать закрытым, если:

- по каждому input-полю можно в 1–2 строках объяснить его реальную роль в текущем `v1.2`
- нет поля со статусом “непонятно, влияет ли”
- отдельно зафиксированы:
  - `core math`
  - `warnings only`
  - `validation only`
  - `future / unresolved`
- отдельно отмечены главные расхождения:
  - `weight_kg`
  - `distance_km`