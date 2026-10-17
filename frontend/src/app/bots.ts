// Ссылки на ботов. Пока ботов нет — null, и в приложении они показаны как «Скоро».
// Когда боты заработают, достаточно вписать адреса сюда.

export interface Bot {
  id: 'telegram' | 'max'
  name: string
  url: string | null
}

export const BOTS: Bot[] = [
  { id: 'telegram', name: 'Telegram', url: null },
  { id: 'max', name: 'MAX', url: null },
]
