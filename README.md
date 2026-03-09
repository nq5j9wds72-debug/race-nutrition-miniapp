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
- `server/server.js` — backend и расчётная логика
- `README.md` — текущее состояние проекта и контракт правды
- `00_MASTER_PLAN_RACE_NUTRITION.md` — план Дней 15–30

## Текущий этап

- Фактически завершён День 20
- Следующий рабочий день: День 21
- День 19 был посвящён честному подключению `distance_km` к sanity-check warnings
- День 20 был посвящён честному подключению `elevation_gain_m` к carbs без поломки baseline-логики

## Финальная проверка текущего состояния

Проверено вручную:

- Mini app открывается внутри Telegram
- Авторизация показывает `auth: ok`
- Базовый расчёт проходит успешно
- Ошибка валидации показывается отдельным красным блоком
- `/api/metrics` отвечает корректно
- Счётчики `miniapp_open`, `auth_success`, `calc_success`, `calc_validation_error` работают
- `effort_level` влияет на carbs
- `humidity_pct` влияет на fluid fallback
- при наличии `sweat_rate_lph` влажность не перехватывает приоритет
- `distance_km` влияет на warnings по средней скорости
- `race_type + distance_km + duration_min` могут давать warning для необычного road-сценария
- `elevation_gain_m` влияет на carbs для `trail / ultra`
- production backend и локальный backend показывают одинаковый результат по кейсу Дня 20

---

## Ключевая правда проекта на текущий момент

### Что реально считает backend сейчас

Сейчас `server/server.js` по факту считает так:

- **carbs** = от `duration_min + gi_tolerance_level + effort_level + elevation_gain_m`
- **fluid** = от `sweat_rate_lph`, а если его нет — от `temperature_c` с мягкой корректировкой по `humidity_pct`
- **sodium** = от `temperature_c` через sodium concentration и от рассчитанной жидкости
- **gel equivalent** = от уже рассчитанных углеводов

### Что уже есть в форме, но ещё не подключено к maths

Эти поля уже есть во frontend и приходят на сервер, но пока не влияют на реальную математику v1:

- `race_type`
- `weight_kg`
- `distance_km`
- `fuel_format`
- `sodium_loss_profile`

### Что уже не является декоративным

Эти поля уже реально влияют на поведение расчёта или warnings:

- `effort_level` → влияет на carbs
- `humidity_pct` → влияет на fluid fallback
- `distance_km` → влияет на sanity-check warnings
- `race_type` → участвует в road-specific warning
- `elevation_gain_m` → влияет на carbs для `trail / ultra`

### Что нельзя обещать пользователю как уже работающую “умную модель”

Пока нельзя утверждать, что в расчёте реально участвуют:

- `weight_kg`
- `distance_km` как прямой множитель formulas
- `sodium_loss_profile`

То есть:
- `distance_km` уже влияет на warnings, но ещё не участвует напрямую в maths
- `sodium_loss_profile` уже валидируется, но пока не влияет на sodium maths
- `weight_kg` пока обязательное поле, но в формулах v1 фактически не участвует

---

## Что реально лежит во frontend

### Обязательные поля формы

- `race_type`
- `duration_hours`
- `duration_minutes`
- `weight_kg`
- `temperature_c`
- `fuel_format`
- `gi_tolerance_level`

### Optional-поля формы

- `effort_level`
- `humidity_pct`
- `distance_km`
- `sweat_rate_lph`
- `elevation_gain_m`
- `sodium_loss_profile`

### Текущие значения select-полей во frontend

#### `effort_level`

- `""` — не выбрано
- `easy`
- `steady`
- `race`

#### `sodium_loss_profile`

- `""` — не выбрано
- `low`
- `medium`
- `high`
- `unknown`

#### `fuel_format`

- `drink_only`
- `gels`
- `combo`

### Что важно про frontend

- frontend обращается напрямую к production backend:
  - `https://race-nutrition-miniapp.onrender.com`
- frontend использует `tg.initDataUnsafe` только для показа пользователя
- frontend использует `tg.initData` для запроса на `/api/auth`
- `duration_min` во frontend не вводится напрямую
- `duration_min` собирается из `duration_hours + duration_minutes`

### Порядок показа результата во frontend

- План на гонку
- Углеводы
- Жидкость
- Натрий
- Эквивалент в гелях
- Как действовать на гонке
- Что учесть

---

## Что реально лежит в backend

### `/api/auth`

- требует `BOT_TOKEN`
- проверяет подпись Telegram `initData`
- проверяет `auth_date` со сроком 24 часа
- при успехе увеличивает `auth_success`

### `/api/track-open`

- увеличивает `miniapp_open`

### `/api/calc`

- при успехе увеличивает `calc_success`
- при ошибках валидации увеличивает `calc_validation_error`

### Что подтверждено после Дня 17

- `effort_level` реально подключён к carbs

### Что подтверждено после Дня 18

- `humidity_pct` реально подключён к fluid fallback
- при наличии `sweat_rate_lph` влажность не вмешивается в расчёт жидкости

### Что подтверждено после Дня 19

- `distance_km` реально подключён к sanity-check warnings
- средняя скорость считается как:
  - `avgSpeedKmh = distance_km / (duration_min / 60)`
- добавлены warnings:
  - слишком низкая средняя скорость
  - слишком высокая средняя скорость
  - необычный road-сценарий

### Что подтверждено после Дня 20

- `elevation_gain_m` реально подключён к carbs
- это влияние пока узкое и безопасное:
  - только для `trail / ultra`
  - только как умеренный модификатор carbs
- `fluid` и `sodium` на Дне 20 не менялись

---

## Что подтверждено тестами

### Базовый кейс без humidity

Вход:
- `trail`
- `6:00`
- `72 кг`
- `24°C`
- `combo`
- `medium`

Результат:
- `75 г углеводов/ч`
- `650 мл жидкости/ч`
- `455 мг натрия/ч`

### Кейс `effort_level = easy`

Результат:
- `60 г углеводов/ч`
- `650 мл жидкости/ч`
- `455 мг натрия/ч`

### Кейс `effort_level = steady`

Результат:
- `75 г углеводов/ч`
- `650 мл жидкости/ч`
- `455 мг натрия/ч`

### Кейс `effort_level = race`

Результат:
- `90 г углеводов/ч`
- `650 мл жидкости/ч`
- `455 мг натрия/ч`
- `carb_interval = 15 мин`

### Кейс `humidity_pct = 30`

Результат:
- `75 г углеводов/ч`
- `618 мл жидкости/ч`
- `433 мг натрия/ч`

### Кейс `humidity_pct = 70`

Результат:
- `75 г углеводов/ч`
- `683 мл жидкости/ч`
- `478 мг натрия/ч`

### Кейс `humidity_pct = 90`

Результат:
- `75 г углеводов/ч`
- `715 мл жидкости/ч`
- `501 мг натрия/ч`

### Кейс `humidity_pct = 90` и `sweat_rate_lph = 1.0`

Результат:
- `75 г углеводов/ч`
- `700 мл жидкости/ч`
- `490 мг натрия/ч`

Вывод:
- влажность влияет только на fallback-модель жидкости
- `sweat_rate_lph` сохраняет главный приоритет
- sodium меняется только как следствие изменения жидкости

### Кейс `distance_km = 5`, `duration_min = 360`

Результат:
- появляется warning:
  - `Проверь дистанцию и длительность: средняя скорость получилась слишком низкой.`

### Кейс `distance_km = 30`, `duration_min = 60`

Результат:
- появляется warning:
  - `Проверь дистанцию и длительность: средняя скорость получилась слишком высокой.`

### Кейс `race_type = road`, `distance_km = 15`, `duration_min = 360`

Результат:
- появляется warning:
  - `Проверь дистанцию, длительность и тип гонки: для road такой сценарий выглядит необычно.`

### Кейс Дня 20: `trail`, `6:00`, `medium`, `steady`, `distance_km = 50`, `elevation_gain_m = 0`

Результат:
- `75 г углеводов/ч`
- `500 мл жидкости/ч`
- `250 мг натрия/ч`

### Кейс Дня 20: `trail`, `6:00`, `medium`, `steady`, `distance_km = 50`, `elevation_gain_m = 1800`

Результат:
- `85 г углеводов/ч`
- `500 мл жидкости/ч`
- `250 мг натрия/ч`

Вывод:
- `elevation_gain_m` реально меняет carbs
- на этом шаге `fluid` и `sodium` не меняются
- baseline-кейс не сломан
- production и локальный результат совпали

---

## Что реально валидируется на сервере сейчас

### Обязательные поля

- `race_type` → `road / trail / ultra`
- `duration_min` → `30..2160`
- `weight_kg` → `35..150`
- `temperature_c` → `-20..45`
- `fuel_format` → `drink_only / gels / combo`
- `gi_tolerance_level` → `low / medium / high`

### Optional-поля

- `effort_level` → `null` или `easy / steady / race`
- `humidity_pct` → `0..100`
- `distance_km` → `1..300`
- `sweat_rate_lph` → `0.2..2.5`
- `elevation_gain_m` → `0..20000`
- `sodium_loss_profile` → `null` или `low / medium / high / unknown`

### Отдельно важно

- `effort_level` больше не превращается скрыто в `race`
- `sodium_loss_profile` валидируется отдельно
- `distance_km` валидируется и влияет на warnings
- `elevation_gain_m` валидируется и влияет на carbs
- `sodium_loss_profile` пока ещё не влияет на maths

---

## Таблица input-полей — фактическое поведение

| field_name | есть в форме | приходит на сервер | валидируется сейчас | влияет на maths сейчас | влияет на warnings сейчас | note |
|---|---|---|---|---|---|---|
| `race_type` | да | да | да | нет | да | обязательное поле; сейчас в maths не участвует, но участвует в road-warning |
| `duration_min` | да | да | да | да | да | собирается на фронте из `duration_hours + duration_minutes` |
| `weight_kg` | да | да | да | нет | нет | сейчас обязательное, но в формулах v1 фактически не участвует |
| `temperature_c` | да | да | да | да | да | влияет на fluid fallback и sodium concentration |
| `fuel_format` | да | да | да | нет | да | влияет не на формулу, а на warnings |
| `gi_tolerance_level` | да | да | да | да | нет | один из главных драйверов блока carbs |
| `effort_level` | да | да | да | да | нет | optional-поле; если пусто, остаётся `null` |
| `humidity_pct` | да | да | да | да | нет | влияет только на fluid fallback, если `sweat_rate_lph` не задан |
| `distance_km` | да | да | да | нет | да | сейчас не влияет на maths напрямую, но влияет на sanity-check warnings |
| `sweat_rate_lph` | да | да | да | да | да | если задано, имеет приоритет в блоке fluid |
| `elevation_gain_m` | да | да | да | да | нет | влияет на carbs для `trail / ultra` |
| `sodium_loss_profile` | да | да | да | нет | нет | отдельно валидируется, но пока не влияет на maths |

### Короткая расшифровка статусов

- **влияет на maths сейчас** = меняет численный расчёт
- **влияет на warnings сейчас** = не меняет формулу, но меняет предупреждения

---

## Формульная карта v1 — что реально считает `server/server.js` сейчас

### 1. Блок carbs

#### Реально используемые input

- `duration_min`
- `gi_tolerance_level`
- `effort_level`
- `elevation_gain_m`

#### Базовая логика

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

#### Модификатор `effort_level`

- `null` → `0`
- `easy` → `-15`
- `steady` → `0`
- `race` → `+15`

#### Модификатор `elevation_gain_m`

Работает только для `trail / ultra`.

- если `elevation_gain_m < 500` → `+0`
- если `elevation_gain_m >= 500` и `< 1500` → `+5`
- если `elevation_gain_m >= 1500` → `+10`

Для `road`:
- `elevation_gain_m` сейчас даёт `+0`

#### Ограничения

- ниже `0 г/ч` не уходим
- выше `90 г/ч` не поднимаемся

#### Производные значения

- `carb_interval_min`
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
- `humidity_pct`
- `distance_km`
- `sweat_rate_lph`
- `sodium_loss_profile`

#### Что влияет только на warnings вокруг carbs

- `fuel_format = drink_only`
- высокий `carbs_per_hour_g`

---

### 2. Блок fluid

#### Реально используемые input

- `sweat_rate_lph`, если задан
- иначе `temperature_c`
- и `humidity_pct` как мягкий модификатор fallback-оценки

#### Логика

Если задан `sweat_rate_lph`:

- `fluid_per_hour_ml = sweat_rate_lph * 1000 * 0.7`

Если `sweat_rate_lph` не задан:

- `temperature_c < 10` → `400 мл/ч`
- `temperature_c >= 10` и `temperature_c <= 19` → `500 мл/ч`
- `temperature_c >= 20` и `temperature_c <= 29` → `650 мл/ч`
- `temperature_c >= 30` → `800 мл/ч`

После этого, только для fallback-модели:

- `humidity_pct >= 80` → `+10%`
- `humidity_pct >= 60` → `+5%`
- `humidity_pct <= 30` → `-5%`
- иначе → без изменений

Итог:
- если `humidity_pct` не задан, остаётся базовый temperature-based результат
- если `sweat_rate_lph` задан, влажность не вмешивается

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
- `distance_km`
- `elevation_gain_m`
- `sodium_loss_profile`

#### Что влияет только на warnings вокруг fluid

- отсутствие `sweat_rate_lph` при `temperature_c >= 20`
- очень длинная гонка

---

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

#### Что сейчас не влияет на sodium напрямую

- `race_type`
- `weight_kg`
- `fuel_format`
- `gi_tolerance_level`
- `effort_level`
- `distance_km`
- `elevation_gain_m`
- `sodium_loss_profile`

#### Что влияет косвенно

- `sweat_rate_lph` влияет на fluid
- `humidity_pct` влияет на fluid fallback, если `sweat_rate_lph` не задан
- fluid влияет на sodium

---

### 4. Блок gel equivalent

#### Реально используемые input

- результат блока carbs

#### Логика

- `gel_basis_g = 25`
- `gels_per_hour_est = carbs_per_hour_g / 25`
- `gels_total_est = carbs_total_g / 25`

---

## Warnings — что подтверждено сейчас

Сейчас warnings зависят от таких условий:

- если `avgSpeedKmh < 2`
  - warning про слишком низкую среднюю скорость
- если `avgSpeedKmh > 25`
  - warning про слишком высокую среднюю скорость
- если `race_type = road` и `distance_km <= 21.1` и `duration_min >= 300`
  - warning про необычный road-сценарий
- если `carbs_per_hour_g >= 75`
  - warning про высокий план по углеводам
- если `fuel_format = drink_only` и `carbs_per_hour > 60`
  - warning про неудобство набора углеводов только напитком
- если `sweat_rate_lph` не задан и `temperature_c >= 20`
  - warning про низкую точность расчёта жидкости
- если `duration_min > 720`
  - warning про очень длинную гонку
- всегда добавляется warning:
  - `Натрий — это ориентир, а не защита от перепивания.`

---

## Что зафиксировано и не меняем без отдельного решения

- Это MVP v1
- Сервер считает, фронт только красиво показывает
- Всё, что видит пользователь, должно быть на русском языке
- Не делаем большой редизайн
- Не добавляем Figma
- Не добавляем платежи
- Не добавляем бренды гелей
- Не переписываем работающий frontend и backend целиком без необходимости

---

## Что важно помнить отдельно

- Метрики сейчас хранятся только в памяти процесса
- После перезапуска Render счётчики обнулятся
- Для MVP v1 это пока допустимо
- `BOT_TOKEN` обязателен для `/api/auth`
- Текущий baseline-код проще, чем экспертная модель и план v1.1
- GitHub-коннектор подключен
- После каждого дня пользователь дополнительно обновляет 2 основных файла проекта:
  - `web/index.html`
  - `server/server.js`

---

## Следующий шаг

Следующий рабочий этап — День 21.

Логика следующего шага:
- не трогать форму без необходимости
- не трогать БД
- не делать редизайн
- подключать следующий честный фактор по одному микрошагу
- сохранять baseline-кейс рабочим

Приоритет:
- сохранять честный контракт между form ↔ server ↔ maths
- не добавлять в UI обещания, которых ещё нет в формулах
- следующий кандидат на подключение:
  - `sodium_loss_profile`