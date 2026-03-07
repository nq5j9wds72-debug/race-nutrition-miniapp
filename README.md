# Race Nutrition Mini App

MVP v1 мини-приложения Telegram для расчёта питания на гонку.

## Что это делает

Приложение помогает получить ориентировочный план на гонку по:
- углеводам
- жидкости
- натрию
- эквиваленту в гелях

## Что уже работает

- Mini app открывается в Telegram
- Frontend задеплоен на Cloudflare Pages
- Backend задеплоен на Render
- Есть рабочий endpoint `/health`
- Есть рабочий endpoint `/api/auth`
- Есть рабочий endpoint `/api/calc`
- Есть рабочий endpoint `/api/metrics`
- Есть рабочий endpoint `/api/track-open`
- Есть служебный endpoint `/api/calc-test`
- Работает серверная проверка Telegram initData
- Работает расчёт через `/api/calc`
- Работают базовые метрики MVP
- Результат показывается в mini app на русском языке
- Ошибки валидации показываются отдельным красным блоком
- Warnings показываются отдельным блоком
- Summary и plan_steps приведены к человеческому виду
- Во frontend есть статус:
  - `auth: ...`
  - `calc: ...`
- Во frontend есть вызов `/api/track-open` при открытии mini app
- Во frontend есть вызов `/api/auth` при открытии mini app

## Стек

- Frontend: HTML / CSS / JavaScript
- Backend: Node.js + Express
- Deploy frontend: Cloudflare Pages
- Deploy backend: Render

## Production URLs

- Frontend: https://race-nutrition-miniapp.pages.dev/
- Backend: https://race-nutrition-miniapp.onrender.com

## Текущие API endpoints

- `GET /health`
- `POST /api/auth`
- `POST /api/calc`
- `GET /api/metrics`
- `POST /api/track-open`
- `POST /api/calc-test`

## Статус MVP v1

Сейчас проект умеет:
- открыть mini app внутри Telegram
- проверить авторизацию Telegram на сервере
- принять данные формы
- посчитать план по питанию и гидратации
- показать ошибки валидации
- показать warnings
- считать базовые метрики открытия, auth и расчётов

## Основные файлы

- `web/index.html` — frontend mini app
- `server.js` — backend и расчётная логика
- `README.md` — текущее состояние проекта и контракт правды
- `00_MASTER_PLAN_RACE_NUTRITION.md` — план Дней 15–30

## Текущий этап

- Завершён День 15
- Текущий день: День 16
- Цель Дня 16:
  - синхронизировать frontend и backend по диапазонам
  - синхронизировать enum-значения
  - убрать скрытую подстановку `effort_level = "race"` при пустом optional-поле
  - зафиксировать единые допустимые значения и диапазоны в README

## Финальная проверка MVP v1

Перед фиксацией рабочего состояния проекта проверяем:

- Mini app открывается внутри Telegram
- Статус авторизации показывает `auth: ok`
- Базовый расчёт отрабатывает без ошибки
- Ошибка валидации показывается при пустых обязательных полях
- Warnings показываются отдельным блоком
- `/api/metrics` отвечает и показывает счётчики событий
- После открытия mini app увеличивается `miniapp_open`
- После успешного расчёта увеличивается `calc_success`

## Итог финальной проверки

Проверено вручную:

- Mini app открывается внутри Telegram
- Авторизация показывает `auth: ok`
- Базовый расчёт проходит успешно
- Ошибка валидации показывается отдельным красным блоком
- `/api/metrics` отвечает корректно
- Счётчики `miniapp_open`, `auth_success`, `calc_success`, `calc_validation_error` работают

---

## День 15 — Контракт правды по полям и формулам

### Текущий фактический статус проекта

По факту после завершения Дня 14:

- День 14 закрыт
- День 15 посвящён фиксации правды по input-полям, валидации, формулам и тест-кейсам
- На Дне 15 код не менялся
- На Дне 15 фиксировалась документация и фактическая логика текущей версии

### Что реально влияет на расчёт сейчас

#### Блок углеводов

Сейчас на расчёт углеводов реально влияют только:

- `duration_min`
- `gi_tolerance_level`

Дополнительно:
- `fuel_format` не меняет саму формулу углеводов
- `fuel_format` влияет только на warnings
- `effort_level` сейчас в математике углеводов не участвует
- `distance_km` сейчас в математике углеводов не участвует
- `elevation_gain_m` сейчас в математике углеводов не участвует

#### Блок жидкости

Сейчас на расчёт жидкости реально влияют:

- `sweat_rate_lph`, если поле задано
- если `sweat_rate_lph` не задан, тогда используется `temperature_c`

Дополнительно:
- `humidity_pct` сейчас в математике жидкости не участвует
- `effort_level` сейчас в математике жидкости не участвует
- `distance_km` сейчас в математике жидкости не участвует
- `elevation_gain_m` сейчас в математике жидкости не участвует

#### Блок натрия

Сейчас на расчёт натрия реально влияют:

- `temperature_c` через sodium concentration
- рассчитанная жидкость (`fluid_per_hour_ml`)

Дополнительно:
- `sodium_loss_profile` сейчас в математике натрия не участвует
- `humidity_pct` сейчас в математике натрия не участвует
- `distance_km` сейчас в математике натрия не участвует
- `elevation_gain_m` сейчас в математике натрия не участвует

### Что уже есть в форме, но ещё не подключено к формулам

Эти поля уже есть во frontend и приходят на сервер, но пока не дают реального влияния на maths:

- `effort_level`
- `humidity_pct`
- `distance_km`
- `elevation_gain_m`
- `sodium_loss_profile`

Текущее состояние по ним:

- `effort_level`:
  - есть в форме
  - приходит на сервер
  - отдельно жёстко не валидируется
  - на расчёт пока не влияет
  - если не выбрано, сервер сейчас скрыто подставляет `"race"`

- `humidity_pct`:
  - есть в форме
  - приходит на сервер
  - валидируется диапазоном `0..100`
  - на расчёт пока не влияет

- `distance_km`:
  - есть в форме
  - приходит на сервер
  - валидируется на сервере диапазоном `1..300`
  - на расчёт пока не влияет

- `elevation_gain_m`:
  - есть в форме
  - приходит на сервер
  - валидируется диапазоном `0..20000`
  - на расчёт пока не влияет

- `sodium_loss_profile`:
  - есть в форме
  - приходит на сервер
  - отдельно по enum сейчас не валидируется
  - на расчёт пока не влияет

### Что реально валидируется на сервере сейчас

#### Обязательные поля

- `race_type` → `road / trail / ultra`
- `duration_min` → `30..2160`
- `weight_kg` → `35..150`
- `temperature_c` → `-20..45`
- `fuel_format` → `drink_only / gels / combo`
- `gi_tolerance_level` → `low / medium / high`

#### Optional-поля

- `humidity_pct` → `0..100`
- `distance_km` → `1..300`
- `sweat_rate_lph` → `0.2..2.5`
- `elevation_gain_m` → `0..20000`

#### Отдельно важно

- `sodium_loss_profile` сейчас нормализуется, но отдельно не валидируется
- `effort_level` сейчас нормализуется через скрытую подстановку `race`, если поле пустое

### Что реально влияет только на warnings

Сейчас warnings зависят от таких условий:

- если `carbs_per_hour_g >= 75`
- если `fuel_format = drink_only` и `carbs_per_hour > 60`
- если `sweat_rate_lph` не задан и `temperature_c >= 20`
- если `duration_min > 720`
- всегда добавляется warning:
  - `Натрий — это ориентир, а не защита от перепивания.`

### Расхождения form ↔ server, которые уже зафиксированы

#### 1. distance_km

- во frontend: max = `500`
- на сервере: max = `300`

#### 2. sweat_rate_lph

- во frontend: max = `5`
- на сервере: max = `2.5`

#### 3. effort_level

- во frontend значения:
  - `""`
  - `easy`
  - `steady`
  - `race`
- на сервере поле пока не влияет на формулы
- если не выбрано, сервер скрыто подставляет `"race"`

#### 4. sodium_loss_profile

- во frontend значения:
  - `""`
  - `low`
  - `medium`
  - `high`
  - `unknown`
- на сервере отдельной валидации и логики по этому полю пока нет

### Контрольные baseline test cases для дальнейшей регрессии

#### Кейс A — базовый road

Цель:
- проверить стандартный успешный расчёт без крайних условий

Ожидаем:
- `HTTP 200`
- успешный расчёт
- без validation error
- warnings возможны только по реальным условиям

#### Кейс B — trail в жару

Цель:
- проверить работу температуры и warnings по жидкости

Ожидаем:
- `HTTP 200`
- fluid выше, чем в прохладном сценарии
- warning о меньшей точности жидкости возможен, если нет `sweat_rate_lph`

#### Кейс C — long race без sweat rate

Цель:
- проверить длинную гонку и warning-heavy поведение

Ожидаем:
- `HTTP 200`
- long-race warning
- hydration считается по temperature fallback

#### Кейс D — race с sweat rate

Цель:
- проверить приоритет пользовательского `sweat_rate_lph`

Ожидаем:
- `HTTP 200`
- fluid считается от `sweat_rate_lph`
- temperature не является главным драйвером жидкости

#### Кейс E — validation error

Цель:
- проверить отказ при невалидных обязательных полях

Ожидаем:
- `HTTP 400`
- ошибки показываются отдельным красным блоком
- расчёт не выполняется

#### Кейс F — warning-heavy case

Цель:
- проверить накопление нескольких warnings одновременно

Ожидаем:
- `HTTP 200`
- несколько warnings сразу
- результат при этом всё равно строится, если вход валидный

### Что считается правдой на конец Дня 15

На конец Дня 15 нельзя утверждать, что:

- `race_type` уже влияет на расчёт
- `effort_level` уже влияет на расчёт
- `humidity_pct` уже влияет на расчёт
- `distance_km` уже влияет на расчёт
- `elevation_gain_m` уже влияет на расчёт
- `sodium_loss_profile` уже влияет на расчёт

Можно утверждать только это:

- `race_type` сейчас валидируется, но в maths и warnings не участвует
- эти optional-поля уже есть в форме
- они уже передаются на сервер
- часть из них уже валидируется
- но большая часть ещё не подключена к фактической математике

---

## Таблица input-полей — фактическое поведение на День 15

| field_name | есть в форме | приходит на сервер | валидируется сейчас | влияет на maths сейчас | влияет на warnings сейчас | planned_for_v1.1 | note |
|---|---|---|---|---|---|---|---|
| `race_type` | да | да | да | нет | нет | да | обязательное поле, enum: `road / trail / ultra`; сейчас в maths и warnings не участвует |
| `duration_min` | да | да | да | да | да | да | собирается на фронте из `duration_hours + duration_minutes` |
| `weight_kg` | да | да | да | нет | нет | возможно позже | сейчас обязательное, но в формулах v1 фактически не участвует |
| `temperature_c` | да | да | да | да | да | да | влияет на fluid fallback и sodium concentration |
| `fuel_format` | да | да | да | нет | да | да | влияет не на формулу, а на warnings |
| `gi_tolerance_level` | да | да | да | да | нет | да | один из двух главных драйверов блока carbs |
| `effort_level` | да | да | нет отдельно | нет | нет | да | optional-поле; если пусто, сервер сейчас скрыто подставляет `"race"` |
| `humidity_pct` | да | да | да | нет | нет | да | есть в форме и на сервере, но пока не подключено |
| `distance_km` | да | да | да | нет | нет | да | сейчас не влияет на maths; позже — sanity-check / warnings |
| `sweat_rate_lph` | да | да | да | да | да | да | если задано, имеет приоритет в блоке fluid |
| `elevation_gain_m` | да | да | да | нет | нет | да | есть, но пока не подключено |
| `sodium_loss_profile` | да | да | нет отдельно | нет | нет | да | во frontend есть `unknown`, на сервере отдельной enum-валидации пока нет |

### Короткая расшифровка статусов

- **влияет на maths сейчас** = меняет численный расчёт
- **влияет на warnings сейчас** = не меняет формулу, но меняет предупреждения
- **planned_for_v1.1** = поле планируется подключить в ближайших днях плана, но пока ещё не считается реальным фактором модели

---

## Формульная карта v1 — что реально считает server.js сейчас

### 1. Блок carbs

#### Реально используемые input

- `duration_min`
- `gi_tolerance_level`

#### Логика

- если `duration_min < 60`:
  - `low` → `0 г/ч`
  - `medium` → `15 г/ч`
  - `high` → `30 г/ч`

- если `duration_min >= 60` и `duration_min <= 150`:
  - `low` → `30 г/ч`
  - `medium` → `45 г/ч`
  - `high` → `60 г/ч`

- если `duration_min > 150`:
  - `low` → `60 г/ч`
  - `medium` → `75 г/ч`
  - `high` → `90 г/ч`

#### Производные значения

- `carb_interval_min`:
  - по умолчанию `30`
  - если `carbs_per_hour_g > 45` и `carbs_per_hour_g <= 75` → `20`
  - если `carbs_per_hour_g > 75` → `15`

- `carbs_total_g = carbs_per_hour_g * duration_hours`
- `carbs_per_intake_g = carbs_per_hour_g / (60 / carb_interval_min)`

#### Что сейчас не влияет на carbs

- `race_type`
- `weight_kg`
- `temperature_c`
- `fuel_format`
- `effort_level`
- `humidity_pct`
- `distance_km`
- `sweat_rate_lph`
- `elevation_gain_m`
- `sodium_loss_profile`

#### Что влияет только на warnings вокруг carbs

- `fuel_format = drink_only`
- высокий `carbs_per_hour_g`

### 2. Блок fluid

#### Реально используемые input

- `sweat_rate_lph`, если задан
- иначе `temperature_c`

#### Логика

- если задан `sweat_rate_lph`:
  - `fluid_per_hour_ml = sweat_rate_lph * 1000 * 0.7`

- если `sweat_rate_lph` не задан:
  - `temperature_c < 10` → `400 мл/ч`
  - `temperature_c >= 10` и `temperature_c <= 19` → `500 мл/ч`
  - `temperature_c >= 20` и `temperature_c <= 29` → `650 мл/ч`
  - `temperature_c >= 30` → `800 мл/ч`

#### Производные значения

- `fluid_total_ml = fluid_per_hour_ml * duration_hours`
- `fluid_interval_min = 15`
- `fluid_per_intake_ml = fluid_per_hour_ml / 4`

#### Что сейчас не влияет на fluid

- `race_type`
- `weight_kg`
- `fuel_format`
- `gi_tolerance_level`
- `effort_level`
- `humidity_pct`
- `distance_km`
- `elevation_gain_m`
- `sodium_loss_profile`

#### Что влияет только на warnings вокруг fluid

- отсутствие `sweat_rate_lph` при `temperature_c >= 20`
- очень длинная гонка

### 3. Блок sodium

#### Реально используемые input

- `temperature_c`
- уже рассчитанный `fluid_per_hour_ml`

#### Логика по sodium concentration

- `temperature_c >= 30` → `900 мг/л`
- `temperature_c >= 20` и `temperature_c <= 29` → `700 мг/л`
- `temperature_c < 20` → `500 мг/л`

#### Производные значения

- `sodium_per_hour_mg = (fluid_per_hour_ml / 1000) * sodium_concentration_mg_l`
- `sodium_total_mg = sodium_per_hour_mg * duration_hours`
- `sodium_interval_min = 15`
- `sodium_per_intake_mg = sodium_per_hour_mg / 4`

#### Что сейчас не влияет на sodium

- `race_type`
- `weight_kg`
- `fuel_format`
- `gi_tolerance_level`
- `effort_level`
- `humidity_pct`
- `distance_km`
- `elevation_gain_m`
- `sodium_loss_profile`

#### Что влияет косвенно

- `sweat_rate_lph` влияет на fluid
- fluid влияет на sodium

### 4. Блок gel equivalent

#### Реально используемые input

- результат блока carbs

#### Логика

- `gel_basis_g = 25`
- `gels_per_hour_est = carbs_per_hour_g / 25`
- `gels_total_est = carbs_total_g / 25`

### 5. Главная правда текущей версии v1

Сейчас `server.js` по факту считает так:

- **carbs** = от `duration_min + gi_tolerance_level`
- **fluid** = от `sweat_rate_lph`, а если его нет — от `temperature_c`
- **sodium** = от `temperature_c` через sodium concentration и от рассчитанной жидкости
- **gel equivalent** = от уже рассчитанных углеводов

Это значит, что следующие поля пока **не участвуют в реальной математике v1**:

- `race_type`
- `effort_level`
- `humidity_pct`
- `distance_km`
- `elevation_gain_m`
- `sodium_loss_profile`

Их нельзя описывать пользователю как полноценные “умные факторы” до подключения в следующих днях плана.

---

## Что важно помнить отдельно

- Метрики сейчас хранятся только в памяти процесса
- После перезапуска Render счётчики обнулятся
- Для MVP v1 это пока допустимо
- `BOT_TOKEN` обязателен для `/api/auth`
- Текущий baseline-код проще, чем экспертная модель и план v1.1
- На следующем этапе нельзя смешивать:
  - текущую рабочую реализацию
  - желаемую будущую формульную систему

## Следующий шаг

Следующий рабочий этап — День 16:
- синхронизировать `distance_km` между frontend и backend
- синхронизировать `sweat_rate_lph` между frontend и backend
- убрать скрытую подстановку `effort_level = "race"` при пустом optional-поле
- определить честную обработку `sodium_loss_profile`