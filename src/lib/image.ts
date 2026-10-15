export function extractDriveId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const matchFile = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) return matchFile[1];
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];
  return null;
}

export function formatDriveUrl(url?: string): string {
  if (!url) return "";
  const id = extractDriveId(url);
  if (id) {
    return `https://lh3.googleusercontent.com/d/${id}=w1000`;
  }
  return url.trim();
}
