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
import { BotLinks } from '../components/BotLinks'
import { Button } from '../components/Button'
import { Card, Screen, SectionLabel } from '../components/Screen'
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
import styles from './SettingsScreen.module.css'

const counts = (c: { programs: number; workouts: number; exercises: number }) =>
  `${c.programs} ${plural(c.programs, 'программа', 'программы', 'программ')}, ` +
  `${c.workouts} ${plural(c.workouts, 'тренировка', 'тренировки', 'тренировок')}, ` +
  `${c.exercises} ${plural(c.exercises, 'упражнение', 'упражнения', 'упражнений')}`

/** Настройки: шаг веса, резервная копия, хранилище, установка на главный экран. */
export function SettingsScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const weightStep = useLiveQuery(() => repos.meta.get('weightStepKg'), [repos])
  const lastExportAt = useLiveQuery(() => repos.meta.get('lastExportAt'), [repos])
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [installable, setInstallable] = useState(canPromptInstall)

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
        <label htmlFor="weight-step">Шаг веса для кнопок ±, кг</label>
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

      <SectionLabel>Резервная копия</SectionLabel>
      <Card>
        <p className={styles.text}>
          Данные хранятся только на этом телефоне. Сохраняйте копию раз в неделю.
        </p>
        <p className={styles.muted}>
          {lastExportAt
            ? `Последняя копия: ${formatLongDateInline(new Date(lastExportAt))}`
            : 'Копию ещё не сохраняли.'}
        </p>
        <Button variant="primary" block onClick={exportBackup}>
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
      <Card>
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
        Версия {import.meta.env.VITE_APP_VERSION?.slice(0, 7) ?? 'разработка'}
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
