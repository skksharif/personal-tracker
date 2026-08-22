# My Amazon SDE Journey

## Overview

**My Amazon SDE Journey** is a personal, local-first web application for
documenting the complete journey toward an Amazon Software Development
Engineer interview.

The product is intentionally different from a conventional productivity
tracker. It combines a dated personal diary, technical preparation
journal, progress history, visual memories, and an AI companion into one
continuous story.

The central idea is:

> **Document the journey, not just the destination.**

The user records what they learned, what they struggled with, what
happened personally, what they felt, what changed, and what they plan to
do next.

AI helps organize and understand that information without replacing the
user's voice.

## Product Principles

### 1. Journey over productivity

The application should capture meaningful experiences rather than
pressure the user to maintain perfect streaks or complete arbitrary task
counts.

A failed problem, an unproductive day, a breakthrough, a difficult
personal experience, and a successful mock interview are all valid parts
of the journey.

### 2. Human-first writing

The user's original diary entry is the source of truth.

AI may suggest improvements, summaries, tags, reflections, visuals, or
next steps, but it must never silently overwrite the original content.

### 3. AI everywhere it adds value

AI assistance should be available contextually inside meaningful input
fields.

The application should not force the user to leave the page and open a
generic chatbot every time they need help.

### 4. Visual storytelling

Images can explain technical concepts, represent personal scenes,
illustrate breakthroughs, or simply make an entry beautiful.

AI-generated images are part of the journal, not merely decorative
assets stored in a separate gallery.

### 5. Tomorrow should emerge from today

The application should continuously connect:

**Today → Reflection → Analysis → Tomorrow's Plan → Tomorrow →
Reflection**

## Scope

### Journey

-   Journey Home
-   Journey Timeline
-   Journey Milestones
-   Progress Overview

### Diary

-   Daily Diary
-   Personal Reflections
-   Emotional Journey
-   Life Experiences
-   Memory & Media
-   Dear Future Me

### Technical Preparation

-   DSA Journey
-   Problem Journal
-   System Design Journey
-   CS Fundamentals
-   Coding Practice
-   Learning Notes

### AI Companion

-   AI Diary Reflection
-   Ask My Journey
-   AI Personal Coach
-   AI Mock Interviewer
-   AI Weekly Reflection
-   AI Progress Analysis
-   AI Learning Insights

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

## Non-Goals

The first version is not intended to be:

-   A multi-user SaaS platform
-   A social network
-   A generic task manager
-   A generic habit tracker
-   A public blogging platform
-   A replacement for LeetCode
-   A replacement for a full interview platform
-   A system requiring MongoDB, PostgreSQL, Redis, or another external
    database

## Technology Constraints

-   Next.js
-   TypeScript
-   React
-   Tailwind CSS
-   Server Components where appropriate
-   Server Actions and/or Route Handlers for mutations and API
    operations
-   Internal filesystem for persistence
-   JSON and/or Markdown for structured and human-readable data
-   Local file storage for uploaded and generated media
-   Gemini API as the only required external API

The Gemini API key is supplied through an environment variable:

``` env
GEMINI_API_KEY=your_key_here
```

The key must remain server-side.

## Design Direction

The interface should be:

-   Minimal
-   Mobile-first
-   Spacious
-   Calm
-   Editorial
-   Personal
-   Clean
-   Content-focused

Avoid dense dashboards, excessive borders, excessive gradients,
unnecessary animations, and large amounts of explanatory copy.

The product should feel like a beautiful digital journal with technical
capabilities.

## Core Experience

A typical day should feel like:

1.  Open the journey.
2.  See what AI planned for today.
3.  Study and practice.
4.  Record problems and learning.
5.  Write the daily diary.
6.  Add a personal reflection.
7.  Add or generate a visual.
8.  Ask AI to reflect.
9.  Review progress.
10. Receive a realistic plan for tomorrow.

## Long-Term Outcome

The final product should allow the user to look back months later and
see more than a preparation score.

It should show:

-   Where the journey began
-   What was learned
-   What went wrong
-   What changed
-   Which problems mattered
-   Which experiences were difficult
-   Which breakthroughs happened
-   How preparation evolved
-   How the user eventually reached the interview

The application is successful when the preparation history feels like a
coherent personal story.
