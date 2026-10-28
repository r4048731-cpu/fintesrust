import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import {
  canPromptInstall,
  isInstalled,
  isIOS,
  isStoragePersisted,
  onInstallAvailabilityChange,
  promptInstall,
  requestPersistentStorage,
  saveFile,
} from '../app/device'
import {
  getAmoled,
  getThemeChoice,
  onThemeChange,
  setAmoled,
  setThemeChoice,
  type ThemeChoice,
} from '../app/theme'
import { BotLinks } from '../components/BotLinks'
import { Button } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { Chips } from '../components/Field'
import { Card, Screen, SectionLabel } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { TrainingReminderSettings } from '../components/reminder/TrainingReminderSettings'
import { WaterReminderSettings } from '../components/reminder/WaterReminderSettings'
import { StepsSettings } from '../components/steps/StepsSettings'
import { isAndroidApp } from '../native/steps'
import { Sheet } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import { formatLongDateInline } from '../components/dates'
import {
  backupFileName,
  BackupError,
  countBackup,
  createBackup,
  parseBackup,
  restoreBackup,
  wipeAll,
  type Backup,
} from '../data/backup'
import { plural } from '../domain/plural'
import { autoWeekGoal } from './today/useToday'
import styles from './SettingsScreen.module.css'

const counts = (c: { programs: number; workouts: number; exercises: number }) =>
  `${c.programs} ${plural(c.programs, 'программа', 'программы', 'программ')}, ` +
  `${c.workouts} ${plural(c.workouts, 'тренировка', 'тренировки', 'тренировок')}, ` +
  `${c.exercises} ${plural(c.exercises, 'упражнение', 'упражнения', 'упражнений')}`

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Как в телефоне' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

type WeekGoalOption = 'auto' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

const WEEK_GOAL_OPTIONS: { value: WeekGoalOption; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  ...(['1', '2', '3', '4', '5', '6', '7'] as const).map((n) => ({ value: n, label: n })),
]

/** Копия старше недели — пора сохранить новую. */
const BACKUP_FRESH_DAYS = 7

interface Status {
  tone: 'good' | 'warn'
  text: string
}

/** Шапка карточки: значок, название и, если есть, цветная метка состояния. */
function CardHead({ icon, title, status }: { icon: IconName; title: string; status?: Status }) {
  return (
    <div className={styles.head}>
      <span className={styles.headIcon} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <h3 className={styles.headTitle}>{title}</h3>
      {status && <span className={`${styles.pill} ${styles[status.tone]}`}>{status.text}</span>}
    </div>
  )
}

function backupStatus(lastExportAt: number | null | undefined): Status {
  if (!lastExportAt) return { tone: 'warn', text: 'нет копии' }
  const days = (Date.now() - lastExportAt) / 864e5
  return days <= BACKUP_FRESH_DAYS
    ? { tone: 'good', text: 'свежая' }
    : { tone: 'warn', text: 'давно' }
}

/** Настройки: шаг веса, резервная копия, хранилище, установка на главный экран. */
export function SettingsScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const weightStep = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos])
  const lastExportAt = useLiveQuery(() => repos.meta.get('lastExportAt'), [repos])
  const weekGoal = useLiveQuery(() => repos.meta.get('weekGoal'), [repos])
  const activeProgram = useLiveQuery(() => repos.programs.getActive(), [repos])
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [installable, setInstallable] = useState(canPromptInstall)
  const [themeChoice, setChoice] = useState(getThemeChoice)
  const [amoled, setAmoledState] = useState(getAmoled)

  // кнопка темы в шапке и этот раздел показывают одно и то же
  useEffect(
    () =>
      onThemeChange(() => {
        setChoice(getThemeChoice())
        setAmoledState(getAmoled())
      }),
    [],
  )

  useEffect(() => {
    void isStoragePersisted().then(setPersisted)
    return onInstallAvailabilityChange(() => setInstallable(canPromptInstall()))
  }, [])

  async function exportBackup() {
    setMessage(null)
    const now = Date.now()
    const backup = await createBackup(repos.db, now)
    const saved = await saveFile(backupFileName(now), JSON.stringify(backup))
    if (!saved) return
    await repos.meta.set('lastExportAt', now)
    setMessage({ kind: 'ok', text: `Копия сохранена: ${counts(countBackup(backup))}.` })
  }

  async function pickFile(file: File | undefined) {
    setMessage(null)
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof BackupError ? err.message : 'Не удалось прочитать файл.',
      })
    }
  }

  async function restore() {
    if (!pending) return
    const restored = await restoreBackup(repos.db, pending)
    setPending(null)
    setMessage({ kind: 'ok', text: `Восстановлено: ${counts(restored)}.` })
  }

  async function wipe() {
    await wipeAll(repos.db)
    await repos.init()
    setConfirmWipe(false)
    setMessage({ kind: 'ok', text: 'Все данные удалены. Справочник упражнений загружен заново.' })
  }

  return (
    <Screen title="Настройки" onBack={() => navigate(-1)}>
      <SectionLabel>Тренировки</SectionLabel>
      <Card>
        <CardHead icon="scale" title="Шаг веса" />
        <label htmlFor="weight-step" className={styles.muted}>
          Для кнопок ± в тренировке, кг
        </label>
        {weightStep !== undefined && (
          <Stepper
            id="weight-step"
            label="Шаг веса, кг"
            value={weightStep}
            step={0.25}
            min={0.25}
            max={10}
            decimal
            onChange={(v) => repos.meta.set('weightStepKg', v)}
          />
        )}
      </Card>

      <Card>
        <CardHead icon="flame" title="Цель недели" />
        <p className={styles.muted}>Сколько тренировок в неделю нужно для серии на «Сегодня».</p>
        {weekGoal !== undefined && (
          <div className={styles.goalChips}>
            <Chips
              label="Цель недели"
              options={WEEK_GOAL_OPTIONS}
              value={weekGoal === null ? 'auto' : (String(weekGoal) as WeekGoalOption)}
              onChange={(v) => repos.meta.set('weekGoal', v === 'auto' ? null : Number(v))}
            />
          </div>
        )}
        {weekGoal === null && activeProgram !== undefined && (
          <p className={styles.muted}>
            Авто —{' '}
            {activeProgram ? `по дням программы «${activeProgram.name}»` : 'без активной программы'}
            : {autoWeekGoal(activeProgram?.days.length)}{' '}
            {plural(
              autoWeekGoal(activeProgram?.days.length),
              'тренировка',
              'тренировки',
              'тренировок',
            )}
            .
          </p>
        )}
      </Card>

      {isAndroidApp() && <TrainingReminderSettings />}
      {isAndroidApp() && <WaterReminderSettings />}

      {isAndroidApp() && <StepsSettings />}

      <SectionLabel>Оформление</SectionLabel>
      <Card>
        <CardHead icon="moon" title="Тема" />
        <Segmented
          label="Тема"
          options={THEME_OPTIONS}
          value={themeChoice}
          onChange={setThemeChoice}
        />
        <label className={styles.toggle}>
          <input type="checkbox" checked={amoled} onChange={(e) => setAmoled(e.target.checked)} />
          <span>
            Чистый чёрный
            <small>В тёмной теме: экономит батарею на AMOLED-экранах</small>
          </span>
        </label>
      </Card>

      <SectionLabel>Резервная копия</SectionLabel>
      <Card framed>
        <CardHead icon="save" title="Копия в файл" status={backupStatus(lastExportAt)} />
        <p className={styles.text}>
          Данные хранятся только на этом телефоне. Сохраняйте копию раз в неделю.
        </p>
        <p className={styles.muted}>
          {lastExportAt
            ? `Последняя копия: ${formatLongDateInline(new Date(lastExportAt))}`
            : 'Копию ещё не сохраняли.'}
        </p>
        <Button icon="save" variant="primary" block onClick={exportBackup}>
          Сохранить копию в файл
        </Button>
        <Button block onClick={() => fileInput.current?.click()}>
          Восстановить из файла
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Файл резервной копии"
          onChange={(e) => {
            void pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={message.kind === 'error' ? styles.error : styles.ok}
          >
            {message.text}
          </p>
        )}
      </Card>

      <SectionLabel>Приложение</SectionLabel>
      <Card>
        <CardHead
          icon="phone"
          title="На этом телефоне"
          status={persisted ? { tone: 'good', text: 'защищено' } : undefined}
        />
        <Button block icon="help" onClick={() => navigate('/help')}>
          Как пользоваться
        </Button>
        {isInstalled() ? (
          <p className={styles.text}>Приложение установлено на главный экран.</p>
        ) : installable ? (
          <Button block onClick={() => void promptInstall()}>
            Установить на главный экран
          </Button>
        ) : (
          <p className={styles.text}>
            {isIOS()
              ? 'Установка: «Поделиться» → «На экран «Домой»».'
              : 'Установка: меню ⋮ → «Установить приложение».'}
          </p>
        )}
        <p className={styles.muted}>
          Защита от очистки:{' '}
          {persisted === true
            ? 'включена'
            : persisted === false
              ? 'не включена'
              : 'недоступна по этому адресу'}
        </p>
        {persisted === false && (
          <Button size="sm" onClick={async () => setPersisted(await requestPersistentStorage())}>
            Включить защиту
          </Button>
        )}
      </Card>

      <SectionLabel>Боты</SectionLabel>
      <BotLinks
        title="Telegram и MAX"
        text="Записывать еду и вес из мессенджера, получать напоминания о тренировках."
      />

      <SectionLabel>Опасная зона</SectionLabel>
      <Card className={styles.danger}>
        <CardHead icon="trash" title="Удаление данных" />
        {confirmWipe ? (
          <div
            className={styles.confirm}
            role="alertdialog"
            aria-label="Подтверждение удаления всех данных"
          >
            <p>Удалить всё на этом телефоне? Вернуть можно только из копии.</p>
            <div className={styles.actions}>
              <Button variant="danger" onClick={wipe}>
                Удалить всё
              </Button>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" block onClick={() => setConfirmWipe(true)}>
            Удалить все данные
          </Button>
        )}
      </Card>

      <p className={styles.version}>
        <span className={styles.logo}>Фитнес</span> · версия{' '}
        {import.meta.env.VITE_APP_VERSION?.slice(0, 7) ?? 'разработка'}
      </p>

      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Восстановить копию?">
        {pending && (
          <>
            <p className={styles.text}>
              Копия от {formatLongDateInline(new Date(pending.exportedAt))}:{' '}
              {counts(countBackup(pending))}.
            </p>
            <p className={styles.text}>Текущие данные заменятся копией.</p>
            <Button variant="primary" block onClick={restore}>
              Восстановить
            </Button>
            <Button block onClick={() => setPending(null)}>
              Отмена
            </Button>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
