let activeDialog = null;

export function showConfirmDialog({
  title,
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  danger = false,
} = {}) {
  return showDialog({
    title,
    message,
    actions: [
      { value: false, label: cancelLabel, kind: 'secondary' },
      {
        value: true,
        label: confirmLabel,
        kind: danger ? 'danger' : 'primary',
        autofocus: true,
      },
    ],
  });
}

export function showMessageDialog({
  title,
  message,
  confirmLabel = '知道了',
} = {}) {
  return showDialog({
    title,
    message,
    actions: [
      { value: true, label: confirmLabel, kind: 'primary', autofocus: true },
    ],
    dismissValue: true,
  });
}

export function showPromptDialog({
  title,
  message = '',
  label = '名稱',
  value = '',
  confirmLabel = '儲存',
  cancelLabel = '取消',
  maxLength = 80,
} = {}) {
  return showDialog({
    title,
    message,
    input: { label, value, maxLength },
    actions: [
      { value: null, label: cancelLabel, kind: 'secondary' },
      {
        value: '__submit_input__',
        label: confirmLabel,
        kind: 'primary',
        autofocus: true,
      },
    ],
    dismissValue: null,
  });
}

export function showTextAreaDialog({
  title,
  message = '',
  label = '內容',
  value = '',
  confirmLabel = '儲存',
  cancelLabel = '取消',
  maxLength = 12000,
  rows = 10,
} = {}) {
  return showDialog({
    title,
    message,
    input: {
      label,
      value,
      maxLength,
      multiline: true,
      rows,
    },
    actions: [
      { value: null, label: cancelLabel, kind: 'secondary' },
      {
        value: '__submit_input__',
        label: confirmLabel,
        kind: 'primary',
        autofocus: true,
      },
    ],
    dismissValue: null,
  });
}

export function showDialog({
  title = '確認',
  message = '',
  input = null,
  actions = [],
  dismissValue = false,
} = {}) {
  closeActiveDialog();

  const host = ensureDialogHost();
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'app-dialog-overlay';
  overlay.dataset.appDialog = 'true';

  const panel = document.createElement('section');
  panel.className = 'app-dialog';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.tabIndex = -1;

  const titleId = `app-dialog-title-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const messageId = `${titleId}-message`;

  const heading = document.createElement('h2');
  heading.id = titleId;
  heading.textContent = String(title || '確認');
  panel.setAttribute('aria-labelledby', titleId);
  panel.appendChild(heading);

  if (message) {
    const copy = document.createElement('p');
    copy.id = messageId;
    copy.className = 'app-dialog-copy';
    copy.textContent = String(message);
    panel.setAttribute('aria-describedby', messageId);
    panel.appendChild(copy);
  }

  let inputElement = null;
  if (input) {
    const field = document.createElement('label');
    field.className = 'app-dialog-field';
    const fieldLabel = document.createElement('span');
    fieldLabel.textContent = String(input.label || '輸入');
    inputElement = document.createElement(
      input.multiline ? 'textarea' : 'input',
    );
    if (!input.multiline) inputElement.type = 'text';
    inputElement.value = String(input.value || '');
    inputElement.maxLength = Math.max(
      1,
      Number(input.maxLength) || (input.multiline ? 12000 : 80),
    );
    if (input.multiline) {
      inputElement.rows = Math.max(4, Math.min(18, Number(input.rows) || 10));
      inputElement.classList.add('app-dialog-textarea');
    }
    field.append(fieldLabel, inputElement);
    panel.appendChild(field);
  }

  const actionRow = document.createElement('div');
  actionRow.className = 'app-dialog-actions';
  panel.appendChild(actionRow);
  overlay.appendChild(panel);
  host.appendChild(overlay);

  return new Promise(resolve => {
    let settled = false;
    const visualViewport = window.visualViewport;
    const syncViewport = () => {
      if (!visualViewport || !overlay.isConnected) return;
      // The mobile on-screen keyboard reduces the visible viewport, not
      // necessarily the CSS viewport used by vh/dvh.
      overlay.style.top = `${visualViewport.offsetTop}px`;
      overlay.style.left = `${visualViewport.offsetLeft}px`;
      overlay.style.width = `${visualViewport.width}px`;
      overlay.style.height = `${visualViewport.height}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
      overlay.dataset.compactHeight = String(visualViewport.height < 460);
    };
    visualViewport?.addEventListener('resize', syncViewport);
    visualViewport?.addEventListener('scroll', syncViewport);
    syncViewport();

    const finish = value => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown, true);
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
      overlay.remove();
      activeDialog = null;
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus({ preventScroll: true });
      }
      resolve(value);
    };

    const onKeyDown = event => {
      // Enter confirms single-line names; Ctrl/Meta+Enter confirms notes.
      // Do not interrupt an active Chinese/Japanese IME composition.
      if (event.isComposing || event.keyCode === 229) return;
      if (
        inputElement && event.target === inputElement &&
        event.key === 'Enter' &&
        (!input?.multiline || event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        finish(inputElement.value.trim());
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(dismissValue);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable(panel);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        action.kind === 'danger'
          ? 'button danger'
          : `button ${action.kind === 'primary' ? 'primary' : 'secondary'}`;
      button.textContent = String(action.label || '確定');
      button.addEventListener('click', () => {
        if (action.value === '__submit_input__') {
          finish(inputElement?.value?.trim() || '');
        } else {
          finish(action.value);
        }
      });
      if (action.autofocus) button.dataset.dialogAutofocus = 'true';
      actionRow.appendChild(button);
    }

    overlay.addEventListener('mousedown', event => {
      if (event.target === overlay) finish(dismissValue);
    });

    document.addEventListener('keydown', onKeyDown, true);
    activeDialog = { finish, dismissValue };

    queueMicrotask(() => {
      if (settled) return;
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
        return;
      }
      const preferred = panel.querySelector('[data-dialog-autofocus]');
      (preferred || getFocusable(panel)[0] || panel).focus();
    });
  });
}

function closeActiveDialog() {
  // The old dialog has its own cancellation semantics.
  activeDialog?.finish?.(activeDialog.dismissValue);
}

/** Keep native Studio dialogs inside the visual viewport above mobile keyboards. */
export function watchNativeDialogViewport(dialog, { expanded = false } = {}) {
  const viewport = window.visualViewport;
  const sync = () => {
    if (!dialog.isConnected) return;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const centerX = (viewport?.offsetLeft || 0) + width / 2;
    const centerY = (viewport?.offsetTop || 0) + height / 2;
    dialog.style.position = 'fixed';
    dialog.style.top = `${centerY}px`;
    dialog.style.left = `${centerX}px`;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.margin = '0';
    dialog.style.maxHeight = `${Math.max(72, height - 16)}px`;
    dialog.style.maxWidth = `${Math.max(160, width - 16)}px`;
    dialog.dataset.compactHeight = String(height < 560);
    if (expanded) {
      dialog.style.height = `${Math.min(920, Math.max(88, height - 24))}px`;
    }
  };
  viewport?.addEventListener('resize', sync);
  viewport?.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);
  sync();
  return () => {
    viewport?.removeEventListener('resize', sync);
    viewport?.removeEventListener('scroll', sync);
    window.removeEventListener('resize', sync);
  };
}

function ensureDialogHost() {
  let host = document.querySelector('#appDialogHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'appDialogHost';
    document.body.appendChild(host);
  }
  return host;
}

function getFocusable(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hidden);
}
