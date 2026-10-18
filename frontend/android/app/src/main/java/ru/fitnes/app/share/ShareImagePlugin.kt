package ru.fitnes.app.share

import android.content.Intent
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

/**
 * `ShareImage` в JavaScript: картинка (PNG в base64) сохраняется в кэш приложения
 * и уходит в системное окно «Поделиться» — Telegram, галерея, сообщения.
 * В WebView нет navigator.share с файлами, поэтому нужен свой мост.
 */
@CapacitorPlugin(name = "ShareImage")
class ShareImagePlugin : Plugin() {
    @PluginMethod
    fun share(call: PluginCall) {
        val data = call.getString("base64")
        if (data.isNullOrEmpty()) {
            call.reject("Нет картинки")
            return
        }
        val name = (call.getString("fileName") ?: "fitnes.png").replace(Regex("[^\\w.-]"), "_")
        try {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, name)
            file.writeBytes(Base64.decode(data, Base64.DEFAULT))
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(send, call.getString("title") ?: "Поделиться")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(chooser)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message ?: "Не удалось поделиться")
        }
    }
}
