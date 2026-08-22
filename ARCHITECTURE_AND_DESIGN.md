# Architecture & Design Specification

## 1. Technical Architecture

The application uses a local-first Next.js architecture.

``` text
Browser
   |
   v
Next.js UI
   |
   +-----------------------+
   |                       |
   v                       v
Server Actions        Route Handlers
   |                       |
   +-----------+-----------+
               |
               v
        Application Services
               |
      +--------+--------+
      |        |        |
      v        v        v
   Journey   Diary   Analytics
   Service   Service   Service
      |
      v
 Filesystem Storage
      |
      +----------------------+
      |                      |
      v                      v
 JSON / Markdown         Media Files
      |
      v
 AI Service
      |
      v
   Gemini API
```

## 2. Technology Stack

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS

### Backend

-   Next.js Server Components
-   Server Actions
-   Route Handlers
-   Node.js filesystem APIs

### Persistence

No external database.

Use:

-   JSON for structured entities
-   Markdown for long-form human-readable content
-   Local files for images and attachments

### AI

Gemini API.

Only the Gemini API key is required externally.

## 3. Filesystem Layout

Suggested structure:

``` text
project/
├── app/
│   ├── page.tsx
│   ├── journey/
│   ├── diary/
│   ├── technical/
│   ├── ai/
│   ├── analytics/
│   └── search/
│
├── components/
│   ├── ui/
│   ├── journey/
│   ├── diary/
│   ├── technical/
│   ├── ai/
│   └── analytics/
│
├── lib/
│   ├── storage/
│   │   ├── diary.ts
│   │   ├── journey.ts
│   │   ├── problems.ts
│   │   ├── notes.ts
│   │   ├── interviews.ts
│   │   └── milestones.ts
│   │
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── prompts.ts
│   │   ├── diary.ts
│   │   ├── planner.ts
│   │   ├── interviewer.ts
│   │   └── insights.ts
│   │
│   ├── analytics/
│   └── validation/
│
├── data/
│   ├── journey.json
│   ├── diary/
│   ├── problems/
│   ├── notes/
│   ├── interviews/
│   ├── reflections/
│   └── milestones/
│
├── public/
│   └── uploads/
│       ├── images/
│       ├── generated/
│       └── attachments/
│
├── .env.local
└── package.json
```

The exact folder structure may evolve, but the separation between UI,
application logic, AI, and persistence should remain.

## 4. Storage Model

### Journey

`data/journey.json`

Contains:

-   Journey title
-   Start date
-   Target
-   Current focus
-   Overall metadata

### Diary

Prefer one file per entry:

`data/diary/YYYY-MM-DD.json`

or:

`data/diary/YYYY-MM-DD.md`

If Markdown is used, metadata can be represented through front matter.

### Problems

One structured file per problem or a collection file depending on scale.

### Notes

Markdown is suitable for long technical notes.

### Media

Store binary files separately.

The structured record stores a relative path:

``` json
{
  "path": "/uploads/generated/recursion-001.webp",
  "type": "image",
  "alt": "AI-generated recursion visualization"
}
```

## 5. Filesystem Service

All filesystem access should be centralized.

UI components must not directly call `fs`.

Use service functions such as:

``` text
getJourney()
saveJourney()

getDiaryEntry(id)
createDiaryEntry(data)
updateDiaryEntry(id, data)

getProblem(id)
saveProblem(data)

getNotes()
saveNote(data)

getMilestones()
createMilestone(data)
```

This makes the storage implementation replaceable in the future.

## 6. Data Validation

All writes should validate data before saving.

Validation should cover:

-   Required fields
-   Date formats
-   Allowed categories
-   File paths
-   Content size
-   AI response structure

Invalid input should return a clear error.

## 7. AI Service

Create one central AI service.

Responsibilities:

-   Authenticate with Gemini
-   Build prompts
-   Send requests
-   Parse responses
-   Validate structured responses
-   Handle errors
-   Enforce context limits

The rest of the application should not directly call the Gemini API.

Example flow:

``` text
Diary Page
    |
    v
AI Diary Action
    |
    v
AI Service
    |
    v
Prompt Builder
    |
    v
Gemini API
    |
    v
Validated Response
    |
    v
Diary UI
```

## 8. Prompt Design

Prompts should be task-specific.

Do not create one massive system prompt for every feature.

Use dedicated prompts for:

-   Diary reflection
-   Title generation
-   Tag generation
-   Learning extraction
-   Tomorrow planning
-   Weekly reflection
-   Journey analysis
-   Mock interviews
-   Visual generation

## 9. AI Context

Context should be selected based on the task.

For diary reflection:

``` text
Current diary
+
Recent entries
+
Related technical records
```

For tomorrow planning:

``` text
Today's activity
+
Recent activity
+
Unfinished work
+
Current focus
+
Recent reflections
```

For Ask My Journey:

``` text
User query
+
Relevant search results
+
Selected historical records
```

Do not send the entire filesystem to every AI request.

## 10. AI Safety and User Control

AI output should be treated as a suggestion.

The user can:

-   Accept
-   Edit
-   Regenerate
-   Ignore

AI should never silently modify:

-   Diary content
-   Problem solutions
-   Personal reflections
-   Historical records

## 11. Image Generation Architecture

Image requests follow:

``` text
User selects content
        |
        v
Generate Visual
        |
        v
Next.js Server
        |
        v
Image AI Service
        |
        v
Generated image
        |
        v
Filesystem
        |
        v
Media record
        |
        v
Diary / Note
```

The UI should allow:

-   Prompt refinement
-   Style selection
-   Meaningful vs decorative mode
-   Regeneration
-   Delete
-   Insert at cursor/location

## 12. Minimalist Design System

### Visual principle

**Content is the design.**

The interface should provide enough structure to guide the user without
competing with the writing.

### Layout

Prefer:

-   Wide whitespace
-   Narrow reading columns
-   Simple navigation
-   Few borders
-   Subtle separators
-   Soft surfaces
-   Clear hierarchy

Avoid:

-   Dense grids
-   Heavy shadows
-   Excessive cards
-   Large hero graphics
-   Constant gradients
-   Decorative UI that does not communicate meaning

## 13. Typography

Use a clean modern sans-serif for application UI.

For long diary content, a highly readable editorial typeface may be used
if it remains consistent with the minimalist system.

Recommended hierarchy:

-   Small metadata
-   Medium page title
-   Strong entry title
-   Comfortable body text
-   Quiet secondary text

Do not use huge text everywhere.

## 14. Color

Use a restrained palette.

Base:

-   Warm white / very light neutral
-   Deep charcoal text
-   Muted gray secondary text
-   One primary accent
-   Optional subtle status colors

Color should communicate meaning rather than decoration.

Examples:

-   Accent = primary actions
-   Green = completed
-   Amber = in progress
-   Red = failure or important warning
-   Purple/blue = AI assistance

Avoid rainbow dashboards.

## 15. Spacing

Whitespace is a major part of the design.

Use generous vertical spacing between:

-   Diary sections
-   Timeline entries
-   Images
-   Reflections
-   Technical blocks

Do not compress content just to fit more on screen.

## 16. Mobile-First Design

The mobile layout is the baseline.

### Mobile principles

-   One primary column
-   Large touch targets
-   Simple navigation
-   Full-width content
-   Sticky actions only when useful
-   Minimal metadata
-   Collapsible secondary information

The diary should feel comfortable to write from a phone.

## 17. Desktop Layout

Desktop may introduce:

-   Left navigation
-   Center reading area
-   Optional right context panel

Suggested structure:

``` text
┌──────────┬─────────────────────────────┬──────────────┐
│          │                             │              │
│   Nav    │       Main Content          │   Context    │
│          │                             │              │
│          │       Diary / Timeline      │ AI / Tags    │
│          │                             │ Progress     │
└──────────┴─────────────────────────────┴──────────────┘
```

The right panel should disappear on smaller screens.

## 18. Diary Page Layout

A diary page should resemble a clean editorial document.

Suggested structure:

``` text
Date

Title

Short metadata

Body

        [Optional Visual]

Body

        [Technical Problem]

Reflection

        [AI Insight]

Tomorrow
```

The image can appear anywhere.

## 19. Clipboard / Scrapbook Concept

The clipboard concept should be subtle.

Use:

-   Pins
-   Paper-like blocks
-   Small attachment labels
-   Polaroid-like media
-   Timeline markers

Do not make the entire application look like a physical clipboard.

The metaphor is for storytelling, not the primary UI.

## 20. AI Interaction Design

AI actions should be close to the content they affect.

Instead of a global "AI" button only:

``` text
✨ AI Assist
```

appears next to relevant inputs.

Examples:

``` text
Title                    ✨ Suggest
Diary                    ✨ Reflect
Tags                     ✨ Suggest
Problem                  ✨ Analyze
Notes                    ✨ Explain
System Design            ✨ Review
Tomorrow                 ✨ Plan
```

## 21. AI Response Presentation

AI responses should not dominate the screen.

Use:

-   Small insight panels
-   Inline suggestions
-   Expandable sections
-   Side panels on desktop
-   Bottom sheets on mobile

Avoid large chatbot bubbles for every AI interaction.

## 22. Loading States

AI operations may take time.

Use quiet states such as:

> Thinking about today's journey...

> Finding patterns in your preparation...

> Creating your visual...

Avoid noisy loading animations.

## 23. Error Handling

Errors should be understandable.

Example:

> **AI couldn't complete this reflection.**

> Your diary entry is safe. Try again in a moment.

For filesystem errors:

> **Couldn't save this entry.**

> Your current text is still on screen.

Never discard user input because of an API or filesystem failure.

## 24. Local-First Persistence

The application should save important user input as soon as practical.

The diary editor should avoid losing unsaved text.

A local draft mechanism may be used in the browser while the persistent
filesystem is the source of truth.

## 25. Backup

Because there is no external database, the filesystem is the primary
data source.

The application should therefore support a future export/backup
capability.

Useful future format:

``` text
journey-export/
├── journey.json
├── diary/
├── problems/
├── notes/
├── interviews/
├── milestones/
└── media/
```

## 26. Security

Never expose:

``` text
GEMINI_API_KEY
```

to the browser.

Validate uploaded files.

Prevent path traversal.

Restrict writes to approved data directories.

Sanitize filenames.

Limit file sizes.

Validate AI responses before storing them.

## 27. Performance

Prefer server-side rendering for content-heavy pages.

Use client components only where interaction requires them.

Lazy-load:

-   Large images
-   Media
-   Heavy analytics
-   AI interfaces

Avoid loading the entire timeline when only the first entries are
visible.

## 28. Implementation Priority

### Phase 1 --- Foundation

-   Next.js setup
-   TypeScript
-   Tailwind
-   Filesystem storage
-   Base layout
-   Mobile navigation

### Phase 2 --- Journey

-   Journey Home
-   Timeline
-   Milestones
-   Progress

### Phase 3 --- Diary

-   Daily Diary
-   Reflections
-   Emotional Journey
-   Life Experiences
-   Media
-   Dear Future Me

### Phase 4 --- Technical

-   DSA
-   Problems
-   System Design
-   CS Fundamentals
-   Coding Practice
-   Learning Notes

### Phase 5 --- AI

-   AI-assisted inputs
-   Diary Reflection
-   Ask My Journey
-   Personal Coach
-   Weekly Reflection
-   Progress Analysis
-   Learning Insights
-   Tomorrow Planner

### Phase 6 --- Visual AI

-   Image generation
-   Meaningful visual mode
-   Decorative mode
-   Inline media insertion

### Phase 7 --- Analytics

-   Preparation progress
-   Topic progress
-   Problem statistics
-   Study streaks
-   Confidence timeline
-   Learning trends

### Phase 8 --- Organization

-   Search
-   Tags
-   Categories
-   Filters
-   Bookmarks

## 29. Definition of Done

The application is complete when:

-   The journey can be started and documented.
-   Diary entries can be created and edited.
-   Technical preparation can be recorded.
-   Problems can be tracked with personal context.
-   System design learning can be documented.
-   Media can be attached.
-   AI can assist meaningful inputs.
-   AI can reflect on diary entries.
-   AI can analyze the journey.
-   AI can conduct mock interviews.
-   AI can generate weekly reflections.
-   AI can plan tomorrow based on today.
-   AI-generated visuals can be inserted into content.
-   Timeline and milestones show the complete journey.
-   Analytics show meaningful progress.
-   Search and organization work across the stored journey.
-   The application works well on mobile.
-   The interface remains minimal and spacious.
-   No external database is required.
-   Only the Gemini API key is required externally.
-   User content is preserved safely on the filesystem.
