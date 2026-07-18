import { browser } from 'wxt/browser';
import type { RuntimeRequest, RuntimeResponse } from '../src/core/contracts';
import { GameTimesService } from '../src/background/game-times-service';
import { clearGameCache } from '../src/storage/cache';
import { getSettings, saveSettings } from '../src/storage/settings';
import { createRuntimeMessageListener } from '../src/background/runtime-listener';

const service = new GameTimesService();

function isRequest(value: unknown): value is RuntimeRequest {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string');
}

async function handleMessage(message: unknown): Promise<RuntimeResponse> {
  if (!isRequest(message)) return { ok: false, error: 'invalid_request' };
  try {
    switch (message.type) {
      case 'GET_GAME_TIMES':
        return await service.getGameTimes(message.appId, message.title);
      case 'GET_SETTINGS':
        return { ok: true, settings: await getSettings() };
      case 'UPDATE_SETTINGS':
        return { ok: true, settings: await saveSettings(message.settings) };
      case 'CLEAR_CACHE':
        await clearGameCache();
        return { ok: true, cleared: true };
      default:
        return { ok: false, error: 'invalid_request' };
    }
  } catch {
    return { ok: false, error: 'service_error' };
  }
}

export const handleRuntimeMessage = createRuntimeMessageListener(handleMessage);

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleRuntimeMessage);
});

export { handleMessage };
