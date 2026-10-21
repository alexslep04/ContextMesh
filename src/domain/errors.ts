export class ApplicationError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode = 409) {
    super(message);
    this.name = "ApplicationError";
  }
}
