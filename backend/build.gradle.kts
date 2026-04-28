plugins {
    java
    id("org.springframework.boot") version "3.2.5"
    id("io.spring.dependency-management") version "1.1.4"
}

group = "com.cloud"
version = "0.0.1-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

repositories {
    mavenCentral()
    maven("https://jitpack.io")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:0.12.5")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.5")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.5")

    // hwplib — HWP binary parser. Published on Maven Central by neolord0.
    implementation("kr.dogfoot:hwplib:1.1.9")

    // Apache POI — MS Office format parsing and writing
    implementation("org.apache.poi:poi-ooxml:5.2.4")       // DOCX, XLSX, PPTX
    implementation("org.apache.poi:poi:5.2.4")              // XLS (legacy)
    implementation("org.apache.poi:poi-scratchpad:5.2.4")   // DOC (legacy HWPF)
    implementation("org.apache.xmlbeans:xmlbeans:5.1.1")   // POI dependency

    // Apache Commons for utility functions
    implementation("org.apache.commons:commons-lang3:3.14.0")

    // OpenPDF — PDF generation (LGPL/MPL, Apache-POI-friendly)
    implementation("com.github.librepdf:openpdf:1.3.30")

    // Oracle OCI Object Storage SDK
    implementation("com.oracle.oci.sdk:oci-java-sdk-objectstorage:3.35.0")
    implementation("com.oracle.oci.sdk:oci-java-sdk-common:3.35.0")

    // Jackson
    implementation("com.fasterxml.jackson.core:jackson-databind")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
