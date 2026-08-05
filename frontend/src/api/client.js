/**
 * Centralized API Client & WebSocket Connection Manager
 */

export async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `API error: ${response.status}`);
  }
  return response.json();
}

export function setupWebSocket(onEvent, onStatusChange) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  let ws = null;
  let retryTimer = null;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (onStatusChange) onStatusChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onEvent) onEvent(data);
        } catch (e) {
          // ignore non-json ping
        }
      };

      ws.onclose = () => {
        if (onStatusChange) onStatusChange(false);
        retryTimer = setTimeout(connect, 3000);
      };
    } catch (e) {
      if (onStatusChange) onStatusChange(false);
    }
  }

  connect();

  return () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (ws) ws.close();
  };
}
