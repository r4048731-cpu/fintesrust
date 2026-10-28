import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router'
import { IconButton } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { MoreMenu } from '../../components/MoreMenu'
import { ThemeToggle } from '../../components/ThemeToggle'
import { plural } from '../../domain/plural'
import type { TodayPlan } from './useToday'
import styles from './Stories.module.css'

/** Сколько показывается один слайд, мс. */
const SLIDE_MS = 6000
const SEEN_KEY = 'fitnes.storiesSeen'
/** Насколько прокрутить, чтобы раскрытая шапка свернулась, px. */
const COLLAPSE_AFTER_PX = 12

interface Slide {
  icon: IconName
  title: string
  text: string
  action?: { label: string; run: () => void }
}

interface Story {
  id: 'workout' | 'soon' | 'guide'
  label: string
  icon: IconName
  slides: Slide[]
}

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function markSeen(id: string) {
  try {
    const seen = new Set(readSeen())
    seen.add(id)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // хранилище недоступно — кружок просто останется ярким
  }
}

/**
 * Шапка «Сегодня» с историями: закреплена сверху, фон сплошной. У других разделов — своя шапка (Screen). Свёрнута: слева выглядывают три маленьких кружка, по центру «Фитнес».
 * Нажатие на кружки раскрывает её: «Фитнес» уезжает вверх влево, кружки становятся крупными
 * с подписями. Прокрутка страницы сворачивает обратно. Справа — меню, тема и профиль.
 */
export function Stories({
  plan,
  active,
  light,
}: {
  plan: TodayPlan | null
  active: boolean
  light: boolean
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const [seen, setSeen] = useState(readSeen)

  // Раскрыли — сворачиваем, как только страницу потянули в любую сторону
  useEffect(() => {
    if (!expanded) return
    const from = window.scrollY
    const onScroll = () => Math.abs(window.scrollY - from) > COLLAPSE_AFTER_PX && setExpanded(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  const go = (to: string) => () => {
    setOpen(null)
    navigate(to)
  }

  const workout: Slide[] = active
    ? [
        {
          icon: 'today',
          title: 'Тренировка идёт',
          text: 'Вернитесь к ней: подходы, отдых и таймер ждут там, где вы остановились.',
          action: { label: 'Продолжить', run: go('/workout') },
        },
      ]
    : plan
      ? [
          {
            icon: 'today',
            title: `Сегодня — ${plan.title}`,
            text: `${plan.items.length} ${plural(plan.items.length, 'упражнение', 'упражнения', 'упражнений')} · около ${plan.minutes} мин. ${plan.source}.`,
            action: {
              label: 'Начать',
              run: () => {
                setOpen(null)
                void plan.start({ light })
              },
            },
          },
          {
            icon: 'flame',
            title: 'Сначала разминка',
            text: '5–10 минут лёгкого кардио и пара подходов с пустым грифом — суставы скажут спасибо.',
          },
          {
            icon: 'check',
            title: 'Отмечайте каждый подход',
            text: 'Приложение запомнит веса и в следующий раз подскажет, где можно прибавить.',
          },
        ]
      : [
          {
            icon: 'programs',
            title: 'Плана пока нет',
            text: 'Подберите программу под себя — по цели, месту и опыту — и приложение будет вести вас по дням.',
            action: { label: 'К программам', run: go('/programs') },
          },
        ]

  const stories: Story[] = [
    { id: 'workout', label: 'Тренировка', icon: 'today', slides: workout },
    {
      id: 'soon',
      label: 'Скоро',
      icon: 'hourglass',
      slides: [
        {
          icon: 'ai',
          title: 'ИИ-тренер',
          text: 'Разбор тренировок, советы по питанию и программам — прямо в приложении.',
        },
        {
          icon: 'food',
          title: 'Боты в Telegram и MAX',
          text: 'Пишите или фотографируйте еду в мессенджере — бот посчитает КБЖУ и добавит в дневник.',
        },
        {
          icon: 'shield',
          title: 'Синхронизация',
          text: 'Данные на нескольких устройствах сразу. Пока — резервная копия в «Настройках».',
          action: { label: 'Сделать копию', run: go('/settings') },
        },
      ],
    },
    {
      id: 'guide',
      label: 'Инструкция',
      icon: 'book',
      slides: [
        {
          icon: 'programs',
          title: '1. Программа',
          text: '«Программы» → «Подобрать под меня» или соберите свою. Дни идут по кругу.',
        },
        {
          icon: 'today',
          title: '2. Тренировка',
          text: '«Начать» на «Сегодня», отмечайте подходы — отдых считается сам.',
        },
        {
          icon: 'plus',
          title: '3. Еда, вес, вода',
          text: 'Кнопка «+» по центру внизу: еда, вес, бег, таймер и заметки с любого экрана.',
        },
        {
          icon: 'progress',
          title: '4. Прогресс',
          text: '«Прогресс» → история, все графики и тело: вес, замеры, фото.',
          action: { label: 'Вся инструкция', run: go('/help') },
        },
      ],
    },
  ]

  const openStory = (i: number) => {
    setOpen(i)
    markSeen(stories[i].id)
    setSeen(readSeen())
  }

  return (
    <>
      <header className={styles.head} data-expanded={expanded || undefined}>
        <div className={styles.inner}>
          <span className={styles.title}>Фитнес</span>
          <div className={styles.circles} role="group" aria-label="Истории">
            {/* Свёрнутые кружки — одна кнопка «раскрыть» поверх них; раскрытые открывают свою историю */}
            {!expanded && (
              <button
                type="button"
                className={styles.expand}
                aria-expanded={false}
                aria-label="Показать истории"
                onClick={() => setExpanded(true)}
              />
            )}
            {stories.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={styles.story}
                data-seen={seen.includes(s.id) || undefined}
                aria-label={`История «${s.label}»`}
                tabIndex={expanded ? undefined : -1}
                aria-hidden={!expanded || undefined}
                onClick={expanded ? () => openStory(i) : undefined}
              >
                <span className={styles.ring}>
                  <span className={styles.face}>
                    <Icon name={s.icon} size={24} />
                  </span>
                </span>
                <span className={styles.label}>{s.label}</span>
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <MoreMenu />
            <ThemeToggle />
            {/* Аватар-заглушка: своей фотографии профиля пока нет, ведёт в настройки */}
            <NavLink to="/settings" className={styles.avatar} aria-label="Профиль и настройки">
              <Icon name="user" size={20} />
            </NavLink>
          </div>
        </div>
      </header>

      {open !== null && (
        <StoryViewer
          stories={stories}
          start={open}
          onClose={() => setOpen(null)}
          onStory={(i) => {
            markSeen(stories[i].id)
            setSeen(readSeen())
          }}
        />
      )}
    </>
  )
}

/** Просмотр историй на весь экран: полоски сверху, нажатие слева — назад, справа — дальше. */
function StoryViewer({
  stories,
  start,
  onClose,
  onStory,
}: {
  stories: Story[]
  start: number
  onClose: () => void
  onStory: (i: number) => void
}) {
  const [pos, setPos] = useState({ story: start, slide: 0 })
  const story = stories[pos.story]
  const slide = story.slides[pos.slide]

  const next = () => {
    if (pos.slide + 1 < story.slides.length) return setPos({ ...pos, slide: pos.slide + 1 })
    if (pos.story + 1 < stories.length) {
      onStory(pos.story + 1)
      return setPos({ story: pos.story + 1, slide: 0 })
    }
    onClose()
  }
  const prev = () => {
    if (pos.slide > 0) return setPos({ ...pos, slide: pos.slide - 1 })
    if (pos.story > 0) setPos({ story: pos.story - 1, slide: 0 })
  }
  // клавиши слушаются один раз — берут свежие next/prev через ссылку
  const keys = useRef({ next, prev })
  keys.current = { next, prev }

  // Слайд сменяется сам; клавиши — для ноутбука
  useEffect(() => {
    const timer = setTimeout(next, SLIDE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') keys.current.next()
      if (e.key === 'ArrowLeft') keys.current.prev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={story.label}>
      <div className={styles.progress} aria-hidden="true">
        {story.slides.map((_, i) => (
          <span key={i} className={styles.track}>
            <span
              key={`${pos.story}-${pos.slide}`}
              className={styles.fill}
              data-state={i < pos.slide ? 'done' : i === pos.slide ? 'now' : undefined}
              style={{ animationDuration: `${SLIDE_MS}ms` }}
            />
          </span>
        ))}
      </div>
      <div className={styles.viewerHead}>
        <span className={styles.viewerLabel}>
          <Icon name={story.icon} size={20} />
          {story.label}
        </span>
        <IconButton icon="close" label="Закрыть историю" onClick={onClose} />
      </div>

      {/* Невидимые половины экрана: слева — назад, справа — дальше */}
      <button type="button" className={styles.zonePrev} aria-label="Назад" onClick={prev} />
      <button type="button" className={styles.zoneNext} aria-label="Дальше" onClick={next} />

      <div key={`${pos.story}-${pos.slide}`} className={styles.slide}>
        <span className={styles.slideIcon}>
          <Icon name={slide.icon} size={24} />
        </span>
        <h2 className={styles.slideTitle}>{slide.title}</h2>
        <p className={styles.slideText}>{slide.text}</p>
      </div>
      {slide.action && (
        <button type="button" className={styles.cta} onClick={slide.action.run}>
          {slide.action.label}
          <Icon name="arrow" size={20} />
        </button>
      )}
    </div>,
    document.body,
  )
}
