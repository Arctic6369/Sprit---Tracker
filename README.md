# Sprit-Tracker 2.0 für Android

## Test-APK installieren

1. Öffne auf GitHub den [Workflow Android-Test-APK](https://github.com/Arctic6369/Sprit---Tracker/actions/workflows/android.yml) und wähle einen Lauf für `android-app`, in dem Build und Emulatorprüfung erfolgreich sind.
2. Lade unter **Artifacts** das Archiv `sprit-tracker-android-test-apk` herunter. Melde dich dazu bei GitHub an und entpacke `app-debug.apk`.
3. Öffne die APK auf einem Android-Gerät ab Android 6 (API 23) mit aktuellem Android System WebView. Erlaube gegebenenfalls der App, mit der du die Datei öffnest, die Installation aus dieser Quelle.

Mit aktiviertem USB-Debugging geht es auch über `adb install -r app-debug.apk`. Die APK trägt die Debug-Signatur des Build-Rechners. Ein Update über eine anders signierte Installation ist nur mit vorheriger Deinstallation möglich. **Exportiere davor eine JSON-Sicherung**, da die Deinstallation die lokalen Daten löscht.

## Daten vom PC oder aus der Web-App übernehmen

1. Erstelle am bisherigen Gerät unter **Datensicherung → JSON-Sicherung** eine Datei und übertrage sie auf das Android-Gerät.
2. Wähle in der App **Import JSON/CSV**, öffne die Datei über den Android-Dateiauswahldialog und bestätige den Import. Der Import ersetzt die lokale Historie. Bestehende JSON-Backups und CSV-Dateien im Tracker-Exportformat funktionieren weiterhin.
3. Vergleiche Anzahl und Werte der Einträge. Erstelle regelmäßig eine Sicherung. Über **JSON-Sicherung** und **CSV für Excel** öffnet sich das Android-Teilen-Menü. Wähle ein Ziel, das die Datei speichert. Eine in der App erzeugte Exportdatei im Android-Cache kann später gelöscht werden.

Tankvorgänge liegen im privaten Android-App-Speicher. Android-Cloud-Backup ist für diese App deaktiviert. Das vorhandene Browserprofil speichert seine Daten separat und überträgt sie per Backup. Ein automatischer PC-/Handy-Abgleich ist ein eigener späterer Schritt.

## OCR und Verbrauch

**Tankbeleg** und **Tacho** öffnen die Auswahl für Kamera oder gespeicherte Fotos. Kontrolliere die erkannten Werte im Formular. Die deutsche Texterkennung nutzt Tesseract.js samt Worker, WASM und Sprachdaten aus der APK. Für Tankbuch, OCR, Import und Export aus lokalem Speicher ist keine Internetverbindung erforderlich. Externe Ziele im Android-Teilen- oder Dateiauswahlmenü können eine Verbindung benötigen. Die separate Browserfassung verwendet weiterhin den Tesseract-CDN.

Der Verbrauch wird zwischen bestätigten Vollbetankungen einschließlich der dazwischenliegenden Teilbetankungen berechnet. Unbekannte Füllungen unterbrechen die gültige Messstrecke. Der Durchschnitt ist nach der berücksichtigten Strecke gewichtet.

## APK lokal bauen

Voraussetzungen sind Node.js aus `.nvmrc`, Temurin JDK 21, Android SDK Platform 35 und Build-Tools 35.0.0. Setze `JAVA_HOME` und `ANDROID_HOME` passend zur Installation und akzeptiere die Android-SDK-Lizenzen. Der erste Build benötigt Netzwerkzugriff auf npm, Gradle sowie die Android-/Maven-Repositories.

```sh
npm ci
npm test
npm run android:sync
cd android
./gradlew :app:assembleDebug
```

Unter Windows verwende im Verzeichnis `android` den Befehl `.\gradlew.bat :app:assembleDebug`. Die Gradle-Version und der Prüfsummenwert stehen im eingecheckten Wrapper. Die APK liegt unter `android/app/build/outputs/apk/debug/app-debug.apk`. Führe nach Änderungen am Webcode erneut `npm run android:sync` aus.

Der Workflow testet die Datenlogik und baut die signierte Debug-APK. Danach installiert er das Artefakt auf einem API-35-Emulator und prüft die Android-Dateiauswahl, native Exporte, Prozessneustart, Kamera und Offline-OCR mit synthetischen Testdaten. Eine physische Gerätekamera lässt sich zusätzlich mit einem Testbeleg prüfen.
