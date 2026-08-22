# Product Specification

## 1. Product Definition

**My Amazon SDE Journey** is a personal preparation diary that records
the user's path toward an Amazon SDE interview.

The product combines five experiences:

1.  Journey tracking
2.  Personal diary
3.  Technical preparation
4.  AI-assisted reflection and coaching
5.  Visual storytelling

The application is intentionally personal. It should not behave like an
enterprise project-management dashboard.

## 2. Information Architecture

The main navigation is divided into five areas.

### Journey

-   Home
-   Timeline
-   Milestones
-   Progress

### Diary

-   Daily Diary
-   Reflections
-   Emotional Journey
-   Life Experiences
-   Memory & Media
-   Dear Future Me

### Technical Preparation

-   DSA
-   Problem Journal
-   System Design
-   CS Fundamentals
-   Coding Practice
-   Learning Notes

### AI Companion

-   Diary Reflection
-   Ask My Journey
-   Personal Coach
-   AI Mock Interviewer
-   Weekly Reflection
-   Progress Analysis
-   Learning Insights

### Analytics

-   Preparation Progress
-   Topic Progress
-   Problem Statistics
-   Study Streaks
-   Confidence Timeline
-   Learning Trends

### Organization

-   Search
-   Tags
-   Categories
-   Filters
-   Bookmarks

## 3. Journey Home

The home screen should answer four questions immediately:

-   Where am I?
-   What have I done?
-   What matters now?
-   What should I do next?

The first viewport should remain simple.

Suggested hierarchy:

**Journey title**

**Start date**

**Target**

**Current focus**

**Today's plan**

**Recent journey**

Avoid filling the first screen with ten different statistics.

## 4. Timeline

The timeline is the primary representation of the journey.

Entries are ordered chronologically and may represent:

-   Diary entries
-   Problems
-   Learning notes
-   Milestones
-   Interviews
-   Reflections
-   Personal experiences
-   Breakthroughs

Each timeline item should show:

-   Date
-   Short title
-   Type
-   Small metadata
-   Optional image

The full content appears after opening the item.

### Timeline design rule

The timeline should remain visually lightweight.

Use whitespace, typography, subtle separators, and small markers instead
of heavy cards.

## 5. Daily Diary

The diary editor should prioritize writing.

The user should be able to begin typing immediately without completing a
large form.

Recommended fields:

-   Date
-   Title
-   Body
-   Mood
-   Category
-   Tags
-   Related problems
-   Related learning notes
-   Media
-   AI reflection

Optional metadata should remain collapsed until needed.

### AI actions

Inside the editor:

-   Improve writing
-   Suggest title
-   Summarize
-   Extract learning
-   Suggest tags
-   Generate reflection questions
-   Find related entries
-   Generate visual

The original text remains preserved.

## 6. Personal Reflections

Reflections are deeper than ordinary diary entries.

A reflection can address:

-   Motivation
-   Frustration
-   Fear
-   Confidence
-   Failure
-   Growth
-   Consistency
-   Personal circumstances
-   Lessons

The editor should feel more open-ended than a structured task form.

## 7. Emotional Journey

The user may record a mood or emotional label.

Examples:

-   Motivated
-   Confident
-   Confused
-   Frustrated
-   Tired
-   Proud
-   Disappointed
-   Hopeful
-   Neutral

The system may visualize trends.

The application should not present emotional trends as medical or
psychological diagnoses.

## 8. Memory & Media

A diary entry may contain:

-   Uploaded images
-   Screenshots
-   AI-generated images
-   Architecture diagrams
-   Code snippets
-   Notes

Media can be placed between paragraphs.

The editor should support:

**Text → Image → Text → Problem → Image → Reflection**

rather than forcing all media into a gallery at the bottom.

## 9. AI Image Generation

AI image generation supports two modes.

### Meaningful visual

The image represents the content.

Examples:

-   A recursion tree
-   A BFS traversal
-   A system architecture
-   A database request flow
-   A personal scene
-   A breakthrough moment

### Decorative visual

The image enhances the visual mood.

Examples:

-   Study desk
-   Night coding scene
-   Sunrise
-   Abstract technical art
-   Minimal milestone illustration
-   Polaroid-style memory

The user should choose the mode.

The system should allow generated images to be inserted at a selected
point in the entry.

## 10. DSA Journey

The DSA module tracks concepts and problem-solving experience.

Each topic has:

-   Status
-   Start date
-   Last practiced date
-   Attempt count
-   Solved count
-   Difficulty distribution
-   Notes
-   Related problems
-   Related diary entries

The interface should favor progress and learning history over
gamification.

## 11. Problem Journal

Each problem should have a personal learning record.

Suggested structure:

### Problem

Name, source, difficulty, topic.

### Attempt

Date, approach, result.

### Struggle

What went wrong.

### Breakthrough

What made the solution understandable.

### Final understanding

Approach and complexity.

### Reflection

Why the problem mattered.

AI may help generate summaries or hints but should not automatically
reveal solutions when the user asks for coaching.

## 12. System Design Journey

Each design record can contain:

-   Problem statement
-   Functional requirements
-   Non-functional requirements
-   Initial architecture
-   Revised architecture
-   Components
-   Data flow
-   Scaling
-   Bottlenecks
-   Trade-offs
-   Lessons

AI may review a design and ask interview-style follow-up questions.

## 13. CS Fundamentals

The module stores notes and learning records for interview fundamentals.

Examples:

-   Operating Systems
-   DBMS
-   Networking
-   OOP
-   Java
-   HTTP
-   APIs
-   Concurrency

## 14. Coding Practice

A coding session may contain:

-   Date
-   Duration
-   Problems attempted
-   Problems solved
-   Topics
-   Notes
-   Reflection

These records feed analytics.

## 15. Learning Notes

Learning notes are concept-focused rather than problem-focused.

A note can contain:

-   Explanation
-   Example
-   Code
-   Diagram
-   AI-generated visual
-   Related problems
-   Related diary entries
-   Tags

## 16. AI Diary Reflection

AI reads the current entry and selected historical context.

It can return:

-   Summary
-   Technical learning
-   Mistakes
-   Breakthrough
-   Recurring pattern
-   Suggested next step

The user can accept, edit, or ignore the suggestions.

## 17. Ask My Journey

This is a natural-language interface over the user's stored journey.

Examples:

-   What have I improved since I started?
-   Which topics do I struggle with?
-   When did recursion become easier?
-   What were my most difficult weeks?
-   Which problems taught me the most?
-   What patterns keep repeating?

Responses should cite or link back to relevant journey entries inside
the application where practical.

## 18. AI Personal Coach

The coach uses recent and historical preparation data to suggest
realistic priorities.

It should consider:

-   Weak topics
-   Unfinished work
-   Recent activity
-   Mock interview feedback
-   User reflections
-   Target timeline

Recommendations should be small enough to be achievable.

## 19. AI Mock Interviewer

The AI interviewer should support:

-   DSA
-   System Design
-   Behavioral

A session includes:

1.  Question
2.  User response
3.  Follow-up questions
4.  Evaluation
5.  Feedback
6.  Improvement points
7.  Stored interview record

## 20. AI Weekly Reflection

The weekly reflection summarizes:

-   Technical progress
-   Important problems
-   Diary highlights
-   Difficult moments
-   Breakthroughs
-   Repeated weaknesses
-   Suggested next focus

## 21. AI Progress Analysis

Progress analysis should combine objective and narrative signals.

Objective:

-   Problems solved
-   Sessions
-   Topics
-   Interviews

Narrative:

-   Diary reflections
-   Learning notes
-   Breakthroughs
-   Repeated struggles

This allows the application to answer not only "how much?" but also
"how?"

## 22. AI Learning Insights

AI can connect records over time.

Example:

A problem from August may be related to a breakthrough in September.

The application can surface:

> You struggled with recursive state in August. You encountered a
> similar pattern in September and solved it independently.

## 23. AI Tomorrow Planner

The planner runs from the user's latest journey context.

Inputs:

-   Today's activity
-   Today's diary
-   Problems
-   Unfinished items
-   Recent progress
-   Current focus
-   Recent interview results
-   User reflections

Output:

-   Primary target
-   Supporting tasks
-   Optional task
-   Estimated time
-   Reason for recommendation

The plan should adapt to difficult days.

## 24. Analytics

Analytics should be simple and readable.

Avoid turning the home screen into a BI dashboard.

Use a few high-value visualizations:

-   Overall progress
-   Topic progress
-   Problem statistics
-   Study consistency
-   Confidence timeline
-   Learning trends

Detailed analytics can live on dedicated pages.

## 25. Search and Organization

Search should work across:

-   Diary
-   Problems
-   Notes
-   Interviews
-   Milestones
-   Reflections

Tags and categories can be manually selected or AI-suggested.

Filters should be available without cluttering the main interface.

## 26. Bookmarks

Bookmarks provide a lightweight way to save:

-   Important problems
-   Important diary entries
-   AI insights
-   Learning notes
-   Reflections
-   Milestones

## 27. Daily Loop

The intended recurring experience is:

**Morning**

Review AI-generated targets.

**During preparation**

Record problems and notes.

**Evening**

Write diary and reflection.

**After writing**

Use AI reflection.

**End of day**

Review AI-generated tomorrow plan.

This creates a continuous preparation loop.

## 28. UX Rules

### Rule 1: Show less

Do not display every piece of data on every page.

### Rule 2: Progressive disclosure

Show the important information first.

Put advanced metadata behind expandable sections.

### Rule 3: One primary action

Each screen should have one obvious primary action.

### Rule 4: Writing should feel uninterrupted

The diary editor should not feel like a database form.

### Rule 5: AI is optional

AI suggestions should help, never interrupt.

### Rule 6: Preserve the original

Original user content must always remain accessible.

### Rule 7: Mobile first

Design for narrow screens first and expand naturally for desktop.

## 29. Accessibility

The application should support:

-   Keyboard navigation
-   Visible focus states
-   Sufficient contrast
-   Semantic HTML
-   Screen-reader labels
-   Accessible form controls
-   Reduced-motion preferences
-   Touch-friendly targets

## 30. Responsive Behavior

### Mobile

-   Single-column layout
-   Bottom navigation or compact navigation drawer
-   Full-width editor
-   Large readable text
-   Minimal metadata
-   Images scaled to viewport
-   Sticky primary action when appropriate

### Tablet

-   Wider reading column
-   Optional secondary information panel

### Desktop

-   Centered content
-   Optional left navigation
-   Reading width constrained for diary content
-   Secondary context panels only when useful

The desktop layout should not simply stretch the mobile interface.

## 31. Performance

The application should:

-   Load the main journey quickly
-   Lazy-load large images
-   Optimize generated media
-   Avoid unnecessary client-side JavaScript
-   Prefer server components where appropriate
-   Paginate or progressively load long timelines
-   Cache safe read operations
-   Keep AI requests explicit and user-triggered where possible

## 32. Privacy

Because the journey may contain highly personal experiences:

-   Data should remain local to the application filesystem.
-   The Gemini API should receive only the context necessary for an AI
    operation.
-   API keys must remain server-side.
-   The application should make it clear when content is being sent to
    the external AI provider.
-   Original diary content should never be silently altered.

## 33. Product Tone

The writing and interface should feel:

-   Human
-   Quiet
-   Reflective
-   Confident
-   Honest
-   Minimal

Avoid:

-   Corporate language
-   Excessive motivational quotes
-   Gamified pressure
-   Overly cheerful AI responses
-   Generic productivity language
-   Excessive emojis

The product should feel like a personal journal first and a technical
application second.
