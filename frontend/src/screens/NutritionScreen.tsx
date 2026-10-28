import { useSearchParams } from 'react-router'
import { PinnedBar, Screen } from '../components/Screen'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { NutritionCalcPanel } from './NutritionCalcPanel'
import { NutritionPanel } from './NutritionPanel'
import { RecipesPanel } from './RecipesPanel'

type Tab = 'diary' | 'recipes' | 'calc'

/** «Расчёт КБЖУ» — не отдельный раздел, а шторка поверх дневника: открывается из «Задать план». */
const TABS: { value: Exclude<Tab, 'calc'>; label: string }[] = [
  { value: 'diary', label: 'Дневник' },
  { value: 'recipes', label: 'Рецепты' },
]

/** Вкладка «Питание». Выбранный раздел — в адресе, чтобы «Назад» и обновление его не сбрасывали. */
export function NutritionScreen() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab =
    requested === 'calc' || TABS.some((t) => t.value === requested) ? (requested as Tab) : 'diary'
  const open = (t: Tab) => setParams(t === 'diary' ? {} : { tab: t }, { replace: true })

  return (
    <Screen title="Питание">
      <PinnedBar>
        <Segmented
          label="Раздел"
          options={TABS}
          value={tab === 'calc' ? 'diary' : tab}
          onChange={open}
        />
      </PinnedBar>
      {tab !== 'recipes' && <NutritionPanel onCalc={() => open('calc')} />}
      {tab === 'recipes' && <RecipesPanel onAdded={() => open('diary')} />}
      <Sheet open={tab === 'calc'} onClose={() => open('diary')} title="Расчёт КБЖУ" tall>
        <NutritionCalcPanel onSaved={() => open('diary')} />
      </Sheet>
    </Screen>
  )
}
