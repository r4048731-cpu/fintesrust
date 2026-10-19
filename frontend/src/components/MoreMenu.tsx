import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BotLinks } from './BotLinks'
import { IconButton } from './Button'
import { OneRMSheet } from './OneRMSheet'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'
import styles from './QuickAdd.module.css'

const ITEMS: { to: string; icon: IconName; title: string; text: string }[] = [
  {
    to: '/interval',
    icon: 'timer',
    title: 'Интервальный таймер',
    text: 'Табата, EMOM, круговая тренировка',
  },
  {
    to: '/notes',
    icon: 'note',
    title: 'Заметки',
    text: 'Добавить, изменить, удалить, найти',
  },
  {
    to: '/help',
    icon: 'help',
    title: 'Как пользоваться',
    text: 'Инструкция по всем разделам',
  },
  {
    to: '/programs/exercises',
    icon: 'programs',
    title: 'Справочник упражнений',
    text: 'Все упражнения, свои и встроенные',
  },
  {
    to: '/settings',
    icon: 'settings',
    title: 'Настройки',
    text: 'Резервная копия, шаг веса, установка',
  },
]

/** Кнопка «Ещё» в верхней панели: редкие разделы в одной шторке, чтобы шапка была чище. */
export function MoreMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [calc, setCalc] = useState(false)
  return (
    <>
      <IconButton icon="menu" label="Ещё" variant="secondary" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Ещё">
        <ul className={styles.list}>
          <li>
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                setOpen(false)
                setCalc(true)
              }}
            >
              <span className={styles.icon}>
                <Icon name="trophy" />
              </span>
              <span className={styles.text}>
                <b>Калькулятор 1ПМ</b>
                <span>Максимум на один раз и рабочие веса в процентах</span>
              </span>
            </button>
          </li>
          {ITEMS.map((i) => (
            <li key={i.to}>
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  setOpen(false)
                  navigate(i.to)
                }}
              >
                <span className={styles.icon}>
                  <Icon name={i.icon} />
                </span>
                <span className={styles.text}>
                  <b>{i.title}</b>
                  <span>{i.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <BotLinks text="Записывать еду и вес из мессенджера, получать напоминания о тренировках." />
      </Sheet>
      <OneRMSheet open={calc} onClose={() => setCalc(false)} />
    </>
  )
}
