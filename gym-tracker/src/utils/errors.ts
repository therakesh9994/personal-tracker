import { ZodError } from 'zod';

/** Error with a message that is safe to show to the user. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'app_error',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'validation');
    this.name = 'ValidationError';
  }
}

/** Convert any thrown value into a user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof ZodError) return err.issues.map((i) => i.message).join('\n');
  if (err instanceof Error) {
    if (/FOREIGN KEY/i.test(err.message)) return 'This item is referenced by other records and cannot be removed.';
    if (/UNIQUE/i.test(err.message)) return 'A record with the same identity already exists.';
    if (/disk|full|SQLITE_FULL|ENOSPC/i.test(err.message)) return 'Not enough storage space on the device.';
    return err.message;
  }
  return 'Something went wrong.';
}

/** Run zod validation and throw a ValidationError with readable messages. */
export function validate<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ValidationError(r.error.issues.map((i) => i.message).join('\n'));
  return r.data;
}
