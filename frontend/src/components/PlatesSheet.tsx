import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepos } from '../app/dataContext'
import { formatDecimal } from '../domain/number'
import { BAR_OPTIONS_KG, groupPlates, plateLoad } from '../domain/plates'
import { SET_LIMITS } from '../domain/workout'
import { Button } from './Button'
import { Chips } from './Field'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'
import styles from './PlatesSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** С какого веса начать — обычно вес следующего подхода. */
  initialKg: number
  step: number
  /** Поставить набранный вес в несделанные подходы; без него кнопки нет. */
  onApply?: (kg: number) => void
}

type BarOption = `${(typeof BAR_OPTIONS_KG)[number]}`
const BAR_CHIPS = BAR_OPTIONS_KG.map((kg) => ({
  value: String(kg) as BarOption,
  label: kg === 0 ? 'Без грифа' : `${kg} кг`,
}))

/** Калькулятор блинов: вес на штанге → какие блины повесить на каждую сторону. */
export function PlatesSheet({ open, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Блины на гриф">
      {open && <PlatesForm key={rest.initialKg} onClose={onClose} {...rest} />}
    </Sheet>
  )
}

function PlatesForm({ initialKg, step, onApply, onClose }: Omit<Props, 'open'>) {
  const repos = useRepos()
  const bar = useLiveQuery(() => repos.meta.get('barKg'), [repos]) ?? 20
  const [target, setTarget] = useState(initialKg)
  const load = plateLoad(target, bar)
  const groups = groupPlates(load.perSide)

  return (
    <div className={styles.body}>
      <Stepper
        decimal
        label="Вес на штанге, кг"
        value={target}
        step={step}
        max={SET_LIMITS.weightKg.max}
        onChange={setTarget}
      />
      <Chips
        label="Гриф"
        options={BAR_CHIPS}
        value={String(bar) as BarOption}
        onChange={(v) => repos.meta.set('barKg', Number(v))}
      />

      <div className={styles.bar} aria-hidden="true">
        <span className={styles.shaft} />
        <span className={styles.collar} />
        <span className={styles.sleeve}>
          {load.perSide.map((kg, i) => (
            <span
              key={i}
              className={styles.plate}
              data-kg={kg}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {formatDecimal(kg)}
            </span>
          ))}
        </span>
      </div>

      <p className={styles.result} role="status">
        {load.missingKg < 0 ? (
          <>Гриф весит {formatDecimal(bar)} кг — это больше цели.</>
        ) : groups.length === 0 ? (
          <>Пустой гриф, блины не нужны.</>
        ) : (
          <>
            <span className={styles.label}>На каждую сторону</span>
            <b>
              {groups
                .map((g) =>
                  g.count > 1 ? `${g.count} × ${formatDecimal(g.kg)}` : formatDecimal(g.kg),
                )
                .join(' + ')}{' '}
              кг
            </b>
          </>
        )}
        {load.missingKg > 0 && (
          <span className={styles.warn}>
            Точно не набрать: выйдет {formatDecimal(load.totalKg)} кг, не хватает{' '}
            {formatDecimal(load.missingKg)} кг.
          </span>
        )}
      </p>

      {onApply && (
        <Button
          variant="primary"
          block
          onClick={() => {
            onApply(target)
            onClose()
          }}
        >
          Поставить {formatDecimal(target)} кг в оставшиеся подходы
        </Button>
      )}
    </div>
  )
}
