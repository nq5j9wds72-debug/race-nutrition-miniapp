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

- Фактически завершён День 21
- Следующий рабочий день: День 22
- День 19 был посвящён честному подключению `distance_km` к sanity-check warnings
- День 20 был посвящён честному подключению `elevation_gain_m` к carbs без поломки baseline-логики
- День 21 был посвящён честному подключению `sodium_loss_profile` к sodium без изменения carbs и fluid

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
- `sodium_loss_profile = low / medium / high` влияет на sodium
- `sodium_loss_profile = unknown` даёт отдельный warning без изменения maths
- production backend и локальный backend показывают одинаковый результат по кейсам Дня 21

---

## Ключевая правда проекта на текущий момент

### Что реально считает backend сейчас

Сейчас `server/server.js` по факту считает так:

- **carbs** = от `duration_min + gi_tolerance_level + effort_level + elevation_gain_m`
- **fluid** = от `sweat_rate_lph`, а если его нет — от `temperature_c` с мягкой корректировкой по `humidity_pct`
- **sodium** = от `temperature_c` через sodium concentration, от рассчитанной жидкости и от `sodium_loss_profile`
- **gel equivalent** = от уже рассчитанных углеводов

### Что уже есть в форме, но ещё не подключено к maths

Эти поля уже есть во frontend и приходят на сервер, но пока не влияют на реальную математику v1:

- `race_type`
- `weight_kg`
- `distance_km`
- `fuel_format`

### Что уже не является декоративным

Эти поля уже реально влияют на поведение расчёта или warnings:

- `effort_level` → влияет на carbs
- `humidity_pct` → влияет на fluid fallback
- `distance_km` → влияет на sanity-check warnings
- `race_type` → участвует в road-specific warning
- `elevation_gain_m` → влияет на carbs для `trail / ultra`
- `sodium_loss_profile` → влияет на sodium или warnings в зависимости от значения

### Что нельзя обещать пользователю как уже работающую “умную модель”

Пока нельзя утверждать, что в расчёте реально участвуют:

- `weight_kg`
- `distance_km` как прямой множитель formulas
- `race_type` как прямой множитель formulas
- `fuel_format` как прямой множитель formulas

То есть:
- `distance_km` уже влияет на warnings, но ещё не участвует напрямую в maths
- `race_type` уже участвует в части warnings и в логике elevation-модификатора, но не является отдельным прямым множителем основной модели
- `fuel_format` уже влияет на warnings, но не меняет formulas
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

### Что подтверждено после Дня 21

- `sodium_loss_profile` реально подключён к sodium
- модификатор работает через `sodium_concentration_mg_l`
- логика сейчас такая:
  - `low` → `-150 мг/л`
  - `medium` → `0`
  - `high` → `+150 мг/л`
  - `unknown` → без изменения maths
  - `null` → без изменения maths
- добавлены пределы:
  - минимум `300 мг/л`
  - максимум `1100 мг/л`
- при `sodium_loss_profile = unknown` добавляется warning:
  - `Профиль потерь натрия не указан точно: план по натрию лучше проверить на тренировке.`

---

## Текущая серверная логика подробнее

### Carbs base

#### Если длительность < 60 мин

- `low` = `0 г/ч`
- `medium` = `15 г/ч`
- `high` = `30 г/ч`

#### Если длительность 60–150 мин

- `low` = `30 г/ч`
- `medium` = `45 г/ч`
- `high` = `60 г/ч`

#### Если длительность > 150 мин

- `low` = `60 г/ч`
- `medium` = `75 г/ч`
- `high` = `90 г/ч`

### Effort modifier

- `null` = `0`
- `easy` = `-15 г/ч`
- `steady` = `0`
- `race` = `+15 г/ч`

### Elevation modifier

Работает только для `trail / ultra`:

- `< 500 м` = `+0 г/ч`
- `500–1499 м` = `+5 г/ч`
- `1500+ м` = `+10 г/ч`

### Carbs clamp

- минимум `0 г/ч`
- максимум `90 г/ч`

### Carb interval

- по умолчанию `30 мин`
- если `>45` и `<=75 г/ч` → `20 мин`
- если `>75 г/ч` → `15 мин`

### Fluid

Если задан `sweat_rate_lph`:

- `fluid_per_hour_ml = sweat_rate_lph * 1000 * 0.7`

Если `sweat_rate_lph` не задан, используется fallback по температуре:

- `<10°C` → `400 мл/ч`
- `10–19°C` → `500 мл/ч`
- `20–29°C` → `650 мл/ч`
- `>=30°C` → `800 мл/ч`

Потом, только если `sweat_rate_lph` не задан и задан `humidity_pct`:

- `humidity_pct >= 80` → `*1.10`
- `humidity_pct >= 60` → `*1.05`
- `humidity_pct <= 30` → `*0.95`
- иначе → без изменений

Результат округляется через `Math.round`.

### Sodium concentration

База по температуре:

- `>=30°C` → `900 мг/л`
- `20–29°C` → `700 мг/л`
- `<20°C` → `500 мг/л`

Потом применяется модификатор `sodium_loss_profile`:

- `low` → `-150 мг/л`
- `medium` → `0`
- `high` → `+150 мг/л`
- `unknown` → `0`
- `null` → `0`

После этого действует clamp:

- минимум `300 мг/л`
- максимум `1100 мг/л`

### Fluid interval

- всегда `15 мин`

### Sodium interval

- всегда `15 мин`

### Gel basis

- `1 гель = 25 г углеводов`

---

## Что сейчас валидируется на сервере

### Обязательные поля

- `race_type`: `road / trail / ultra`
- `duration_min`: `30–2160`
- `weight_kg`: `35–150`
- `temperature_c`: `-20..45`
- `fuel_format`: `drink_only / gels / combo`
- `gi_tolerance_level`: `low / medium / high`

### Optional-поля

- `effort_level`:
  - `null` или `easy / steady / race`
- `humidity_pct`: `0–100`
- `distance_km`: `1–300`
- `sweat_rate_lph`: `0.2–2.5`
- `elevation_gain_m`: `0–20000`
- `sodium_loss_profile`:
  - `null` или `low / medium / high / unknown`

### Что важно

- `effort_level` больше не превращается скрыто в `race`
- `distance_km` валидируется и участвует в warnings
- `elevation_gain_m` валидируется и участвует в carbs
- `sodium_loss_profile` валидируется и теперь участвует в sodium или warnings
- `weight_kg` пока обязательное поле, но в maths не участвует

---

## Что подтверждено по warnings в текущем backend

### Sanity-check warnings

Если `avgSpeedKmh < 2`:
- `Проверь дистанцию и длительность: средняя скорость получилась слишком низкой.`

Если `avgSpeedKmh > 25`:
- `Проверь дистанцию и длительность: средняя скорость получилась слишком высокой.`

Если:
- `race_type = road`
- `distance_km <= 21.1`
- `duration_min >= 300`

то:
- `Проверь дистанцию, длительность и тип гонки: для road такой сценарий выглядит необычно.`

### Practical warnings

Если `carbs_per_hour >= 75`:
- `Высокий план по углеводам лучше заранее протестировать на тренировке.`

Если `fuel_format = drink_only` и `carbs_per_hour > 60`:
- `Только напитком такой объём углеводов набрать может быть неудобно.`

Если `sweat_rate_lph` не задан и `temperature_c >= 20`:
- `В жару без данных о вашей потливости точность расчёта жидкости ниже.`

Если `duration_min > 720`:
- `Очень длинная гонка: расчёт носит ориентировочный характер и требует проверки на практике.`

Если `sodium_loss_profile = unknown`:
- `Профиль потерь натрия не указан точно: план по натрию лучше проверить на тренировке.`

Всегда добавляется:
- `Натрий — это ориентир, а не защита от перепивания.`

---

## Проверочные кейсы

### Кейс Дня 20 — baseline для elevation

Вход:
- `race_type = trail`
- `duration_min = 360`
- `weight_kg = 72`
- `temperature_c = 18`
- `fuel_format = combo`
- `gi_tolerance_level = medium`
- `effort_level = steady`
- `distance_km = 50`
- `elevation_gain_m = 1800`

Результат:
- `carbs = 85 г/ч`
- `fluid = 500 мл/ч`
- `sodium = 250 мг/ч`

### Кейс Дня 21 — sodium_loss_profile = low

Вход:
- тот же кейс
- `sodium_loss_profile = low`

Результат:
- `carbs = 85 г/ч`
- `fluid = 500 мл/ч`
- `sodium = 175 мг/ч`

### Кейс Дня 21 — sodium_loss_profile = high

Вход:
- тот же кейс
- `sodium_loss_profile = high`

Результат:
- `carbs = 85 г/ч`
- `fluid = 500 мл/ч`
- `sodium = 325 мг/ч`

### Кейс Дня 21 — sodium_loss_profile = unknown

Вход:
- тот же кейс
- `sodium_loss_profile = unknown`

Результат:
- `carbs = 85 г/ч`
- `fluid = 500 мл/ч`
- `sodium = 250 мг/ч`
- дополнительно появляется warning про неопределённый профиль потерь натрия

### Что важно по тестам

- baseline без `sodium_loss_profile` не сломан
- `low / high` меняют только sodium
- `unknown` не меняет maths, но меняет warnings
- production backend и локальный backend совпали по результатам

---

## Что зафиксировано в git

### День 20

- `Day 20: add elevation effect on carbs`
- `Day 20: update README for elevation and distance warnings`

### День 21

- `Day 21: connect sodium loss profile to sodium`
- `Day 21: add warning for unknown sodium loss profile`

---

## Что зафиксировано и не меняем без отдельного решения

- Это MVP v1
- Сервер считает, frontend только красиво показывает
- Всё, что видит пользователь, должно быть на русском языке
- Не делаем большой редизайн
- Не добавляем Figma
- Не добавляем платежи
- Не добавляем бренды гелей
- Не переписываем работающий frontend и backend целиком без необходимости

## Что важно помнить отдельно

- Метрики сейчас хранятся только в памяти процесса
- После перезапуска Render счётчики обнулятся
- Для MVP v1 это пока допустимо
- `BOT_TOKEN` обязателен для `/api/auth`
- Текущий baseline-код проще, чем экспертная модель и план v1.1
- GitHub-коннектор подключен
- Пользователь предпочитает очень маленькие шаги
- Код удобнее давать полными блоками, а не мелкими кусками

## Что есть как стратегический план дальше

- Загружен отдельный master plan:
  - `00_MASTER_PLAN_RACE_NUTRITION.md`
- Главная логика плана:
  - сначала убрать ложные обещания form ↔ server ↔ formulas
  - потом усилить расчётное ядро
  - потом добавить хранение данных
  - потом упаковку и продажу

## Что есть как научно-методическая база

- Загружен отдельный файл `Рекомендации эксперта`
- В нём описана расширенная модель:
  - carbs engine
  - fluid engine
  - sodium engine
  - validation
  - warnings
  - JSON contract

Но важно:
- это пока ориентир для развития
- текущий `server/server.js` эту модель ещё не реализует полностью

Не путать:
- что рекомендует экспертный файл
- и что реально работает сейчас в коде

## Следующий логичный шаг

- День 21 по backend уже синхронизирован
- README после вставки тоже будет синхронизирован
- Следующий рабочий день:
  - День 22
- Следующий честный кандидат на подключение к maths:
  - `weight_kg` или следующий фактор из master plan

  ---

## День 23 — ручная регрессия MVP v1.1

Цель дня: руками проверить, что после изменений Дней 16–22 продукт работает как единая система, и зафиксировать результаты.

### Статус дня
- День 23: завершён
- Formula version: текущая рабочая версия до freeze на Дне 24
- Формат проверки: ручная регрессия
- Что трогаем в этот день: только README.md
- Что не трогаем: server.js, web/index.html, формулы, дизайн, БД

### Что проверяем
1. Успешный расчёт
2. Validation error
3. Warnings
4. auth status
5. calc status
6. Отображение результата во frontend
7. Что новые optional-поля влияют только там, где должны
8. Что базовый сценарий случайно не сломан

### Статусы тестов
- `pending` — ещё не проверяли
- `passed` — проверено, работает как ожидается
- `failed` — есть поломка
- `needs review` — поведение есть, но нужно отдельно оценить

### Ручные test cases

#### CASE A — базовый road
- Статус: passed
- Сценарий: базовый успешный расчёт без optional-полей
- Что проверили:
  - auth: ok
  - calc: HTTP 200
  - есть result
  - нет validation errors
  - summary читаемый
  - plan_steps читаемые
- Фактический результат:
  - 75 г углеводов/ч
  - 500 мл жидкости/ч
  - 250 мг натрия/ч
  - warnings отображаются корректно
- Комментарий: базовый сценарий не сломан, результат совпал с ожидаемым.

#### CASE B — trail в жару
- Статус: passed
- Сценарий: trail / высокая температура / должны быть warnings
- Что проверили:
  - расчёт успешен
  - warnings отображаются
  - результат выглядит правдоподобно
- Фактический результат:
  - 85 г углеводов/ч
  - 800 мл жидкости/ч
  - 720 мг натрия/ч
  - warnings отображаются корректно
- Комментарий: сценарий trail в жару отработал корректно, elevation_gain_m влияет на carbs как ожидается.

#### CASE C — long race без sweat rate
- Статус: passed
- Сценарий: длинная гонка без `sweat_rate_lph`
- Что проверили:
  - расчёт успешен
  - fallback-модель жидкости работает
  - warnings при необходимости есть
- Фактический результат:
  - 75 г углеводов/ч
  - 500 мл жидкости/ч
  - 250 мг натрия/ч
  - warnings отображаются корректно
- Комментарий: длинный сценарий без sweat rate не сломан, fallback-логика жидкости работает стабильно.

#### CASE D — race со sweat rate
- Статус: passed
- Сценарий: расчёт с заданным `sweat_rate_lph`
- Что проверили:
  - расчёт успешен
  - fluid меняется от sweat rate
  - результат не выглядит сломанным
- Фактический результат:
  - 75 г углеводов/ч
  - 560 мл жидкости/ч
  - 280 мг натрия/ч
  - warnings отображаются корректно
- Комментарий: сценарий с заданным sweat rate отработал корректно, fluid считается от пользовательского значения.

#### CASE E — validation error
- Статус: passed
- Сценарий: заведомо невалидный ввод
- Что проверили:
  - сервер возвращает ошибку валидации
  - красный блок ошибки показывается во frontend
  - успешный result не рисуется как будто всё нормально
- Фактический результат:
  - показана ошибка: `Длительность гонки должна быть от 30 минут до 36 часов.`
  - результат: `Расчёт не выполнен.`
- Комментарий: сценарий validation error отработал корректно и честно показывает проблему пользователю.

#### CASE F — warning-heavy case
- Статус: passed
- Сценарий: кейс с несколькими предупреждениями
- Что проверили:
  - расчёт успешен
  - warnings-block заполняется
  - интерфейс не ломается от нескольких предупреждений
- Фактический результат:
  - 75 г углеводов/ч
  - 800 мл жидкости/ч
  - 720 мг натрия/ч
  - warnings отображаются корректно
- Комментарий: сценарий с несколькими warnings одновременно отработал корректно, интерфейс не ломается.

### Итог регрессии
- CASE A: passed
- CASE B: passed
- CASE C: passed
- CASE D: passed
- CASE E: passed
- CASE F: passed

### Вывод по Дню 23
- Общий статус: passed
- Есть ли скрытые поломки: не обнаружены в рамках ручной регрессии
- Базовый сценарий сохранён: yes
- Optional-поля ведут себя честно: yes
- Готово ли к переходу к Дню 24: yes

---

## День 24 — freeze formula_version для stable MVP v1.1

Цель дня: зафиксировать явную версию формульного ядра без изменения текущей математики.

### Статус дня
- День 24: завершён
- Что меняли: только `server/server.js` и `README.md`
- Что не меняли: `web/index.html`, formulas, UI, БД, история расчётов
- Текущая formula version: `v1.1`

### Что сделали
- Добавили в backend-константу:
  - `FORMULA_VERSION = "v1.1"`
- Добавили поле `formula_version` в успешный ответ `POST /api/calc`
- Не меняли расчётную логику:
  - carbs
  - fluid
  - sodium
  - warnings
- Не меняли validation branch
- Не меняли frontend на этом шаге

### Что подтвердили
- Локальный backend после изменения стартует без ошибок
- Production backend на Render успешно задеплоен
- `POST /api/calc` на production возвращает:
  - `ok: true`
  - `formula_version: v1.1`
- Базовый контрольный кейс не сломан
- Базовый результат остался прежним:
  - 75 г углеводов/ч
  - 500 мл жидкости/ч
  - 250 мг натрия/ч

### Зачем это сделали
- Чтобы у расчётного ядра появилась явная версия
- Чтобы дальше любые изменения formulas можно было привязывать к конкретной версии
- Чтобы README, backend и план развития говорили на одном языке

### Что это значит для проекта
- Текущий stable snapshot формульного ядра теперь зафиксирован как `v1.1`
- Все следующие изменения математики нужно сравнивать именно с `v1.1`
- Если позже изменятся formulas, warnings или JSON contract, версия должна обновляться отдельно и осознанно

### Вывод по Дню 24
- Общий статус: passed
- Formula version введена успешно: yes
- Базовый сценарий не сломан: yes
- Production проверка пройдена: yes
- README синхронизирован с backend: yes
- Готово ли к следующему шагу: yes