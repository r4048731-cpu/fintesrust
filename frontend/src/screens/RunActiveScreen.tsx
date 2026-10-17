import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../app/dataContext'
import { useNow } from '../app/hooks/useNow'
import { useWakeLock } from '../app/hooks/useWakeLock'
import { Button, IconButton } from '../components/Button'
import { RouteMap } from '../components/run/RouteMap'
import { Sheet } from '../components/Sheet'
import {
  addFix,
  formatKm,
  formatPace,
  goalProgress,
  goalReached,
  movingTime,
  paceSecPerKm,
  pauseRun,
  resumeRun,
  runCalories,
  type Run,
} from '../domain/run'
import { formatClock } from '../domain/workout'
import { gpsAvailable } from '../app/gps'
import styles from './RunActiveScreen.module.css'

/** Как часто сохранять пробежку в базу во время бега, мс. */
const SAVE_EVERY_MS = 5000

function say(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    window.speechSynthesis.speak(u)
  } catch {
    // нет голоса — не беда
  }
}

/** Экран во время бега: таймер, километры, темп, калории, карта; пауза и завершение. */
export function RunActiveScreen() {
  const repos = useRepos()
  const navigate = useNavigate()
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null)
  const voice = useLiveQuery(() => repos.meta.get('runVoice'), [repos]) ?? true
  const lastSave = useRef(0)
  const announcedKm = useRef(0)
  const announcedGoal = useRef(false)

  const now = useNow(1000, !!run)
  useWakeLock(run?.resumedAt != null)

  useEffect(() => {
    void repos.runs.getActive().then((r) => {
      setRun(r)
      if (r) announcedKm.current = Math.floor(r.distanceM / 1000)
    })
  }, [repos])

  const persist = useCallback(
    async (r: Run) => {
      lastSave.current = Date.now()
      await repos.runs.save(r)
    },
    [repos],
  )

  // GPS: пока не на паузе
  const moving = run?.resumedAt != null
  useEffect(() => {
    if (!moving || !gpsAvailable()) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null)
        setAccuracy(Math.round(pos.coords.accuracy))
        setRun((r) =>
          r
            ? addFix(r, {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                alt: pos.coords.altitude,
                t: pos.timestamp,
              })
            : r,
        )
      },
      (err) =>
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Нет доступа к геолокации — разрешите её для приложения в настройках браузера.'
            : 'Ищу спутники… Выйдите на открытое место.',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [moving])

  // Сохранение раз в несколько секунд и при сворачивании
  useEffect(() => {
    if (run && Date.now() - lastSave.current > SAVE_EVERY_MS) void persist(run)
  }, [run, persist])
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && run) void persist(run)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [run, persist])

  // Голос и вибрация на каждом километре и при достижении цели
  useEffect(() => {
    if (!run) return
    const km = Math.floor(run.distanceM / 1000)
    if (km > announcedKm.current) {
      announcedKm.current = km
      navigator.vibrate?.([200, 100, 200])
      if (voice) {
        const pace = formatPace(paceSecPerKm(run.distanceM, movingTime(run, Date.now())))
        say(
          `${km} ${km === 1 ? 'километр' : km < 5 ? 'километра' : 'километров'}, темп ${pace.replace(':', ' ')}`,
        )
      }
    }
    if (!announcedGoal.current && goalReached(run, now)) {
      announcedGoal.current = true
      navigator.vibrate?.([400, 150, 400])
      if (voice) say('Цель выполнена!')
    }
  }, [run, now, voice])

  if (run === undefined) return null
  if (run === null) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Пробежка не идёт.</p>
        <Button variant="primary" onClick={() => navigate('/run')}>
          К бегу и ходьбе
        </Button>
      </div>
    )
  }

  const r = run
  const ms = movingTime(r, now)
  const pace = paceSecPerKm(r.distanceM, ms)
  const progress = goalProgress(r, now)

  async function togglePause() {
    const next = r.resumedAt !== null ? pauseRun(r, Date.now()) : resumeRun(r, Date.now())
    setRun(next)
    await persist(next)
  }

  async function finish() {
    const done = await repos.runs.finish(r)
    navigate(done ? `/run/${done.id}` : '/run', { replace: true })
  }

  async function discard() {
    await repos.runs.discard(r.id)
    navigate('/run', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <IconButton icon="down" label="Свернуть" onClick={() => navigate('/run')} />
        <span className={styles.kind}>{r.kind === 'run' ? 'Бег' : 'Ходьба'}</span>
        <button
          type="button"
          className={styles.voice}
          aria-pressed={voice}
          onClick={() => repos.meta.set('runVoice', !voice)}
        >
          {voice ? 'Голос вкл' : 'Голос выкл'}
        </button>
      </header>

      <section className={styles.board} aria-label="Показатели">
        <div className={styles.clock} role="timer" aria-label="Время в движении">
          {formatClock(ms / 1000)}
        </div>
        <div className={styles.stats}>
          <div>
            <b>{formatKm(r.distanceM)}</b>
            <span>км</span>
          </div>
          <div>
            <b>{formatPace(pace)}</b>
            <span>темп, мин/км</span>
          </div>
          <div>
            <b>{runCalories(r.kind, r.distanceM, r.bodyKg)}</b>
            <span>ккал</span>
          </div>
        </div>
        {progress !== null && (
          <div className={styles.goal} aria-label={`Цель: ${Math.round(progress * 100)}%`}>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </section>

      <p className={gpsError || !gpsAvailable() ? styles.gpsBad : styles.gps} role="status">
        {(!gpsAvailable() && 'GPS недоступен: откройте приложение по ссылке https://') ||
          gpsError ||
          (r.resumedAt === null
            ? 'Пауза'
            : accuracy === null
              ? 'Ищу спутники…'
              : `GPS: точность ${accuracy} м${accuracy > 35 ? ' — слабый сигнал' : ''}`)}
      </p>

      <RouteMap segments={r.segments} live height={260} />

      <div className={styles.controls}>
        <Button variant={r.resumedAt !== null ? 'secondary' : 'primary'} onClick={togglePause}>
          {r.resumedAt !== null ? 'Пауза' : 'Продолжить'}
        </Button>
        <Button variant="primary" onClick={() => setConfirm('finish')}>
          Завершить
        </Button>
      </div>
      <Button variant="ghost" className={styles.discard} onClick={() => setConfirm('discard')}>
        Отменить без сохранения
      </Button>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'discard' ? 'Отменить пробежку?' : 'Завершить пробежку?'}
      >
        {confirm === 'discard' ? (
          <>
            <p className={styles.muted}>Маршрут и километры не сохранятся.</p>
            <Button block variant="danger" onClick={discard}>
              Отменить пробежку
            </Button>
          </>
        ) : (
          <>
            <p>
              {formatKm(r.distanceM)} км за {formatClock(ms / 1000)}.
              {r.distanceM < 50 && ' Меньше 50 м — такая пробежка не сохранится.'}
            </p>
            <Button block variant="primary" onClick={finish}>
              Завершить
            </Button>
          </>
        )}
        <Button block onClick={() => setConfirm(null)}>
          Продолжить
        </Button>
      </Sheet>
    </div>
  )
}
