#!/usr/bin/env bash
# APK'yı emülatöre kurar, açar ve 25 sn sonra hâlâ çalışıyor mu bakar.
# Çökme olursa logcat'teki hata satırlarını basar ve hata koduyla çıkar.
set -u
APK="${1:-slow-mo-rush.apk}"
PKG=com.slowmorush.slow_mo_rush
OUT=smoke
mkdir -p "$OUT"

adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
sleep 25

adb exec-out screencap -p > "$OUT/screen.png" || true
adb logcat -d > "$OUT/logcat.txt"

echo "===== Uygulama logları ====="
grep -E "AndroidRuntime|FATAL|flutter|DartVM|Ads|$PKG|libc.*Fatal|DEBUG" "$OUT/logcat.txt" | tail -n 200

if adb shell pidof "$PKG" > /dev/null; then
  echo "SMOKE OK: uygulama 25 sn sonra hâlâ çalışıyor"
else
  echo "SMOKE FAIL: uygulama kapandı"
  exit 1
fi
