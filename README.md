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
