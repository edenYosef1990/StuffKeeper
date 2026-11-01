import { Service } from '@angular/core';
import { nameFromUrl, youtubeId } from './url-utils';

const TIMEOUT_MS = 6000;

/** Infers a human-friendly name for a link from the page it references. */
@Service()
export class TitleResolver {
  async resolve(url: string): Promise<string> {
    return (await this.fromOEmbed(url)) ?? (await this.fromPage(url)) ?? nameFromUrl(url);
  }

  // YouTube pages can't be fetched cross-origin, so use the CORS-enabled noembed.com oEmbed proxy.
  private async fromOEmbed(url: string): Promise<string | null> {
    if (!youtubeId(url)) {
      return null;
    }
    try {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        return null;
      }
      const data: unknown = await response.json();
      const title = (data as { title?: unknown } | null)?.title;
      return typeof title === 'string' && title.trim() ? title.trim() : null;
    } catch {
      return null;
    }
  }

  // Only succeeds for sites that allow cross-origin requests.
  private async fromPage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        credentials: 'omit',
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('html')) {
        return null;
      }
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const title =
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? doc.title;
      return title?.trim() || null;
    } catch {
      return null;
    }
  }
}
