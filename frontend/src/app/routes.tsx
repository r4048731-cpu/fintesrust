import { Navigate, type RouteObject } from 'react-router'
import { HistoryDetailScreen } from '../screens/HistoryDetailScreen'
import { HistoryScreen } from '../screens/HistoryScreen'
import { LibraryScreen } from '../screens/LibraryScreen'
import { ProgramEditScreen } from '../screens/ProgramEditScreen'
import { ProgramsScreen } from '../screens/ProgramsScreen'
import { ProgressScreen } from '../screens/ProgressScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { WorkoutScreen } from '../screens/WorkoutScreen'
import { WorkoutSummaryScreen } from '../screens/WorkoutSummaryScreen'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  // Режим тренировки — на весь экран, без нижней панели вкладок
  { path: 'workout', element: <WorkoutScreen /> },
  { path: 'history/:workoutId/edit', element: <WorkoutScreen mode="edit" /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'programs', element: <ProgramsScreen /> },
      { path: 'programs/exercises', element: <LibraryScreen /> },
      { path: 'programs/:programId', element: <ProgramEditScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'history/:workoutId', element: <HistoryDetailScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'workout/:workoutId/summary', element: <WorkoutSummaryScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
