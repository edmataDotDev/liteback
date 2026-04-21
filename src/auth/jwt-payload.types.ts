export type AccessTokenPayload = {
  sub: string;
  /** PK de `sessions`; obligatorio en tokens emitidos tras login/refresh. */
  sessionId: number;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  nbf?: number;
  exp?: number;
};
