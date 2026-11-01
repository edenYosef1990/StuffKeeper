/** Returns a usable http(s) URL from free text, or null if the text is not a link. */
export function normalizeUrl(text: string): string | null {
  const value = text.trim();
  if (/^www\.\S+\.\S+$/i.test(value)) {
    return normalizeUrl(`https://${value}`);
  }
  if (!/^https?:\/\/\S+$/i.test(value)) {
    return null;
  }
  try {
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

export function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : (parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1] ?? null);
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Fallback name built from the URL itself, e.g. "My article – example.com". */
export function nameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    if (!segment) {
      return host;
    }
    const words = decodeURIComponent(segment)
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_+]+/g, ' ')
      .trim();
    return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)} – ${host}` : host;
  } catch {
    return url;
  }
}

export function parseTags(text: string): string[] {
  return normalizeTags(text.split(','));
}

export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}
