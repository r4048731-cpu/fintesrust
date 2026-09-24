// Временная заглушка этапа 0: проверяем, что сборка и деплой работают.
// Каркас с вкладками появится на этапе 2 (docs/ROADMAP.md).
export default function App() {
  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 28 }}>Фитнес</h1>
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        Приложение в разработке. Этап 0 пройден: проект собирается и открывается на телефоне.
      </p>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
        Версия {import.meta.env.VITE_APP_VERSION ?? 'dev'}
      </p>
    </main>
  )
}
