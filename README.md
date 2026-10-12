# QuickSave (plugin do Revenge)

Dodaje w nagłówku podglądu obrazka (obok menu „…”) dwa przyciski: **Kopiuj link** i **Save**.
Zamiast: kliknij obrazek → menu → Save, robisz: kliknij obrazek → Save.
Używa wbudowanej akcji Save Discorda, więc zapisuje oryginał w pełnej rozdzielczości.

## Instalacja

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
