"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { uploadEmployeeDocument, deleteEmployeeDocument, type UploadEmployeeDocumentState } from "./actions";

type Document = {
  id: string;
  file_name: string;
  document_type: string | null;
  storage_path: string;
  uploaded_at: string;
  downloadUrl: string | null;
};

export function EmployeeDocumentsPanel({
  employeeId,
  documents,
  canManage,
}: {
  employeeId: string;
  documents: Document[];
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(
    (prevState: UploadEmployeeDocumentState, formData: FormData) =>
      uploadEmployeeDocument(employeeId, prevState, formData),
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      {documents.length > 0 ? (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between border-b border-border pb-2 last:border-b-0">
              <div className="flex flex-col gap-0.5">
                {doc.downloadUrl ? (
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-bold text-primary"
                  >
                    {doc.file_name}
                  </a>
                ) : (
                  <span className="text-[13px] font-bold text-ink">{doc.file_name}</span>
                )}
                <span className="text-[12px] text-ink-soft">
                  {doc.document_type ?? "Uncategorised"} · {new Date(doc.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              {canManage && (
                <form action={deleteEmployeeDocument.bind(null, doc.id, doc.storage_path)}>
                  <button type="submit" className="text-[12px] font-bold text-bad">
                    Delete
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-soft">No documents uploaded yet.</p>
      )}

      {canManage && (
        <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-3">
          <FormError message={state?.error} />
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="file">
              File
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <FormField label="Document type" name="document_type" required={false} />
          <SubmitButton>Upload document</SubmitButton>
        </form>
      )}
    </div>
  );
}
