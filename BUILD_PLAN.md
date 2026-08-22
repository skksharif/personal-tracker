# Build Plan — My Amazon SDE Journey

A phase-by-phase implementation plan derived from `README.md`,
`PRODUCT_SPEC.md`, and `ARCHITECTURE_AND_DESIGN.md`.

Each phase is shippable on its own. Nothing in a later phase is required
to make an earlier phase usable.

---

## Ground Rules (apply to every phase)

1. **UI never touches `fs`.** All reads/writes go through `lib/storage/*`.
2. **Every write is validated** by a Zod schema before it hits disk, and
   written atomically (temp file → `rename`).
3. **Every write is scoped** to `data/` or `public/uploads/`. Paths are
   resolved and checked against the allowed root — no traversal.
4. **AI output is a suggestion.** It lands in a separate field or a
   review panel. It never overwrites `body` without an explicit accept.
5. **Server Components by default.** `"use client"` only where there is
   real interaction (editor, AI panels, charts).
6. **Mobile layout first.** Build the narrow screen, then add desktop
   columns.

---

## Phase 0 — Project Setup ✅ *complete*

**Goal:** an empty app that runs, lints, type-checks, and can read/write
one file safely.

**Built**

- Next.js 16.3.1, React 19.2, TypeScript strict (plus
  `noUncheckedIndexedAccess`), Tailwind 4, ESLint, Prettier, Vitest.
- `zod` v4, `date-fns`, `js-yaml`, `nanoid`, `server-only`.
- `lib/env.ts` — Zod-validated env behind `server-only`. Split into
  `env` (always required) and `aiEnv()` (validated lazily), so the app
  runs with no API key through Phase 3 and fails with a readable message
  the moment an AI action is invoked.
- `lib/storage/paths.ts` — `safePath`, `isInside`, `sanitizeFilename`,
  `toPublicUrl`. Pure, no I/O; the single place path containment is
  decided.
- `lib/storage/frontmatter.ts` — explicit YAML front matter
  serializer/parser.
- `lib/storage/fs.ts` — atomic writes, reentrant per-file locking,
  schema-validated JSON and Markdown I/O, `listFiles`, `sweepTempFiles`.
- `lib/storage/journey.ts` — first entity module; the shape the rest
  follow.
- `.gitignore` covering `data/`, `public/uploads/`, `.env.local`;
  `.env.example` committed.
- Placeholder home page reading the journey in a Server Component.

**Exit criteria — all met**

- `npm run dev` serves the home page; `data/journey.json` is created on
  first request.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all
  pass clean. Run all four with `npm run verify`.
- 78 tests, including a full diary round-trip through the real
  `DATA_DIR` wiring.
- `safePath` rejects `../../etc/passwd` and 14 other traversal and
  absolute-path forms.

**Decisions made during Phase 0**

- **`gray-matter` was removed.** It re-parses the body you hand it, so a
  diary entry whose first line is `---` gets absorbed into the YAML and
  destroyed *on write* — the body came back as character-indexed keys.
  Silent loss of the user's original text is the one thing this product
  cannot do, so front matter is now serialized explicitly in
  `lib/storage/frontmatter.ts`: the body is never inspected on write,
  and exactly one block is stripped on read.
- **YAML schemas are asymmetric on purpose.** Dump uses `DUMP_SCHEMA` so
  `2026-08-16` is quoted; load uses `JSON_SCHEMA` so it never becomes a
  `Date` and breaks every `z.string()` date field.
- **The write lock is reentrant** (via `AsyncLocalStorage`).
  Read-modify-write is the normal shape of a save, and `writeJson` locks
  internally — without reentrancy `withLock(f, … writeJson(f) …)`
  deadlocks against itself.
- **`export const dynamic = "force-dynamic"` in the root layout.** Next
  cannot see filesystem reads and prerendered the home page at build
  time, which would serve a snapshot of an empty journal forever. Static
  output has no value for a single-user local app.

---

## Phase 1 — Foundation: Design System & Shell ✅ *complete*

**Goal:** the frame every page will live in.

**Built**

- `app/globals.css` — semantic tokens (canvas/surface/ink/line/accent/ai +
  status) defined three times over for the tri-state theme: bare `:root`,
  `prefers-color-scheme` guarded by `:not([data-theme="light"])`, and
  `[data-theme="dark"]`. Mapped through `@theme inline` so they switch at
  runtime. Type scale, spacing scale, `.prose-journal`, one global focus
  style, reduced-motion override.
- `lib/cn.ts` — `cn()` extended with the project's font-size scale.
- `components/ui/` — Button, IconButton, Field, Input, Select, Textarea
  (auto-grow), BareInput/BareTextarea (chrome-free editor controls), Tag,
  TagInput, Surface, Separator, EmptyState, Skeleton, Sheet, Dialog,
  Toast.
- `components/shell/` — `AppShell`, `Page`, `PageHeader`, `BottomNav`,
  `SideNav`, `MobileHeader`, `ThemeToggle`, nav icons.
- `lib/navigation.ts` — the route map, declared once.
- `app/loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`.
- `app/design` — living reference rendering every primitive.

**Exit criteria — met**

- Verified in-browser at 1440px and 390px, in both light and dark. The
  desktop layout is a rail + centred column + optional context panel, not
  a stretched mobile layout.
- Sheet opens as a right panel on desktop, closes on Escape, traps focus
  and inerts the background — all native `<dialog>` behaviour.
- `npm run build` and `npm run verify` clean; 89 tests.
- *Not visually confirmed:* the Sheet's bottom-sheet presentation at
  mobile width. The browser kept restoring the window to maximised, so
  only the desktop panel was seen. It is a CSS breakpoint difference
  (`mt-auto w-full` vs `sm:ml-auto sm:w-[26rem]`) — worth a glance during
  Phase 3, when the AI panels get real use.

**Decisions made during Phase 1**

- **`cn()` had to be taught the type scale.** tailwind-merge resolves
  conflicts by class group and only knows the stock scales, so it filed
  `text-page` / `text-meta` under `text-color` next to `text-ink` and
  dropped one as a duplicate. Primary buttons lost their text colour and
  tags their size — no error, no build warning, just wrong output.
  `extendTailwindMerge` registers the font sizes; `lib/cn.test.ts` locks
  it down. **Any new `--text-*` token must be added to that list.**
- **Components use semantic tokens, not `dark:` utilities.** The tokens
  already carry the theme, so a component written against them is correct
  in all three states with no variant classes.
- **Theme reads through `useSyncExternalStore`.** `localStorage` is
  external state; mirroring it into React state in an effect causes a
  cascading render and needs a `mounted` flag to avoid a hydration
  mismatch. The store form gives a correct server snapshot for free.
- **Overlays are native `<dialog>`.** Focus trapping, Escape, inerting
  and the backdrop are browser behaviour. Hand-rolled focus traps are a
  common source of keyboard bugs and there is no reason to own one.

**Original plan for reference**

- **Design tokens** in `app/globals.css` as CSS custom properties:
  warm white background, deep charcoal text, muted gray secondary, one
  accent, plus status colors (green complete / amber in-progress /
  red warning / violet AI). Define light *and* dark, both driven by
  tokens — never hardcode a hex in a component.
- **Typography scale:** metadata (12/13px), body (17px, ~1.7 line
  height, `max-width: 68ch`), entry title, page title. Sans for UI;
  an editorial serif for diary body only.
- **Spacing scale** — a small set (4/8/12/16/24/40/64). Generous
  vertical rhythm between sections.
- **`components/ui/`** primitives: `Button`, `IconButton`, `Input`,
  `Textarea` (auto-grow), `Select`, `Tag`/`TagInput`, `Card` (borderless
  — a surface tint, not a box), `Separator`, `EmptyState`, `Sheet`
  (bottom sheet on mobile / side panel on desktop), `Dialog`, `Toast`,
  `Skeleton`.
- **App shell** `app/layout.tsx`:
  - Mobile: bottom nav with 5 items — Journey, Diary, Technical, AI,
    More. Content is one full-width column.
  - Desktop (`lg:`): left nav rail, centered content column
    (`max-w-[720px]`), optional right context slot the page can fill.
  - Skip-to-content link, visible focus rings, `prefers-reduced-motion`
    respected globally.
- **Loading + error conventions:** `loading.tsx` skeletons and
  `error.tsx` per route group, worded in the product's quiet tone.

**Exit criteria**

- Nav works on 375px and 1440px; the desktop layout is not a stretched
  mobile layout.
- Keyboard tab order is sane through nav → content → actions.
- A demo page renders every primitive in light and dark.

---

## Phase 2 — Journey ✅ *complete*

**Goal:** the spine — Home, Timeline, Milestones, Progress.

**Built**

- `lib/types.ts` — the entry-type registry. All ten types are declared
  now, so the timeline and filters need no change as later phases fill
  them in.
- `lib/storage/index-store.ts` — `data/index.json`. Deterministic
  ordering, cursor pagination, filters by type/tag/date/text,
  `countByType`, and `rebuildIndex()` driven by registered collectors.
- `lib/storage/register.ts` — imports every entity module so a rebuild
  cannot silently produce a partial index.
- `lib/storage/milestones.ts` — the template every later entity module
  follows: schema, CRUD, index update on every write.
- `lib/storage/errors.ts` — error types split out of `fs.ts`.
- `lib/dates.ts` — local-calendar date helpers.
- `app/actions/` — `shared.ts` (ActionState, error mapping),
  `milestones.ts`, `journey.ts`, `timeline.ts`.
- `components/ui/use-form-action.ts` — submit-and-react hook.
- Pages: Journey Home, Timeline, Milestones, Progress, Settings.

**Exit criteria — all met**

- Verified in the browser: creating a milestone shows up on the timeline
  and home immediately, with no manual index step.
- Ordering, paging, filtering and rebuild covered by 33 tests.
  `rebuildIndex()` reproduces the incrementally-built file byte for byte.
- 500-entry index: first page 223ms, full 20-page walk 863ms, filtered
  query 30ms.
- `npm run build` and `npm run verify` clean; 122 tests.

**Decisions made during Phase 2**

- **Pagination is cursor-based, not offset-based.** Entries are inserted
  at arbitrary points in a date-ordered list, so an offset captured
  before a write points somewhere else after it — silently skipping or
  repeating a row. A cursor of `date|id` survives insertions, and falls
  back to the start if the entry it named was deleted.
- **The index stores `href`.** The timeline stays generic across all ten
  entry types instead of growing a switch as each phase lands.
- **Milestone ids are `date-slug`** (`2026-08-16-first-mock-interview`),
  assigned once and never changed. The directory lists chronologically
  and the filename says what it is — someone reading `data/` without the
  app can follow their own journal. Renaming a milestone does not move
  its file.
- **Forms use a `useFormAction` hook, not `useActionState`.** Reacting to
  a result in an effect reads backwards and triggers a cascading render
  (React's lint rule flags it). Submitting in a transition puts the
  success path on the next line after the await.
- **`server-only` caught a real leak.** `app/actions/shared.ts` imported
  `ValidationError` from `fs.ts`, and Client Components import `IDLE`
  from `shared.ts` — which would have pulled the filesystem module toward
  the browser. Error types now live in `lib/storage/errors.ts`.

**Noted for Phase 3:** each save fsyncs, costing ~265ms with a
500-entry index, and a diary save writes twice — the entry and the index.
If autosave feels heavy, the entry write is the one that must be durable;
the index update can be debounced separately and rebuilt if lost.

**Original plan for reference**

- **Storage:** `lib/storage/journey.ts` (`getJourney`, `saveJourney`),
  `lib/storage/milestones.ts`.
- **The index.** This is the key architectural piece of the phase.
  `data/index.json` holds one lightweight record per entity — id, type,
  date, title, tags, mood, a 160-char excerpt, media thumb path. Every
  `save*()` in every storage module updates it. The timeline, search,
  and analytics all read the index instead of opening hundreds of files.
  Ship a `rebuildIndex()` that regenerates it from disk so it is never
  the source of truth, only a cache.
- **Journey Home** (`app/page.tsx`, Server Component): title, start
  date, target, current focus, today's plan slot (empty until Phase 5),
  and the last 5 timeline items. Nothing else. One primary action:
  *Write today's entry*.
- **Timeline** (`app/journey/timeline`): reverse-chronological, grouped
  by month, reading off the index. Each row = date · title · type dot ·
  small metadata · optional thumbnail. Cursor pagination (25/page) with
  a *Load more*, plus a type filter. Deliberately lightweight — rules,
  whitespace, and small markers, not cards.
- **Milestones** (`app/journey/milestones`): create/edit/delete, with a
  date, title, note, and optional image. Milestones appear in the
  timeline.
- **Progress** (`app/journey/progress`): days elapsed / days to target,
  entry counts by type. Real numbers only — no fake charts yet.

**Exit criteria**

- Creating a milestone makes it appear on the timeline and home without
  a manual refresh of the index.
- Timeline with 500 seeded index rows renders the first page fast and
  paginates.
- `rebuildIndex()` reproduces `index.json` byte-identically from the
  entity files.

---

## Phase 3 — Diary ✅ *complete*

**Goal:** the heart of the product. If only this phase existed, the app
would still be worth using daily.

**Built**

- `lib/storage/entries.ts` — one module for all four written types
  (diary, reflection, experience, letter), Markdown + YAML front matter,
  per-type config for directory and id strategy, index collectors, and
  `saveAiReflection` storing AI output *beside* the body.
- `lib/storage/media.ts` + `app/api/media/route.ts` — upload validated
  by magic bytes, re-encoded to WebP through sharp, capped at 8MB and
  2000px, filenames sanitised.
- `components/diary/use-entry-editor.ts` — debounced autosave plus a
  per-keystroke `localStorage` mirror and draft recovery.
- `components/diary/editor.tsx` — chrome-free title and body, image
  insert at the caret, preview toggle, collapsed details.
- `components/diary/entry-body.tsx` — Markdown rendering with images
  inline.
- Pages: diary month list, `/diary/[date]` editor, reflections,
  experiences, Dear Future Me, Emotional Journey, Memory & Media.

**Exit criteria — all met**

- Wrote an entry, closed it, reopened it, edited it — verified in the
  browser.
- **Crash recovery verified for real:** killed the dev server mid-entry,
  typed 218 characters, confirmed the disk file still held only the
  earlier save while `localStorage` held everything, restarted, reloaded,
  and the recovery banner offered the newer text. Restoring wrote it to
  disk.
- Image uploaded to a caret position *between* two sentences renders
  between those paragraphs — DOM verified as `P → FIGURE → P`.
- All four types index with correct hrefs and reach the timeline; the
  image appeared in Memory & Media automatically.
- `npm run build` and `npm run verify` clean; 158 tests.

**Decisions made during Phase 3**

- **Sealing is enforced in the storage layer, not the UI.** A letter with
  a future `openOn` has its excerpt replaced before it reaches the index,
  so a sealed body cannot leak through the timeline, search, or an AI
  context payload by accident. The author can still open their own letter
  early — it is their file, in plain text, on their disk; pretending
  otherwise would be theatre.
- **`updateEntry` upserts.** The editor opens at a date whether or not
  anything exists there, so the first autosave must create the file
  rather than fail with "no such entry".
- **Partial saves never blank a field.** An autosave carrying only the
  body must not wipe tags set in a different control, so each field is
  written only when actually supplied.
- **The local mirror is offered, never applied.** Silently replacing what
  is on disk with a draft of unknown age is its own kind of data loss.
- **Images are validated by signature, not extension**, and re-encoded
  through sharp — which also strips EXIF, and phone photos carry GPS
  coordinates into what is meant to be a private journal.
- **A standalone image unwraps its paragraph.** Markdown wraps a lone
  image in `<p>`, and a `<figure>` inside a `<p>` is invalid HTML that
  the browser silently reparents, producing a hydration error. Caught in
  the console during the browser check.

**Original plan for reference**

**Storage format**

`data/diary/YYYY-MM-DD.md` — Markdown body with YAML front matter
(id, date, title, mood, category, tags, related problem/note ids, media
array, `aiReflection` block, `createdAt`, `updatedAt`). Markdown keeps
the most personal content human-readable and diffable outside the app.
Structured-only entities (problems, journey, milestones) stay JSON.

**Build**

- `lib/storage/diary.ts` — get/list/create/update/delete + Zod schema.
- **Editor** (`app/diary/[date]`): the page opens with the cursor in the
  body. Title is a borderless input above it. Everything else — mood,
  category, tags, relations — lives in a collapsed *Details* row beneath.
  - Autosave: debounce 800ms → server action; mirror to `localStorage`
    on every keystroke so a crash or failed save never loses text.
  - A visible, quiet save state: *Saving… / Saved 14:32*.
  - Block-based body so media can sit between paragraphs. Start simple:
    Markdown text with `![](path)` image blocks inserted at the cursor,
    rendered inline in preview. Do not build a full block editor yet.
- **Diary list** (`app/diary`): month view + a "write today" affordance
  that routes to `/diary/<today>` and creates on first save.
- **Reflections** (`app/diary/reflections`): same storage shape, type
  `reflection`, no date-per-file constraint. A deliberately emptier
  editor — prompt, body, mood. Nothing else.
- **Emotional Journey** (`app/diary/emotions`): mood per entry plotted
  over time as a plain line/dot strip. Neutral, descriptive labels only —
  never framed as diagnosis.
- **Life Experiences** and **Dear Future Me**: two more entry types on
  the same storage primitives. *Dear Future Me* adds an `openOn` date
  and stays collapsed in the timeline until that date passes.
- **Media upload** (`app/api/media/route.ts`): multipart POST →
  validate MIME by magic bytes (not extension), cap at ~8MB, sanitize
  filename, convert to WebP via `sharp`, write to
  `public/uploads/images/`, return the media record. Delete removes the
  file and the record.

**Exit criteria**

- You can write, save, close, reopen, and edit an entry.
- Killing the dev server mid-typing loses nothing on reload.
- An image can be inserted mid-paragraph and renders in the right place.
- Every diary type shows up correctly on the timeline.

---

## Phase 3.5 — AI Spike ✅ *complete (migrated to Gemini)*

**Goal:** de-risk the AI provider before designing seven features around it.

> **Provider changed.** This was built against xAI's Grok and migrated to
> Google Gemini when the key turned out to be a Google credential. The spec
> documents were updated to match. Everything below describes the Gemini
> implementation; the Grok findings are kept at the end because they are why
> parts of the design look the way they do.

**Built**

- `lib/ai/gemini.ts` — the only place the app talks to Gemini. Built on the
  official `@google/genai` SDK: timeout, bounded retry, typed errors, an
  injectable client for tests, schema-constrained JSON, and image generation.
- `lib/ai/errors.ts` — named failure kinds, each with wording safe to show
  the user as-is.
- `lib/ai/prompts/title.ts` — first task-specific prompt, with the context
  disclosure derived from the same constant the prompt uses.
- `lib/ai/diagnostics.ts` + **Settings → Check AI connection**.
- **Suggest title** shipped end-to-end in the diary editor.

**Answers — all three, verified against the live API**

- **Models.** `gemini-3.7-flash` for general work (~2.2s, and it bills
  *thinking* tokens separately — 83 on a one-word reply).
  `gemini-3.5-flash-lite` for short, frequent calls at ~790ms, which is what
  the inline **Suggest** control uses. Image model
  `gemini-3.1-flash-image`.
- **Structured output is reliable, and native.** Gemini enforces a
  `responseSchema` server-side. `z.toJSONSchema()` output is accepted
  directly, so **one Zod schema constrains the request and validates the
  response** — they cannot drift apart. **Phase 5 can depend on schemas**
  rather than parsing free text defensively.
- **Image generation is reachable but not on this key's plan** — HTTP 429
  quota, not 404. So Phase 6 ships diagram-and-upload as the working path,
  with real generation behind a graceful "not included on your plan"
  message that the diagnostics already word correctly.

**Decisions made during Phase 3.5**

- **The SDK, not raw HTTP.** The wire format is the part most likely to be
  guessed wrong and least likely to be caught by a type checker — which is
  exactly how the Grok attempt went. The client is injectable, so the retry
  and error logic is still fully testable without a network or a key.
- **Quota is not a rate limit.** Gemini answers both "slow down" and "not on
  your plan" with a 429, and only the message separates them. Retrying the
  second wastes the user's time for the same refusal, so `quota` is its own
  non-retryable kind. Found by hitting it for real.
- **Two models, not one.** ~790ms versus ~2.2s is the difference between an
  inline control feeling instant and feeling slow.
- **Model output stays untrusted** even under constrained decoding: the same
  Zod schema re-validates every response.
- **AI controls disappear entirely without a key** rather than showing a
  disabled button the user cannot fix from where they are standing.

**Carried over from the Grok build**

- A provider's status codes are not reliable on their own. xAI answered an
  invalid key with HTTP 400; Gemini overloads 429. Both are classified by
  reading the response body, not the code alone.
- Naming a live model explicitly matters: the project's original default,
  `grok-4-fast`, had been retired and was silently redirecting.

## Phase 4 — Technical Preparation ✅ *complete*

**Goal:** the record of what was actually studied.

**Built**

- `lib/storage/problems.ts` — the Problem Journal. Attempts with dates and
  results, plus the five-part learning record from the spec.
- `lib/storage/topics.ts` — DSA topics. Status and notes are stored;
  **every count is derived** from the problem records.
- `lib/storage/notes.ts` — one module for learning notes, CS fundamentals
  and system design records, differing only by `kind`.
- `lib/storage/sessions.ts` — practice sittings, separate from the
  problems inside them.
- `lib/storage/ids.ts` — journey-wide id allocation.
- `lib/storage/patch.ts` — partial updates that touch only what was sent.
- `lib/technical.ts` — client-safe constants shared by storage and UI.
- `components/markdown/` — one renderer for the whole app: images inline,
  server-side syntax highlighting, `​```mermaid` blocks as diagrams.
- Pages: Technical index, Problem Journal (list + detail), DSA (list +
  topic), System Design, CS Fundamentals, Coding Practice, Learning Notes.
- `RelationPicker` + `findReferencesTo` — cross-linking both ways.

**Exit criteria — all met**

- Logged *Two Sum* in the browser, recorded an attempt: status moved to
  solved, and both topics appeared on the DSA page with derived counts
  (`1 problem · 1 attempt · 1 solved`) without ever being declared.
- Linked the problem from a diary entry; the problem page shows
  **“Mentioned in — Untitled entry · 16 August 2026”**.
- Mermaid renders as a real diagram in the app's own palette, and Python
  is highlighted, both verified in a design record.
- `npm run build` and `npm run verify` clean; 209 tests.

**Two data-loss bugs found and fixed**

- **Id collision across collections.** A practice session and a diary
  entry on the same day were both identified by the bare date, so one
  silently overwrote the other in the index and a rebuild dropped it
  entirely. Ids are now allocated against the whole journey, and sessions
  are prefixed `practice-`.
- **Zod's `.partial()` still applies defaults.** Parsing a patch of
  `{attempts, status}` returned `topics: []` as well, which then erased
  the real topics on merge — so *recording an attempt wiped the
  problem's topics and tags*, with no error and quietly emptying the DSA
  counts. `providedKeysOnly()` now narrows a validated patch back to the
  keys the caller actually supplied. **Any future `.partial()` patch must
  go through it.**

**Decisions made during Phase 4**

- **Counts are derived, never stored.** A stored counter is a second
  source of truth that drifts the first time a problem is edited or
  deleted, and a progress number that quietly lies is worse than none.
  A test deletes a problem and asserts the topic count falls.
- **A problem is named for itself** (`two-sum`), not for a day — it gets
  revisited, and the attempts carry the dates.
- **Sessions are separate from problems**, so “ninety minutes, nothing to
  show for it” stays a recordable fact.
- **`lib/technical.ts` exists because of a build break.** A Client
  Component importing a runtime constant from a `server-only` module
  pulls the filesystem layer into the browser bundle. Types may come from
  `lib/storage/*`; values must not.

**Original plan for reference**

**Build**

- **Storage:** `problems.ts`, `topics.ts`, `designs.ts`, `notes.ts`,
  `sessions.ts`. Problems and sessions are JSON; notes and designs are
  Markdown + front matter.
- **Problem Journal** (`app/technical/problems`) — the highest-value
  module here. The entry form mirrors the spec's structure: Problem /
  Attempt / Struggle / Breakthrough / Final understanding / Reflection.
  Each section is a plain textarea, not a wizard. Fields: name, source,
  url, difficulty, topics, status, attempts array (date + result), time
  complexity, space complexity.
- **DSA Journey** (`app/technical/dsa`): topic list with status, first
  and last practiced dates, attempt/solved counts, difficulty split,
  notes, and links to related problems and diary entries. Counts derive
  from problem records — never entered by hand.
- **System Design** (`app/technical/design`): one record per design,
  sections per the spec (requirements, initial vs revised architecture,
  components, data flow, scaling, bottlenecks, trade-offs, lessons).
  Diagram = uploaded image or Mermaid text block.
- **CS Fundamentals** (`app/technical/fundamentals`): notes grouped by
  subject (OS, DBMS, Networking, OOP, Java, HTTP, APIs, Concurrency).
- **Coding Practice** (`app/technical/sessions`): date, duration,
  attempted, solved, topics, notes, reflection. Feeds Phase 7.
- **Learning Notes** (`app/technical/notes`): concept-first Markdown
  notes with code blocks (Shiki highlighting), related problems, tags.
- **Cross-linking:** a shared `<RelationPicker />` that searches the
  index and attaches ids. Relations are stored on both sides so a
  problem page can show "mentioned in these diary entries."

**Exit criteria**

- Logging a problem updates its topic's counts and appears on the
  timeline.
- A diary entry can link a problem, and that problem page shows the link
  back.
- Code blocks and Mermaid render in notes and designs.

---

## Phase 5 — AI Companion ✅ *complete*

**Goal:** AI everywhere it adds value, always optional, never destructive.

**Built — the layer**

- `lib/ai/context.ts` — the privacy boundary. Per-task selection (recent,
  relevant, range, span), character budgets, and a disclosure derived from
  the same records that will be sent.
- `lib/ai/schema.ts` — a Zod schema per response, driving both the request
  constraint and the validation.
- `lib/ai/prompts/index.ts` — one short prompt per feature, sharing only a
  `VOICE` block of house style.
- `components/ai/ai-panel.tsx` — the accept/ignore contract, written once.
- `lib/storage/interviews.ts` — full transcripts on disk.

**Built — the features**

Inline assists (title, tags, improve, summarise, extract learning), Diary
Reflection, Ask My Journey, Personal Coach, Mock Interviewer, Weekly
Reflection, Progress Analysis, Learning Insights, and the Tomorrow Planner
on Home.

**Exit criteria — all met**

- Every AI action has Accept / Edit / Regenerate / Ignore, with **Ignore
  first and free** — enforced by `AiPanel` rather than by convention.
- Failures change nothing and say so. Verified live during the Gemini
  migration with a rejected key, and pinned by 19 client tests.
- **No request exceeds its declared context**, asserted by 13 tests against
  a journal deliberately larger than every budget — including one that
  proves a sealed letter's body cannot reach a prompt.
- **The key appears in zero client bundles**: 0 of 113 chunks, with the
  scan proven able to find things (8 chunks contain the word "Gemini").
- `npm run build` and `npm run verify` clean; 240 tests.

**Two bugs found by using it, not by testing it**

- **Citations silently vanished.** The prompt told the model to cite entry
  ids, but the rendered context showed it a formatted date in brackets —
  it had never been given an id to cite. Answers looked correct and simply
  had no links. Entries now lead with `[id: ...]`.
- **The disclosure misstated its own date range.** It read the oldest and
  newest dates off the ends of the list, which is only correct when the
  list is date-ordered — and relevance-ranked selections are not. Now
  computed.

**Decisions made during Phase 5**

- **Context is built from the index, never the files.** Excerpts bound
  every payload by construction, and a sealed letter's body was already
  replaced before it got there — so the strongest privacy guarantee comes
  from the data path rather than from remembering to check.
- **Every schema field is optional.** A model given a required
  "breakthrough" will invent one, and a journal containing a confident
  fabrication is worse than one with a gap. Verified live: a reflection
  filled four fields and left three out.
- **The counted half is given as fact.** Numbers come from the analytics
  layer, so the model never infers a count from excerpts and gets it wrong.
- **Fabricated citations cannot render.** Cited ids are resolved against
  the records actually sent; anything invented fails to resolve and simply
  does not appear as a link.
- **Only two surfaces are conversational** — Ask My Journey and the Mock
  Interviewer. Everything else is a panel or a page, never a chat bubble.
- **The interview writes each turn as it happens**, so a closed tab leaves
  a real transcript rather than nothing.

## Phase 6 — Visual AI ✅ *complete (as the Mermaid fallback)*

**Goal:** images that are part of the journal, not a gallery.

**The image API is not available on this key**

Probed before writing anything, which is what the plan's fallback clause was
for. Both image models return 429 with `limit: 0`:

    Quota exceeded for metric: generate_content_free_tier_requests,
    limit: 0, model: gemini-3.1-flash-image

`limit: 0` is not a rate limit that clears — it is an entitlement that is not
there. So this shipped as the documented fallback: **the model writes Mermaid
source and the app renders it.**

That turns out to suit the product better than an image would have. A
generated picture is opaque and final; Mermaid source is text the author can
edit, it lives *inside* the entry rather than beside it, it costs nothing to
store, it re-themes with the app, and it survives the export as readable
characters. It is also honest about what it is, which is the rule the rest of
the AI layer already follows.

**Built**

- `lib/ai/prompts/diagram.ts` — six shapes (flow, sequence, tree,
  architecture, state, data model), each naming its Mermaid dialect and its
  conventions, plus `sanitiseMermaid`, `toMermaidBlock` and the disclosure.
  No server-only imports: the sheet needs all of it in the browser.
- `diagramSchema` and `generateDiagramAction` — the source is sanitised on
  the server as well as in the browser, because a model wrapping its answer
  in a code fence is the likeliest failure and a fence inside a fence is
  miserable to find in a saved file.
- `components/ai/diagram-assist.tsx` — the sheet. Shape picker, a description
  field, and a preview rendered by **the same component the entry uses**, so
  what is previewed is the artefact rather than an approximation of it.
- `components/ui/use-caret-insert.ts` — shared by the diary and the note
  editor so an image and a diagram land identically: between paragraphs at
  the caret, blank lines normalised, caret left after the block.
- Wired into the diary editor (beside Add image) and the note editor, where
  a system design record is the case it earns its keep on.
- `AiPanel` gained an `inputs` slot and a `runDisabled` flag — the first AI
  feature that needs to ask something before it can run.

**Exit criteria — met, in the fallback's terms**

- **A diagram generates and inserts at the chosen paragraph** — verified
  end-to-end against the live API: an architecture diagram of a URL shortener
  generated, previewed, inserted at the caret, autosaved, and read back off
  disk as a fenced mermaid block.
- **Regenerating leaves no orphaned files** — true by construction now. A
  diagram is text in the entry; there is no second artefact to orphan.
- **Deleting an entry cleans up the media it owned** — this one was genuinely
  unmet and is now fixed. `deleteEntry` removed the Markdown and the index
  record and left the uploads on disk forever: a leak the user could neither
  see nor clear. It now deletes the images the entry owned, but only after
  checking the rest of the journal — media records *and* bodies, entries and
  notes alike — because deleting a file another page still points at is worse
  than a file left behind.
- `npm run build` and `npm run verify` clean; 288 tests. Lighthouse
  accessibility 100 on both pages that carry a diagram.

**Decisions made during Phase 6**

- **The AI marker is a Mermaid comment, not a UI badge.** `%% AI-generated
  diagram` sits inside the fence, so it travels with the source when it is
  copied and is still there in the exported Markdown. A badge that only
  exists in the app would not survive the thing this app promises to hand
  back. Verified in the browser that the comment does not stop it rendering.
- **Only the selection is sent, never the entry.** A diagram is about one
  idea, so the context it needs is the text the author pointed at. The
  disclosure counts the characters and says outright that the rest of the
  entry stays home.
- **The failure mode is shown, not hidden.** Invalid source renders as source
  with the parser's complaint underneath — `MermaidDiagram` already worked
  that way — and Regenerate is one click away. Nothing is written until
  Insert, so a diagram that will not draw costs the entry nothing.
- **No decorative mode.** The plan's *Meaningful / Decorative* toggle was for
  images. A diagram of a mood is nonsense, so the toggle became the six
  shapes instead of pretending the other half still existed.

**A bug the browser found**

The description field rendered as a 2px sliver. `Textarea` auto-grows by
setting its height from `scrollHeight` on mount — and a hidden element
measures zero, which is exactly what happens inside a `<dialog>` that has not
been shown yet. Nothing outside a sheet had ever hit it. It now keeps its
rows-based height when the measurement comes back zero.

**Original plan for reference**

**Build**

- `app/api/ai/image/route.ts` — prompt → Grok image endpoint → download
  → `sharp` to WebP → `public/uploads/generated/` → media record with
  the prompt and mode saved alongside it.
- **Generate Visual** sheet: mode toggle (*Meaningful* / *Decorative*),
  a prompt field pre-filled from the selected text, style presets,
  Regenerate, Delete, and **Insert here** at the cursor position.
- Meaningful mode augments the prompt for diagrammatic clarity
  (recursion trees, BFS traversal, architecture, request flow);
  decorative mode augments for mood.
- Generated images carry a small, permanent "AI-generated" marker in
  their record and a quiet caption in the UI.

**Fallback:** if the spike in Phase 3.5 showed no image generation on
the key, this phase ships as *meaningful visuals via Mermaid* (AI
generates diagram source, you render it) plus upload-and-caption. That
covers the technical half of the use case at zero image-API cost.

**Exit criteria**

- An image generates, lands on disk as WebP, and inserts at the chosen
  paragraph.
- Regenerating does not leave orphaned files.
- Deleting an entry cleans up the media it owned.

---

## Phase 7 — Analytics ✅ *complete*

**Goal:** a few readable views. Not a BI dashboard.

**Built**

- `lib/analytics/compute.ts` — pure functions over the records. No JSX, no
  colours, no chart code, so the numbers can be tested on their own.
- `components/charts/primitives.tsx` — `Figure`, `DataTable`, `StatTile`,
  `BarList`, `StackedBar`, `Legend`, `TrendLine`. Inline SVG and HTML; no
  charting library, and nothing ships to the browser.
- Chart tokens in `globals.css`: an ordinal ramp (`chart-1..3`) and a
  diverging pair with a neutral midpoint, defined for light and dark.
- Six views: Analytics index (stat tiles), Topic progress, Problem
  statistics, Study consistency, Confidence timeline, Learning trends.
- One line on Home — days recorded out of days elapsed, linking onward.

**Exit criteria — all met**

- Every figure is computed from the records; 20 tests build a known
  journal and assert the numbers that come out.
- **Every chart has a table.** Verified by counting: each page renders
  exactly one “Show the numbers” disclosure per `<figure>`.
- No horizontal overflow at 360px, measured in the browser.
- `npm run build` and `npm run verify` clean; 229 tests.

**Decisions made during Phase 7**

- **The palette was computed, not chosen.** Every chart colour came out
  of the data-viz validator, run against each mode's own surface. The
  first two attempts failed — the light end of the ramp sat at 1.81:1
  against white, and the accent's chroma was just under the floor — so
  the values were re-stepped until they passed. Dark steps are selected
  against the dark surface, never flipped from light.
- **Difficulty uses an ordinal ramp, not a traffic light.** Easy → hard
  is an ordered scale, and green/amber/red would read as good/warning/bad.
  A hard problem is not a failure. Status colours stay reserved for
  status.
- **Three charts, not one with three lines.** Problems, entries and
  minutes are different scales; one plot would need a second y-axis,
  which invents a correlation the data does not contain.
- **Trends need three months before they draw.** A line between two
  points is a line between two numbers. Below that the page says so and
  shows the values instead.
- **Confidence is framed as counting words, not measuring a person.**
  Diverging form because the data is genuinely an ordered scale with a
  middle — but no score, no average, no trend line, and copy that says
  what the groupings are.
- **Streaks are reported, never targeted.** The consistency page states
  outright that a blank day is a day, not a failure, which is what the
  product principles ask for.

**Two bugs found by looking at the rendered output**

- The trend line's end marker rendered as a squashed ellipse: a
  `<circle>` inside `preserveAspectRatio="none"` is scaled
  non-uniformly. It is now an HTML dot positioned over the SVG.
- A two-month chart drew a meaningless straight line across the full
  plot. Hence the three-month threshold.

**Original plan for reference**

**Build**

- `lib/analytics/*.ts` — pure functions over the index and problem/
  session records. No charts in the computation layer.
- Six views, each on its own page under `app/analytics/`: preparation
  progress, topic progress, problem statistics, study consistency,
  confidence timeline, learning trends.
- Charts: lightweight SVG or Recharts, one accent color plus the status
  palette, no gridline clutter, readable on a 375px screen. Every chart
  needs an accessible text summary or data table alternative.
- Home surfaces at most **one** small progress element from this layer.

**Exit criteria**

- Analytics compute from real records with no hand-maintained counters.
- Every chart is legible on mobile and has a non-visual equivalent.

---

## Phase 8 — Organization & Polish ✅ *complete*

**Goal:** finding things, and the last 10%.

**Built**

- `lib/search.ts` — one scored pass over the index, so a phrase written in
  a diary entry, a problem's breakthrough or a design's trade-offs all come
  back together. Title 6 (12 exact) > tag 4 > text 2; quoted phrases stay
  whole; every term must land somewhere or it is not a result.
- `app/search` — a Server Component reading `searchParams`, with the box and
  type chips in `components/organise/search-form.tsx` driving the URL. The
  results never cross into the client.
- `lib/storage/tags.ts` — a registry derived from the index, never stored.
  `renameTag` rewrites every entity carrying the tag (a problem's topics and
  tags both, or a rename would half-apply), and renaming onto an existing tag
  merges. `deleteTag` removes the label and nothing else.
- `app/tags` and `app/tags/[tag]` — the list with rename/merge/remove, and
  everything one tag covers.
- `lib/storage/bookmarks.ts` + `components/organise/bookmark-button.tsx` —
  a flat id list in `data/bookmarks.json`. Starring writes nothing to the
  entry, so a bookmark can never corrupt one. Wired into every detail page.
- `app/api/export/route.ts` — streams a zip of `data/` and `public/uploads/`
  with a README that explains the layout.
- `app/more` — the fifth nav area, which the navigation had linked at `/more`
  since Phase 1 with no page behind it.
- `components/organise/entry-list.tsx` — one row shared by search, tags and
  bookmarks rather than three that drift.

**Exit criteria — all met**

- **Search finds a phrase written in any module** — verified in the browser
  against a seeded journal, and pinned by tests that search across diary,
  reflection, problem and note in one query.
- **Export produces a zip a stranger could read without the app** —
  downloaded over HTTP and opened: README, Markdown, JSON and WebP for every
  entry, `testzip()` clean.
- **Lighthouse accessibility ≥ 95** — measured, not assumed. Home, Timeline,
  the diary editor, search, tags, bookmarks, settings, more, four analytics
  pages, a problem page and Ask all score **100**.
- `npm run build` and `npm run verify` clean; 264 tests.

**The export was broken and the test is what found it**

`new Archiver("zip", options)` type-checked cleanly against the local
interface and threw `self._module.on is not a function` at runtime: archiver
8 replaced the callable v5 API with one class per format taking only options,
so that call constructed an archiver with no format attached. It is
`new ZipArchive({ zlib })`. Nothing but opening a real archive would have
caught it — `tests/export.test.ts` now reads the zip's local file headers and
asserts the entries are actually in there.

**The contrast audit found real failures**

Computed rather than eyeballed, every ink and status token against all three
surfaces it can sit on:

- Light `ink-muted` was 3.42:1 and `ink-faint` 2.22:1 — both used for meta
  text at small sizes, both below AA. Re-stepped to 5.43 and 4.54.
- Light `warning` was 4.18:1, and `success` on `success-soft` 4.46:1.
- Dark `ink-faint` was 2.71:1; the dark ramp was re-stepped with it.
- Control borders were the quiet one: an input's edge at 1.28:1 against the
  page fails WCAG 1.4.11, which asks 3:1 for the boundary that identifies a
  control. Rather than thicken every hairline divider, a `--control-border`
  token now carries inputs and secondary buttons at 3.16–3.53:1, and `--line`
  stays decorative.

The ink ramp is now contrast-bound rather than taste-bound, which puts its
lower steps closer together than they would be by eye — so hierarchy below
`ink-secondary` leans on size and weight as much as on lightness.

**Three more found by Lighthouse**

- "See the rest" inside a sentence was accent-coloured with `hover:underline`
  — 1.13:1 against the surrounding text and no underline at rest, so colour
  was doing the work alone. Inline links now underline at rest.
- The `sr-only` file input behind "Add image" sat in the accessibility tree
  as a second, unlabelled control. `hidden` removes it; the button was always
  the real control and `.click()` still works.
- `StatTile` put a `<p>` beside its `<dt>`/`<dd>` inside a `<dl>`, which is
  invalid. The detail line moved inside the `<dd>` it describes.

**A mistake worth recording**

A throwaway script that seeded a demo journal read its target from `DEMO_DIR`
and stubbed `DATA_DIR` with it. It lived under `tests/`, so `npm run verify`
picked it up — with `DEMO_DIR` unset it fell back to the default and wrote
eight fixture entries straight into the real `data/`. They were removed (the
journal held nothing but `journey.json`, which was untouched), but the lesson
is the guard, not the cleanup: `atomicWrite` now refuses to write anywhere
inside the project while Vitest is running, with a test that proves it.

**Decisions made during Phase 8**

- **Search stays a Server Component.** The form writes to the URL and the
  server does the searching, which means a search is linkable, survives a
  reload, and never ships the index to the browser.
- **No stored tag list.** Same reasoning as the DSA counts: a registry on
  disk is a second source of truth that drifts the moment an entry is
  edited. A tag exists because something carries it.
- **A rename reports how many records changed**, rather than claiming
  success — a rename that matched nothing is worth knowing about.
- **A bookmarked id whose entry is gone is skipped on read, not pruned on
  write.** Cheaper, and it means restoring a file from a backup brings its
  star back with it.
- **A sealed letter is findable by title but never by body.** The index
  masks the excerpt, so search inherits the guarantee rather than
  re-implementing it — and a test asserts both halves.
- **`Tag` stopped being a client component.** It is a coloured span rendered
  by more Server Components than client ones; the `"use client"` on its file
  was dragging all of them across the boundary. Split into `tag.tsx`
  (presentational) and `tag-input.tsx` (interactive).
- **The timing budgets are retried.** They run alongside fourteen other
  suites hammering the same disk; a cold read behind a virus scanner was
  measured at 300ms for work that takes 5ms warm. A real regression is an
  order of magnitude out and still fails every attempt.

**Original plan for reference**

**Build**

- **Search** (`app/search`): index-backed. Start with a scored substring
  match over title/excerpt/tags; move to MiniSearch if it feels slow.
  Filter by type, date range, tags, mood. Results grouped by type.
- **Tags & Categories:** a tag registry derived from the index, a tag
  page listing everything carrying it, and rename/merge.
- **Bookmarks:** `data/bookmarks.json` — a star on any entity, surfaced
  in one list.
- **Export/backup:** a route that zips `data/` + `public/uploads/` into
  the `journey-export/` layout from the architecture doc.
- **Polish pass:** empty states with real copy, error boundaries,
  `prefers-reduced-motion`, focus traps in sheets and dialogs, contrast
  audit (4.5:1 body, 3:1 UI), Lighthouse on mobile, and a pass removing
  every `"use client"` that isn't earning its place.

**Exit criteria**

- Search finds a phrase written in any module.
- Export produces a zip that a stranger could read without the app.
- Lighthouse accessibility ≥ 95 on Home, Timeline, and the diary editor.

---

## Sequencing Notes

- **Phases 0–3 are the critical path.** At the end of Phase 3 you have a
  real journal you can use every day for months. Start using it then —
  your own usage will reorder everything after it.
- **Phase 3.5 must happen before Phase 5 is designed.** What the provider
  actually does changes what Phases 5 and 6 look like — and it did: Phase 6
  became diagrams rather than images because the key has no image quota.
- **Phase 4 and Phase 5 can swap.** If daily writing matters more than
  problem logging right now, do the AI layer first.
- **Phase 7 needs Phase 4's data to be meaningful.** Analytics over an
  empty problem journal is a chart of zeros — don't build it early.
- **The index (Phase 2) is the load-bearing decision.** If it isn't
  maintained by every storage write, timeline, search, and analytics all
  degrade into full-directory scans as the journey grows.

---

## Risks Worth Naming Now

| Risk | Mitigation |
|---|---|
| No image API on the key | Confirmed in Phase 6: `limit: 0` on both image models. Shipped as the Mermaid fallback |
| Concurrent writes corrupt a file | Atomic temp-file + rename in `lib/storage/fs.ts` from Phase 0 |
| Index drifts from disk | `rebuildIndex()` shipped in Phase 2, run on boot in dev |
| Scope creep across 30+ pages | Ground rule: no page ships without one clear primary action |
| Personal content leaving the machine | Explicit context disclosure before every AI call (Phase 5) |
| `data/` committed to git by accident | `.gitignore` in Phase 0 |
