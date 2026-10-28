package ru.fitnes.app.steps

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId

/**
 * Шаги из Health Connect. Их весь день считает сам телефон (Google Fit, Samsung Health,
 * Mi Fitness и т. п.) — приложению не нужно работать в фоне, чтобы шаги были.
 */
object StepsReader {
    val READ_STEPS: String = HealthPermission.getReadPermission(StepsRecord::class)
    const val READ_IN_BACKGROUND: String = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    /** available | not_installed | update_required */
    fun status(context: Context): String =
        when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "not_installed"
        }

    fun client(context: Context): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    /** Можно ли читать в фоне (нужно для вечернего уведомления). */
    fun backgroundSupported(context: Context): Boolean =
        client(context).features.getFeatureStatus(
            HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND,
        ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    suspend fun granted(context: Context): Set<String> =
        client(context).permissionController.getGrantedPermissions()

    /** Шаги с начала сегодняшнего дня до сейчас. */
    suspend fun today(context: Context): Long {
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val result = client(context).aggregate(
            AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(start, java.time.Instant.now()),
            ),
        )
        return result[StepsRecord.COUNT_TOTAL] ?: 0L
    }

    /** Шаги сегодня по часам: 24 числа, час 0 — с полуночи до часу ночи; будущие часы — нули. */
    suspend fun hourly(context: Context): List<Long> {
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val groups = client(context).aggregateGroupByDuration(
            AggregateGroupByDurationRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(start, java.time.Instant.now()),
                timeRangeSlicer = Duration.ofHours(1),
            ),
        )
        val hours = LongArray(24)
        for (g in groups) {
            val hour = g.startTime.atZone(zone).hour
            hours[hour] += g.result[StepsRecord.COUNT_TOTAL] ?: 0L
        }
        return hours.toList()
    }

    /** Шаги по дням за последние `days` дней, включая сегодня: дата YYYY-MM-DD → шаги. */
    suspend fun daily(context: Context, days: Int): List<Pair<String, Long>> {
        val today = LocalDate.now()
        val from: LocalDateTime = today.minusDays((days - 1).toLong()).atStartOfDay()
        val to: LocalDateTime = LocalDateTime.now()
        val groups = client(context).aggregateGroupByPeriod(
            AggregateGroupByPeriodRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(from, to),
                timeRangeSlicer = Period.ofDays(1),
            ),
        )
        val byDate = groups.associate { it.startTime.toLocalDate().toString() to (it.result[StepsRecord.COUNT_TOTAL] ?: 0L) }
        return (0 until days).map { i ->
            val d = today.minusDays((days - 1 - i).toLong()).toString()
            d to (byDate[d] ?: 0L)
        }
    }
}
