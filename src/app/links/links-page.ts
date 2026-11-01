import { Component, inject, signal } from '@angular/core';
import { Link } from './link.model';
import { LinkEditor } from './link-editor';
import { LinkList } from './link-list';
import { LinkStore } from './link-store';

@Component({
  selector: 'app-links-page',
  imports: [LinkEditor, LinkList],
  template: `
    <div class="toolbar" role="group" aria-label="Backup">
      <button type="button" (click)="exportLinks()">Export JSON</button>
      <button type="button" (click)="fileInput.click()">Import JSON</button>
      <input
        #fileInput
        type="file"
        accept="application/json,.json"
        hidden
        (change)="importLinks(fileInput)"
      />
      <span class="status" role="status">{{ message() }}</span>
    </div>
    <app-link-editor [(editing)]="editing" />
    <app-link-list (edit)="startEdit($event)" />
  `,
  styles: `
    :host {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(20rem, 26rem) minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      gap: 1rem 1.25rem;
    }

    .toolbar {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    @media (max-width: 760px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: auto;
      }
    }
  `,
})
export default class LinksPage {
  private readonly store = inject(LinkStore);

  protected readonly editing = signal<Link | null>(null);
  protected readonly message = signal('');

  protected startEdit(link: Link): void {
    this.editing.set(link);
    document.getElementById('link-url')?.focus();
  }

  protected exportLinks(): void {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `stuffkeeper-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.message.set('Links exported.');
  }

  protected async importLinks(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    try {
      const { added, updated, skipped } = this.store.importJson(await file.text());
      this.message.set(
        `Imported: ${added} added, ${updated} updated` + (skipped ? `, ${skipped} invalid skipped.` : '.'),
      );
    } catch {
      this.message.set('Import failed: the file is not a valid StuffKeeper JSON export.');
    }
  }
}
