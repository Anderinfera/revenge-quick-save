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
        // The CI workflow builds the Revenge API from source and publishes it here,
        // so no GitHub Packages token is needed.
        mavenLocal()
        google()
        mavenCentral()
        // Xposed API (provided by the framework at runtime).
        maven(url = "https://api.xposed.info/")
        // The Revenge plugin API is published to GitHub Packages.
        maven {
            url = uri("https://maven.pkg.github.com/revenge-mod/revenge-xposed")
            credentials(PasswordCredentials::class) {
                username = providers.gradleProperty("GitHubPackagesUsername").orNull
                    ?: System.getenv("GITHUB_ACTOR")
                password = providers.gradleProperty("GitHubPackagesPassword").orNull
                    ?: System.getenv("GITHUB_TOKEN")
            }
        }
    }
}

rootProject.name = "revenge-quick-save"

// Each `plugins/<name>/` folder with Kotlin sources (`src/main`) is a native plugin module.
// Plugins without `src/main` are JS-only and are packaged without a Gradle project.
file("plugins").listFiles()
    ?.filter { it.isDirectory && File(it, "src/main").isDirectory }
    ?.sortedBy { it.name }
    ?.forEach { dir -> include(":plugins:${dir.name}") }
