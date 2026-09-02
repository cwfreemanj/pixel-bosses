export class PixelNetwork extends EventTarget {
  constructor(getState) {
    super();
    this.getState = getState;
    this.ws = null;
  }
  get baseUrl() {
    const configured = this.getState().settings.serverUrl?.trim();
    return configured || (location.protocol.startsWith('http') ? location.origin : '');
  }
  async sync(state) {
    if (!this.baseUrl) throw new Error('Add your Railway server URL in Settings first.');
    const response = await fetch(`${this.baseUrl}/api/profile/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: state.playerId, token: state.playerToken, state, updatedAt: state.updatedAt })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sync failed');
    return data;
  }
  connect() {
    if (!this.baseUrl) throw new Error('Add your Railway server URL in Settings first.');
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
