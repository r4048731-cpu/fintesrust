package ru.fitnes.app.water

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
 * Напоминание пить воду: с `from` до `to` часов каждые `every` часов.
 * `date`, `ml` и `goal` присылает приложение — сколько выпито и какая норма: базу приложения
 * (IndexedDB) отсюда не прочитать.
 */
data class WaterSettings(
    val enabled: Boolean,
    val from: Int,
    val to: Int,
    val every: Int,
    val date: String,
    val ml: Int,
    val goal: Int,
)

object WaterReminder {
    private const val PREFS = "water_reminder"
    private const val WORK = "water_reminder"
    private const val CHANNEL = "water"
    private const val NOTIFICATION_ID = 4001
    private const val GLASS_ML = 250

    fun load(context: Context): WaterSettings {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return WaterSettings(
            enabled = p.getBoolean("enabled", false),
            from = p.getInt("from", 9),
            to = p.getInt("to", 21),
            every = p.getInt("every", 2),
            date = p.getString("date", "") ?: "",
            ml = p.getInt("ml", 0),
            goal = p.getInt("goal", 2000),
        )
    }

    fun save(context: Context, enabled: Boolean, from: Int, to: Int, every: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("enabled", enabled)
            .putInt("from", from)
            .putInt("to", to)
            .putInt("every", every)
            .apply()
        schedule(context)
    }

    fun saveInfo(context: Context, date: String, ml: Int, goal: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("date", date)
            .putInt("ml", ml)
            .putInt("goal", goal)
            .apply()
    }

    /** Ближайшее время проверки: from, from + every, … до to включительно, не раньше чем через 30 с. */
    fun nextAt(s: WaterSettings, now: LocalDateTime): LocalDateTime? {
        if (s.every <= 0 || s.to <= s.from) return null
        for (shift in 0L..1L) {
            val day = now.toLocalDate().plusDays(shift)
            var h = s.from
            while (h <= s.to) {
                val at = day.atTime(h, 0)
                if (at.isAfter(now.plusSeconds(30))) return at
                h += s.every
            }
        }
        return null
    }

    fun schedule(context: Context) {
        val s = load(context)
        val wm = WorkManager.getInstance(context)
        val at = if (s.enabled) nextAt(s, LocalDateTime.now()) else null
        if (at == null) {
            wm.cancelUniqueWork(WORK)
            return
        }
        val delay = Duration.between(LocalDateTime.now(), at).toMillis()
        val request = OneTimeWorkRequestBuilder<WaterReminderWorker>()
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .build()
        wm.enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, request)
    }

    /** Выпито сегодня: данные за другой день — значит, сегодня приложение не открывали. */
    fun drunkToday(s: WaterSettings, today: LocalDate): Int = if (s.date == today.toString()) s.ml else 0

    /**
     * Напоминать ли сейчас: к этому часу по ровному темпу должно быть выпито столько-то,
     * а отставание — хотя бы стакан.
     */
    fun behind(s: WaterSettings, now: LocalDateTime): Boolean {
        val ml = drunkToday(s, now.toLocalDate())
        if (ml >= s.goal) return false
        val passed = (now.hour + now.minute / 60.0 - s.from) / (s.to - s.from)
        val expected = s.goal * passed.coerceIn(0.0, 1.0)
        return ml + GLASS_ML <= expected || now.hour == s.from && ml == 0
    }

    private fun liters(ml: Int) = String.format("%.2f", ml / 1000.0).trimEnd('0').trimEnd('.', ',')

    fun notify(context: Context, s: WaterSettings) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Вода", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Напоминание выпить воды, если до нормы далеко"
            },
        )
        val ml = drunkToday(s, LocalDate.now())
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle("Стакан воды?")
            .setContentText("Выпито ${liters(ml)} из ${liters(s.goal)} л — отметьте в «Питании».")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, n)
    }
}

/** В час проверки: если отстаёте от нормы — уведомление; затем ставит следующую проверку. */
class WaterReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val ctx = applicationContext
        val s = WaterReminder.load(ctx)
        if (s.enabled && WaterReminder.behind(s, LocalDateTime.now())) WaterReminder.notify(ctx, s)
        WaterReminder.schedule(ctx)
        return Result.success()
    }
}
