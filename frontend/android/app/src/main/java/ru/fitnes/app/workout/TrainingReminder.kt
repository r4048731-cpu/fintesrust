package ru.fitnes.app.workout

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.concurrent.TimeUnit
import ru.fitnes.app.MainActivity
import ru.fitnes.app.R

/**
 * Настройки напоминания о тренировке: дни недели (1 — понедельник … 7 — воскресенье) и время.
 * `next` и `doneDate` присылает приложение: что за тренировка следующая и когда была последняя —
 * базу приложения (IndexedDB) отсюда не прочитать.
 */
data class TrainingReminderSettings(
    val enabled: Boolean,
    val hour: Int,
    val minute: Int,
    val days: Set<Int>,
    val next: String,
    val doneDate: String,
)

object TrainingReminder {
    private const val PREFS = "training_reminder"
    private const val WORK = "training_reminder"
    private const val CHANNEL = "training"
    private const val NOTIFICATION_ID = 3001
    val DEFAULT_DAYS = setOf(1, 3, 5)

    fun load(context: Context): TrainingReminderSettings {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val days = p.getString("days", null)
            ?.split(',')
            ?.mapNotNull { it.toIntOrNull() }
            ?.filter { it in 1..7 }
            ?.toSet()
            ?: DEFAULT_DAYS
        return TrainingReminderSettings(
            enabled = p.getBoolean("enabled", false),
            hour = p.getInt("hour", 19),
            minute = p.getInt("minute", 0),
            days = days,
            next = p.getString("next", "") ?: "",
            doneDate = p.getString("doneDate", "") ?: "",
        )
    }

    fun save(context: Context, enabled: Boolean, hour: Int, minute: Int, days: Set<Int>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("enabled", enabled)
            .putInt("hour", hour)
            .putInt("minute", minute)
            .putString("days", days.sorted().joinToString(","))
            .apply()
        schedule(context)
    }

    /** Что за тренировка следующая и дата последней — без перестановки расписания. */
    fun saveInfo(context: Context, next: String, doneDate: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("next", next)
            .putString("doneDate", doneDate)
            .apply()
    }

    /** Ближайшее время среди выбранных дней не раньше чем через 30 с; null — дней нет. */
    fun nextAt(s: TrainingReminderSettings, now: LocalDateTime): LocalDateTime? {
        if (s.days.isEmpty()) return null
        val base = now.withHour(s.hour).withMinute(s.minute).withSecond(0).withNano(0)
        for (shift in 0L..7L) {
            val at = base.plusDays(shift)
            if (at.dayOfWeek.value in s.days && at.isAfter(now.plusSeconds(30))) return at
        }
        return null
    }

    /** Ставит одно уведомление на ближайший выбранный день; после показа Worker ставит следующее. */
    fun schedule(context: Context) {
        val s = load(context)
        val wm = WorkManager.getInstance(context)
        val at = if (s.enabled) nextAt(s, LocalDateTime.now()) else null
        if (at == null) {
            wm.cancelUniqueWork(WORK)
            return
        }
        val delay = Duration.between(LocalDateTime.now(), at).toMillis()
        val request = OneTimeWorkRequestBuilder<TrainingReminderWorker>()
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .build()
        wm.enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, request)
    }

    fun notify(context: Context, next: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Напоминание о тренировке", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "В выбранные дни недели — какая тренировка сегодня"
            },
        )
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle(if (next.isBlank()) "Сегодня тренировка" else "Сегодня: $next")
            .setContentText("Пора тренироваться — откройте приложение, чтобы начать.")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, n)
    }
}

/** В выбранный день и час: если сегодня ещё не тренировались — уведомление; затем следующее. */
class TrainingReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val ctx = applicationContext
        val s = TrainingReminder.load(ctx)
        val today = LocalDate.now()
        if (s.enabled && today.dayOfWeek.value in s.days && s.doneDate != today.toString()) {
            TrainingReminder.notify(ctx, s.next)
        }
        TrainingReminder.schedule(ctx)
        return Result.success()
    }
}
