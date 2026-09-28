export type WorkspaceResourceFormState =
  | { status: "idle" }
  | {
      status: "error";
      name: string;
      fieldError?: string;
      formError?: string;
    };

export type WorkspaceDeleteFormState =
  | { status: "idle" }
  | { status: "error"; formError: string };

export const initialWorkspaceResourceFormState: WorkspaceResourceFormState = {
  status: "idle",
};

export const initialWorkspaceDeleteFormState: WorkspaceDeleteFormState = {
  status: "idle",
};
