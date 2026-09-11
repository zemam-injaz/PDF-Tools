// Persistent local app storage.
// In Tauri, values live in the app data directory (~/.pdf-tools style) so they
// survive app reinstalls. In plain web mode, falls back to localStorage.
//
// Rule: this cache never grants access by itself — it only lets the client use
// the last trusted entitlement while offline (see SubscriptionContext).

const LS_PREFIX = 'pdf_tools_';

async function canUseTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function readAppFile(name: string): Promise<string | null> {
  if (await canUseTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string | null>('read_app_file', { name });
      if (result != null) return result;
    } catch (e) {
      console.warn('[Storage] Tauri read failed, falling back to localStorage:', e);
    }
  }
  return localStorage.getItem(LS_PREFIX + name);
}

export async function writeAppFile(name: string, content: string): Promise<void> {
  if (await canUseTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_app_file', { name, content });
      return;
    } catch (e) {
      console.warn('[Storage] Tauri write failed, falling back to localStorage:', e);
    }
  }
  localStorage.setItem(LS_PREFIX + name, content);
}