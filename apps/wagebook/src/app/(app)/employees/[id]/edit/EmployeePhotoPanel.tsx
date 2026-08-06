"use client";

import { useActionState, useId } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { uploadEmployeePhoto, removeEmployeePhoto, type UploadEmployeePhotoState } from "./actions";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M12 15V4M12 4 8 8M12 4l4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function EmployeePhotoPanel({
  employeeId,
  photoUrl,
  photoPath,
  initials,
  canManage,
}: {
  employeeId: string;
  photoUrl: string | null;
  photoPath: string | null;
  initials: string;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(
    (prevState: UploadEmployeePhotoState, formData: FormData) => uploadEmployeePhoto(employeeId, prevState, formData),
    null,
  );
  const fileInputId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <label
          htmlFor={canManage ? fileInputId : undefined}
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg ${canManage ? "cursor-pointer" : ""}`}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, expires shortly; not a static asset next/image can optimize.
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[16px] font-extrabold text-ink-soft">{initials}</span>
          )}
          {canManage && (
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-white">
              <UploadIcon />
            </span>
          )}
        </label>
        {canManage && photoPath && (
          <ConfirmActionButton
            action={removeEmployeePhoto.bind(null, employeeId, photoPath)}
            label="Remove photo"
            confirmTitle="Remove this photo?"
            confirmMessage="The profile photo will be removed. This can't be undone."
            confirmLabel="Remove"
          />
        )}
      </div>

      {canManage && (
        <form action={formAction} className="flex flex-col gap-2">
          <FormError message={state?.error} />
          <input
            id={fileInputId}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          />
          <SubmitButton>{photoPath ? "Replace photo" : "Upload photo"}</SubmitButton>
        </form>
      )}
    </div>
  );
}
