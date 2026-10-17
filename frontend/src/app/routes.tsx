import { Navigate, type RouteObject } from 'react-router'
import { HistoryDetailScreen } from '../screens/HistoryDetailScreen'
import { HelpScreen } from '../screens/HelpScreen'
import { LibraryScreen } from '../screens/LibraryScreen'
import { NotesScreen } from '../screens/NotesScreen'
import { NutritionScreen } from '../screens/NutritionScreen'
import { ProgramEditScreen } from '../screens/ProgramEditScreen'
import { ProgramsScreen } from '../screens/ProgramsScreen'
import { ProgressScreen } from '../screens/ProgressScreen'
import { RunActiveScreen } from '../screens/RunActiveScreen'
import { RunDetailScreen } from '../screens/RunDetailScreen'
import { RunScreen } from '../screens/RunScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { WorkoutScreen } from '../screens/WorkoutScreen'
import { WorkoutSummaryScreen } from '../screens/WorkoutSummaryScreen'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  // Режим тренировки — на весь экран, без нижней панели вкладок
  { path: 'workout', element: <WorkoutScreen /> },
  { path: 'history/:workoutId/edit', element: <WorkoutScreen mode="edit" /> },
  { path: 'run/active', element: <RunActiveScreen /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'programs', element: <ProgramsScreen /> },
      { path: 'programs/exercises', element: <LibraryScreen /> },
      { path: 'programs/:programId', element: <ProgramEditScreen /> },
      // «История» теперь раздел «Прогресса»; адрес оставлен для закладок
      { path: 'history', element: <Navigate to="/progress?view=history" replace /> },
      { path: 'history/:workoutId', element: <HistoryDetailScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'food', element: <NutritionScreen /> },
      // Старые адреса веса — могли сохранить в закладки; вес теперь в «Прогрессе»
      { path: 'body', element: <Navigate to="/progress?view=weight" replace /> },
      { path: 'weight', element: <Navigate to="/progress?view=weight" replace /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'help', element: <HelpScreen /> },
      { path: 'notes', element: <NotesScreen /> },
      { path: 'run', element: <RunScreen /> },
      { path: 'run/:runId', element: <RunDetailScreen /> },
      { path: 'workout/:workoutId/summary', element: <WorkoutSummaryScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
