import { NavLink, Outlet } from 'react-router'
import { Icon, type IconName } from '../components/Icon'
import styles from './Layout.module.css'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Сегодня', icon: 'today' },
  { to: '/programs', label: 'Программы', icon: 'programs' },
  { to: '/history', label: 'История', icon: 'history' },
  { to: '/progress', label: 'Прогресс', icon: 'progress' },
]

/** Каркас приложения: содержимое вкладки и нижняя панель навигации. */
export function Layout() {
  return (
    <>
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
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
