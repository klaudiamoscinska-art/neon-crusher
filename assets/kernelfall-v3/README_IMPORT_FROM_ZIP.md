# KERNELFALL V3 — komplet grafik JUŻ JEST W REPOZYTORIUM

Stan po workflow importu: **100 rzeczywistych PNG w tej gałęzi** (bosses, modules, drones, uplinks, fx, ui, environment, brand), zgodnie z `manifest.json`. Nie trzeba już pobierać ani przesyłać ZIP-a. Tekst wcześniejszej instrukcji importu zastąpiono, ponieważ był nieaktualny.

- Grafiki: `assets/kernelfall-v3/`
- Manifest i SHA256 każdej grafiki: `assets/kernelfall-v3/manifest.json`
- Dokumentacja i podglądy: `docs/art/kernelfall-v3/`
- Pełne zadanie Claude: `docs/art/kernelfall-v3/CLAUDE_TASK_PL.md`
- Wymagania spójności mobile/desktop oraz EN-first: `docs/art/kernelfall-v3/VISUAL_PARITY_EN.md`

**Status integracji:** PNG NA GITHUBIE = PASS; sprite'y w aktualnym runtime = NOT RUN. `main` jest nienaruszony. Claude musi zaimplementować loader i wykorzystać assety, udowadniając wynik na prawdziwych screenshotach. Bez merge/deploy.
