# CADVIEW Studio · Browserbasierter 3D-CAD-Viewer

Eine statische, auf **GitHub Pages** ausführbare 3D-Web-App zum Betrachten von STEP/IGES-Dateien, zur Baugruppeninspektion, zum Ein-/Ausblenden einzelner Komponenten sowie zur Materialgestaltung und zum Export in Mesh-Formate.

Die Anwendung benötigt **kein Backend, keinen Account und keinen API-Schlüssel**. CAD-Dateien werden vom Browser verarbeitet und **nicht an einen eigenen Server hochgeladen**. Wichtig: Die JavaScript-Bibliotheken und die WebAssembly-CAD-Engine werden über die öffentlichen CDNs `cdn.jsdelivr.net` (mit `unpkg.com` als Fallback für die CAD-Engine) nachgeladen, insbesondere beim ersten STEP-/IGES-Import. Zum Öffnen muss daher eine Internetverbindung bestehen. Die ausgewählte CAD-Datei selbst wird an das CDN **nicht** hochgeladen.

## Direkt auf GitHub Pages veröffentlichen

1. Ein öffentliches GitHub-Repository erstellen, z. B. `cadview-studio`.
2. **Alle Dateien dieses Ordners** in das Hauptverzeichnis des Repositories hochladen. Wichtig: Die `index.html` muss direkt im Hauptverzeichnis liegen, nicht in einem zusätzlichen Unterordner.
3. GitHub → **Settings** → **Pages** → **Build and deployment** → **Deploy from a branch**.
4. Branch `main` und Ordner `/(root)` wählen, dann **Save**.
5. Aufruf nach der Veröffentlichung: `https://DEIN-BENUTZERNAME.github.io/cadview-studio/`.

Ein eigener Build-Schritt, npm-Installation oder Webserver ist für GitHub Pages **nicht nötig**. Dateien nicht direkt per Doppelklick über `file://` öffnen: Module und Worker benötigen eine HTTP(S)-Adresse.

### Lokal testen

Im entpackten Projektordner in einer Konsole:

```bash
python -m http.server 8000
```

Dann `http://localhost:8000/` im Browser öffnen. Auch hier ist zum ersten Start eine Internetverbindung für die CDN-Bibliotheken erforderlich.

## Unterstützte Formate

| Format | Import | Export | Hinweise |
|---|---|---|---|
| STEP (`.step`, `.stp`) | Ja | Nein | OpenCascade-WebAssembly; Bauteilbaum, CAD-Farben soweit im Export enthalten; Geometrie wird für die Anzeige trianguliert |
| IGES (`.iges`, `.igs`) | Ja | Nein | OpenCascade-WebAssembly; Struktur und Farben je nach Quelldatei |
| BREP (`.brep`) | Ja | Nein | OpenCascade-WebAssembly |
| STL (`.stl`) | Ja | Ja | Triangulierte Geometrie; keine Materialien und keine Maßeinheiten im Format |
| OBJ (`.obj`) | Ja | Ja | Geometrie; der OBJ-Export schreibt **keine** Material-`.mtl`-Datei |
| GLB (`.glb`) | Ja | Ja | Triangulierte Geometrie, üblicherweise mit Materialien; **empfohlener Export für Präsentationen** |
| glTF (`.gltf`) | Ja, eingeschränkt | Nein | Nur wenn keine separaten `.bin`/Bilddateien benötigt werden; andernfalls GLB verwenden |

**Wichtig:** STEP/IGES sind präzise CAD-/B-Rep-Daten; GLB, STL und OBJ sind Mesh-/Dreiecksformate. Der Export aus dem Viewer erstellt **keine** vollständige parametrische CAD-Datei. Bohrungsdefinitionen, editierbare Flächen, Konstruktionshistorie und exakte Kreisbögen bleiben in einem Mesh-Export nicht erhalten. Auch die Materialvorlagen sind **optische Darstellungen**, keine technischen Werkstoffkennwerte (Dichte, E-Modul etc.).

## Funktionen

- STEP/IGES/BREP per Datei öffnen oder Drag & Drop in einem **Web Worker** mit OpenCascade importieren; während der CAD-Konvertierung bleibt die Oberfläche weitgehend reaktionsfähig.
- Baugruppenbaum anzeigen, nach Namen filtern, Einzelteile sichtbar/unsichtbar schalten, Bauteil per Klick auswählen, per Doppelklick einpassen, per Rechtsklick isolieren.
- Kamera drehen, verschieben und zoomen; gespeicherte Ansichten: 3D, oben, vorne, rechts.
- Material-Presets: Aluminium, Edelstahl, Chrom, Kupfer, Messing, Kunststoff, Gummi, Glas; Farbe, Metallizität, Rauheit und Deckkraft einstellbar; Originalfarben zurücksetzen.
- Explosionsansicht für mehrteilige Baugruppen (vereinfachte geometrische Separation, **kein** CAD-Montageplan).
- Schnitt durch Z-Ebene für die Anzeige (Visualisierung, kein echtes konstruktives Trennen oder neuer Volumenkörper).
- Kanten, Raster, helles/dunkles Farbschema und Transparenzmodus.
- Punkt-zu-Punkt-Messung **auf der triangulierten Oberfläche**, angezeigt in importierten Modell-Einheiten; keine native CAD-Präzisionsmessung.
- Bounding-Box-Abmessungen der Auswahl und Screenshot als PNG.
- Export als GLB (empfohlen für Materialien), STL (3D-Druck), OBJ (ohne MTL). **Nur sichtbare Bauteile** werden exportiert. Die Explosionspositionen werden beim Export übernommen. Beim GLB-Export werden aus STEP/IGES importierte Millimeter-Koordinaten korrekt in Meter umgerechnet.
- Responsives Layout für Desktop und kleinere Bildschirme; integriertes Demomodell.

## Bedienung

- Linke Maustaste + ziehen: drehen; rechte Maustaste + ziehen: verschieben; Mausrad: zoomen.
- Klick auf ein Bauteil: Auswahl mit markierter Umrandung. Doppelklick im Bauteilbaum: Einpassen.
- **Messen** aktivieren und nacheinander zwei Punkte auf sichtbaren Modellflächen anklicken.
- `Strg + O`: Datei öffnen. `F`: Auswahl bzw. gesamte Baugruppe einpassen. `Esc`: Messen beenden / Auswahl aufheben.
- Für die Umwandlung von STEP/IGES in ein anderes Format: zuerst Datei importieren, dann **Exportieren → GLB / STL / OBJ**.

## Technischer Aufbau

- `index.html` – Oberfläche und feste Import-Map
- `styles.css` – Layout
- `app.js` – Three.js-Viewer, Bauteilbaum, Material-, Mess- und Exportlogik
- `occt-worker.js` – OpenCascade/WASM-Import in Web Worker
- `.nojekyll` – GitHub-Pages-Kompatibilität

Verwendete externe Projekte: [Three.js](https://threejs.org/) (`0.180.0`, MIT) und [occt-import-js](https://github.com/kovacsv/occt-import-js) (`0.0.23`, LGPL-2.1), auf Basis von [Open CASCADE Technology](https://dev.opencascade.org/). Bei einer Veröffentlichung sind die Lizenzen der jeweiligen Drittanbieter einzuhalten. Dieses Projekt lädt die Drittbibliotheken vom CDN; sie sind nicht Bestandteil dieses ZIPs.

## Grenzen dieser ersten Version

- Es handelt sich um einen **Viewer/Konverter-Prototyp**, nicht um einen vollständigen CAD-Editor. STEP-/IGES-Export ist **nicht** implementiert. Eine verlässliche bidirektionale B-Rep-Konvertierung erfordert eine weitere CAD-Kernel-Schicht.
- Baugruppen werden soweit unterstützt, wie der Importer Knoten und Mesh-Referenzen liefert. Die Struktur hängt von der Quelldatei ab.
- CAD-PMI, echte 3D-PDF-Montageanweisungen, Maßtoleranzen, technische Werkstoffdefinitionen und Layer/Annotationen werden nicht vollständig übernommen.
- Große Dateien bzw. sehr komplexe Baugruppen können den Browserspeicher überschreiten. Die Version begrenzt die Eingangsdatei vorsorglich auf 180 MB; praktisch kann ein viel kleineres komplexes Modell bereits zu groß sein.
- Gemessene Abstände beziehen sich auf die **triangulierte Ansicht**. STEP/IGES werden in Millimetern eingelesen, GLB in Metern und STL/OBJ in formatbedingt nicht definierten Koordinateneinheiten.
- Bei eigener Nutzung mit vertraulichen CAD-Konstruktionen: Obwohl Dateien lokal verarbeitet werden, solltest du vor einer betrieblichen Nutzung Drittanbieterbibliotheken, Quellcode, Sicherheitsrichtlinien und die Lizenzsituation selbst prüfen.
- Internetverbindung nötig, da Bibliotheken extern geladen werden; für einen vollständig offlinefähigen Build müssten diese separat mit Lizenzdateien lokal eingebunden werden.

## Fehler beheben

- **Leere Ansicht / Demo fehlt:** WebGL-Unterstützung und JavaScript prüfen; Browser-Konsole auf blockierte CDN-Skripte kontrollieren.
- **STEP/IGES meldet CDN-/WASM-Fehler:** Internet, Werbeblocker, Unternehmensfirewall und CDN-Verfügbarkeit prüfen.
- **STEP hat keine Flächen:** Quelle neu exportieren, defekte Datei prüfen, ggf. große Baugruppe verkleinern.
- **Materialien fehlen:** STEP- oder IGES-Datei kann ohne Farben exportiert worden sein. Im Material-Inspektor neue Farben zuweisen.
- **GLB Export kann Geometrie nicht erhalten:** Der Export ist immer trianguliert. Für die genaue CAD-Bearbeitung die Original-STEP-Datei aufbewahren.

Stand: November 2026 · CADVIEW Studio Beta 1.0

## Fehlerbehebung STEP-/IGES-Import (Beta 1.0.1)

Die anfängliche Version referenzierte `occt-import-js@0.0.24` im npm-CDN, obwohl npm bisher `0.0.23` veröffentlicht hat. Ab Beta 1.0.1 ist der CAD-Importer auf `0.0.23` korrigiert, nutzt bei Bedarf `unpkg.com` als Ausweichadresse und lädt den Web Worker mit einer versionierten URL. Falls der Browser noch die alte Version zwischengespeichert hat, `Strg+F5` drücken.

---

## CADVIEW Studio 1.2 – Installation und Erweiterungen

**Direkt im Browser:** `https://simmark.github.io/cadview-studio/`

**Als App installieren:** Auf Windows in Chrome oder Edge den Button „⊞ Installieren“ anklicken, wenn der Browser die PWA-Installation anbietet. Falls kein Installationsdialog erscheint: Edge/Chrome-Menü → „Apps“ / „Diese Seite als App installieren“. Auf Android: Chrome-Menü → „App installieren“ / „Zum Startbildschirm hinzufügen“. Auf iOS: Teilen → „Zum Home-Bildschirm“. Die installierte App hat ein eigenes Fenster, Icon und Startmenüeintrag.

Die Installation ist kein natives Windows-Setup (`.exe`), sondern eine Progressive Web App. Sie benötigt beim ersten Öffnen Internet. Der `sw.js` speichert die Oberfläche offline; externe Three.js- und OpenCascade/WASM-Dateien werden bei Netzwerknutzung zwischengespeichert, soweit Browser und Speicherkontingent dies zulassen. **Vollständig offline verfügbares STEP/IGES ist nicht garantiert**: Vor der ersten Offline-Nutzung muss die Engine einmal online geladen worden sein, und Browser können Cache-Daten löschen. Lokale STEP-Dateien werden nicht an einen Server hochgeladen. Die App speichert Projektkonfigurationen nur lokal (Browserspeicher) oder als explizit exportierte `.cadview.json`.

### Baugruppen, Material und GLB-Export

- **Strg-Klick** im Bauteilbaum bzw. im 3D-Fenster: mehrere Teile auswählen; **Umschalt-Klick** im Baum: Bereich auswählen. Materialvorgaben gelten für die Auswahl. Ohne Auswahl wird das gesamte Modell geändert.
- **Kategorie**: frei benannte Gruppen, z. B. „Pins“, „Wicklung“, „Kern“, „Gehäuse“, „Isolation“. Bei Auswahl einer Baugruppe wird die Kategorie auch für deren Kinder gesetzt.
- **Exportieren → GLB-Struktur**: „Originale Baugruppe“, „Nach Kategorien“, „Nach Materialien“ oder „Kategorie → Material“. Im GLB entstehen tatsächlich separate Objekte bzw. Gruppen. Mehrfarbige CAD-Meshes werden dafür je Material aufgeteilt. **GLB ist immer ein Dreiecksnetz**, kein parametrischer CAD-Körper.
- **Studio**: Reflexionslicht (RoomEnvironment) für realistischere visuelle Metalle und Kunststoffe; „Renderbild als PNG (2×)“ für hochauflösenden Screenshot. Kein physikalisch genauer Pathtracer.

### Drehen und Schnitte

- **Ausrichtung**: beliebige Winkel um X, Y oder Z; 90°/180° direkt oder eigener Winkel. Ohne Auswahl wird das gesamte Modell um seine Bounding-Box-Mitte gedreht. Mit Auswahl werden gewählte Baugruppenteile gemeinsam gedreht. Diese Geometrieausrichtung wird beim GLB/STL/OBJ-Export übernommen.
- **Drehvorlagen** können unter eigenem Namen im Browserspeicher gespeichert und erneut angewendet werden. Mit **Projekt speichern** wird zusätzlich eine `.cadview.json`-Datei erzeugt; diese speichert Ausrichtungen, Materialien, Kategorien, Sichtbarkeit, Punktmessungen und Schnitte. Die Original-CAD-Datei muss zum Wiederverwenden der Projektdatei erneut geöffnet werden.
- **Schnittebenen**: zwei gleichzeitig aktive orthogonale Ebenen oder die erste mit frei eingegebener Normalenrichtung (nx/ny/nz). Ein/Aus und Positionsslider. Es handelt sich um **Clipping im Viewer**, nicht um geometrisch geschlossene Schnittkörper. Ein GLB/STL/STEP-Export wendet den Schnitt nicht auf die CAD-Geometrie an.
- **Ansichten**: 3D, oben, unten, vorne, hinten, rechts, links.

### Messen und Bemaßen

- **Messen**: zwei Punkte auf sichtbaren Dreiecksflächen anklicken. Fangoptionen: Klick auf Fläche, nahe einer triangulierten **Mesh-Ecke** oder **Mesh-Kante** (ca. 15 px). Danach wird 3D-Abstand sowie ΔX, ΔY, ΔZ angezeigt; Messungen bleiben als sichtbare Linien und Zahlen im 3D-Modell.
- **Breite / Tiefe / Höhe einzeichnen**: automatische Hüllmaß-Bemaßungen der Auswahl oder des gesamten Modells. Gut für einzelne Wicklungen, Kerne und Gehäuse, die zuerst isoliert wurden. Die automatische Hüllmaßbemaßung ist keine echte Form- oder Fertigungsbemaßung. Genauigkeit des Eck-/Kantenfangs hängt von der importierten Dreiecksauflösung ab; für hochgenaue CAD-Kantenmessung wird eine OpenCascade-TopoDS-Edge-Analyse benötigt.
- Exportierte Screenshots enthalten die Messlinien. Die `.cadview.json` enthält Punktmessungen, aber keine Original-Geometriedaten.

### STEP-Schreibunterstützung – noch nicht vollständig

**Wichtig:** `occt-import-js` ist ein STEP/IGES-**Importer**, kein STEP-Writer. Globale und individuelle Drehungen werden exakt an den 3D-Objekttransformationen geführt und nach **GLB/STL/OBJ** exportiert, aber aktuell **nicht als bearbeitbare gedrehte STEP-Datei** geschrieben. Der Menüpunkt „STEP (Original)“ exportiert ausschließlich die unmodifizierte, ursprünglich geladene STEP-Datei, solange noch keine Drehung erfolgt ist.

Ein Versuch, STEP-Positionskoordinaten und Richtungen ohne vollständigen CAD-Kernel direkt zu rotieren, wurde mit der echten STEP-Datei `615108137421R.stp` durch OpenCascade getestet: Die exportierte Datei blieb zwar einlesbar und enthielt 13 Solids, ihr geometrisches Bounding-Box-Maß war jedoch falsch. Dieser fehlerhafte Weg wurde **nicht** veröffentlicht. Für einen korrekten STEP-Export der gedrehten BRep-Körper wird ein Browser-WASM mit `STEPControl_Writer` und `BRepBuilderAPI_Transform` oder `STEPCAFControl_Writer` benötigt. Bei mehrfach gedrehten Einzelteilen müssen zudem Baugruppenhierarchien und Platzierungen übernommen werden.

**Version 1.2.0**. Die UI, Dateien, JSON- und JavaScript-Syntax wurden geprüft; dynamische Material-Render- und CDN-Importfunktionen sind im Zielbrowser zu testen.


## CADVIEW Beta 1.3 · Navigation, Snapping und Sprachen

- **Tastenkürzel**: `Leertaste` alle Teile einblenden + Vollansicht, `H` Ausblenden, `Shift+H` alles zeigen, `I` Auswahl isolieren, `F` einpassen, `M` messen, `D` automatische Bemaßung ein/aus, `U` beziehungsweise `Strg+Z` letzte Messung rückgängig, `G` Raster, `A` Welt-/Teilachsen, `1` bis `7` Ansichten, `F1`/`?` Hilfe, `Esc` abbrechen, `Strg+O` öffnen. Kurzbefehle werden nicht abgefangen, während Eingabefelder aktiv sind.
- **Bedienhilfe**: erscheint beim ersten Start und lässt sich per `F1` beziehungsweise `?` wieder öffnen.
- **DE/EN**: Sprachschalter für grundlegende Menüs, Werkzeuge und Hilfe; die noch nicht übersetzten Statusmeldungen und einige spezielle Dialoge werden schrittweise ergänzt.
- **XYZ-Koordinaten**: links unten zeigen die Pfeile mit X (rot), Y (grün), Z (blau) die Achsen relativ zur Kamera. Schalter `Welt/Teil` aktiviert bei einer ausgewählten Komponente deren lokale Achsorientierung; ohne Auswahl ist die Ausrichtung global. Das Koordinatensystem der importierten Datei bleibt erhalten; CADVIEW interpretiert nicht automatisch die mechanisch gewünschte Einbaulage.
- **Messung**: Klick mit Vorschau, bevorzugt magnetische Punkte an CAD-Dreiecksnetzen; `□` Eckpunkt, `━` Kante, `◐` Kantenmitte, `◔` 1/4- und 3/4-Punkte, `◉` Mittelpunkt eines getroffenen Dreiecks. `Alt` deaktiviert Snapping für den Klick. Die Treffpunkte sind Näherungen auf einer triangulierten Darstellung, *keine* analytischen CAD-Topologie-Entities.
- **Kleinere Maße**: Die Beschriftungen und Endpunkte behalten eine annähernd feste Pixelgröße, sodass Zoom und große Baugruppen keine riesigen Beschriftungen mehr auslösen. Messungen lassen sich rückgängig machen, temporär ausblenden oder dauerhaft löschen. Automatische XYZ-Bemaßungen lassen sich erneut mit `D` entfernen.
- **PNG-Wasserzeichen**: optionaler eingebetteter Wort-/Symbol-Schriftzug `CADVIEW by SIMONLATION`, im Rendering und beim einfachen Screenshot. Verwendet eine vektorartig gezeichnete SIM-Marke als typografische Annäherung; kein offizielles, eingebundenes Logo-Asset.

Die PWA verwendet weiterhin die eindeutige App-ID `/cadview-studio/` und bleibt unabhängig von `s-parameter-plotter`. STEP-Bearbeitung und exakter STEP-Reexport nach Drehung sind **nicht** Bestandteil dieses Updates.

## Beta 1.4.0 – GUI Rework und Rendering-Diagnose

- Der Inspektor ist in fünf fokussierte Bereiche aufgeteilt: **Material**, **Ausrichten**, **Schnitt**, **Ansicht**, **Messen**. Alle vorhandenen Einstellungen und IDs sind erhalten geblieben.
- Das Rendering läuft unabhängig von Achsenwidget, Auswahlmarkierung und Messgrafik weiter. Fehler in diesen nichtkritischen Overlays stoppen die 3D-Ausgabe nicht mehr.
- Eine sichtbare Render-Diagnose erscheint bei WebGL-Fehlern oder wenn trotz importierter Geometrie keine Dreiecke gezeichnet werden. **Einpassen** (`0`) setzt Sichtbarkeit, Kamera und Schnittebene zurück, ohne die Quelldatei zu verändern.
- Einführung als kleine, schließbare Karte statt blockierender Vollbild-Hilfe. F1 bzw. `?` öffnen weiterhin die vollständige Hilfe.
- Separates `gui.js`/`rework.css` für den GUI-Layer. PWA-ID `/cadview-studio/` bleibt unverändert, daher keine Überschneidung mit S-Parameter Analyzer.

### Einschränkung und Testhinweise

Die Änderungen wurden auf Syntax, Dateikonsistenz, HTML-IDs und CSS geprüft. Ein vollständiger echter WebGL-Browsertest war in der vorhandenen Testumgebung nicht möglich. Daher erst Demo prüfen, dann die reale STEP-Datei erneut laden und ggf. das sichtbare Fehlerprotokoll beziehungsweise die Browserkonsole beobachten. Der STEP-Export bleibt unverändert ein Download des Original-CAD, keine neu berechnete B-Rep-Geometrie.
## Beta 1.4.1 – Kameraeingabe und Bauteildrehung

Die WebGL-Zeichenfläche verarbeitet keine Maus- oder Touch-Events mehr. Eine separate Eingabefläche `#cadInteractionLayer` erhält alle Pointer-Ereignisse und steuert `OrbitControls`, die Bauteilauswahl und die magnetische Messpunkt-Auswahl. Damit sind WebGL-Rendering und Interaktion voneinander unabhängig.

**Kamera:** Linke Maustaste im 3D-Bereich gedrückt halten und ziehen (Orbit), rechte Maustaste ziehen (Verschieben), Mausrad (Zoom). Zusätzlich gibt es vier Schaltflächen für Kameradrehung und -neigung. Das ändert weder die Geometrie noch den Mesh-Export.

**Bauteil:** In der Struktur oder im 3D-Modell markieren und `↻ Teil 90°` drücken; alternativ im Tab **Ausrichten** einen beliebigen Winkel und eine Achse wählen. Ohne Bauteilauswahl dreht die Funktion die gesamte Baugruppe. Diese Änderung wird in GLB/STL/OBJ berücksichtigt, aber ist kein vollwertiger B-Rep-STEP-Schreibvorgang.

Eine kleine Anzeige im Viewport zeigt an, ob Zeigereingaben eintreffen. Für die installierte Edge-PWA sind die CSS- und JS-Dateien auf Version `1.4.1` umgestellt und der CADVIEW-eigene Service-Worker-Cache wird erneuert. Die PWA-ID bleibt `/cadview-studio/`; der S-Parameter Analyzer wird nicht verändert.

**Test:** Demo öffnen, mit linker Maustaste über der Baugruppe ziehen, Mausrad zoomen, rechte Maustaste ziehen; ein Bauteil im Baum auswählen und `↻ Teil 90°` klicken; danach dieselben Funktionen mit einer importierten STEP-Datei prüfen.
