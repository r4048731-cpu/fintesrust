import 'leaflet/dist/leaflet.css'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import { useEffect, useRef } from 'react'
import type { TrackPoint } from '../../domain/run'
import styles from './Run.module.css'

interface Props {
  segments: TrackPoint[][]
  /** Во время пробежки карта следует за последней точкой. */
  live?: boolean
  height?: number
}

/**
 * Маршрут на карте OpenStreetMap (Leaflet). Подложка грузится из интернета — без связи
 * останется сама линия маршрута. Подпись «© OpenStreetMap» — условие использования карты.
 */
export function RouteMap({ segments, live = false, height = 240 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const state = useRef<{
    L: typeof import('leaflet')
    map: LeafletMap
    layer: LayerGroup
    fitted: boolean
  } | null>(null)
  const latest = useRef(segments)
  latest.current = segments

  function draw() {
    const s = state.current
    if (!s) return
    const { L, map, layer } = s
    layer.clearLayers()
    const all = latest.current.flat()
    for (const seg of latest.current) {
      if (seg.length < 2) continue
      L.polyline(
        seg.map((p) => [p[0], p[1]] as [number, number]),
        { color: '#7c3aed', weight: 5, opacity: 0.9 },
      ).addTo(layer)
    }
    const first = all[0]
    const last = all[all.length - 1]
    if (first && !live) {
      L.circleMarker([first[0], first[1]], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: '#22c55e',
        fillOpacity: 1,
      }).addTo(layer)
    }
    if (last) {
      L.circleMarker([last[0], last[1]], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: live ? '#3563e9' : '#db2777',
        fillOpacity: 1,
      }).addTo(layer)
    }
    if (!all.length) return
    if (live) map.setView([last[0], last[1]], s.fitted ? map.getZoom() : 16)
    else
      map.fitBounds(L.latLngBounds(all.map((p) => [p[0], p[1]] as [number, number])), {
        padding: [20, 20],
      })
    s.fitted = true
  }

  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | null = null
    void import('leaflet').then((L) => {
      if (cancelled || !box.current) return
      try {
        map = L.map(box.current, { zoomControl: false, attributionControl: true }).setView(
          [55.75, 37.62],
          11,
        )
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map)
        state.current = { L, map, layer: L.layerGroup().addTo(map), fitted: false }
        draw()
      } catch {
        // без поддержки карты (старый браузер, тесты) — просто пустой блок
      }
    })
    return () => {
      cancelled = true
      map?.remove()
      state.current = null
    }
    // карта создаётся один раз; маршрут перерисовывает эффект ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, live])

  return (
    <div
      ref={box}
      className={styles.map}
      style={{ height }}
      aria-label="Карта маршрута"
      role="img"
    />
  )
}
