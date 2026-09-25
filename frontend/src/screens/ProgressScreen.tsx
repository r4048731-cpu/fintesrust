import { EmptyState } from '../components/EmptyState'
import { Screen } from '../components/Screen'

export function ProgressScreen() {
  return (
    <Screen title="Прогресс">
      <EmptyState title="Графиков пока нет">
        <p>
          После первых тренировок здесь появятся графики веса и расчётного 1ПМ по каждому
          упражнению, личные рекорды и тоннаж по неделям.
        </p>
      </EmptyState>
    </Screen>
  )
}
