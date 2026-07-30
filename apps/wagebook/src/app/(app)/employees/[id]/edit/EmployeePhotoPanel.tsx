"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { uploadEmployeePhoto, removeEmployeePhoto, type UploadEmployeePhotoState } from "./actions";

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, expires shortly; not a static asset next/image can optimize.
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[16px] font-extrabold text-ink-soft">{initials}</span>
          )}
        </div>
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
