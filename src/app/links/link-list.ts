import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Link } from './link.model';
import { LinkStore } from './link-store';
import { parseTags, youtubeId } from './url-utils';

// Must match the .link height and .links gap in link-list.css.
const ROW_HEIGHT = 116;
const ROW_GAP = 8;

interface LinkView extends Link {
  thumbnail: string | null;
}

@Component({
  selector: 'app-link-list',
  imports: [FormField, NgOptimizedImage],
  templateUrl: './link-list.html',
  styleUrl: './link-list.css',
})
export class LinkList {
  private readonly store = inject(LinkStore);

  readonly edit = output<Link>();

  protected readonly criteria = signal({ name: '', description: '', tags: '' });
  protected readonly searchForm = form(this.criteria);
  protected readonly allTags = this.store.allTags;

  protected readonly results = computed<LinkView[]>(() => {
    const { name, description, tags } = this.criteria();
    const nameQuery = name.trim().toLowerCase();
    const descriptionQuery = description.trim().toLowerCase();
    const tagQuery = parseTags(tags).map((tag) => tag.toLowerCase());

    return this.store
      .links()
      .filter(
        (link) =>
          (!nameQuery ||
            link.name.toLowerCase().includes(nameQuery) ||
            link.url.toLowerCase().includes(nameQuery)) &&
          (!descriptionQuery || link.description.toLowerCase().includes(descriptionQuery)) &&
          tagQuery.every((query) => link.tags.some((tag) => tag.toLowerCase().includes(query))),
      )
      .map((link) => {
        const videoId = youtubeId(link.url);
        return { ...link, thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : null };
      });
  });

  protected readonly total = computed(() => this.store.links().length);
  protected readonly hasCriteria = computed(() => Object.values(this.criteria()).some((v) => v.trim()));

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly viewportHeight = signal(0);

  protected readonly pageSize = computed(() =>
    Math.max(1, Math.floor((this.viewportHeight() + ROW_GAP) / (ROW_HEIGHT + ROW_GAP))),
  );
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.results().length / this.pageSize())),
  );
  private readonly requestedPage = linkedSignal({ source: this.criteria, computation: () => 1 });
  protected readonly page = computed(() => Math.min(this.requestedPage(), this.pageCount()));
  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.results().slice(start, start + this.pageSize());
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.viewport().nativeElement;
      const observer = new ResizeObserver(() => this.viewportHeight.set(element.clientHeight - 8));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected goToPage(page: number): void {
    this.requestedPage.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected addTagFilter(tag: string): void {
    const current = parseTags(this.criteria().tags);
    if (!current.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      this.criteria.update((c) => ({ ...c, tags: [...current, tag].join(', ') }));
    }
  }

  protected clearSearch(): void {
    this.criteria.set({ name: '', description: '', tags: '' });
  }

  protected remove(link: Link): void {
    if (confirm(`Delete “${link.name}”?`)) {
      this.store.remove(link.id);
    }
  }
}
