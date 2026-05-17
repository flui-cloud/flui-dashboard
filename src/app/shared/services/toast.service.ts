import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  routerLink?: string | unknown[];
  onClick?: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  action?: ToastAction;
  persistent: boolean;
}

export interface ToastInput {
  title?: string;
  message: string;
  action?: ToastAction;
  persistent?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  private nextId = 1;

  showInfo(input: ToastInput | string): number {
    return this.show('info', this.normalize(input));
  }

  showSuccess(input: ToastInput | string): number {
    return this.show('success', this.normalize(input));
  }

  showWarning(input: ToastInput | string): number {
    return this.show('warning', this.normalize(input));
  }

  showError(input: ToastInput | string): number {
    return this.show('error', this.normalize(input));
  }

  dismiss(id: number): void {
    this.toastsSignal.update(curr => curr.filter(t => t.id !== id));
  }

  clear(): void {
    this.toastsSignal.set([]);
  }

  private show(kind: ToastKind, input: ToastInput): number {
    const id = this.nextId++;
    const toast: Toast = {
      id,
      kind,
      title: input.title,
      message: input.message,
      action: input.action,
      persistent: !!input.persistent,
    };
    this.toastsSignal.update(curr => [...curr, toast]);
    if (!toast.persistent) {
      setTimeout(() => this.dismiss(id), 5000);
    }
    return id;
  }

  private normalize(input: ToastInput | string): ToastInput {
    return typeof input === 'string' ? { message: input } : input;
  }
}
