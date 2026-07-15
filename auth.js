// ===========================================================
// Authentifizierung
// ===========================================================
// Die App zeigt keinen Login-Bildschirm. Stattdessen wird beim Laden
// automatisch und unsichtbar eine anonyme Firebase-Sitzung gestartet.
// Das schützt die Datenbank vor wahllosen Zugriffen von außerhalb der
// App, ohne dass Nutzer:innen sich mit E-Mail/Passwort anmelden müssen.
//
// Wichtig: Da es keine echte Anmeldung gibt, sieht und bearbeitet
// jede Person mit Zugriff auf die App-URL alle Einträge. Es gibt keine
// Trennung zwischen verschiedenen Nutzer:innen.
// ===========================================================
import { auth } from "./firebase-config.js";
import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export function ensureSignedIn() {
  return signInAnonymously(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
