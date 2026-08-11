"use client";

import { useState } from "react";
import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { addWorkflowStep, type AddWorkflowStepState } from "./actions";

type ApproverKind = "role" | "reporting_manager" | "department_manager" | "specific_user";

export function WorkflowStepForm({
  members,
  roleLabels,
}: {
  members: { userId: string; role: string; email: string }[];
  roleLabels: Record<string, string>;
}) {
  const [state, formAction] = useActionState<AddWorkflowStepState, FormData>(addWorkflowStep, null);
  const [approverKind, setApproverKind] = useState<ApproverKind>("role");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:w-[100px]">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="step_order">
            Step
          </label>
          <input
            id="step_order"
            name="step_order"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-2 sm:w-[220px]">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="approver_kind">
            Approver
          </label>
          <select
            id="approver_kind"
            name="approver_kind"
            value={approverKind}
            onChange={(e) => setApproverKind(e.target.value as ApproverKind)}
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="role">A role</option>
            <option value="reporting_manager">Employee&apos;s reporting manager</option>
            <option value="department_manager">Employee&apos;s department manager</option>
            <option value="specific_user">A specific person</option>
          </select>
        </div>
        {approverKind === "role" && (
          <div className="flex flex-col gap-2 sm:flex-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="approver_role">
              Role
            </label>
            <select
              id="approver_role"
              name="approver_role"
              className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        {approverKind === "specific_user" && (
          <div className="flex flex-col gap-2 sm:flex-1">
            <label
              className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft"
              htmlFor="approver_user_id"
            >
              Person
            </label>
            <select
              id="approver_user_id"
              name="approver_user_id"
              className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
            >
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.email} ({roleLabels[member.role] ?? member.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <SubmitButton>Add step</SubmitButton>
      </div>
    </form>
  );
}
