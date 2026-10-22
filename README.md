# QuickSave (plugin do Revenge)

Dodaje w nagłówku podglądu obrazka (obok menu „…”) dwa przyciski: **Kopiuj link** i **Save**.
Zamiast: kliknij obrazek → menu → Save, robisz: kliknij obrazek → Save.
Używa wbudowanej akcji Save Discorda, więc zapisuje oryginał w pełnej rozdzielczości.

## Instalacja (Revenge Next)

Settings → Revenge → Plugins → ikona zębatki → dodaj repozytorium (adres katalogu, bez `index.json` — Revenge dopisuje go sam):

```
https://raw.githubusercontent.com/Anderinfera/revenge-quick-save/main/next/repo
```

Potem Plugins → `+` (Browse Plugins) → QuickSave → Install.

### Zapis do folderów (tylko Revenge Next)

Ustawienia pluginu → wyszukaj kanał → wpisz folder (np. `Pictures/Funny`). Przycisk ⬇ w podglądzie zapisuje
pliki z tego kanału (oraz jego wątków / postów na forum) do tego folderu. Ścieżka musi zaczynać się od
`Pictures`, `DCIM`, `Download`, `Movies`, `Music` albo `Documents` (ograniczenie Androida).

Zapis robi natywna część pluginu (`next/plugins/quick-save/src/main/kotlin`) przez MediaStore, bo zapis Discorda
nie przyjmuje folderu, a `fs.write` Revenge zapisuje tylko tekst.

### Wydawanie nowej wersji

Edytuj `next/plugins/quick-save/`, podbij `version` w `manifest.json` i wypchnij. GitHub Actions
(`.github/workflows/next.yml`) zbuduje JS + Kotlin i doda paczkę do `next/repo`. Gdy build się wywali,
log trafia na gałąź `ci-log`.

## Instalacja (Revenge Classic, stary format)

Revenge → Settings → Plugins → `+` → wklej URL:

```
https://raw.githubusercontent.com/Anderinfera/revenge-quick-save/main/docs/quick-save/
```

## Jak to działa

- Patchuje `MediaModalOverlayHeader` (nagłówek podglądu: „X” po lewej, menu „⋮” po prawej).
- Menu „⋮” to `ContextMenu` z listą pozycji. Pierwsza to Save Discorda (`{ label, IconComponent, action }`).
- Plugin wstawia przed menu przycisk z tą samą ikoną i tą samą akcją, więc zapis działa dokładnie jak menu → Save
  (oryginalny plik w pełnej rozdzielczości).
- Gdy Discord wyłącza pobieranie (brak Save w menu), przycisk się nie pojawia.

## Zmiany

Edytuj `src/quick-save/index.js`, potem:

```
node build.mjs
```

i wypchnij (`docs/` to katalog serwowany pod URL-em).
