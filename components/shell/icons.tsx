import type { NavArea } from "@/lib/navigation";

/**
 * Navigation icons. Line drawings on a 24px grid, 1.5px stroke, currentColor —
 * they inherit the active state from their link rather than carrying colour.
 */

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** A path — the journey. */
function JourneyIcon() {
  return (
    <svg {...common} className="size-5">
      <path d="M5 20c0-4 4-5 7-7s3-5 0-6-5 1-5 1" />
      <circle cx="6" cy="20" r="1.5" />
      <circle cx="17" cy="5" r="1.5" />
    </svg>
  );
}

/** An open book. */
function DiaryIcon() {
  return (
    <svg {...common} className="size-5">
      <path d="M12 6.5C10.5 5.2 8.6 4.5 6 4.5H3.5v13H6c2.6 0 4.5.7 6 2" />
      <path d="M12 6.5c1.5-1.3 3.4-2 6-2h2.5v13H18c-2.6 0-4.5.7-6 2" />
      <path d="M12 6.5v15" />
    </svg>
  );
}

/** Angle brackets. */
function TechnicalIcon() {
  return (
    <svg {...common} className="size-5">
      <path d="M8.5 8.5L5 12l3.5 3.5" />
      <path d="M15.5 8.5L19 12l-3.5 3.5" />
      <path d="M13.5 5.5l-3 13" />
    </svg>
  );
}

/** A spark — used for AI everywhere in the product. */
function AiIcon() {
  return (
    <svg {...common} className="size-5">
      <path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg {...common} className="size-5">
      <circle cx="5.5" cy="12" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="18.5" cy="12" r="1.25" />
    </svg>
  );
}

const icons: Record<NavArea["icon"], () => React.JSX.Element> = {
  journey: JourneyIcon,
  diary: DiaryIcon,
  technical: TechnicalIcon,
  ai: AiIcon,
  more: MoreIcon,
};

export function NavIcon({ name }: { name: NavArea["icon"] }) {
  const Icon = icons[name];
  return <Icon />;
}
