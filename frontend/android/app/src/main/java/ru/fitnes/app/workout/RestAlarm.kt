package ru.fitnes.app.workout

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import ru.fitnes.app.MainActivity
import ru.fitnes.app.R

/**
 * Конец отдыха между подходами: будильник AlarmManager срабатывает и при погасшем экране,
 * и когда приложение свёрнуто — показывает уведомление со звуком и вибрирует.
 */
object RestAlarm {
    private const val CHANNEL = "rest"
    private const val NOTIFICATION_ID = 2001
    private const val REQUEST = 2001
    private const val EXTRA_TEXT = "text"

    /** Вибрация конца отдыха: два длинных толчка. */
    val ALARM_PATTERN = longArrayOf(0, 350, 150, 350)

    private fun pending(context: Context, text: String = ""): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            REQUEST,
            Intent(context, RestAlarmReceiver::class.java).putExtra(EXTRA_TEXT, text),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    fun schedule(context: Context, atMs: Long, text: String) {
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = pending(context, text)
        // точный будильник разрешён USE_EXACT_ALARM (Android 13+) или SCHEDULE_EXACT_ALARM;
        // если система не дала — неточный, он тоже будит телефон, но может опоздать
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        }
    }

    fun cancel(context: Context) {
        context.getSystemService(AlarmManager::class.java).cancel(pending(context))
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    fun vibrate(context: Context, pattern: LongArray) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
        if (!vibrator.hasVibrator()) return
        val effect = if (pattern.size == 1) {
            VibrationEffect.createOneShot(pattern[0], VibrationEffect.DEFAULT_AMPLITUDE)
        } else {
            VibrationEffect.createWaveform(pattern, -1)
        }
        vibrator.vibrate(effect)
    }

    private fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Конец отдыха", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Сигнал, что отдых между подходами закончился"
                enableVibration(true)
                vibrationPattern = ALARM_PATTERN
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            },
        )
    }

    fun fire(context: Context, text: String) {
        val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (!allowed) {
            // без разрешения на уведомления хотя бы вибрируем
            vibrate(context, ALARM_PATTERN)
            return
        }
        ensureChannel(context)
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle("Отдых окончен")
            .setContentText(text.ifBlank { "Пора делать следующий подход" })
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVibrate(ALARM_PATTERN)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setTimeoutAfter(5 * 60 * 1000)
            .build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, n)
    }

    fun textOf(intent: Intent): String = intent.getStringExtra(EXTRA_TEXT) ?: ""
}

class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        RestAlarm.fire(context, RestAlarm.textOf(intent))
    }
}
