export type DocumentFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; formError: string };

export const initialDocumentFormState: DocumentFormState = { status: "idle" };
