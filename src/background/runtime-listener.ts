import type { RuntimeResponse } from '../core/contracts';

type RuntimeHandler = (message: unknown) => Promise<RuntimeResponse>;
type SendResponse = (response: RuntimeResponse) => void;

export function createRuntimeMessageListener(handler: RuntimeHandler) {
  return (message: unknown, _sender: unknown, sendResponse: SendResponse): true => {
    void handler(message).then(sendResponse, () => sendResponse({ ok: false, error: 'service_error' }));
    return true;
  };
}
