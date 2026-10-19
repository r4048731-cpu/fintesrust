import type { ReactNode } from 'react'
import { artSeed, dishArt, type Base, type Topping } from '../domain/dishArt'

/**
 * Плоская картинка блюда (SVG 120×120): посуда, основа и продукты сверху.
 * Что рисовать, решает domain/dishArt по названию и составу.
 */
export function DishArt({
  title,
  ingredients,
  className,
}: {
  title: string
  ingredients: { name: string; grams: number }[]
  className?: string
}) {
  const art = dishArt(title, ingredients)
  const seed = artSeed(title)
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      {VESSELS[art.vessel](art.fill, art.base, art.toppings, seed)}
    </svg>
  )
}

type Draw = (fill: string, base: Base | null, toppings: Topping[], seed: number) => ReactNode

/* ---------- продукты: каждый рисуется вокруг точки (0, 0), размер ~24 ---------- */

const T: Record<Topping, ReactNode> = {
  egg: (
    <>
      <path d="M-12 1c0-7 6-11 12-10s12 4 11 10-6 9-12 9-11-3-11-9Z" fill="#fffdf7" />
      <circle cx="0" cy="0" r="5" fill="#f5b700" />
      <circle cx="-1.5" cy="-1.5" r="1.4" fill="#ffe27a" />
    </>
  ),
  tomato: (
    <>
      {[
        [-6, -2],
        [6, 3],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <circle r="7.5" fill="#e63946" />
          <circle r="5.6" fill="#ff7b7b" />
          <circle cx="-2" cy="-1" r="1" fill="#ffe0a3" />
          <circle cx="2" cy="1" r="1" fill="#ffe0a3" />
          <circle cx="0" cy="2.6" r="1" fill="#ffe0a3" />
        </g>
      ))}
    </>
  ),
  cucumber: (
    <>
      {[
        [-7, 0],
        [3, -6],
        [5, 5],
      ].map(([x, y]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
          <circle r="6.5" fill="#3f7d35" />
          <circle r="5.2" fill="#c9e7a7" />
          <circle r="2" fill="#e7f5d3" />
        </g>
      ))}
    </>
  ),
  banana: (
    <>
      {[
        [-7, -2],
        [2, -6],
        [5, 4],
        [-3, 6],
      ].map(([x, y]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
          <circle r="5.4" fill="#fff1b8" stroke="#e8c95c" strokeWidth="1.2" />
          <circle r="1.3" fill="#d9b85a" />
        </g>
      ))}
    </>
  ),
  strawberry: (
    <>
      {[
        [-6, 0, -15],
        [6, -2, 20],
      ].map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M-6-3c2-3 10-3 12 0 1 5-3 11-6 12-3-1-7-7-6-12Z" fill="#e5383b" />
          <path d="M-4-4 0-1l4-3-2-2-2 1-2-1Z" fill="#4caf50" />
          <circle cx="-2" cy="2" r=".7" fill="#ffd6a0" />
          <circle cx="2" cy="3" r=".7" fill="#ffd6a0" />
          <circle cx="0" cy="6" r=".7" fill="#ffd6a0" />
        </g>
      ))}
    </>
  ),
  blueberry: (
    <>
      {[
        [-7, -2],
        [-1, -6],
        [5, -2],
        [-4, 4],
        [3, 5],
        [9, 4],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="3.4" fill="#3d4a9c" />
          <circle cx={x - 1} cy={y - 1} r="1" fill="#7f8fd6" />
        </g>
      ))}
    </>
  ),
  broccoli: (
    <>
      <path d="M-2 4h4l1 9h-6Z" fill="#9ccc65" />
      <circle cx="-6" cy="0" r="6" fill="#3d8b37" />
      <circle cx="6" cy="0" r="6" fill="#3d8b37" />
      <circle cx="0" cy="-5" r="7" fill="#4caf50" />
      <circle cx="-2" cy="-7" r="2" fill="#6fcf5f" />
    </>
  ),
  carrot: (
    <>
      {[
        [-5, -20],
        [0, 10],
        [5, -5],
      ].map(([x, r]) => (
        <rect
          key={x}
          x={x - 2.5}
          y="-10"
          width="5"
          height="20"
          rx="2.5"
          fill="#f4842d"
          transform={`rotate(${r} ${x} 0)`}
        />
      ))}
    </>
  ),
  chicken: (
    <>
      {[
        [-7, -3, -10],
        [5, -4, 15],
        [-1, 6, 5],
      ].map(([x, y, r]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-7" y="-5" width="14" height="10" rx="4" fill="#e7bf8d" />
          <path d="M-4-5v10M1-5v10" stroke="#b9854f" strokeWidth="1.4" opacity=".7" />
        </g>
      ))}
    </>
  ),
  salmon: (
    <g transform="rotate(-12)">
      <rect x="-14" y="-8" width="28" height="16" rx="6" fill="#f7895f" />
      <path d="M-8-8 -4 8M-1-8 3 8M6-8 10 8" stroke="#ffd4bf" strokeWidth="1.6" />
      <rect x="-14" y="5" width="28" height="3" rx="1.5" fill="#d9663f" />
    </g>
  ),
  whiteFish: (
    <g transform="rotate(10)">
      <rect x="-14" y="-8" width="28" height="16" rx="7" fill="#f6efe3" />
      <path d="M-7-6-5 6M0-7 2 7M7-6 9 6" stroke="#e1d1b6" strokeWidth="1.4" />
      <rect x="-14" y="4" width="28" height="4" rx="2" fill="#e8c78f" opacity=".8" />
    </g>
  ),
  shrimp: (
    <>
      {[
        [-5, -2, 0],
        [6, 3, 140],
      ].map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path
            d="M-6 4a7 7 0 1 1 12-3"
            fill="none"
            stroke="#f28c5b"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M-6 4a7 7 0 1 1 12-3"
            fill="none"
            stroke="#ffc3a0"
            strokeWidth="1.3"
            strokeDasharray="2 2.5"
          />
        </g>
      ))}
    </>
  ),
  beef: (
    <>
      {[
        [-6, -4, -20],
        [6, -2, 25],
        [0, 6, 0],
      ].map(([x, y, r]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-7" y="-4" width="14" height="8" rx="3.5" fill="#8d4b36" />
          <path d="M-4-1h6" stroke="#b26a4e" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ))}
    </>
  ),
  avocado: (
    <g transform="rotate(-25)">
      <ellipse rx="10" ry="13" fill="#3e6b25" />
      <ellipse rx="8.2" ry="11.2" fill="#c5e17a" />
      <ellipse cy="2" rx="4.2" ry="4.6" fill="#8b5a3c" />
    </g>
  ),
  nuts: (
    <>
      {[
        [-6, -2, -30],
        [3, -5, 20],
        [5, 4, -10],
        [-3, 6, 50],
      ].map(([x, y, r]) => (
        <ellipse
          key={`${x}${y}`}
          cx={x}
          cy={y}
          rx="4.2"
          ry="2.8"
          fill="#b07a46"
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
    </>
  ),
  greens: (
    <>
      {[
        [-5, 0, -30],
        [4, -3, 25],
        [1, 6, 80],
      ].map(([x, y, r]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0-9C6-5 6 5 0 9-6 5-6-5 0-9Z" fill="#4caf50" />
          <path d="M0-8V8" stroke="#2e7d32" strokeWidth="1" />
        </g>
      ))}
    </>
  ),
  pepper: (
    <>
      <path
        d="M-11 4a12 12 0 0 1 18-10"
        fill="none"
        stroke="#e53935"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M-6 9a12 12 0 0 1 17-9"
        fill="none"
        stroke="#fbc02d"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </>
  ),
  cheese: (
    <>
      <path d="M-11 4 3-7l8 11Z" fill="#ffd166" />
      <circle cx="0" cy="0" r="1.6" fill="#f0b43c" />
      <circle cx="5" cy="1" r="1.2" fill="#f0b43c" />
    </>
  ),
  chickpea: <Dots color="#e2b86b" shine="#f3d79f" />,
  beans: <Dots color="#9b3d3d" shine="#c76a6a" />,
  corn: <Dots color="#f6c945" shine="#ffe48a" />,
  peas: <Dots color="#7cb342" shine="#aed581" />,
  apple: (
    <>
      {[
        [-5, -15],
        [5, 25],
      ].map(([x, r]) => (
        <g key={x} transform={`translate(${x} 0) rotate(${r})`}>
          <path d="M-4-10a10 10 0 0 1 0 20 4 10 0 0 0 0-20Z" fill="#f5e6b8" />
          <path d="M-4-10a10 10 0 0 1 0 20" fill="none" stroke="#d63c3c" strokeWidth="2.4" />
        </g>
      ))}
    </>
  ),
  pumpkin: (
    <>
      {[
        [-6, -3],
        [4, -5],
        [0, 5],
      ].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x - 4.5} y={y - 4.5} width="9" height="9" rx="2" fill="#f08a24" />
      ))}
    </>
  ),
  zucchini: (
    <>
      {[
        [-6, -2],
        [5, -4],
        [1, 6],
      ].map(([x, y]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
          <circle r="6" fill="#558b2f" />
          <circle r="4.8" fill="#dcedc8" />
        </g>
      ))}
    </>
  ),
  driedFruit: (
    <>
      {[
        [-5, -2, -20],
        [4, -4, 30],
        [1, 5, 0],
      ].map(([x, y, r]) => (
        <ellipse
          key={`${x}${y}`}
          cx={x}
          cy={y}
          rx="5"
          ry="3"
          fill="#6d3b1f"
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
    </>
  ),
  lemon: (
    <>
      <circle r="8" fill="#f9d423" />
      <circle r="6.6" fill="#fff3a6" />
      <path d="M0-6V6M-6 0H6M-4.2-4.2 4.2 4.2M4.2-4.2-4.2 4.2" stroke="#f9d423" strokeWidth="1" />
    </>
  ),
  honey: (
    <path
      d="M-14-4c5 6 9-6 14 0s9-6 14 0"
      fill="none"
      stroke="#f2a516"
      strokeWidth="3"
      strokeLinecap="round"
    />
  ),
  potato: (
    <>
      {[
        [-6, -3, -10],
        [5, -4, 20],
        [0, 6, 0],
      ].map(([x, y, r]) => (
        <rect
          key={`${x}${y}`}
          x={x - 5}
          y={y - 4}
          width="10"
          height="8"
          rx="3.5"
          fill="#f2d16b"
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
    </>
  ),
  cocoa: (
    <>
      {[
        [-6, -3],
        [0, -6],
        [5, -1],
        [-3, 4],
        [4, 6],
      ].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x - 2} y={y - 2} width="4" height="4" rx="1" fill="#5b3421" />
      ))}
    </>
  ),
}

function Dots({ color, shine }: { color: string; shine: string }) {
  const pts = [
    [-7, -3],
    [-1, -6],
    [5, -3],
    [-4, 3],
    [2, 2],
    [8, 3],
    [-1, 8],
  ]
  return (
    <>
      {pts.map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="3.2" fill={color} />
          <circle cx={x - 1} cy={y - 1} r=".9" fill={shine} />
        </g>
      ))}
    </>
  )
}

/** Продукты по местам: `slots` — точки на блюде, поворот чуть меняется от названия. */
function placed(toppings: Topping[], slots: [number, number][], seed: number, scale = 1) {
  return toppings.slice(0, slots.length).map((t, i) => {
    const [x, y] = slots[i]
    const rot = ((seed >> (i * 3)) % 41) - 20
    return (
      <g key={t} transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
        {T[t]}
      </g>
    )
  })
}

/* ---------- основа: крупа, творог, хумус ---------- */

const BASE_COLORS: Record<Base, [string, string]> = {
  rice: ['#fbfbf8', '#e6e3da'],
  buckwheat: ['#8b5a3c', '#6b4129'],
  grain: ['#e8c87a', '#cfa94f'],
  pasta: ['#f4cf62', '#dcae38'],
  potato: ['#f7e3a1', '#e8c86a'],
  oats: ['#ead6a8', '#d1b67c'],
  cream: ['#fdf8ef', '#ece1cf'],
  chocoCream: ['#86553a', '#6a3f29'],
  hummus: ['#e2c08d', '#c9a46b'],
  greens: ['#7cc36b', '#4f9a3f'],
}

function BaseFill({
  base,
  cx,
  cy,
  rx,
  ry,
}: {
  base: Base
  cx: number
  cy: number
  rx: number
  ry: number
}) {
  const [main, dot] = BASE_COLORS[base]
  if (base === 'pasta') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={main} />
        {[-10, -4, 2, 8].map((dy) => (
          <path
            key={dy}
            d={`M${cx - rx + 6} ${cy + dy}q5-5 10 0t10 0 10 0`}
            fill="none"
            stroke={dot}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }
  if (base === 'greens') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={main} />
        {[
          [-10, -8],
          [8, -10],
          [12, 6],
          [-8, 10],
          [0, 0],
        ].map(([x, y]) => (
          <path
            key={`${x}${y}`}
            d={`M${cx + x} ${cy + y - 7}c5 3 5 11 0 14-5-3-5-11 0-14Z`}
            fill={dot}
            transform={`rotate(${x * 3} ${cx + x} ${cy + y})`}
          />
        ))}
      </g>
    )
  }
  const creamy = base === 'cream' || base === 'chocoCream' || base === 'hummus'
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={main} />
      {creamy ? (
        <path
          d={`M${cx - rx * 0.5} ${cy}c4-6 12-6 14 0s-6 8-10 4`}
          fill="none"
          stroke={dot}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        Array.from({ length: 14 }, (_, i) => {
          const a = i * 2.39
          const r = Math.sqrt(i / 14) * Math.min(rx, ry) * 0.85
          return (
            <ellipse
              key={i}
              cx={cx + Math.cos(a) * r}
              cy={cy + Math.sin(a) * r}
              rx="1.8"
              ry="1.1"
              fill={dot}
              transform={`rotate(${i * 40} ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r})`}
            />
          )
        })
      )}
    </g>
  )
}

/* ---------- посуда ---------- */

const shadow = <ellipse cx="60" cy="108" rx="40" ry="5" fill="rgb(0 0 0 / 18%)" />

const VESSELS: Record<ReturnType<typeof dishArt>['vessel'], Draw> = {
  plate: (_fill, base, toppings, seed) => (
    <>
      {shadow}
      <circle cx="60" cy="60" r="48" fill="#ffffff" />
      <circle cx="60" cy="60" r="39" fill="#f4f1ec" />
      {base && <BaseFill base={base} cx={45} cy={60} rx={22} ry={26} />}
      {placed(
        toppings,
        base
          ? [
              [76, 46],
              [78, 72],
              [56, 84],
              [54, 38],
            ]
          : [
              [46, 48],
              [74, 50],
              [62, 76],
              [40, 72],
            ],
        seed,
      )}
    </>
  ),
  bowl: (fill, base, toppings, seed) => (
    <>
      {shadow}
      <circle cx="60" cy="60" r="48" fill="#5b7bd5" />
      <circle cx="60" cy="60" r="44" fill="#7c97e6" />
      <circle cx="60" cy="60" r="38" fill={base ? BASE_COLORS[base][0] : fill} />
      {base && <BaseFill base={base} cx={60} cy={60} rx={38} ry={38} />}
      {placed(
        toppings,
        [
          [46, 50],
          [74, 52],
          [62, 76],
          [44, 74],
        ],
        seed,
      )}
    </>
  ),
  soup: (fill, _base, toppings, seed) => (
    <>
      {shadow}
      <circle cx="60" cy="60" r="48" fill="#f2f0eb" />
      <circle cx="60" cy="60" r="44" fill="#d9534f" />
      <circle cx="60" cy="60" r="40" fill="#ffffff" />
      <circle cx="60" cy="60" r="35" fill={fill} />
      <ellipse
        cx="48"
        cy="48"
        rx="9"
        ry="4"
        fill="rgb(255 255 255 / 35%)"
        transform="rotate(-30 48 48)"
      />
      {placed(
        toppings,
        [
          [50, 56],
          [72, 58],
          [60, 76],
          [42, 72],
        ],
        seed,
        0.8,
      )}
    </>
  ),
  glass: (fill, _base, toppings) => (
    <>
      {shadow}
      <path d="M34 18h52l-6 86a6 6 0 0 1-6 5H46a6 6 0 0 1-6-5Z" fill="rgb(255 255 255 / 55%)" />
      <path d="M37 38h46l-5 64a5 5 0 0 1-5 4H47a5 5 0 0 1-5-4Z" fill={fill} />
      <ellipse cx="60" cy="38" rx="23" ry="4" fill={fill} stroke="rgb(255 255 255 / 60%)" />
      <path d="M68 6 62 60" stroke="#ff6b9a" strokeWidth="5" strokeLinecap="round" />
      <path d="M44 46v40" stroke="rgb(255 255 255 / 45%)" strokeWidth="4" strokeLinecap="round" />
      {toppings[0] && <g transform="translate(84 22) scale(.8)">{T[toppings[0]]}</g>}
    </>
  ),
  mug: (fill, _base, toppings) => (
    <>
      {shadow}
      <path d="M86 48h6a12 12 0 0 1 0 24h-6" fill="none" stroke="#f2f0eb" strokeWidth="7" />
      <rect x="28" y="34" width="60" height="72" rx="10" fill="#f2f0eb" />
      <ellipse cx="58" cy="36" rx="30" ry="7" fill="#e0dbd2" />
      <path d="M31 36c4-14 50-14 54 0 0 6-54 6-54 0Z" fill={fill} />
      <path
        d="M40 30c3-5 8-4 10 0M58 26c3-4 9-3 10 1"
        stroke="rgb(255 255 255 / 40%)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="28" y="62" width="60" height="10" fill="#7c97e6" />
      {toppings[0] && toppings[0] !== 'cocoa' && (
        <g transform="translate(58 28) scale(.7)">{T[toppings[0]]}</g>
      )}
    </>
  ),
  jar: (fill, base, toppings) => (
    <>
      {shadow}
      <rect x="34" y="12" width="52" height="10" rx="3" fill="#c9a46b" />
      <rect x="30" y="22" width="60" height="86" rx="12" fill="rgb(255 255 255 / 55%)" />
      <rect x="34" y="66" width="52" height="38" rx="8" fill={base ? BASE_COLORS[base][0] : fill} />
      <rect x="34" y="50" width="52" height="18" fill="#fdf8ef" />
      <rect x="34" y="38" width="52" height="14" rx="4" fill="#f29bb0" />
      {toppings.includes('strawberry') && (
        <g transform="translate(60 34) scale(.8)">{T.strawberry}</g>
      )}
    </>
  ),
  pan: (fill, _base, toppings, seed) => (
    <>
      {shadow}
      <rect x="92" y="54" width="28" height="10" rx="5" fill="#3a3a3a" />
      <circle cx="56" cy="60" r="46" fill="#3a3a3a" />
      <circle cx="56" cy="60" r="40" fill="#4a4a4a" />
      <circle cx="56" cy="60" r="36" fill={fill} />
      {placed(
        toppings,
        [
          [44, 50],
          [68, 52],
          [58, 76],
          [38, 72],
        ],
        seed,
      )}
    </>
  ),
  stack: (fill, _base, toppings) => (
    <>
      {shadow}
      <ellipse cx="60" cy="96" rx="48" ry="12" fill="#ffffff" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx="60" cy={86 - i * 11} rx="36" ry="10" fill="#c98f45" />
          <ellipse cx="60" cy={83 - i * 11} rx="36" ry="9.5" fill={fill} />
        </g>
      ))}
      <path
        d="M40 50c6 6 12 3 14 10 2-6 8-4 12-10"
        fill="none"
        stroke="#f2a516"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {toppings[0] && <g transform="translate(60 46) scale(.9)">{T[toppings[0]]}</g>}
    </>
  ),
  toast: (_fill, _base, toppings, seed) => (
    <>
      {shadow}
      <path
        d="M22 44c0-22 76-22 76 0 0 6-4 8-6 9v44a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V53c-2-1-6-3-6-9Z"
        fill="#c98f45"
      />
      <path
        d="M28 45c0-16 64-16 64 0 0 4-3 6-5 7v42a3 3 0 0 1-3 3H36a3 3 0 0 1-3-3V52c-2-1-5-3-5-7Z"
        fill="#f1d39b"
      />
      {placed(
        toppings,
        [
          [48, 52],
          [72, 58],
          [56, 80],
          [76, 82],
        ],
        seed,
        0.95,
      )}
    </>
  ),
  wrap: () => (
    <>
      {shadow}
      {[
        [40, 66, -12],
        [80, 58, 14],
      ].map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-18" y="-30" width="36" height="60" rx="16" fill="#f1d9a6" />
          <ellipse cx="0" cy="-22" rx="16" ry="9" fill="#fbecc8" />
          <ellipse cx="0" cy="-22" rx="12" ry="6.5" fill="#7cc36b" />
          <circle cx="-5" cy="-23" r="3" fill="#e63946" />
          <rect x="1" y="-26" width="8" height="5" rx="2" fill="#e7bf8d" />
          <path d="M-14 0h28M-14 12h28" stroke="#d9b779" strokeWidth="1.5" />
        </g>
      ))}
    </>
  ),
  balls: () => (
    <>
      {shadow}
      <circle cx="60" cy="60" r="48" fill="#ffffff" />
      <circle cx="60" cy="60" r="39" fill="#f4f1ec" />
      {[
        [44, 50],
        [70, 46],
        [76, 70],
        [52, 76],
        [60, 60],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="11" fill="#6b3f26" />
          <circle cx={x - 3} cy={y - 3} r="3" fill="rgb(255 255 255 / 25%)" />
          <circle cx={x + 3} cy={y + 2} r="1" fill="#3e2416" />
          <circle cx={x - 2} cy={y + 4} r="1" fill="#3e2416" />
        </g>
      ))}
    </>
  ),
  cake: (fill, _base, toppings) => (
    <>
      {shadow}
      <ellipse cx="60" cy="96" rx="48" ry="12" fill="#ffffff" />
      <path d="M22 62 98 46v42l-76 8Z" fill="#fff4dc" />
      <path d="M22 62 98 46l-8-10-68 14Z" fill={fill} />
      <path d="M22 62v34" stroke="#e7c58a" strokeWidth="2" />
      <path d="M30 76l60-10M30 86l60-8" stroke="#f3dfb5" strokeWidth="2" />
      {toppings[0] && <g transform="translate(60 44) scale(.8)">{T[toppings[0]]}</g>}
    </>
  ),
}
