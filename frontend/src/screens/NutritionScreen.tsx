import { useSearchParams } from 'react-router'
import { Screen } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { NutritionCalcPanel } from './NutritionCalcPanel'
import { NutritionPanel } from './NutritionPanel'
import { RecipesPanel } from './RecipesPanel'

type Tab = 'diary' | 'recipes' | 'calc'

const TABS: { value: Tab; label: string }[] = [
  { value: 'diary', label: 'Дневник' },
  { value: 'recipes', label: 'Рецепты' },
  { value: 'calc', label: 'Расчёт КБЖУ' },
]

/** Вкладка «Питание». Выбранный раздел — в адресе, чтобы «Назад» и обновление его не сбрасывали. */
export function NutritionScreen() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab = TABS.some((t) => t.value === requested) ? (requested as Tab) : 'diary'
  const open = (t: Tab) => setParams(t === 'diary' ? {} : { tab: t }, { replace: true })

  return (
    <Screen title="Питание">
      <Segmented label="Раздел" options={TABS} value={tab} onChange={open} />
      {tab === 'diary' && <NutritionPanel onCalc={() => open('calc')} />}
      {tab === 'recipes' && <RecipesPanel onAdded={() => open('diary')} />}
      {tab === 'calc' && <NutritionCalcPanel onSaved={() => open('diary')} />}
    </Screen>
  )
}
