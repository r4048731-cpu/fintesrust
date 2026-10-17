/** GPS браузер даёт только защищённым страницам: https:// или localhost. */
export const gpsAvailable = () =>
  typeof window !== 'undefined' && window.isSecureContext && 'geolocation' in navigator
