export function wireMarkdown(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.md-copy-btn:not([data-wired])').forEach((btn) => {
    btn.dataset['wired'] = '';
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      if (btn.classList.contains('copied')) return;
      const code = btn.closest('.md-code-block')?.querySelector('code')?.textContent ?? '';
      if (!navigator.clipboard) {
        flashError(btn);
        return;
      }
      navigator.clipboard.writeText(code).then(
        () => flashSuccess(btn),
        () => flashError(btn),
      );
    });
  });
  container.querySelectorAll<HTMLAnchorElement>('a[href]:not([data-ext-wired])').forEach((a) => {
    if (a.href.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset['extWired'] = '';
    }
  });
}

function flashSuccess(btn: HTMLElement): void {
  btn.textContent = 'Copied!';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }, 2000);
}

function flashError(btn: HTMLElement): void {
  btn.textContent = 'Error';
  setTimeout(() => {
    btn.textContent = 'Copy';
  }, 1500);
}
