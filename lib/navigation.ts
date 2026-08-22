/**
 * The application's navigation map.
 *
 * Five areas, matching the information architecture in the product spec. The
 * mobile bar shows all five; the desktop rail shows each area's sections
 * beneath it. Routes are declared here once so nothing drifts.
 */

export interface NavSection {
  label: string;
  href: string;
}

export interface NavArea {
  id: string;
  label: string;
  href: string;
  /** Name of the icon in `components/shell/icons.tsx`. */
  icon: "journey" | "diary" | "technical" | "ai" | "more";
  sections: NavSection[];
}

export const NAV_AREAS: NavArea[] = [
  {
    id: "journey",
    label: "Journey",
    href: "/",
    icon: "journey",
    sections: [
      { label: "Home", href: "/" },
      { label: "Timeline", href: "/journey/timeline" },
      { label: "Milestones", href: "/journey/milestones" },
      { label: "Progress", href: "/journey/progress" },
    ],
  },
  {
    id: "diary",
    label: "Diary",
    href: "/diary",
    icon: "diary",
    sections: [
      { label: "Daily Diary", href: "/diary" },
      { label: "Reflections", href: "/diary/reflections" },
      { label: "Emotional Journey", href: "/diary/emotions" },
      { label: "Life Experiences", href: "/diary/experiences" },
      { label: "Memory & Media", href: "/diary/media" },
      { label: "Dear Future Me", href: "/diary/future" },
    ],
  },
  {
    id: "technical",
    label: "Technical",
    href: "/technical",
    icon: "technical",
    sections: [
      { label: "DSA", href: "/technical/dsa" },
      { label: "Problem Journal", href: "/technical/problems" },
      { label: "System Design", href: "/technical/design" },
      { label: "CS Fundamentals", href: "/technical/fundamentals" },
      { label: "Coding Practice", href: "/technical/sessions" },
      { label: "Learning Notes", href: "/technical/notes" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    href: "/ai",
    icon: "ai",
    sections: [
      { label: "Ask My Journey", href: "/ai/ask" },
      { label: "Personal Coach", href: "/ai/coach" },
      { label: "Mock Interviewer", href: "/ai/interview" },
      { label: "Weekly Reflection", href: "/ai/weekly" },
      { label: "Progress Analysis", href: "/ai/progress" },
      { label: "Learning Insights", href: "/ai/insights" },
    ],
  },
  {
    id: "more",
    label: "More",
    href: "/more",
    icon: "more",
    sections: [
      // Listed so `/more` itself resolves to an area, the same way Journey
      // lists Home for `/`.
      { label: "Overview", href: "/more" },
      { label: "Search", href: "/search" },
      { label: "Tags", href: "/tags" },
      { label: "Bookmarks", href: "/bookmarks" },
      { label: "Analytics", href: "/analytics" },
      { label: "Settings", href: "/settings" },
    ],
  },
];

/**
 * The area a path belongs to. Matches on the longest section href so that
 * `/journey/timeline` resolves to Journey rather than falling through to the
 * `/` home route.
 */
export function activeArea(pathname: string): NavArea | undefined {
  let best: { area: NavArea; length: number } | undefined;

  for (const area of NAV_AREAS) {
    for (const section of area.sections) {
      const matches =
        section.href === "/"
          ? pathname === "/"
          : pathname === section.href ||
            pathname.startsWith(`${section.href}/`);

      if (matches && (!best || section.href.length > best.length)) {
        best = { area, length: section.href.length };
      }
    }
  }

  return best?.area;
}

/** Whether a nav link should render as current. */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
