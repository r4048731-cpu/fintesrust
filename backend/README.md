# Backend

Для MVP и v2 сервер не нужен: приложение хранит все данные на телефоне (IndexedDB).

Папка понадобится в v3 для синхронизации между устройствами:

- `supabase/migrations/` — SQL-миграции таблиц exercises, programs, workouts с полями `updated_at` и `deleted_at`
- политики доступа (Row Level Security): данные видит только владелец
