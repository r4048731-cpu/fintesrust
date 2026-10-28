// Распознавание штрихкода с камеры. Где есть встроенный BarcodeDetector (Chrome на Android),
// берём его; иначе — тот же интерфейс на zxing-wasm, загружается только при первом скане.

/** Штрихкоды товаров в магазине. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

interface NativeDetectorClass {
  new (options: { formats: readonly string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}

export async function createDetector(): Promise<Detector> {
  const native = (window as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (native) {
    const supported = await native.getSupportedFormats().catch(() => [] as string[])
    if (FORMATS.some((f) => supported.includes(f))) return new native({ formats: FORMATS })
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  // .wasm — из своей сборки, а не с CDN
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  })
  return new BarcodeDetector({ formats: [...FORMATS] })
}
