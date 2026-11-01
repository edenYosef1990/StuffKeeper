import { Service, computed, signal } from '@angular/core';
import { Link, LinkInput } from './link.model';
import { nameFromUrl, normalizeTags, normalizeUrl } from './url-utils';

const STORAGE_KEY = 'stuffkeeper.links';

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

@Service()
export class LinkStore {
  private readonly state = signal<Link[]>(loadLinks());

  readonly links = computed(() =>
    [...this.state()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  readonly allTags = computed(() =>
    normalizeTags(this.state().flatMap((link) => link.tags)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  hasUrl(url: string): boolean {
    return this.state().some((link) => link.url === url);
  }

  add(input: LinkInput): void {
    const link: Link = {
      ...cleanInput(input),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.commit([...this.state(), link]);
  }

  update(id: string, input: LinkInput): void {
    this.commit(
      this.state().map((link) => (link.id === id ? { ...link, ...cleanInput(input) } : link)),
    );
  }

  remove(id: string): void {
    this.commit(this.state().filter((link) => link.id !== id));
  }

  exportJson(): string {
    return JSON.stringify(
      { app: 'StuffKeeper', version: 1, exportedAt: new Date().toISOString(), links: this.state() },
      null,
      2,
    );
  }

  /** Merges links from a JSON export; links with an already-saved URL are updated. */
  importJson(json: string): ImportResult {
    const data: unknown = JSON.parse(json);
    const items = Array.isArray(data) ? data : (data as { links?: unknown } | null)?.links;
    if (!Array.isArray(items)) {
      throw new Error('The file does not contain a list of links.');
    }

    const links = [...this.state()];
    const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
    for (const item of items) {
      const imported = toLink(item);
      if (!imported) {
        result.skipped++;
        continue;
      }
      const index = links.findIndex((link) => link.url === imported.url);
      if (index >= 0) {
        links[index] = { ...imported, id: links[index].id };
        result.updated++;
      } else {
        links.push(links.some((link) => link.id === imported.id) ? { ...imported, id: crypto.randomUUID() } : imported);
        result.added++;
      }
    }
    this.commit(links);
    return result;
  }

  private commit(links: Link[]): void {
    this.state.set(links);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    } catch {
      // Storage may be full or unavailable (e.g. private mode); keep the in-memory state.
    }
  }
}

function cleanInput(input: LinkInput): LinkInput {
  return {
    url: input.url.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    tags: normalizeTags(input.tags),
  };
}

function loadLinks(): Link[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(data) ? data.map(toLink).filter((link) => link !== null) : [];
  } catch {
    return [];
  }
}

function toLink(value: unknown): Link | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const url = typeof record['url'] === 'string' ? normalizeUrl(record['url']) : null;
  if (!url) {
    return null;
  }
  const text = (key: string) => (typeof record[key] === 'string' ? record[key].trim() : '');
  const tags = Array.isArray(record['tags'])
    ? record['tags'].filter((tag): tag is string => typeof tag === 'string')
    : [];
  const createdAt = text('createdAt');
  return {
    id: text('id') || crypto.randomUUID(),
    url,
    name: text('name') || nameFromUrl(url),
    description: text('description'),
    tags: normalizeTags(tags),
    createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : new Date().toISOString(),
  };
}
