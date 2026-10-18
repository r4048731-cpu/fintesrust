package ru.fitnes.app.steps

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
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.time.Duration
import java.time.LocalDateTime
import java.util.concurrent.TimeUnit
import ru.fitnes.app.MainActivity
import ru.fitnes.app.R

/** Настройки вечернего уведомления о шагах — хранятся в SharedPreferences телефона. */
data class ReminderSettings(val enabled: Boolean, val hour: Int, val minute: Int, val goal: Int)

object StepsReminder {
    private const val PREFS = "steps_reminder"
    private const val WORK = "steps_daily_summary"
    const val CHANNEL = "steps"

    fun load(context: Context): ReminderSettings {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return ReminderSettings(
            enabled = p.getBoolean("enabled", false),
            hour = p.getInt("hour", 21),
            minute = p.getInt("minute", 0),
            goal = p.getInt("goal", 8000),
        )
    }

    fun save(context: Context, s: ReminderSettings) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("enabled", s.enabled)
            .putInt("hour", s.hour)
            .putInt("minute", s.minute)
            .putInt("goal", s.goal)
            .apply()
        schedule(context)
    }

    /** Ставит одно уведомление на ближайшее время HH:MM; после показа Worker ставит следующее. */
    fun schedule(context: Context) {
        val s = load(context)
        val wm = WorkManager.getInstance(context)
        if (!s.enabled) {
            wm.cancelUniqueWork(WORK)
            return
        }
        val now = LocalDateTime.now()
        var at = now.withHour(s.hour).withMinute(s.minute).withSecond(0).withNano(0)
        if (!at.isAfter(now.plusSeconds(30))) at = at.plusDays(1)
        val delay = Duration.between(now, at).toMillis()
        val request = OneTimeWorkRequestBuilder<StepsSummaryWorker>()
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .build()
        wm.enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, request)
    }

    fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Шаги за день", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Вечерний итог шагов"
            },
        )
    }

    /** Текст уведомления: шаги и сколько осталось до цели. */
    fun message(steps: Long, goal: Int): Pair<String, String> {
        val n = String.format("%,d", steps).replace(',', ' ')
        val title = "Сегодня $n ${plural(steps)}"
        val text = when {
            goal <= 0 -> "Хорошего вечера!"
            steps >= goal -> "Цель выполнена — так держать!"
            else -> "До цели ${String.format("%,d", goal - steps).replace(',', ' ')} — короткая прогулка, и готово."
        }
        return title to text
    }

    private fun plural(n: Long): String {
        val m10 = n % 10
        val m100 = n % 100
        return when {
            m10 == 1L && m100 != 11L -> "шаг"
            m10 in 2..4 && m100 !in 12..14 -> "шага"
            else -> "шагов"
        }
    }

    fun notify(context: Context, title: String, text: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        ensureChannel(context)
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(1001, n)
    }
}

/** Вечером: читает шаги за день из Health Connect и показывает уведомление с итогом. */
class StepsSummaryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val s = StepsReminder.load(ctx)
        try {
            if (s.enabled && StepsReader.status(ctx) == "available") {
                val granted = StepsReader.granted(ctx)
                if (StepsReader.READ_STEPS in granted && StepsReader.READ_IN_BACKGROUND in granted) {
                    val (title, text) = StepsReminder.message(StepsReader.today(ctx), s.goal)
                    StepsReminder.notify(ctx, title, text)
                }
            }
        } catch (e: Exception) {
            // нет доступа или Health Connect занят — уведомление пропускаем, завтра попробуем снова
        } finally {
            StepsReminder.schedule(ctx)
        }
        return Result.success()
    }
}
