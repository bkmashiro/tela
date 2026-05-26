/**
 * Parser error types.
 */

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly file?: string
  ) {
    super(
      `Parse error${file ? ` in ${file}` : ''} at line ${line}, col ${column}: ${message}`
    );
    this.name = 'ParseError';
  }
}
