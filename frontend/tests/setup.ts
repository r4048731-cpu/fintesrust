// IndexedDB в памяти для тестов в Node и матчеры вида toBeInTheDocument()
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy… и waitFor ждут ответа базы; когда все файлы тестов идут параллельно,
// 1 с по умолчанию изредка не хватает — тесты падали через раз без ошибки в коде
configure({ asyncUtilTimeout: 4000 })

afterEach(() => cleanup())
