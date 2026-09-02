# Repo restructure — 2026-09-02

Branch cleanup and root-directory restructure run by Joyce (JzZ404) with Claude
Code, landed directly on `main` as commits `2837055..bf7b732`.

**If something of yours just broke, start with [Where things moved](#where-things-moved).**
Nothing was lost: every deletion is reachable from a tag or from a commit SHA
listed here, and every recovery command is spelled out.

---

## Why

The repo had accumulated three projects in one root — a dead May Streamlit
prototype, the Kaggle fine-tune pipeline, and the pnpm monorepo — plus ten
branches, half of which were fully merged or orphaned. Two concrete bugs came
out of it: `WRITEUP.md` (the Kaggle submission) linked four files under `train/`
that did not exist, and two files named `report.py` meant `from report import ...`
resolved differently depending on your working directory.

---

## Where things moved

| Was | Is now |
|---|---|
| `tests/` | `backend/tests/` |
| `build_training_data.py` | `train/build_training_data.py` |
| `train_gemma4_e2b.py` | `train/train_gemma4_e2b.py` |
| `kaggle_train_gemma4_e2b.ipynb` | `train/kaggle_train_gemma4_e2b.ipynb` |
| `list_models.py` | `train/list_models.py` |
| `Dataset.txt` | `train/Dataset.txt` |
| `data/train.jsonl`, `data/val.jsonl` | `train/data/` |
| `scripts/publish_to_hf.py` | `train/publish_to_hf.py` |
| `icons/` (290 SVGs) | `packages/ui/icons/` |
| `feat/1-caregiver-shift-view/README.md` | `docs/features/caregiver-shift-view.md` |
| `feat/2-family-tracking/README.md` | `docs/features/family-tracking.md` |

**Run the training scripts from `train/`.** Their paths are cwd-relative
(`DATA_DIR = Path("data")`, `TRAIN_JSONL` defaults to `data/train.jsonl`), so
`cd train && python build_training_data.py` works unchanged. Running them from
the repo root will not find the data.

`scripts/` now contains only `generate-icons.mjs`.

### Deleted

| File | Why |
|---|---|
| `app.py`, `pages/1_Caregiver.py`, `pages/2_Family.py` | Streamlit prototype, May 5-6, superseded by `backend/` + `apps/` |
| `report.py` (root) | Duplicate of `backend/report.py`; nothing imported it |
| `assistant.py` | Prototype-only, zero references |
| `my_info.json` (root) | Byte-identical to `backend/my_info.json` |
| `requirements.txt` (root) | Pinned streamlit/SpeechRecognition for the prototype; `backend/requirements.txt` is the live one |
| `.DS_Store` ×3 | Untracked from the index (files stay on disk) |

Recover any of them:

```bash
git show 31d2437^:app.py          # or any other path above
git checkout 31d2437^ -- pages/   # restore into the working tree
```

---

## Branches deleted from origin

Five branches were removed. **The first three had zero commits not already in
`main`** (`git rev-list --count origin/<branch> ^main` = 0), so nothing was lost:

| Branch | Tip | Owner | Status |
|---|---|---|---|
| `children` | `9f2a8e4` | Yunxiao Du | Fully merged; code lives at `backend/children/` and has evolved past the branch |
| `children-pr` | `8db6b05` | Yunxiao Du | Fully merged, same work |
| `integration` | `6358600` | Yunxiao Du | Fully merged, zero files missing from main |
| `claude/keen-goldwasser-727084` | `0837729` | jwei2000-code | Orphan history (no merge base). Original `feat/feat1` Streamlit + `feat/feat2` Next.js prototype |
| `feat/ai-visit-log` | `c184e33` | Joyce Zhou | Orphan, one commit, one file: a `README.md` containing `# Alio` |

The two orphan branches are preserved as **annotated tags on origin**:

```bash
git checkout archive/keen-goldwasser   # 0837729, 47 files
git checkout archive/ai-visit-log      # c184e33
```

The three merged branches need no tag — their tips are ordinary commits in
`main`'s history. Recreate any of them with `git branch <name> <sha>`.

**Before deleting `keen-goldwasser` we rescued `SPEC.md`** (379 lines: project
brief, team list, positioning). It existed only on that orphan branch and is now
at the repo root. All of that branch's *code* had already reached main —
`feat/feat1/app.py` and `pages/1_Caregiver.py` were byte-identical to the root
copies, `feat/feat2/prescriptions.py` identical to `backend/prescriptions.py`,
and `api.py` / `report.py` had evolved further on main.

### Branches left alone

| Branch | Why |
|---|---|
| `renew-ui-sep02` | jwei2000-code's active UI rework. Verified: still merges into the restructured main with **zero conflicts** |
| `chore/design-sync` | Deliberately untouched — reference material for the Claude Design sticker sheet, to be re-synced fresh after the UI rework lands |
| `feat/caregiver` | Still holds the Gemma trademark attribution, which main lacks. See below |
| `integrate-local-model` | Unfinished Vercel deploy config. See below |

---

## The 8 commits

| SHA | What |
|---|---|
| `2837055` | Restore `SPEC.md` from the orphan branch before deleting it |
| `28a8d9b` | Move `tests/` → `backend/tests/` so they test the live module |
| `31d2437` | Delete the Streamlit prototype |
| `fc71938` | Move the training pipeline into `train/`; fix doc links |
| `e77007d` | Move `icons/` into `packages/ui`; make the generator portable |
| `1fd2311` | Fix the `packages/theme` typecheck error |
| `927459d` | Untrack `.DS_Store`; repoint ignore rules at `train/data/` |
| `bf7b732` | File the feature briefs under `docs/features/` |

Each commit message carries the full reasoning. `git log 2837055^..bf7b732`.

---

## Behavior changes worth knowing

**The report tests now cover the live backend.** `tests/test_report.py` imported
`from report import ...` and, run from the repo root, bound to the *dead* root
`report.py`. Moving the directory was the entire fix — pytest puts `backend/` on
`sys.path` because `tests/__init__.py` makes it a package. All 8 pass unchanged.
The backend suite went from 13 tests to **21**: `cd backend && pytest`.

**`generate-icons.mjs` is portable and idempotent.** It hardcoded
`/Users/jz/Documents/aliooo/icons` — an absolute path into a second clone — so
`pnpm icons:generate` could not work for anyone else. Paths now resolve from the
script's own location.

It also had a latent break: `IconKeyboard` and `IconChatswitch` are hand-authored
in `packages/ui/src/icons/custom.tsx`, but `keyboard.svg` and `chatswitch.svg`
are still in the source folder, so regenerating emitted those names into
`medical.gen.tsx` too. The barrel `export *`s from both files, which is TS2308 —
and the generated copies were worse (a hardcoded `#5E69F6` stroke against the
tokens-only rule, and an unscaled 12×12 viewBox). **The generator now seeds its
dedup set from `custom.tsx`, so hand-authored icons win** and are reported as
skipped. If you add an SVG whose name already exists in `custom.tsx`, it will be
skipped by design.

**`.gitignore` rules follow the move.** Patterns containing a slash are anchored
to the `.gitignore`'s directory, so `data/build_checkpoint.jsonl` and the Kaggle
CSV entries stopped matching once `data/` became `train/data/`. They now read
`train/data/...`; without this the resumable checkpoint and ~100MB of downloaded
datasets would show up as untracked.

**`pnpm -r typecheck` was failing on main** before this — `packages/theme`
assigned an `as const` readonly tuple to Tailwind's mutable `string[]`. Fixed by
spreading. (aarony630 fixed the same line on `feat/caregiver` back in May; it
never landed.)

**Documentation links.** `WRITEUP.md`'s four `train/...` links now resolve.
`methods.md` picked up the new paths plus three pre-existing broken ones —
`medical_ai.py` → `backend/`, `nextjs/api.py` → `backend/api.py`, and
`nextjs/next-app/` → the two `apps/` packages, a layout that has not existed
since the monorepo landed. Its run instructions said `python app.py`; they now
say `cd backend && uvicorn api:app`.

---

## Deliberately not done

- **The `apps/caregiver` typecheck error.** Next's generated `PageProps` rejects
  `LogsPage`'s `{ onOpenReport?: ... } = {}` props. It predates this cleanup,
  `next.config.js` sets `ignoreBuildErrors: true` so deploys are unaffected, and
  those files are being rewritten on `renew-ui-sep02` right now. Left for that
  branch's owner.
- **Deduplicating the app assets.** All 11 files in `apps/caregiver/public/` are
  byte-identical to `apps/family/public/` (including `person1.avif` at 783KB
  twice). This looks like waste but is **structurally required**: Next serves
  `/avatars/x.png` from each app's own `public/`, and `packages/mock-data` —
  shared by both apps — hardcodes those paths. Deduplicating would 404 images in
  one app without a build-time copy step.
- **`chore/design-sync`.** See above.

---

## Verification run before pushing

| Check | Result |
|---|---|
| `pnpm -r build` | Both apps build clean, all routes generated |
| `cd backend && pytest` | 21 passed |
| `node scripts/generate-icons.mjs` | Re-run produces zero diff (idempotent) |
| Markdown links in `methods.md`, `WRITEUP.md`, `README.md`, `ARCHITECTURE.md`, `SETUP.md`, `SPEC.md` | All resolve |
| `git merge-tree main origin/renew-ui-sep02` | Clean, no conflicts |
| `pnpm -r typecheck` | Clean except the known `apps/caregiver` `PageProps` error |

---

## Undoing all of it

Every commit is a normal revert. To undo the whole restructure but keep the
`SPEC.md` rescue:

```bash
git revert --no-commit bf7b732 927459d 1fd2311 e77007d fc71938 31d2437 28a8d9b
git commit -m "Revert the 2026-09-02 restructure"
```

To restore a deleted branch:

```bash
git branch children 9f2a8e4 && git push origin children
git branch keen-goldwasser archive/keen-goldwasser && git push origin keen-goldwasser
```
