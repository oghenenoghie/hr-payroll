"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { uploadCourseMaterial, deleteCourseMaterial, type UploadCourseMaterialState } from "../actions";

type Material = {
  id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  downloadUrl: string | null;
};

export function CourseMaterialsPanel({ courseId, materials }: { courseId: string; materials: Material[] }) {
  const [state, formAction] = useActionState(
    (prevState: UploadCourseMaterialState, formData: FormData) => uploadCourseMaterial(courseId, prevState, formData),
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      {materials.length > 0 ? (
        <div className="flex flex-col gap-2">
          {materials.map((material) => (
            <div key={material.id} className="flex items-center justify-between border-b border-border pb-2 last:border-b-0">
              <div className="flex flex-col gap-0.5">
                {material.downloadUrl ? (
                  <a
                    href={material.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-bold text-primary"
                  >
                    {material.file_name}
                  </a>
                ) : (
                  <span className="text-[13px] font-bold text-ink">{material.file_name}</span>
                )}
                <span className="text-[12px] text-ink-soft">
                  {new Date(material.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              <ConfirmActionButton
                action={deleteCourseMaterial.bind(null, material.id, material.storage_path)}
                label="Delete"
                confirmTitle="Delete this file?"
                confirmMessage={`"${material.file_name}" will be permanently deleted.`}
                confirmLabel="Delete"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-soft">No files attached yet.</p>
      )}

      <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-3">
        <FormError message={state?.error} />
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor={`file-${courseId}`}>
            File (20MB max)
          </label>
          <input
            id={`file-${courseId}`}
            name="file"
            type="file"
            required
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <SubmitButton>Upload file</SubmitButton>
      </form>
    </div>
  );
}
