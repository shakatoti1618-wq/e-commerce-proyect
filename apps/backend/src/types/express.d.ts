// Minimal express type declarations for body parser configuration
// This avoids adding @types/express as a dependency

declare module 'express' {
  import { RequestHandler, Request, Response } from 'express-serve-static-core';

  export interface Request extends Request {
    rawBody?: Buffer;
  }

  export function json(options?: {
    limit?: string | number;
    verify?: (req: Request, res: Response, buf: Buffer) => void;
  }): RequestHandler;

  export function raw(options?: {
    type?: string | string[];
    limit?: string | number;
    verify?: (req: Request, res: Response, buf: Buffer) => void;
  }): RequestHandler;

  export function urlencoded(options?: {
    extended: boolean;
    limit?: string | number;
    verify?: (req: Request, res: Response, buf: Buffer) => void;
  }): RequestHandler;
}
