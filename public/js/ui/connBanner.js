// Connection banner (global chrome, mounted once by main.js): reconnecting / closed / rejected-hello states with
// the matching action, and "正在同步同盟状态…" while a resumed session waits for its room/match state. Outside a
// match it sits at the bottom centre; in a match (html.sp-in-match, set by the match screen) it moves under the top bar
// so it never covers the combat view switcher or the shop bar. While it shows, html.sp-conn moves the toasts below it
// (classes instead of CSS :has(), which Firefox ESR / Safari < 15.4 lack).

import { html, Button, Icon, useTicker } from './components.js';
import { net, CLIENT_ERR_TEXT } from '../net.js';
import { useStore, shallowEqual } from '../store.js';
import { useDocClass } from './device.js';

/** Whether the banner shows for this connection state (mirrors the early returns below). */
export function bannerVisible(conn, entered, restoring) {
  if (!entered || !conn) return false;
  if (conn.status === 'online') return !!restoring;
  if (!conn.everOnline && (conn.status === 'connecting' || conn.status === 'handshaking' || conn.status === 'idle')) return false;
  return true;
}

export function ConnectionBanner() {
  const conn = useStore((s) => s.connection, shallowEqual);
  const entered = useStore((s) => s.session.entered);
  const restoring = useStore((s) => s.ui.restoring);
  useTicker(conn.status === 'reconnecting' ? 500 : 0);
  useDocClass('sp-conn', bannerVisible(conn, entered, restoring));
  if (!entered) return null;
  if (conn.status === 'online' && !restoring) return null;
  if (conn.status === 'online' && restoring) {
    return html`<div class="conn-banner" role="status"><${Icon} name="refresh" /><span>Синхронизация состояния альянса…</span></div>`;
  }
  if (!conn.everOnline && (conn.status === 'connecting' || conn.status === 'handshaking' || conn.status === 'idle')) return null;
  const secs = conn.retryAt ? Math.max(0, Math.ceil((conn.retryAt - Date.now()) / 1000)) : 0;
  const replaced = conn.status === 'closed' && conn.lastError?.code === 'REPLACED';
  const rejected = conn.status === 'connected' && !!conn.lastError; // hello refused (version, server full…)
  const versionMismatch = rejected && conn.lastError.text === CLIENT_ERR_TEXT.VERSION;
  // Short transitional states (a rename re-sends hello on the live socket) only show if they linger.
  const transient = conn.status === 'connecting' || conn.status === 'handshaking' || (conn.status === 'connected' && !rejected);
  const text = conn.status === 'reconnecting'
    ? 'Соединение с сервером прервано, переподключение'
    : replaced ? 'Эта учётная запись уже вошла на другой странице'
      : conn.status === 'closed' ? 'Соединение закрыто'
        : rejected ? conn.lastError.text : 'Подключение к серверу';
  const action = conn.status === 'reconnecting' ? { label: 'Переподключиться сейчас', run: () => net.retryNow() }
    : conn.status === 'closed' ? { label: replaced ? 'Продолжить на этой странице' : 'Переподключиться', run: () => net.connect() }
      : versionMismatch ? { label: 'Обновить страницу', run: () => location.reload() }
        : rejected ? { label: 'Повторить', run: () => net.reconnectNow() } : null;
  return html`<div class=${`conn-banner${transient ? ' conn-banner--soft' : ''}`} role="alert">
    <${Icon} name="wifiOff" />
    <span>${text}</span>
    ${conn.status === 'reconnecting' ? html`<span class="conn-banner__sub">Попытка ${conn.attempt} · ${secs} с</span>` : null}
    ${action ? html`<${Button} size="sm" variant="secondary" icon="refresh" onClick=${action.run}>${action.label}<//>` : null}
  </div>`;
}