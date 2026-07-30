import type { ContractStatus, ProbationStatus } from "@/lib/format";

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

export function BankDetailsBadge({ bankAccountNumber }: { bankAccountNumber: string | null }) {
  return bankAccountNumber ? <Badge tone="good">On file</Badge> : <Badge tone="neutral">Missing</Badge>;
}

export function EmployeeStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge tone="good">Active</Badge>;
  if (status === "suspended") return <Badge tone="warn">Suspended</Badge>;
  return <Badge tone="neutral">Terminated</Badge>;
}

export function ProbationBadge({ status }: { status: ProbationStatus }) {
  switch (status) {
    case "confirmed":
      return <Badge tone="good">Confirmed</Badge>;
    case "overdue":
      return <Badge tone="bad">Overdue</Badge>;
    case "ends_soon":
      return <Badge tone="warn">Ends soon</Badge>;
    case "on_probation":
      return <Badge tone="neutral">On probation</Badge>;
    case "none":
      return <span className="text-ink-soft">—</span>;
  }
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  switch (status) {
    case "permanent":
      return <Badge tone="neutral">Permanent</Badge>;
    case "expired":
      return <Badge tone="bad">Expired</Badge>;
    case "ends_soon":
      return <Badge tone="warn">Ends soon</Badge>;
    case "active":
      return <Badge tone="good">Active contract</Badge>;
    case "none":
      return <span className="text-ink-soft">—</span>;
  }
}

export function PayRunStatusBadge({ status }: { status: string }) {
  if (status === "draft") return <Badge tone="warn">Draft</Badge>;
  if (status === "reversed") return <Badge tone="bad">Reversed</Badge>;
  return <Badge tone="good">Posted</Badge>;
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

const LEAVE_ENCASHMENT_STATUS_TONE = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  paid: "neutral",
} as const;

export function LeaveEncashmentStatusBadge({ status }: { status: string }) {
  const tone = LEAVE_ENCASHMENT_STATUS_TONE[status as keyof typeof LEAVE_ENCASHMENT_STATUS_TONE] ?? "neutral";
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

const VENDOR_BILL_STATUS_TONE = {
  pending_approval: "warn",
  approved: "good",
  rejected: "bad",
  paid: "neutral",
} as const;

const VENDOR_BILL_STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export function VendorBillStatusBadge({ status }: { status: string }) {
  const tone = VENDOR_BILL_STATUS_TONE[status as keyof typeof VENDOR_BILL_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{VENDOR_BILL_STATUS_LABEL[status] ?? status}</Badge>;
}

const CUSTOMER_INVOICE_STATUS_TONE = {
  draft: "neutral",
  issued: "warn",
  paid: "good",
  void: "bad",
} as const;

const CUSTOMER_INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued — awaiting payment",
  paid: "Paid",
  void: "Void",
};

export function CustomerInvoiceStatusBadge({ status }: { status: string }) {
  const tone = CUSTOMER_INVOICE_STATUS_TONE[status as keyof typeof CUSTOMER_INVOICE_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{CUSTOMER_INVOICE_STATUS_LABEL[status] ?? status}</Badge>;
}

const RECONCILIATION_STATUS_TONE = {
  in_progress: "warn",
  completed: "good",
} as const;

const RECONCILIATION_STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
};

export function ReconciliationStatusBadge({ status }: { status: string }) {
  const tone = RECONCILIATION_STATUS_TONE[status as keyof typeof RECONCILIATION_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{RECONCILIATION_STATUS_LABEL[status] ?? status}</Badge>;
}

const FIXED_ASSET_STATUS_TONE = {
  active: "good",
  disposed: "neutral",
} as const;

export function FixedAssetStatusBadge({ status }: { status: string }) {
  const tone = FIXED_ASSET_STATUS_TONE[status as keyof typeof FIXED_ASSET_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status === "active" ? "Active" : "Disposed"}</Badge>;
}
