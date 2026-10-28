import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { useRepos } from '../app/dataContext'
import { weightNear } from '../data/repositories/bodyWeights'
import { parseISODate, toISODate } from '../domain/metrics'
import { formatDecimal } from '../domain/number'
import { plural } from '../domain/plural'
import type { BodyWeight, ProgressPhoto } from '../domain/types'
import { Button } from './Button'
import { shortDate } from './dates'
import { resizePhoto, type ResizedPhoto } from './photoResize'
import { Card } from './Screen'
import { Sheet } from './Sheet'
import styles from './ProgressPhotos.module.css'

const kg = (v: number) => `${formatDecimal(v)} кг`

/** Дата снимка по умолчанию: когда сделан файл, но не позже сегодняшнего дня. */
function fileDate(file: File, today: string): string {
  const d = file.lastModified ? toISODate(new Date(file.lastModified)) : today
  return d > today ? today : d
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** «Прогресс» → «Вес тела»: снимки тела по датам, сравнение «было — стало» и вес на день снимка. */
export function ProgressPhotos({ weights }: { weights: BodyWeight[] }) {
  const repos = useRepos()
  const photos = useLiveQuery(() => repos.photos.list(), [repos])
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<(ResizedPhoto & { date: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  // пара для сравнения; по умолчанию — первый и последний снимок
  const [pair, setPair] = useState<{ before?: string; after?: string }>({})
  if (!photos) return null

  const today = toISODate(new Date())
  const byId = new Map(photos.map((p) => [p.id, p]))
  const before = byId.get(pair.before ?? '') ?? photos[0]
  const after = byId.get(pair.after ?? '') ?? photos[photos.length - 1]
  const opened = openId ? byId.get(openId) : undefined

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      setDraft({ ...(await resizePhoto(file)), date: fileDate(file, today) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть фото')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft) return
    const photo = await repos.photos.add(draft)
    setDraft(null)
    // новый снимок сразу встаёт в «Стало»
    setPair((p) => ({ ...p, after: photo.id }))
  }

  function closeViewer() {
    setOpenId(null)
    setConfirmRemove(false)
  }

  const addButton = (
    <Button
      size="sm"
      variant={photos.length ? 'secondary' : 'primary'}
      icon="camera"
      disabled={busy}
      onClick={() => input.current?.click()}
    >
      {busy ? 'Открываю…' : 'Добавить фото'}
    </Button>
  )

  return (
    <Card framed className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Фото прогресса</h2>
        {photos.length > 0 && addButton}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label="Фото прогресса"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {photos.length === 0 ? (
        <div className={styles.empty}>
          <p>
            Снимайте себя раз в 2–4 недели в одной позе, при том же свете и в той же одежде — так
            изменения видно лучше, чем на весах.
          </p>
          {addButton}
        </div>
      ) : (
        <>
          {photos.length >= 2 && before.id !== after.id && (
            <Compare before={before} after={after} weights={weights} onOpen={setOpenId} />
          )}
          <ul className={styles.grid} aria-label="Снимки по датам">
            {[...photos].reverse().map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.thumb}
                  onClick={() => setOpenId(p.id)}
                  aria-label={`Фото за ${shortDate(p.date)} — открыть`}
                >
                  <img src={p.thumb} alt="" loading="lazy" />
                  <span>{shortDate(p.date)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.hint}>
            Фото хранятся только на этом телефоне и в файле резервной копии.
          </p>
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Новое фото"
        footer={
          <Button icon="check" variant="primary" block onClick={() => void save()}>
            Сохранить
          </Button>
        }
      >
        {draft && (
          <div className={styles.sheetBody}>
            <img className={styles.preview} src={draft.image} alt="Новый снимок" />
            <label className={styles.field}>
              <span className={styles.label}>Дата снимка</span>
              <input
                type="date"
                className={styles.date}
                value={draft.date}
                max={today}
                onChange={(e) => e.target.value && setDraft({ ...draft, date: e.target.value })}
              />
            </label>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!opened}
        onClose={closeViewer}
        title={opened ? `Фото за ${shortDate(opened.date)}` : ''}
        tall
        footer={
          opened &&
          (confirmRemove ? (
            <div className={styles.actions}>
              <Button block onClick={() => setConfirmRemove(false)}>
                Оставить
              </Button>
              <Button
                variant="danger"
                block
                onClick={async () => {
                  closeViewer()
                  setPair((p) => ({
                    before: p.before === opened.id ? undefined : p.before,
                    after: p.after === opened.id ? undefined : p.after,
                  }))
                  await repos.photos.remove(opened.id)
                }}
              >
                Удалить навсегда
              </Button>
            </div>
          ) : (
            <Button variant="danger" block onClick={() => setConfirmRemove(true)}>
              Удалить фото
            </Button>
          ))
        }
      >
        {opened && (
          <div className={styles.sheetBody}>
            <img
              className={styles.preview}
              src={opened.image}
              alt={`Снимок за ${shortDate(opened.date)}`}
            />
            <WeightLine photo={opened} weights={weights} />
            {photos.length >= 2 && (
              <div className={styles.actions}>
                <Button
                  size="sm"
                  block
                  disabled={before.id === opened.id}
                  onClick={() => {
                    setPair({
                      before: opened.id,
                      after: after.id === opened.id ? undefined : after.id,
                    })
                    closeViewer()
                  }}
                >
                  Сравнить: «было»
                </Button>
                <Button
                  size="sm"
                  block
                  disabled={after.id === opened.id}
                  onClick={() => {
                    setPair({
                      after: opened.id,
                      before: before.id === opened.id ? undefined : before.id,
                    })
                    closeViewer()
                  }}
                >
                  Сравнить: «стало»
                </Button>
              </div>
            )}
            <label className={styles.field}>
              <span className={styles.label}>Дата снимка</span>
              <input
                type="date"
                className={styles.date}
                value={opened.date}
                max={today}
                onChange={(e) =>
                  e.target.value && void repos.photos.setDate(opened.id, e.target.value)
                }
              />
            </label>
          </div>
        )}
      </Sheet>
    </Card>
  )
}

function WeightLine({ photo, weights }: { photo: ProgressPhoto; weights: BodyWeight[] }) {
  const w = weightNear(weights, photo.date)
  if (!w) return <p className={styles.hint}>Вес около этой даты не записан.</p>
  return (
    <p className={styles.weightLine}>
      Вес: <b>{kg(w.weightKg)}</b>
      {w.date !== photo.date && <span> ({shortDate(w.date)})</span>}
    </p>
  )
}

function Compare({
  before,
  after,
  weights,
  onOpen,
}: {
  before: ProgressPhoto
  after: ProgressPhoto
  weights: BodyWeight[]
  onOpen: (id: string) => void
}) {
  const wb = weightNear(weights, before.date)
  const wa = weightNear(weights, after.date)
  const days = Math.abs(daysBetween(before.date, after.date))
  const diff = wb && wa ? Math.round((wa.weightKg - wb.weightKg) * 10) / 10 : null
  const side = (label: string, p: ProgressPhoto, w: BodyWeight | null) => (
    <button
      type="button"
      className={styles.side}
      onClick={() => onOpen(p.id)}
      aria-label={`${label}: фото за ${shortDate(p.date)}${w ? `, ${kg(w.weightKg)}` : ''}`}
    >
      <img src={p.thumb} alt="" />
      <span className={styles.tag}>{label}</span>
      <span className={styles.caption}>
        <b>{shortDate(p.date)}</b>
        {w && <span>{kg(w.weightKg)}</span>}
      </span>
    </button>
  )
  return (
    <section className={styles.compare} aria-label="Было и стало">
      <div className={styles.pair}>
        {side('Было', before, wb)}
        {side('Стало', after, wa)}
      </div>
      <p className={styles.summary}>
        {days} {plural(days, 'день', 'дня', 'дней')} между снимками
        {diff !== null && (
          <>
            {' · '}
            <b className={diff < 0 ? styles.down : diff > 0 ? styles.up : ''}>
              {diff === 0 ? 'вес тот же' : `${diff > 0 ? '+' : '−'}${kg(Math.abs(diff))}`}
            </b>
          </>
        )}
      </p>
    </section>
  )
}
