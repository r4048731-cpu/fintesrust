/**
 * Новый UUID v4 для записей.
 *
 * crypto.randomUUID() браузер даёт только на защищённых адресах (HTTPS или localhost).
 * Телефон в домашней сети открывает приложение по http://192.168.…, и там этой функции нет.
 * crypto.getRandomValues() работает на любом адресе, из него и собирается UUID.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function' && globalThis.isSecureContext !== false) {
    return crypto.randomUUID()
  }
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // версия 4
  b[8] = (b[8] & 0x3f) | 0x80 // вариант RFC 4122
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
