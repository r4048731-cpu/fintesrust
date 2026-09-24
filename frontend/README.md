# Frontend

PWA на React + TypeScript + Vite. Данные хранятся на устройстве (IndexedDB).

## Команды

| Команда | Что делает |
| --- | --- |
| `npm install` | установить зависимости |
| `npm run dev` | запуск для разработки на http://localhost:5173 |
| `npm run dev -- --host` | то же, но доступно с телефона в той же Wi-Fi сети |
| `npm run lint` | проверка кода (oxlint) |
| `npm run typecheck` | проверка типов TypeScript |
| `npm test` | тесты (Vitest) |
| `npm run format` | форматирование (Prettier) |
| `npm run build` | сборка в `dist/` |
| `npm run preview` | просмотр собранной версии |

Структура `src/` описана в корневом README.md. Деплой на GitHub Pages: `.github/workflows/deploy.yml`.
