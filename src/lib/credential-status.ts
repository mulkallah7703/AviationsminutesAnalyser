export type CredentialFieldStatus = {
  key: string;
  secret: boolean;
  set: boolean;
  hint: string | null;
  /** Full value for non-secret fields marked reveal. Secrets stay null. */
  value: string | null;
  /** Env wins over a value saved in the admin form. */
  source: "env" | "stored" | "empty";
  envVar: string | null;
};

export type CredentialStatus = {
  configured: boolean;
  fields: CredentialFieldStatus[];
};
