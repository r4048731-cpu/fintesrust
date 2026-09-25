import { NavLink, Outlet, useNavigate } from 'react-router'
import { IconButton } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { ThemeToggle } from '../components/ThemeToggle'
import styles from './Layout.module.css'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Сегодня', icon: 'today' },
  { to: '/programs', label: 'Программы', icon: 'programs' },
  { to: '/history', label: 'История', icon: 'history' },
  { to: '/progress', label: 'Прогресс', icon: 'progress' },
]

/** Каркас приложения: верхняя панель, содержимое вкладки и нижняя панель навигации. */
export function Layout() {
  const navigate = useNavigate()
  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={styles.brand}>Фитнес</span>
          <div className={styles.topActions}>
            <IconButton
              icon="settings"
              label="Настройки"
              variant="secondary"
              onClick={() => navigate('/settings')}
            />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.tabbar} aria-label="Разделы">
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                [styles.tab, isActive && styles.active].filter(Boolean).join(' ')
              }
            >
              <span className={styles.tabIcon}>
                <Icon name={t.icon} />
              </span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
