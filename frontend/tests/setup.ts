// IndexedDB в памяти для тестов в Node и матчеры вида toBeInTheDocument()
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
