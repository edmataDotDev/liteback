/**
 * pg v8+ warns when `sslmode` is require/prefer/verify-ca without opting in to future
 * libpq semantics. Those modes are currently treated like verify-full; set it explicitly
 * so the driver stops emitting the deprecation warning.
 *
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizeDatabaseUrlForPgSslWarning(
  connectionString: string,
): string {
  try {
    const u = new URL(connectionString);
    if (u.searchParams.get('uselibpqcompat') === 'true') {
      return connectionString;
    }
    const mode = u.searchParams.get('sslmode')?.toLowerCase();
    if (mode === 'require' || mode === 'prefer' || mode === 'verify-ca') {
      u.searchParams.set('sslmode', 'verify-full');
      return u.toString();
    }
    return connectionString;
  } catch {
    return connectionString;
  }
}
