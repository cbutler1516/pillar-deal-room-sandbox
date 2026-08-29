export class ShareFileClientError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ShareFileClientError";
    this.status = status;
  }
}

export function sharefileRequestFailed(status?: number): ShareFileClientError {
  return new ShareFileClientError(
    status
      ? `ShareFile request failed (${status}).`
      : "ShareFile request failed.",
    status,
  );
}

export function redactShareFileError(error: unknown): ShareFileClientError {
  if (error instanceof ShareFileClientError) {
    return error;
  }
  return new ShareFileClientError("ShareFile request failed.");
}
