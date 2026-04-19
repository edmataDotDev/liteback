export type AccessTokenPayload = {
  sub: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  nbf?: number;
  exp?: number;
};
