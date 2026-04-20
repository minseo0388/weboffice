#!/bin/bash
# build_hwplib.sh — Builds hwplib from source and installs it into backend/libs/
# Run this once before building the main project.
# Requirements: git, Java 17+

set -e

LIBS_DIR="$(dirname "$0")/libs"
mkdir -p "$LIBS_DIR"

echo "==> Cloning hwplib..."
TMP=$(mktemp -d)
git clone --depth=1 https://github.com/neolord0/hwplib "$TMP/hwplib"

echo "==> Building hwplib JAR with Gradle..."
cd "$TMP/hwplib"
chmod +x ./gradlew

# Use Java 17 if JAVA_HOME is set to it, otherwise rely on the system JDK
JAVA_HOME=${JAVA_HOME:-$(dirname $(dirname $(readlink -f $(which java))))}
export JAVA_HOME
./gradlew jar --no-daemon

JAR=$(find build/libs -name "hwplib-*.jar" | head -1)
if [ -z "$JAR" ]; then
  echo "ERROR: hwplib JAR not found after build!"
  exit 1
fi

cp "$JAR" "$LIBS_DIR/hwplib.jar"
echo "==> hwplib.jar copied to $LIBS_DIR"
echo "Done! You can now run: JAVA_HOME=<jdk17> ./gradlew.bat build in the backend directory."
