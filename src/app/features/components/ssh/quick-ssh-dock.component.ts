import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTerminal, lucideMaximize2, lucideX } from '@ng-icons/lucide';
import { QuickSshService } from '../../service/quick-ssh.service';

@Component({
  selector: 'app-quick-ssh-dock',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideTerminal, lucideMaximize2, lucideX })],
  template: `
    @if (sshService.isMinimized()) {
      <div class="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border shadow-lg cursor-pointer hover:bg-muted transition-colors"
           (click)="sshService.restore()">
        <ng-icon name="lucideTerminal" class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

        @if (sshService.activeSession(); as session) {
          <div class="flex items-center gap-1.5">
            <div class="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse"></div>
            <span class="text-xs font-medium text-foreground max-w-[160px] truncate">{{ session.serverName }}</span>
          </div>
        } @else {
          <span class="text-xs font-medium text-foreground">SSH Terminal</span>
        }

        <div class="flex items-center gap-0.5 ml-1">
          <button
            (click)="$event.stopPropagation(); sshService.restore()"
            class="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Restore">
            <ng-icon name="lucideMaximize2" class="h-3 w-3" />
          </button>
          <button
            (click)="$event.stopPropagation(); sshService.close()"
            class="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Close">
            <ng-icon name="lucideX" class="h-3 w-3" />
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class QuickSshDockComponent {
  protected readonly sshService = inject(QuickSshService);
}
