@file:JvmName("QuickSave")

package anderinfera.quicksave

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.widget.Toast
import io.github.revenge.plugins.plugin
import io.github.revenge.xposed.api.registerNativeAsyncMethod
import io.github.revenge.xposed.api.registerNativeMethod
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Native half of QuickSave: downloads a file and saves it into a user-chosen folder.
 *
 * JS calls `<plugin id>.saveTo(url, folder, fileName, mimeType?)` when the viewed media's channel has a folder rule.
 * Discord's own Save can't take a destination, and Revenge's `fs.write` only writes text, hence this.
 *
 * - With "All files access" granted to Discord: any folder, written directly (`Memy/Funny`, `/storage/emulated/0/Memy`).
 * - Without it: only public folders (`Pictures/...`, `Download/...`, ...) through MediaStore, which needs no permission.
 *
 * `<plugin id>.canWriteAnywhere()` tells the settings screen which of the two applies.
 */
@Suppress("UNUSED")
val quickSave = plugin {
    start {
        withAppContext { ctx ->
            registerNativeMethod("${manifest.id}.canWriteAnywhere") { hasAllFilesAccess(ctx) }

            // Async: runs off the React native-modules thread, so blocking network/disk IO is fine here.
            registerNativeAsyncMethod("${manifest.id}.saveTo") { args ->
                val url = args.getOrNull(0) as? String ?: throw IllegalArgumentException("Missing url")
                val folder = args.getOrNull(1) as? String ?: throw IllegalArgumentException("Missing folder")
                val fileName = sanitizeFileName(args.getOrNull(2) as? String ?: url.substringAfterLast('/').substringBefore('?'))
                val mimeHint = args.getOrNull(3) as? String

                try {
                    // No toast on success on purpose; errors still show one.
                    saveTo(ctx, url, folder, fileName, mimeHint)
                } catch (e: Throwable) {
                    log.e("Save to '$folder' failed", e)
                    toast(ctx, "Nie udało się zapisać: ${e.message}")
                    throw e
                }
            }
        }
    }
}

private val PUBLIC_DIRS = listOf(
    Environment.DIRECTORY_PICTURES,
    Environment.DIRECTORY_DCIM,
    Environment.DIRECTORY_DOWNLOADS,
    Environment.DIRECTORY_MOVIES,
    Environment.DIRECTORY_MUSIC,
    Environment.DIRECTORY_DOCUMENTS,
)

/** `/storage/emulated/0/Pictures/Funny/` or `pictures/Funny` -> `Pictures/Funny`. Only public top-level folders are allowed. */
internal fun normalizeFolder(input: String): String {
    val path = input.trim().replace('\\', '/')
        .removePrefix("/storage/emulated/0")
        .removePrefix("/sdcard")
    val parts = path.split('/').filter { it.isNotBlank() && it != "." }
    require(parts.isNotEmpty()) { "Pusta ścieżka" }
    require(parts.none { it == ".." }) { "Ścieżka nie może zawierać '..'" }

    val first = if (parts[0].equals("Downloads", ignoreCase = true)) Environment.DIRECTORY_DOWNLOADS else parts[0]
    val top = PUBLIC_DIRS.firstOrNull { it.equals(first, ignoreCase = true) }
        ?: throw IllegalArgumentException("Ścieżka musi zaczynać się od: ${PUBLIC_DIRS.joinToString()}")
    return (listOf(top) + parts.drop(1)).joinToString("/")
}

private fun sanitizeFileName(name: String): String =
    name.replace(Regex("""[\\/:*?"<>|\u0000-\u001f]"""), "_").ifBlank { "file" }

private fun open(url: String): HttpURLConnection =
    (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000
        readTimeout = 60_000
        instanceFollowRedirects = true
        connect()
        if (responseCode !in 200..299) throw IllegalStateException("HTTP $responseCode")
    }

/** Discord holds MANAGE_EXTERNAL_STORAGE ("All files access") on Android 11+, or the legacy write permission before. */
internal fun hasAllFilesAccess(ctx: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager()
    else ctx.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

/** `Memy/Funny` (from the storage root), `/sdcard/Memy` or `/storage/emulated/0/Memy` -> the absolute directory. */
@Suppress("DEPRECATION")
internal fun resolveAnyFolder(input: String): File {
    val path = input.trim().replace('\\', '/')
    require(path.isNotEmpty() && path != "/") { "Pusta ścieżka" }
    require(path.split('/').none { it == ".." }) { "Ścieżka nie może zawierać '..'" }

    val root = Environment.getExternalStorageDirectory()
    return when {
        path.startsWith("/storage/") -> File(path)
        path == "/sdcard" || path.startsWith("/sdcard/") -> File(root, path.removePrefix("/sdcard"))
        else -> File(root, path.trimStart('/'))
    }
}

/** @return Where the file was saved, relative to the storage root when inside it, e.g. `Pictures/Funny/cat.png`. */
private fun saveTo(ctx: Context, url: String, folder: String, fileName: String, mimeHint: String?): String {
    // Validate before downloading anything.
    val anyDir = if (hasAllFilesAccess(ctx)) resolveAnyFolder(folder) else null
    val publicFolder = if (anyDir == null) normalizeFolder(folder) else null

    val conn = open(url)
    try {
        val mime = mimeHint?.takeIf { '/' in it }
            ?: conn.contentType?.substringBefore(';')?.trim()?.takeIf { '/' in it }
            ?: "application/octet-stream"

        return conn.inputStream.use { input ->
            when {
                anyDir != null -> saveToDirectory(ctx, input, anyDir, fileName, mime)
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> saveWithMediaStore(ctx, input, publicFolder!!, fileName, mime)
                else -> saveToDirectory(ctx, input, resolveAnyFolder(publicFolder!!), fileName, mime)
            }
        }
    } finally {
        conn.disconnect()
    }
}

/** Android 10+: no storage permission needed to add files to public folders. */
private fun saveWithMediaStore(ctx: Context, input: InputStream, folder: String, fileName: String, mime: String): String {
    val top = folder.substringBefore('/')
    val collection: Uri = when {
        top == Environment.DIRECTORY_DOWNLOADS -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
        mime.startsWith("image/") && (top == Environment.DIRECTORY_PICTURES || top == Environment.DIRECTORY_DCIM) ->
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        mime.startsWith("video/") &&
            (top == Environment.DIRECTORY_MOVIES || top == Environment.DIRECTORY_DCIM || top == Environment.DIRECTORY_PICTURES) ->
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        mime.startsWith("audio/") && top == Environment.DIRECTORY_MUSIC -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        else -> MediaStore.Files.getContentUri("external")
    }

    val resolver = ctx.contentResolver
    val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
        put(MediaStore.MediaColumns.MIME_TYPE, mime)
        put(MediaStore.MediaColumns.RELATIVE_PATH, "$folder/")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val item = resolver.insert(collection, values) ?: throw IllegalStateException("MediaStore odrzucił plik")

    try {
        val out = resolver.openOutputStream(item) ?: throw IllegalStateException("Nie można otworzyć pliku do zapisu")
        out.use { input.copyTo(it) }
        resolver.update(item, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
    } catch (e: Throwable) {
        resolver.delete(item, null, null)
        throw e
    }

    // MediaStore renames on collision ("cat (1).png"), so report the name it actually used.
    val finalName = resolver.query(item, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)
        ?.use { if (it.moveToFirst()) it.getString(0) else null } ?: fileName
    return "$folder/$finalName"
}

/** Plain file write (needs All files access, or the legacy permission on Android 7-9), then index it for the gallery. */
@Suppress("DEPRECATION")
private fun saveToDirectory(ctx: Context, input: InputStream, dir: File, fileName: String, mime: String): String {
    if (!dir.isDirectory && !dir.mkdirs()) throw IllegalStateException("Nie można utworzyć folderu ${dir.absolutePath}")
    var file = File(dir, fileName)
    var n = 1
    while (file.exists()) file = File(dir, "${fileName.substringBeforeLast('.')} (${n++})" +
        (fileName.substringAfterLast('.', "").takeIf(String::isNotEmpty)?.let { ".$it" } ?: ""))

    file.outputStream().use { input.copyTo(it) }
    MediaScannerConnection.scanFile(ctx, arrayOf(file.absolutePath), arrayOf(mime), null)

    val root = Environment.getExternalStorageDirectory().absolutePath + "/"
    return file.absolutePath.removePrefix(root)
}

private fun toast(ctx: Context, text: String) {
    Handler(Looper.getMainLooper()).post { Toast.makeText(ctx, text, Toast.LENGTH_SHORT).show() }
}
