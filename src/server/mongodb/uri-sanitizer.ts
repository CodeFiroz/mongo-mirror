/**
 * Mask sensitive credentials from MongoDB connection strings
 */
export function sanitizeMongoUri(uri: string): string {
  if (!uri) return '';
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '••••••••';
    }
    return parsed.toString();
  } catch {
    // Fallback regex for standard and SRV connection strings
    return uri.replace(
      /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/i,
      '$1••••••••$3'
    );
  }
}
