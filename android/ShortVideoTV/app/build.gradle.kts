plugins {
    id("com.android.application")
}

android {
    namespace = "com.shortvideo.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.shortvideo.tv"
        minSdk = 21
        targetSdk = 34
        versionCode = project.findProperty("appVersionCode")?.toString()?.toIntOrNull() ?: 1
        versionName = project.findProperty("appVersionName")?.toString() ?: "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-ui:1.3.1")
}
