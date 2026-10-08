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
  closeActiveDialog(dismissValue);

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

    const finish = value => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown, true);
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
    activeDialog = { finish };

    queueMicrotask(() => {
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

function closeActiveDialog(value) {
  activeDialog?.finish?.(value);
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
