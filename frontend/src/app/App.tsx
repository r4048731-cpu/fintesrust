import { createHashRouter, RouterProvider } from 'react-router'
import { DataProvider } from './DataProvider'
import { routes } from './routes'

// Адреса через # (…/#/programs): на GitHub Pages нет серверной переадресации,
// и обычные пути давали бы 404 при обновлении страницы.
const router = createHashRouter(routes)

export function App() {
  return (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  )
}
