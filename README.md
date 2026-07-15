# Herbarium

Eine digitale Pflanzensammlung mit Rezeptbuch: Pflanzen strukturiert erfassen
(Bestimmungsmerkmale, Fundort, Heilwirkung, Fotos, Verwechslungsarten) und
Rezepte (Tinktur, Tee, Salbe, Öl …) direkt mit den passenden Pflanzen
verknüpfen.

Reine HTML/CSS/JS-Anwendung ohne Build-Schritt — läuft auf GitHub Pages,
Daten liegen in Firebase (Firestore + Storage + Authentication).

## 1. Firebase-Projekt einrichten

Die App hat **keinen Login-Bildschirm**. Beim Öffnen meldet sie sich
automatisch und unsichtbar anonym bei Firebase an — niemand muss ein
Konto anlegen oder sich mit E-Mail/Passwort einloggen.

1. Auf [console.firebase.google.com](https://console.firebase.google.com) ein
   neues Projekt anlegen.
2. **Authentication** aktivieren: Menü *Build → Authentication → Get started*,
   dann unter *Sign-in method* den Anbieter **Anonym** aktivieren.
3. **Firestore Database** aktivieren: *Build → Firestore Database → Create
   database*. Beliebiger Standort, Produktionsmodus ist ok (die Regeln
   werden gleich ersetzt).
4. **Storage** aktivieren: *Build → Storage → Get started* (für die Fotos).
5. Sicherheitsregeln einspielen:
   - Unter *Firestore Database → Regeln* den Inhalt von `firestore.rules`
     einfügen und veröffentlichen.
   - Unter *Storage → Regeln* den Inhalt von `storage.rules` einfügen und
     veröffentlichen.
6. Web-App registrieren: *Projektübersicht → Web-Symbol (`</>`)* anklicken,
   App einen Namen geben, **kein** Firebase Hosting einrichten (wir nutzen
   GitHub Pages). Du erhältst danach ein `firebaseConfig`-Objekt.
7. Diese Werte in `js/firebase-config.js` eintragen (die Platzhalter
   `DEIN_API_KEY` usw. ersetzen).

> **Hinweis zur Sicherheit:** Die Werte in `firebase-config.js` sind
> öffentliche Client-Kennungen, kein Geheimnis — sie dürfen bedenkenlos mit
> ins (auch öffentliche) GitHub-Repository.
>
> **Wichtiger Unterschied zu einer echten Anmeldung:** Da es keinen Login
> gibt, kann **jede Person mit der App-URL alle Einträge sehen, bearbeiten
> und löschen** — es gibt keine Trennung zwischen Nutzer:innen. Die
> anonyme Authentifizierung verhindert nur, dass wahllose Bots oder
> Skripte außerhalb der App direkt auf die Datenbank zugreifen; sie ist
> keine Zugriffskontrolle für Menschen. Für ein rein persönliches Projekt
> mit einer Handvoll Vertrauenspersonen ist das in der Regel unkritisch.
> Falls du die Daten wirklich vor anderen schützen willst, sag Bescheid —
> dann richten wir stattdessen eine private, passwortgeschützte Variante
> ein.

## 2. Lokal testen

Da die App ES-Module lädt, muss sie über einen lokalen Server aufgerufen
werden (nicht per Doppelklick auf `index.html`, das blockieren Browser aus
Sicherheitsgründen). Zum Beispiel:

```bash
cd herbarium-app
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

Oder mit der VS-Code-Erweiterung "Live Server".

## 3. Auf GitHub Pages veröffentlichen

1. Repository auf GitHub anlegen und den Inhalt dieses Ordners pushen:
   ```bash
   git init
   git add .
   git commit -m "Herbarium App"
   git branch -M main
   git remote add origin https://github.com/DEIN-NUTZERNAME/DEIN-REPO.git
   git push -u origin main
   ```
2. Im Repository unter *Settings → Pages*: als Quelle den `main`-Branch und
   Ordner `/ (root)` auswählen, speichern.
3. Nach ein bis zwei Minuten ist die App unter
   `https://DEIN-NUTZERNAME.github.io/DEIN-REPO/` erreichbar.
4. In der Firebase-Konsole unter *Authentication → Settings → Authorized
   domains* die GitHub-Pages-Domain (`DEIN-NUTZERNAME.github.io`)
   hinzufügen, sonst schlägt die automatische Anmeldung dort fehl.

## Projektstruktur

```
herbarium-app/
├── index.html              App-Gerüst
├── css/style.css           Gesamtes Styling
├── js/
│   ├── firebase-config.js  Eigene Firebase-Zugangsdaten hier eintragen
│   ├── auth.js              Automatische, unsichtbare anonyme Anmeldung
│   ├── plants.js            Firestore- & Storage-Zugriff für Pflanzen
│   ├── recipes.js           Firestore- & Storage-Zugriff für Rezepte
│   └── app.js                Routing, Rendering, Formulare
├── firestore.rules
└── storage.rules
```

## Funktionsumfang

- **Pflanzen erfassen**: botanischer & deutscher Name, Familie,
  Bestimmungsmerkmale (Blatt, Blüte, Stängel, Wurzel, Wuchshöhe), Standort,
  Fundort & -datum, Sammelkalender, mehrere beschriftete Fotos.
- **Sicherheit**: Giftigkeitsstufe und beliebig viele Verwechslungsarten mit
  Unterscheidungsmerkmalen — wird als deutlich sichtbare Warnung auf Karte
  und Detailseite angezeigt.
- **Heilwirkung**: verwendete Pflanzenteile, Inhaltsstoffe, Indikationen,
  Kontraindikationen, Dosierung.
- **Rezepte**: Typ (Tinktur, Tee, Salbe, Öl, Sirup, Essig, …), Zutatenliste
  mit Mengen, Zubereitung, Ziehzeit, Haltbarkeit, Lagerung, Anwendung, Foto.
- **Verknüpfung**: Rezepte werden mit einer oder mehreren Pflanzen
  verknüpft; auf der Pflanzenseite erscheinen automatisch alle zugehörigen
  Rezepte und umgekehrt.
- **Mengen skalieren**: In der Rezeptansicht lässt sich ein Faktor eingeben,
  der alle Zutatenmengen live umrechnet.
- **Suche & Filter**: Volltextsuche über Namen/Familie/Tags, Filterchips
  nach Schlagworten bei Pflanzen.
- **Export**: Alle Daten als JSON-Datei herunterladen (Backup).
- **Druckansicht**: Pflanzen- und Rezeptseiten sind für den Ausdruck als
  Karteikarte optimiert (Navigation wird beim Drucken ausgeblendet).

## Bekannte Grenzen (für eine spätere Ausbaustufe)

- Wird das Anlegen einer neuen Pflanze/eines Rezepts abgebrochen, nachdem
  bereits ein Foto hochgeladen wurde, bleibt die Bilddatei im Storage
  liegen (kein automatisches Aufräumen bei Abbruch).
- Die Regeln in `firestore.rules` geben jeder Person mit der App-URL
  Zugriff auf alle Einträge, da es keine echte Anmeldung gibt (siehe
  Hinweis oben). Für einen wirklich geschützten Zugang wäre ein
  Passwortschutz oder eine echte Anmeldung nötig.
- Es gibt keine Offline-Synchronisation; ohne Internetverbindung lädt die
  App keine Daten.
