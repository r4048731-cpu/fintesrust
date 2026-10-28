import { isIOS } from '../../app/device'
import { Icon } from '../Icon'
import frame from '../frame.module.css'
import styles from './Steps.module.css'

/** Страница установки на GitHub Pages: локальный сервер APK не раздаёт, поэтому ссылка — на опубликованную. */
const INSTALL_URL = 'https://r4048731-cpu.github.io/fintesrust/install.html'

/**
 * «Шаги» на «Сегодня» в браузере: веб-версии шагомер телефона недоступен, поэтому вместо
 * пустого места — пояснение, где их смотреть, и ссылка на Android-приложение.
 */
export function StepsWebCard() {
  const ios = isIOS()
  return (
    <section className={`${styles.card} ${frame.frame}`} aria-label="Шаги">
      <div className={styles.head}>
        <div>
          <span className={styles.label}>Шаги сегодня</span>
          <b className={styles.big}>—</b>
          <span className={styles.muted}>
            {ios
              ? 'На iPhone шаги пока недоступны: приложение читает их только на Android.'
              : 'Шаги видно в Android-приложении: браузеру шагомер телефона недоступен.'}
          </span>
        </div>
        <div className={styles.ring} style={{ ['--p' as string]: '0deg' }} aria-hidden="true">
          <span>
            <Icon name="run" size={24} />
          </span>
        </div>
      </div>
      {!ios && (
        <a className={styles.install} href={INSTALL_URL} target="_blank" rel="noreferrer">
          Скачать для Android
          <Icon name="arrow" size={20} />
        </a>
      )}
      <p className={styles.muted}>
        В приложении здесь будут шаги по часам за сегодня, неделя и прогресс к цели — их считает сам
        телефон через Health Connect.
      </p>
    </section>
  )
}
