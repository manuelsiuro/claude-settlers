let snackbar: HTMLElement;
let snackbarTimeout: ReturnType<typeof setTimeout> | null = null;

export function initSnackbar(): void {
  snackbar = document.getElementById('snackbar')!;
}

export function showSnackbar(message: string, type?: 'success' | 'warning' | 'error' | 'info'): void {
  snackbar.textContent = message;
  snackbar.className = 'snackbar';
  if (type === 'success') snackbar.classList.add('snackbar-success');
  else if (type === 'warning') snackbar.classList.add('snackbar-warning');
  else if (type === 'error') snackbar.classList.add('snackbar-error');
  snackbar.classList.add('show');
  if (snackbarTimeout) clearTimeout(snackbarTimeout);
  snackbarTimeout = setTimeout(() => {
    snackbar.classList.remove('show');
    snackbarTimeout = null;
  }, 3000);
}
