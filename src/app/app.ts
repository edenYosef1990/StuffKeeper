import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <header class="app-header">
      <h1>StuffKeeper</h1>
      <p>Keep your links, named, described and tagged.</p>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
})
export class App {}
