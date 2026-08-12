// A small, hand-authored set of line icons for sidebar navigation and
// dashboard widgets — no icon-library dependency, matching how the
// chevron/hamburger/close icons in SidebarNav.tsx and AppShell.tsx are
// already drawn inline. Every icon shares the same 20x20 viewBox and
// stroke weight so they sit consistently at any size the caller passes.
type IconProps = { className?: string };

const DEFAULT_CLASS = "h-4 w-4 shrink-0";

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? DEFAULT_CLASS}
    >
      {children}
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </Svg>
  );
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 3h10v14l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V3z" />
      <path d="M7.5 7h5M7.5 10h5" />
    </Svg>
  );
}

export function TargetIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" />
    </Svg>
  );
}

export function CapIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 4 2.5 8 10 12l7.5-4L10 4z" />
      <path d="M5.5 9.7v3.4c0 1 2 2.1 4.5 2.1s4.5-1.1 4.5-2.1V9.7" />
    </Svg>
  );
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="7.2" cy="7" r="2.4" />
      <path d="M2.8 16c0-2.6 2-4.2 4.4-4.2s4.4 1.6 4.4 4.2" />
      <circle cx="14" cy="7.5" r="1.9" />
      <path d="M12.6 11.9c1.9.2 3.6 1.6 3.6 4.1" />
    </Svg>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="3" width="9" height="14" rx="1" />
      <path d="M13 8h3v9h-3M6.5 6.2h1.5M11 6.2h1.5M6.5 9.2h1.5M11 9.2h1.5M6.5 12.2h1.5M11 12.2h1.5" />
    </Svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 3 3 7l7 4 7-4-7-4z" />
      <path d="M3 10.5 10 14.5 17 10.5M3 13.8 10 17.8 17 13.8" />
    </Svg>
  );
}

export function HierarchyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="7.3" y="2.8" width="5.4" height="3.6" rx="0.8" />
      <rect x="2.5" y="13.6" width="5.4" height="3.6" rx="0.8" />
      <rect x="12.1" y="13.6" width="5.4" height="3.6" rx="0.8" />
      <path d="M10 6.4v3.2M5.2 13.6v-2.4h9.6v2.4" />
    </Svg>
  );
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2.8" y="6.5" width="14.4" height="9.5" rx="1.2" />
      <path d="M7 6.5V4.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3V6.5" />
      <path d="M2.8 10.5h14.4" />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 2.8 16 5v5c0 4-2.6 6.6-6 7.2-3.4-.6-6-3.2-6-7.2V5l6-2.2z" />
      <path d="M7.3 9.6l1.9 1.9 3.5-3.9" />
    </Svg>
  );
}

export function BanknoteIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="6" width="15" height="9" rx="1.4" />
      <circle cx="10" cy="10.5" r="2.2" />
      <path d="M5 6v9M15 6v9" />
    </Svg>
  );
}

export function DoorExitIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 3H5.5v14H9" />
      <path d="M9 10h8m0 0-2.6-2.6M17 10l-2.6 2.6" />
    </Svg>
  );
}

export function BarChartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 16.5v-6M9.5 16.5v-10M15.5 16.5v-3.5" />
      <path d="M2.5 16.5h15" />
    </Svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 6h8M14.5 6H17M3 10h4.5M10.5 10H17M3 14h9.5M16 14H17" />
      <circle cx="10.5" cy="6" r="1.4" />
      <circle cx="8" cy="10" r="1.4" />
      <circle cx="14" cy="14" r="1.4" />
    </Svg>
  );
}

export function TruckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="6" width="9" height="7.5" rx="1" />
      <path d="M11.5 8.5h3l2 2.5v2.5h-5v-5z" />
      <circle cx="6" cy="14.8" r="1.4" />
      <circle cx="14" cy="14.8" r="1.4" />
    </Svg>
  );
}

export function PersonCardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.4" />
      <circle cx="7.3" cy="9.3" r="1.8" />
      <path d="M4.5 13.5c0-1.6 1.3-2.5 2.8-2.5s2.8.9 2.8 2.5" />
      <path d="M12.5 8.3h3M12.5 11.3h3" />
    </Svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 5.5h9.5M7 10h9.5M7 14.5h9.5" />
      <circle cx="3.5" cy="5.5" r="0.9" fill="currentColor" />
      <circle cx="3.5" cy="10" r="0.9" fill="currentColor" />
      <circle cx="3.5" cy="14.5" r="0.9" fill="currentColor" />
    </Svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 5.3C8.8 4.2 6.9 3.6 4 3.6v11.3c2.9 0 4.8.6 6 1.7M10 5.3c1.2-1.1 3.1-1.7 6-1.7v11.3c-2.9 0-4.8.6-6 1.7V5.3z" />
    </Svg>
  );
}

export function ColumnsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2.8 7.2 10 3l7.2 4.2" />
      <path d="M3.5 7.2h13v8.3h-13z" />
      <path d="M6.3 9.5v3.7M10 9.5v3.7M13.7 9.5v3.7" />
    </Svg>
  );
}

export function BoxIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 3 17 6.5 10 10 3 6.5 10 3z" />
      <path d="M3 6.5v7L10 17l7-3.5v-7" />
      <path d="M10 10v7" />
    </Svg>
  );
}

export function TrendDownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 5.5 8.2 11l3-3L17 14.5" />
      <path d="M12.5 14.5H17v-4.5" />
    </Svg>
  );
}

export function PieChartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 3v7l5.5 3.2" />
      <circle cx="10" cy="10" r="7" />
    </Svg>
  );
}

export function CoinsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <ellipse cx="7.5" cy="6" rx="4.5" ry="2.4" />
      <path d="M3 6v3.2c0 1.3 2 2.4 4.5 2.4s4.5-1.1 4.5-2.4V6" />
      <path d="M3 9.2v3.2c0 1.3 2 2.4 4.5 2.4.9 0 1.7-.1 2.4-.4" />
      <ellipse cx="13.2" cy="12" rx="4.3" ry="2.2" />
    </Svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4.3" width="14" height="12.2" rx="1.4" />
      <path d="M3 8h14M6.5 2.8v3M13.5 2.8v3" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="10.5" r="6.7" />
      <path d="M10 6.8v3.7l2.6 1.6" />
    </Svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 16.2 4 10.6c-1.6-1.6-1.6-4 0-5.5 1.5-1.4 3.7-1.3 5.1.2l.9.9.9-.9c1.4-1.5 3.6-1.6 5.1-.2 1.6 1.5 1.6 3.9 0 5.5L10 16.2z" />
    </Svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 8.5c0-2.5 1.6-4.5 4-4.5s4 2 4 4.5c0 3.7 1.3 4.7 1.3 4.7H4.7S6 12.2 6 8.5z" />
      <path d="M8.3 15.8c.3.9 1 1.4 1.7 1.4s1.4-.5 1.7-1.4" />
    </Svg>
  );
}

export function CalculatorIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="2.8" width="12" height="14.4" rx="1.4" />
      <path d="M6.2 5.8h7.6M6.2 9h1.7M9.9 9h1.7M13.6 9v6.2M6.2 12.2h1.7M9.9 12.2h1.7M6.2 15.4h1.7M9.9 15.4h1.7" />
    </Svg>
  );
}

export function MapIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 4 3 5.5v10.7L7 14.7m0-10.7 6 2m-6-2v10.7m6-8.7 4-1.5v10.7L13 17m0-10.7v10.7m0-10.7-6-2" />
    </Svg>
  );
}

export function PlugIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 2.8v3.4M13 2.8v3.4" />
      <path d="M5 6.2h10v3c0 2.9-2.2 5.2-5 5.2s-5-2.3-5-5.2v-3z" />
      <path d="M10 14.4v2.8" />
    </Svg>
  );
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 10a6.5 6.5 0 1 1 2 4.7" />
      <path d="M2.8 7.3 3.5 10l2.7-.9" />
      <path d="M10 6.5v3.8l2.8 1.7" />
    </Svg>
  );
}
