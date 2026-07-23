const TONE_CLASSES = {
  good: "bg-good-tint text-good border-good",
  warn: "bg-warn-tint text-warn border-warn",
  bad: "bg-bad-tint text-bad border-bad",
  neutral: "bg-bg text-ink-soft border-border",
} as const;

export function Badge({
  tone,
  children,
}: {
  tone: keyof typeof TONE_CLASSES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-badge border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.03em] ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function TinBadge({ tin }: { tin: string | null }) {
  return tin ? <Badge tone="good">TIN valid</Badge> : <Badge tone="bad">TIN missing</Badge>;
}

export function EmployeeStatusBadge({ status }: { status: string }) {
  return status === "active" ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Terminated</Badge>;
}

const LOAN_STATUS_TONE = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  completed: "neutral",
} as const;

export function LoanStatusBadge({ status }: { status: string }) {
  const tone = LOAN_STATUS_TONE[status as keyof typeof LOAN_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

const EXPENSE_STATUS_TONE = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  paid: "neutral",
} as const;

export function ExpenseStatusBadge({ status }: { status: string }) {
  const tone = EXPENSE_STATUS_TONE[status as keyof typeof EXPENSE_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

const OVERTIME_STATUS_TONE = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  paid: "neutral",
} as const;

export function OvertimeStatusBadge({ status }: { status: string }) {
  const tone = OVERTIME_STATUS_TONE[status as keyof typeof OVERTIME_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

const LEAVE_STATUS_TONE = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  paid: "neutral",
} as const;

export function LeaveStatusBadge({ status }: { status: string }) {
  const tone = LEAVE_STATUS_TONE[status as keyof typeof LEAVE_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

const BENEFIT_ENROLLMENT_STATUS_TONE = {
  active: "good",
  cancelled: "neutral",
} as const;

export function BenefitEnrollmentStatusBadge({ status }: { status: string }) {
  const tone = BENEFIT_ENROLLMENT_STATUS_TONE[status as keyof typeof BENEFIT_ENROLLMENT_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
