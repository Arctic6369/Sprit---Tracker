# Sprit-Tracker 2.0 – Entwicklungsstand

Auf dem PC: GitHub Desktop → Fetch origin → Current Branch → version-2 → gegebenenfalls Pull origin → Show in Explorer → index.html öffnen.

Auf Android: Eine HTTPS-Bereitstellung (z. B. GitHub Pages) ermöglicht das Hinzufügen zum Startbildschirm. Die Testversion ist nicht automatisch veröffentlicht. OCR benötigt möglicherweise Internetzugang; manuelle Erfassung funktioniert lokal.

## Verbrauch
Nur zwischen bestätigten Vollbetankungen, einschließlich aller dazwischenliegenden Teilbetankungen. Unbekannte Tankfüllungen unterbrechen die gültige Messstrecke. Durchschnitt nach tatsächlich berücksichtigter Strecke gewichtet.

## Daten
Version 2 übernimmt vorhandene lokale fuel_history-Daten in einen neuen Schlüssel fuel_history_v2, sofern dieselbe Browser-Adresse und dasselbe Profil verwendet werden. Die alte Historie bleibt unangetastet. Alte Volltankangaben sind unbekannt und können bearbeitet werden. JSON/CSV-Export und Import dienen der Sicherung und manuellen Übertragung. Kein automatischer Geräteabgleich.

## Tests
Echte Tankbelege, Smartphone-Kamera und Installation müssen auf dem Zielgerät ausprobiert werden. Keine Live-Veröffentlichung oder Änderung des main-Zweigs.
