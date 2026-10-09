# QuickSave (plugin do Revenge)

Dodaje przycisk **Save** w nagłówku podglądu obrazka (obok menu „…”).
Zamiast: kliknij obrazek → menu → Save, robisz: kliknij obrazek → Save.
Zapisuje oryginał w pełnej rozdzielczości (bez parametrów `width`/`height`/`format` z proxy Discorda).

## Instalacja

Revenge → Settings → Plugins → `+` → wklej URL:

```
https://raw.githubusercontent.com/Anderinfera/revenge-quick-save/main/docs/quick-save/
```

## Jak to działa

- Przycisk jest doczepiony do `GIFFavButton` (gwiazdka w nagłówku podglądu, ten sam trik co FavouriteAnything).
- Zapis idzie przez natywne `MediaManager.downloadMediaAsset(url, typ)`.
- Liczba `typ` nie jest udokumentowana. Domyślnie: 0 = obrazek, 1 = wideo. Gdy zapiszesz coś raz przez menu „…” → Save,
  plugin zapamięta typ użyty przez Discorda i od tej pory będzie go używał.

## Zmiany

Edytuj `src/quick-save/index.js`, potem:

```
node build.mjs
```

i wypchnij (`docs/` to katalog serwowany pod URL-em).
