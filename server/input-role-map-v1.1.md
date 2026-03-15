# Input Role Map — v1.1

## Цель
Зафиксировать все input-поля текущего `/api/calc` и их роль в версии `v1.1` до любых изменений формул.

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

## Что будем заполнять дальше для каждого поля

- required / optional
- math / warnings / validation / UI only
- что происходит при `null`
- что происходит на крайних значениях
- ожидаемая важность
- реальное влияние в текущем ядре
- комментарий по расхождению

## Часть 1 — базовые обязательные поля (фактическая роль в v1.1)

| field | required? | expected role | actual v1.1 role | if null | edge values | discrepancy |
|---|---|---|---|---|---|---|
| race_type | yes | carbs + hydration + sodium + warnings | validation + carbs context only + warnings | calc stops with validation error | outside `road/trail/ultra` => error | слабее ожиданий: не влияет напрямую на fluid/sodium math |
| duration_min | yes | главный драйвер всех блоков | validation + carbs math + totals + warnings + plan | calc stops with validation error | `<30` or `>2160` => error | почти соответствует ожиданиям |
| weight_kg | yes | hydration + warnings | validation only | calc stops with validation error | `<35` or `>150` => error | сильное расхождение: обязательное поле, но на result не влияет |
| temperature_c | yes | hydration + sodium + warnings | validation + fluid fallback math + sodium math + warnings | calc stops with validation error | `<-20` or `>45` => error | близко к ожиданиям |
| fuel_format | yes | carbs + schedule + warnings | validation + warnings only | calc stops with validation error | outside `drink_only/gels/combo` => error | расхождение: не меняет carbs target и не перестраивает plan |
| gi_tolerance_level | yes | carbs + schedule + warnings | validation + главный driver carbs/hour + indirect interval/plan effect | calc stops with validation error | outside `low/medium/high` => error | близко к ожиданиям для carbs, но не влияет на fluid/sodium |

### Notes for audit
- `race_type` влияет на carbs только косвенно: через `getElevationCarbModifier()` для `trail/ultra` и через warning для странного road-сценария.
- `duration_min` влияет на диапазон carbs/hour, на totals для carbs/fluid/sodium и на long-race warning.
- `weight_kg` после validation больше нигде не используется в текущем `server.js`.
- `temperature_c` участвует в `calculateFluidPerHourMl()` как fallback без sweat rate и в `getSodiumConcentrationMgL()`.
- `fuel_format` пока не меняет сам расчёт carbs/hour; сейчас есть только warning для `drink_only`, если `carbsPerHour > 60`.
- `gi_tolerance_level` — главный переключатель ступеней carbs/hour в текущем v1.1.

## Часть 2 — advanced-поля (фактическая роль в v1.1)

| field | required? | expected role | actual v1.1 role | if null | edge values | discrepancy |
|---|---|---|---|---|---|---|
| effort_level | no | carbs + hydration + warnings | validation + carbs math only | calc continues | outside `easy/steady/race` => error | слабее ожиданий: влияет только на carbs, не влияет на fluid/sodium |
| humidity_pct | no | hydration + sodium + warnings | validation + fluid fallback math only | calc continues, fluid fallback uses temperature only | outside `0..100` => error | слабее ожиданий: не влияет напрямую на sodium и почти не влияет на warnings |
| distance_km | no | pacing context + warnings + plan realism | validation + warnings only | calc continues | outside `1..300` => error | сильное расхождение: на result math не влияет |
| sweat_rate_lph | no | hydration + sodium + warnings | validation + главный driver fluid math | calc continues, fluid switches to temp/humidity fallback | outside `0.2..2.5` => error | частичное расхождение: сильно влияет на fluid, но напрямую не меняет sodium concentration logic |
| elevation_gain_m | no | carbs + hydration + schedule + warnings | validation + small carbs math modifier only for `trail/ultra` | calc continues | outside `0..20000` => error | слабее ожиданий: не влияет на fluid/sodium/plan напрямую |
| sodium_loss_profile | no | sodium + warnings + safety | validation + sodium math only | calc continues, sodium uses temperature-only base | outside `low/medium/high/unknown` => error | частичное расхождение: влияет на sodium, но без отдельной safety logic и without special handling for `unknown` |

### Notes for audit — advanced
- `effort_level`: `easy` даёт `-15 g/h`, `race` даёт `+15 g/h`, `steady` фактически ничего не меняет.
- `humidity_pct`: участвует только в `calculateFluidPerHourMl()` при отсутствии `sweat_rate_lph`; модификатор грубый: `0.95 / 1.00 / 1.05 / 1.10`.
- `distance_km`: на вычисление carbs/fluid/sodium не влияет; используется только для проверки правдоподобия средней скорости и одного road-warning.
- `sweat_rate_lph`: если задан, то `fluid_per_hour_ml = sweat_rate_lph * 1000 * 0.7`; это главный персональный hydration input в текущем v1.1.
- `elevation_gain_m`: через `getElevationCarbModifier()` даёт `+5 g/h` при `>=500 m` и `+10 g/h` при `>=1500 m`, только для `trail/ultra`.
- `sodium_loss_profile`: меняет `sodium_concentration_mg_l` на `-150 / 0 / +150`, а `unknown` сейчас фактически ведёт себя как `medium`.