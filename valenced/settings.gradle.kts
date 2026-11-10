import java.io.File

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        // Xposed API (provided by the framework at runtime).
        maven(url = "https://api.xposed.info/")
        // The Valenced plugin API, built from source and published locally by CI (GitHub Packages needs a token).
        mavenLocal()
    }
}

rootProject.name = "valenced-quick-save"

val pluginRoots = listOf("plugins", "themes")

// Each `plugins/<name>/` or `themes/<name>/` folder with Kotlin sources (`src/main`) is a native plugin module (`:plugins:<name>` or `:themes:<name>`).
// Plugins without `src/main` are JS-only and are packaged without a Gradle project.
pluginRoots.forEach { root ->
    file(root).listFiles()
        ?.filter { it.isDirectory && File(it, "src/main").isDirectory }
        ?.sortedBy { it.name }
        ?.forEach { dir -> include(":$root:${dir.name}") }
}
