import { useState } from 'react'
import { NavLink, Outlet, useLocation, useMatches } from 'react-router'
import { AiSheet } from '../components/AiSheet'
import { Icon, type IconName } from '../components/Icon'
import { MoreMenu } from '../components/MoreMenu'
import { QuickAdd } from '../components/QuickAdd'
import { TrainingReminderSync } from '../components/reminder/TrainingReminderSync'
import { ThemeToggle } from '../components/ThemeToggle'
import { isAndroidApp } from '../native/steps'
import styles from './Layout.module.css'

interface Tab {
  to: string
  label: string
  icon: IconName
  /** Ещё адреса, на которых вкладка подсвечена: карточка тренировки — это «Прогресс». */
  also?: string
}

const LEFT: Tab[] = [
  { to: '/', label: 'Сегодня', icon: 'today' },
  { to: '/programs', label: 'Программы', icon: 'programs' },
]
const RIGHT: Tab[] = [
  { to: '/progress', label: 'Прогресс', icon: 'progress', also: '/history' },
  { to: '/food', label: 'Питание', icon: 'food' },
]

const ORDER = [...LEFT, ...RIGHT].map((t) => t.to)
const tabIndex = (path: string) =>
  ORDER.reduce((found, to, i) => (to !== '/' && path.startsWith(to) ? i : found), 0)

/** Куда сдвигать экран при смене вкладки: вправо по панели — новый въезжает справа. */
function slideDirection(to: string, from: string) {
  document.documentElement.dataset.slide = tabIndex(to) < tabIndex(from) ? 'back' : 'forward'
}

/** Каркас приложения: верхняя панель, содержимое вкладки и нижняя панель навигации. */
export function Layout() {
  const { pathname } = useLocation()
  // Ключ анимации — маршрут, а не адрес: другая программа в том же редакторе не пересоздаёт экран
  const matches = useMatches()
  const routeKey = matches[matches.length - 1]?.id
  const [aiOpen, setAiOpen] = useState(false)

  const tab = (t: Tab) => (
    <NavLink
      key={t.to}
      to={t.to}
      end={t.to === '/'}
      viewTransition
      onClick={() => slideDirection(t.to, pathname)}
      className={({ isActive }) =>
        [styles.tab, (isActive || (t.also && pathname.startsWith(t.also))) && styles.active]
          .filter(Boolean)
          .join(' ')
      }
    >
      <span className={styles.tabIcon}>
        <Icon name={t.icon} />
      </span>
      <span>{t.label}</span>
    </NavLink>
  )

  return (
    <>
      {isAndroidApp() && <TrainingReminderSync />}
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={styles.brand}>Фитнес</span>
          <div className={styles.topActions}>
            <MoreMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={styles.main}>
        {/* Новый экран мягко проявляется; смена вкладки внутри экрана (?view=) — без анимации */}
        <div key={routeKey} className={styles.pageIn}>
          <Outlet />
        </div>
      </main>
      <QuickAdd />
      <nav className={styles.tabbar} aria-label="Разделы">
        <div className={styles.tabs}>
          {LEFT.map(tab)}
          <button
            type="button"
            className={styles.aiTab}
            aria-label="ИИ-помощник"
            aria-haspopup="dialog"
            onClick={() => setAiOpen(true)}
          >
            <span className={styles.aiIcon}>
              <Icon name="ai" />
            </span>
            <span>ИИ</span>
          </button>
          {RIGHT.map(tab)}
        </div>
      </nav>
      <AiSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  )
}
