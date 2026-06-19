# BS Variablen Export Figma Plugin
Mit dem Plugin können die im Figma definierten Variablen backslash-Theme-gerecht exportiert werden.

## Installation
Für eine einfache Verwendung im Figma kann der Ordner `build` lokal geladen werden. Im Figma kann dann unter `Plugins > Development > Import Plugin from manifest` das Plugin installiert werden.

## Entwicklung
Im Ordner `src` sind die beiden entscheidenden Files `code.ts` und `ui.html`. 

* `npm run watch` watched die `src/ui.html`-, `manifest.json`- und `code.ts`-Datei auf Änderungen und aktualisiert den build bei einer Änderung.
* `npm run build` kompliliert die `code.ts`-Datei und kopiert sie in den Build-Ordner. Ebenfalls werden `manifest.json` und `ui.html` in den Build-Ordner kopiert.s