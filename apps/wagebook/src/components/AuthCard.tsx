"use client";

import { useFormStatus } from "react-dom";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px] rounded-container border border-border bg-surface p-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Plutus Technologies</span>
        <h1 className="mt-1 text-[20px] font-extrabold text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  // Pass value+onChange (instead of defaultValue) on a form where a failed
  // submission needs to preserve what was typed — React resets uncontrolled
  // fields once a form action settles, success or not, so an uncontrolled
  // field on a long form silently throws away everything on one bad field.
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        {...(onChange ? { value: value ?? "", onChange } : { defaultValue })}
        className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
      />
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-50"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-panel border border-bad bg-bad-tint px-3 py-2 text-[12.5px] font-bold text-bad">
      {message}
    </div>
  );
}

export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-panel border border-good bg-good-tint px-3 py-2 text-[12.5px] font-bold text-good">
      {message}
    </div>
  );
}
