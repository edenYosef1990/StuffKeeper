import {
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, form, required, submit, validate } from '@angular/forms/signals';
import { Link } from './link.model';
import { LinkStore } from './link-store';
import { TitleResolver } from './title-resolver';
import { normalizeUrl, parseTags } from './url-utils';

interface LinkDraft {
  url: string;
  name: string;
  description: string;
  tags: string;
}

const EMPTY_DRAFT: LinkDraft = { url: '', name: '', description: '', tags: '' };

@Component({
  selector: 'app-link-editor',
  imports: [FormField],
  templateUrl: './link-editor.html',
  styleUrl: './link-editor.css',
  host: {
    '(window:focus)': 'checkClipboard()',
    '(document:paste)': 'onDocumentPaste($event)',
  },
})
export class LinkEditor {
  private readonly store = inject(LinkStore);
  private readonly titles = inject(TitleResolver);
  private readonly urlInput = viewChild.required<ElementRef<HTMLInputElement>>('urlInput');

  /** The link being edited, or null when adding a new one. */
  readonly editing = model<Link | null>(null);

  protected readonly draft = signal<LinkDraft>({ ...EMPTY_DRAFT });
  protected readonly linkForm = form(this.draft, (path) => {
    required(path.url, { message: 'A URL is required.' });
    validate(path.url, ({ value }) =>
      value().trim() && !normalizeUrl(value())
        ? { kind: 'url', message: 'Enter a valid web address starting with http:// or https://.' }
        : null,
    );
    required(path.name, { message: 'A name is required.' });
  });

  protected readonly resolvingName = signal(false);
  protected readonly clipboardUrl = signal<string | null>(null);
  protected readonly status = signal('');

  private autoName = '';
  private nameRequest = 0;
  private readonly dismissedClipboardUrls = new Set<string>();

  constructor() {
    effect(() => {
      const link = this.editing();
      untracked(() => {
        this.autoName = '';
        this.linkForm().reset(
          link
            ? { url: link.url, name: link.name, description: link.description, tags: link.tags.join(', ') }
            : { ...EMPTY_DRAFT },
        );
      });
    });

    effect((onCleanup) => {
      const url = normalizeUrl(this.linkForm.url().value());
      if (!url) {
        return;
      }
      const timer = setTimeout(() => this.suggestName(url, false), 400);
      onCleanup(() => clearTimeout(timer));
    });

    afterNextRender(() => this.checkClipboard());
  }

  protected async suggestName(url: string, force: boolean): Promise<void> {
    const request = ++this.nameRequest;
    this.resolvingName.set(true);
    const title = await this.titles.resolve(url);
    if (request !== this.nameRequest) {
      return;
    }
    this.resolvingName.set(false);
    const current = this.draft().name.trim();
    if (force || !current || current === this.autoName) {
      this.autoName = title;
      this.draft.update((draft) => ({ ...draft, name: title }));
    }
  }

  protected refreshName(): void {
    const url = normalizeUrl(this.draft().url);
    if (url) {
      this.suggestName(url, true);
    }
  }

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.linkForm, async () => {
      const draft = this.draft();
      const input = {
        url: normalizeUrl(draft.url) ?? draft.url,
        name: draft.name,
        description: draft.description,
        tags: parseTags(draft.tags),
      };
      const editing = this.editing();
      if (editing) {
        this.store.update(editing.id, input);
        this.status.set(`Saved changes to “${input.name.trim()}”.`);
      } else {
        this.store.add(input);
        this.status.set(`Added “${input.name.trim()}”.`);
      }
      this.clear();
    });
  }

  protected clear(): void {
    this.nameRequest++;
    this.resolvingName.set(false);
    this.autoName = '';
    this.linkForm().reset({ ...EMPTY_DRAFT });
    this.editing.set(null);
  }

  protected async pasteFromClipboard(): Promise<void> {
    try {
      const url = normalizeUrl(await navigator.clipboard.readText());
      if (url) {
        this.useUrl(url);
      } else {
        this.status.set('The clipboard does not contain a link.');
      }
    } catch {
      this.status.set('Clipboard access was blocked. Paste the link with Ctrl+V instead.');
    }
  }

  protected useClipboardUrl(): void {
    const url = this.clipboardUrl();
    if (url) {
      this.useUrl(url);
    }
  }

  protected dismissClipboardUrl(): void {
    const url = this.clipboardUrl();
    if (url) {
      this.dismissedClipboardUrls.add(url);
    }
    this.clipboardUrl.set(null);
  }

  /** Silently offers a link found in the clipboard, only when read permission was already granted. */
  protected async checkClipboard(): Promise<void> {
    try {
      const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      if (permission.state !== 'granted') {
        return;
      }
      const url = normalizeUrl(await navigator.clipboard.readText());
      if (
        url &&
        !this.dismissedClipboardUrls.has(url) &&
        !this.store.hasUrl(url) &&
        url !== normalizeUrl(this.draft().url)
      ) {
        this.clipboardUrl.set(url);
      }
    } catch {
      // Clipboard permission queries are not supported in every browser.
    }
  }

  protected onDocumentPaste(event: ClipboardEvent): void {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    const url = normalizeUrl(event.clipboardData?.getData('text') ?? '');
    if (url) {
      event.preventDefault();
      this.useUrl(url);
    }
  }

  private useUrl(url: string): void {
    this.dismissedClipboardUrls.add(url);
    this.clipboardUrl.set(null);
    if (!this.editing()) {
      this.autoName = '';
      this.linkForm().reset({ ...EMPTY_DRAFT, url });
    } else {
      this.draft.update((draft) => ({ ...draft, url }));
    }
    this.status.set(
      this.store.hasUrl(url) && !this.editing() ? 'Note: this link is already saved.' : '',
    );
    this.urlInput().nativeElement.focus();
  }
}
