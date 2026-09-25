import { Navigate, type RouteObject } from 'react-router'
import { HistoryScreen } from '../screens/HistoryScreen'
import { LibraryScreen } from '../screens/LibraryScreen'
import { ProgramsScreen } from '../screens/ProgramsScreen'
import { ProgressScreen } from '../screens/ProgressScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'programs', element: <ProgramsScreen /> },
      { path: 'programs/exercises', element: <LibraryScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
