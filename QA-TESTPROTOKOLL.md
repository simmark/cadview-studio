# CADVIEW Studio – QA-Testprotokoll (Beta 1.4.4)

Ziel: Kamera, STEP-Import, Live-Änderungen, Bemaßung und Export bei jedem Release nachvollziehbar prüfen. **Teststatus erst nach tatsächlichem Browser-Test auf PASS setzen.** Statische Codeprüfungen ersetzen keine WebGL-Tests.

## Entwicklungsbranch · Mobile Inspektion · 22. November 2026

Die historische Desktop-Checkliste ab „Umgebung“ bleibt als manueller Prüfkatalog erhalten. Der folgende Stand gilt für den Entwicklungsbranch auf Basis von 1.5.0. Die Browserprüfungen liefen auf Chromium mit Software-WebGL. Smartphone-Größen und Touch-Eingaben wurden emuliert.

| Bereich | Beobachtetes Ergebnis | Verbleibende Prüfung |
| --- | --- | --- |
| M01–M02, M21, M24 | Geschlossene Start-Sheets, nutzbare Modellfläche und kein horizontales Überlaufen bei 360, 390 und 430 px, 844 × 390 und 820 × 1180. Sprachumschaltung, Themenaktion und Vollbild-Touchziel geprüft. | Safe Areas mit Displayausschnitt, Systemschriftvergrößerung, Screenreader und erreichbare Ziele im gesamten Inspektor. |
| M03–M09 | Orbit mit einem Finger, kombinierter Pinch/Pan, direkter Pick im Modell, Mehrfachwahl im Baum, Isolieren, Ausblenden, Undo und Alle anzeigen. Zwei Touchpunkte schließen eine Messung ab. Ein Zug zurück zum Start setzt keinen Messpunkt. Schnitt und Explosion ändern in der Desktop-Suite das gerenderte Bild. | Fanggenauigkeit am Finger und Bedienkomfort bei dicht gepackten Baugruppen. |
| M10–M17, M25 | Natives Vollbild und abgelehnter nativer Aufruf, Browser-Zurück, sichtbarer Exit, Kalibrierung ohne Sprung, konstanter Orbitabstand, Zentrieren, Pinch bei aktivem Gyro, Rückkehr mit Kamerazustand. Verweigerte Freigabe und ausbleibende Sensordaten erlauben weiter Touch. Der Controller-Test prüft ungültige Werte, verspätete Freigabe nach Exit, Displaydrehung und simulierten Hintergrundwechsel. | Echte Sensorrichtung, Drift, Dialoge, Unterbrechen durch Sperren der Geräte und Kombination aller Werkzeuge mit laufendem Sensor. |
| M18–M20 | Öffentliche CAx-IF-Baugruppe as1-oc-214.stp über Dateieingabe und OCCT-Worker geladen. Vier Teile, gerenderte Dreiecke, offline erneut vier Teile nach Browser-Reload. Im Test nur GET an den eigenen Ursprung. GLB und PNG heruntergeladen und Dateisignaturen geprüft. | Große vertrauliche Modelle lokal auf Zielhardware, Downloadablage unter iOS und Android, externer GLB-Roundtrip. |
| M22 | Desktop-Referenzsuite vor und nach der Umstellung bestanden. Mausorbit, Sofort-Highlight, H-Ausblenden, Schnitt, Explosion, Maßdarstellung, Einstellungen und Exportmenü. | Edge als installierte Windows-PWA, Dateizuordnung, manueller Vergleich mit der ursprünglichen 13-Teile-Baugruppe. |
| M23 | Offline-Start nach dem Aufwärmen der CAD-Engine. Bei nachgebildetem 1.5.0-Cache wurden JS und WASM übernommen, der alte Shell-Cache entfernt und der Kontroll-Cache einer anderen App erhalten. | Update einer tatsächlich installierten PWA mit geöffnetem Projekt und Dateihandles. |

[Bestandener Referenzlauf](https://github.com/simmark/cadview-studio/actions/runs/45020562571) · [Bestandener Branchlauf unter /cadview-studio/](https://github.com/simmark/cadview-studio/actions/runs/45021381893) · [Audit und Bildschirmvergleich](docs/MOBILE-AUDIT.md)

### Reproduktion

Node 22.15+ für den isolierten Controller-Test. Aus dem Repository-Stamm:

```sh
node tests/check-release.mjs
node tests/gyro-controller.mjs
```

Für die Browserprüfungen führt der Workflow „CADVIEW browser WebGL smoke test“ die Installation, den lokalen Pages-Server, Desktop- und Mobile-Suites sowie die Screenshotaufnahme aus. Er nutzt die im Workflow auf einen Commit festgelegte öffentliche Beispieldatei. Lokal akzeptiert die Mobile-Suite CADVIEW_URL und CADVIEW_STEP als Umgebungsvariablen.

### Kurzer Hardware-Durchlauf

1. Branch auf einer eigenen vertrauenswürdigen HTTPS-Testadresse öffnen. Gerät, Browser, Betriebssystem und Startart (Tab oder PWA) festhalten. Eine bekannte STEP-Baugruppe über „Öffnen“ laden.
2. Ein innenliegendes Teil im Baum wählen. Gehäuse ausblenden, „Fokus“ anwenden und das Detail per Pinch vergrößern. Zweimal antippen im Messmodus muss genau eine Messung liefern. Beim Zurückziehen des Fingers darf kein weiterer Punkt entstehen.
3. „Vollbild“ und dann „Gyro · Test“ wählen, Freigabe erteilen. Das Gerät ruhig halten, nach links/rechts und oben/unten neigen. Ansicht bei Start und Zentrieren, Richtung, verzögerte Reaktion und Drift notieren. Mit aktiver Gyrosteuerung zoomen, drehen und ins Querformat wechseln.
4. Display sperren und fortsetzen, Schnitt bedienen und über „Zurück“ verlassen. Dateiname, Auswahl, ausgeblendete Teile und Kamera vergleichen. In einem neuen Berechtigungskontext die Sensoranfrage ablehnen und per Touch weiterarbeiten.
5. Dieselbe Datei nach Aufwärmen und im Flugmodus wieder laden, PNG/GLB öffnen. Auf Edge zusätzlich per „Öffnen mit“ starten.

Gyro-Orbit ist experimentell. Die Sicht vom festen Kamerastandpunkt im Inneren (Look-Around), einstellbare Sensitivität, eine Messlupe, gestufte Sheet-Höhen und Rendering-/Akkuprofiling stehen im Backlog. Für einen Merge sind physische Android- und iOS-Ergebnisse sowie die Edge-PWA-Prüfung offen.

## Umgebung

- [ ] Windows 11 / Microsoft Edge als normaler Browser-Tab
- [ ] Microsoft Edge: installierte **CADVIEW Studio** PWA separat
- [ ] Zweiter Browser (Chrome oder Firefox), sofern verfügbar
- [ ] Smartphone / responsive Ansicht (ca. 420 px)
- [ ] Seite zeigt **BETA 1.4.4**; alte PWA-Fenster schließen, im Browser `Strg+F5`
- [ ] Testdaten: eingebaute Demo-Baugruppe sowie reale STEP-Datei `Download_STP_615108137421R (rev1).stp` (13 Bauteile)

## Funktionale Tests

| ID | Aktion | Soll-Ergebnis | Status |
| --- | --- | --- | --- |
| QA-01 | Seite öffnen und Demo laden | Demo sichtbar, kein fataler Fehler, Diagnose `renderFrames > 0` | ☐ |
| QA-02 | Demo links ziehen, rechts ziehen, Mausrad | Kamera dreht, verschiebt, zoomt; Darstellung unmittelbar sichtbar | ☐ |
| QA-03 | Ansicht 3D / Oben / Vorne / Links wechseln | Jeder Klick ändert sofort die Kamera ohne weitere Bewegung | ☐ |
| QA-04 | STEP-Datei importieren | Baugruppe und 13 Teile erscheinen; Demo wird ersetzt; drehen und auswählen möglich | ☐ |
| QA-05 | Teil im Baum markieren, danach per Augen-Symbol oder **H** ausblenden | Auswahlrahmen erscheint **sofort**, danach verschwindet das Teil **sofort** ohne Kamerabewegung | ☐ |
| QA-06 | Teil isolieren, danach „Alles einpassen“ / Sichtbarkeit | Isolieren und erneutes Anzeigen sofort, ohne verlorene Geometrie | ☐ |
| QA-07 | Explosionsregler 0 → 40 → 100 → 0 bewegen | Positionen ändern sich **während** des Ziehens; Rückkehr auf 0 ohne Restversatz | ☐ |
| QA-08 | Schnitt 1 aktivieren und X/Y/Z, Invertierung, Schieberegler variieren | Modell wird **bei jedem Eingabeschritt** live abgeschnitten; keine Kamerabewegung nötig | ☐ |
| QA-09 | Schnitt 2 aktivieren/deaktivieren | Beiden Ebenen folgen sichtbare Änderungen; Abschalten stellt richtige Flächen wieder her | ☐ |
| QA-10 | Materialfarbe, Transparenzmodus, Kantenanzeige, Hell/Dunkel wechseln | Jede Änderung erscheint ohne Kamerabewegung | ☐ |
| QA-11 | Messen: 2 Punkte auf dem Modell wählen | Kleine Endmarker (ca. 4–6 px Durchmesser), feine Linie, kleines lesbares Maßlabel; **nicht** riesige Kugeln | ☐ |
| QA-12 | Modell nach Messung drehen, zweite Messung hinzufügen | Erste Messung mit beiden Endpunkten und Maß bleibt sichtbar | ☐ |
| QA-13 | „Maße ausblenden“, wieder einblenden, Rückgängig, einzelne Messung löschen | Bestehende Messungen sind wiederherstellbar bzw. gezielt löschbar; Live-Update | ☐ |
| QA-14 | „Breite, Tiefe, Höhe einzeichnen“ aktivieren/deaktivieren | Drei klare, nicht übergroße Beschriftungen; Ansicht bleibt bedienbar | ☐ |
| QA-15 | Exportmenü öffnen, während Inspektor rechts sichtbar ist | Dropdown **über** dem Inspektor und dessen Tabs, vollständig lesbar, nicht abgeschnitten | ☐ |
| QA-16 | Exportmenü unterhalb rechtem Bildschirmrand / kleinem Fenster öffnen | Menü positioniert sich innerhalb des Bildschirms, ist scrollbar, schließt durch Außenklick/Esc | ☐ |
| QA-17 | GLB nach Kategorien/Materialien exportieren | Ausgabedatei enthält sichtbare Teile mit geeigneten Gruppen; in einem GLB-Viewer gegenprüfen | ☐ |
| QA-18 | STL/OBJ exportieren | Datei öffnet sich in externem Viewer, gedrehte Geometrie wird berücksichtigt | ☐ |
| QA-19 | STEP-Originalexport bei unverändertem STEP | Original-B-Rep bleibt erhalten; nach Drehung **kein** falscher STEP-Reexport | ☐ |
| QA-20 | PWA minimieren und wiederherstellen | Viewport nicht weiß oder eingefroren; Zeichnung bleibt aktuell | ☐ |
| QA-21 | DE/EN wählen und Hilfe per ? öffnen | Wichtige Funktionen verständlich, Hilfe sichtbar und nicht vom Menü überdeckt | ☐ |
| QA-22 | `edge://apps` prüfen | CADVIEW Studio und S-Parameter Analyzer bleiben zwei getrennte Installationen | ☐ |
| QA-23 | Browser-Konsole während der Aktionen prüfen | Keine neuen unhandled errors oder WebGL-Kontextverluste | ☐ |
| QA-24 | Diagnose direkt nach Start und 1 s später kopieren | `loopStarted: true`, `animationTicks` und `renderFrames` steigen auch ohne Mausbewegung | ☐ |
| QA-25 | Beschädigte gespeicherte Drehvorlagen / blockiertes localStorage simulieren | Demo und Renderloop starten trotzdem; nur Vorlagen-Funktion darf ausfallen | ☐ |
| QA-26 | Messmodus einschalten, kurz auf zwei Modellflächen klicken | Zwei Messpunkte erzeugen eine gespeicherte Maßlinie; aktive Snap-Vorschau bleibt sichtbar | ☐ |
| QA-27 | Messmodus aktiv, linke Maustaste ziehen und loslassen | Kamera dreht sofort; **kein** zusätzlicher Messpunkt wird beim Loslassen angelegt | ☐ |
| QA-28 | Maßtextgröße 70 → 170 %, Snap-Größe 8 → 18 px und hell/dunkel einstellen | Labels/Snap-Vorschau passen sich live an; Einstellungen bleiben nach Neustart gespeichert | ☐ |
| QA-29 | Installierte CADVIEW-PWA über Explorer → Öffnen mit für .stp/.step/.igs/.iges/.stl/.obj/.glb wählen | CADVIEW wird als Handler angeboten und lädt die gewählte Datei direkt, ohne erneuten Dateidialog | ☐ |
| QA-30 | In Windows CADVIEW als Standard für .stp setzen, Datei doppelklicken | CADVIEW öffnet die Datei; S-Parameter Analyzer bleibt eigenständig und unverändert | ☐ |

## Messungsdarstellung – visuelle Akzeptanz

- [ ] Gespeicherte Endmarker sind kleine Bildschirmpunkte, unabhängig vom Modellmaßstab; kein sichtbar wachsender Ball beim Zoomen
- [ ] Endpunkte und Verbindungslinie bleiben nach zwei Klicks und nach Kamerarotation bestehen
- [ ] Maßlabel liegt nahe der Linie, verdeckt keine großen Modellbereiche und ist lesbar
- [ ] Zusätzliche Messungen löschen keine vorherigen; „Rückgängig“, Ein-/Ausblenden und „Alle löschen“ arbeiten korrekt
- [ ] Der Fangtyp (Ecke, Kante, Mitte, Viertel, Fläche) ist im Preview erkennbar; die Messung bleibt als Mesh-Näherung gekennzeichnet

## Diagnose bei FEHLER

1. Prüfen, ob Versionsbadge **BETA 1.4.4** sichtbar ist
2. Vor Aktion und nach Aktion je Screenshot aufnehmen
3. „Diagnose“ kopieren, wenn Kamera oder Rendering stillsteht
4. F12 → Konsole: erste rote Fehlermeldung und Stack aufnehmen
5. Vermerken: Demo oder STEP, Browser/PWA, Viewport-Größe, gewählte Aktion, erwartetes und tatsächliches Ergebnis

**Beispielfehlerbericht:**

```text
Test-ID: QA-__
Umgebung: Edge PWA / Edge Browser / Chrome / Mobil
Version: 1.4.4
Datei: Demo / STEP
Schritte: ...
Erwartet: ...
Tatsächlich: ...
Diagnose: ...
Konsolenfehler: ...
```

## Freigaberegel

Eine Beta ist erst dann für den Alltag freigegeben, wenn **QA-01 bis QA-30** getestet, die kritischen Fälle **QA-02, QA-04, QA-05, QA-07, QA-08, QA-11, QA-12, QA-15 und QA-20** erfolgreich sind und keine neuen Fehler auftreten. Bei kritischem Fehler Release nicht als „vollständig getestet“ bezeichnen.
