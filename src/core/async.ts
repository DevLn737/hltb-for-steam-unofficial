export class OperationTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs} ms`);
    this.name = 'OperationTimeoutError';
  }
}

export function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new OperationTimeoutError(timeoutMs)), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

