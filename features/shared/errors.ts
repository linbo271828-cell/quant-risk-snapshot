export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function asErrorPayload(err: unknown): { status: number; error: string } {
  if (err instanceof AppError) {
    return { status: err.status, error: err.message };
  }
  if (err instanceof Error) {
    return { status: 500, error: err.message };
  }
  return { status: 500, error: "Unknown error" };
}
