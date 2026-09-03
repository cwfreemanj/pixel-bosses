export const PIXEL_BOSSES_SERVER = 'https://web-production-efaa4b.up.railway.app';

export class PixelNetwork extends EventTarget {
  constructor(getState) {
    super();
    this.getState = getState;
    this.ws = null;
  }
  get baseUrl() {
    return ['localhost', '127.0.0.1'].includes(location.hostname) && location.protocol.startsWith('http')
      ? location.origin
      : PIXEL_BOSSES_SERVER;
  }
  authHeaders(state = this.getState()) {
    return { 'content-type': 'application/json', 'x-player-id': state.playerId, 'x-player-token': state.playerToken };
  }
  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers: { ...this.authHeaders(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  async sync(state) {
    return this.request('/api/profile/sync', {
      method: 'POST',
      body: JSON.stringify({ playerId: state.playerId, token: state.playerToken, state, updatedAt: state.updatedAt })
    });
  }
  connect() {
    this.close();
    const url = new URL(this.baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/multiplayer';
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => this.dispatchEvent(new CustomEvent('message', { detail: JSON.parse(event.data) }));
    this.ws.onerror = () => this.dispatchEvent(new CustomEvent('message', { detail: { type: 'error', message: 'Could not reach multiplayer server.' } }));
    this.ws.onclose = () => this.dispatchEvent(new CustomEvent('message', { detail: { type: 'disconnected' } }));
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      setTimeout(() => this.ws?.readyState !== WebSocket.OPEN && reject(new Error('Connection timed out.')), 8000);
    });
  }
  send(message) {
    if (this.ws?.readyState !== WebSocket.OPEN) throw new Error('Not connected.');
    this.ws.send(JSON.stringify(message));
  }
  close() { this.ws?.close(); this.ws = null; }
}
