# Картинки техники

Два положения на упражнение — начало и конец движения: `<id>-0.webp` и `<id>-1.webp`.
В карточке упражнения они стоят рядом. Лежат в приложении и работают без интернета.
id — из `src/data/seed.ts` без «builtin-» (например, `drawings/squat-0.webp`).

- `drawings/` — рисунки [Everkinetic](https://github.com/everkinetic/data) (Greg Priday),
  лицензия **CC BY-SA 4.0**: при показе обязательно указывать автора и лицензию (подпись
  под картинками в карточке). Картинки уменьшены до 480 px и переведены в WebP; эти
  изменённые версии распространяются под той же лицензией CC BY-SA 4.0.
- `photos/` — фото [free-exercise-db](https://github.com/yuhonas/free-exercise-db),
  общественное достояние (Unlicense). Только для упражнений, у которых нет рисунка.

- `boxing/` — бокс: фото из наставлений армии США по рукопашному бою
  [FM 3-25.150 (2002)](https://commons.wikimedia.org/wiki/File:FM_3-25.150_Combatives_January_2002.pdf)
  и [TC 3-25.150 (2017)](https://commons.wikimedia.org/wiki/File:TC_3-25.150_Combatives_March_2017.pdf) —
  работа правительства США, общественное достояние (стойка, джеб, прямой, боковой, апперкот,
  лапы, уклон). Работа на мешке —
  [Ike Williams, Los Angeles Times](https://commons.wikimedia.org/wiki/File:Ike_Williams_and_punching_bag.jpg),
  CC BY 4.0: указывать источник. Какие кадры у какого упражнения — в `BOXING` в
  `src/domain/technique.ts`.

Чтобы добавить картинки: положить оба файла в нужную папку и вписать id в список
`DRAWINGS` или `PHOTOS` в `src/domain/technique.ts`.

## Схема мышц

`muscles/` — тело спереди и сзади (`front.webp`, `back.webp`) и слои мышц
(`main-<n>.svg` — красные, основные; `secondary-<n>.svg` — оранжевые, вспомогательные).
Рисунок тела — [Termininja, Викисклад](https://commons.wikimedia.org/wiki/File:Muscular_system.svg)
(CC BY-SA 3.0), слои мышц — из проекта [wger](https://github.com/wger-project/wger)
(`wger/core/static/images/muscles`). Номера слоев и какие мышцы работают в каждом
упражнении — в `src/domain/muscles.ts`. Подпись об источнике стоит под схемой.
