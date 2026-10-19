package ru.fitnes.app.run

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import ru.fitnes.app.MainActivity
import ru.fitnes.app.R
import ru.fitnes.app.workout.RestAlarm
import java.util.Locale

/** Точка GPS — как `GpsFix` в веб-приложении. */
data class Fix(val lat: Double, val lon: Double, val accuracy: Float, val alt: Double?, val t: Long)

/** Сигнал интервалов: когда (мс эпохи), что сказать (пусто — только вибрация) и как вибрировать. */
data class Cue(val at: Long, val text: String, val pattern: LongArray)

/**
 * Служба переднего плана на время бега: пишет точки GPS и при выключенном экране,
 * пока WebView спит. Веб-приложение забирает накопленные точки через `RunTracker.drain()`.
 */
class RunLocationService : Service(), LocationListener {
    private var wakeLock: PowerManager.WakeLock? = null
    private var listening = false
    private val handler = Handler(Looper.getMainLooper())
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    /** Фраза, пришедшая раньше, чем голос успел запуститься (первая фаза — сразу на старте). */
    private var pendingSpeech: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Идёт запись маршрута"
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification(title),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0,
        )
        if (!listening) listen()
        scheduleCues()
        return START_NOT_STICKY
    }

    /**
     * Смена фаз интервалов: страница при выключенном экране спит, поэтому голос и вибрацию
     * подаёт служба. Каждый новый `start` заменяет расписание (пауза, возврат на экран, голос вкл/выкл).
     */
    private fun scheduleCues() {
        handler.removeCallbacksAndMessages(null)
        val list = cues
        if (list.any { it.text.isNotEmpty() } && tts == null) {
            tts = TextToSpeech(this) { status ->
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    tts?.language = Locale.forLanguageTag("ru-RU")
                    pendingSpeech?.let { tts?.speak(it, TextToSpeech.QUEUE_FLUSH, null, "run-cue") }
                }
                pendingSpeech = null
            }
        }
        val now = System.currentTimeMillis()
        for (cue in list) {
            // опоздали меньше чем на 2 с — сказать сейчас, иначе сигнал уже не к месту
            if (cue.at < now - 2000) continue
            handler.postDelayed({ fire(cue) }, maxOf(0L, cue.at - now))
        }
    }

    private fun fire(cue: Cue) {
        if (cue.pattern.isNotEmpty()) RestAlarm.vibrate(this, cue.pattern)
        if (cue.text.isEmpty()) return
        if (ttsReady) tts?.speak(cue.text, TextToSpeech.QUEUE_FLUSH, null, "run-cue")
        else pendingSpeech = cue.text
    }

    @SuppressLint("WakelockTimeout")
    private fun listen() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return
        }
        // процессор не засыпает, пока идёт бег; не дольше 6 часов на случай, если службу забыли остановить
        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "fitnes:run")
            .apply { acquire(6 * 60 * 60 * 1000L) }
        val lm = getSystemService(LocationManager::class.java)
        lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
        listening = true
        running = true
    }

    override fun onLocationChanged(location: Location) {
        val fix = Fix(
            lat = location.latitude,
            lon = location.longitude,
            accuracy = location.accuracy,
            alt = if (location.hasAltitude()) location.altitude else null,
            t = location.time,
        )
        synchronized(buffer) { buffer.add(fix) }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        tts?.shutdown()
        tts = null
        if (listening) getSystemService(LocationManager::class.java).removeUpdates(this)
        listening = false
        running = false
        wakeLock?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    private fun notification(title: String): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Бег и ходьба", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Пока идёт запись маршрута"
            },
        )
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle(title)
            .setContentText("Маршрут записывается и при выключенном экране")
            .setContentIntent(open)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .build()
    }

    companion object {
        const val EXTRA_TITLE = "title"
        private const val CHANNEL = "run"
        private const val NOTIFICATION_ID = 2001
        private val buffer = ArrayList<Fix>()

        @Volatile
        private var cues: List<Cue> = emptyList()

        @Volatile
        var running = false
            private set

        /** Забрать накопленные точки (буфер очищается). */
        fun drain(): List<Fix> = synchronized(buffer) {
            val out = buffer.toList()
            buffer.clear()
            out
        }

        fun start(context: Context, title: String, cues: List<Cue> = emptyList()) {
            this.cues = cues
            ContextCompat.startForegroundService(
                context,
                Intent(context, RunLocationService::class.java).putExtra(EXTRA_TITLE, title),
            )
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RunLocationService::class.java))
        }
    }
}
