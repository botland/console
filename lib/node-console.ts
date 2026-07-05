/** Browser URL for another appliance's management console. */
export function nodeConsoleUrl(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  return `http://${trimmed}`;
}