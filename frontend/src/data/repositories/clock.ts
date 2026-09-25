/** Источник текущего времени. В тестах подменяется, чтобы результаты не зависели от даты запуска. */
export type Clock = () => number

export const systemClock: Clock = () => Date.now()
