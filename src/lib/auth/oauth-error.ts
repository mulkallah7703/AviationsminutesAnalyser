export class OAuthError extends Error {
  constructor(
    public code: string,
    public description = "",
  ) {
    super(code);
    this.name = "OAuthError";
  }
}
