import * as fs from 'fs';
import * as path from 'path';
import express, { Express, NextFunction, Request, Response } from 'express';

const FILE_EXTENSION_REGEX = /\.[a-zA-Z0-9]{1,8}$/;

/**
 * Resolves the built frontend directory (`apps/web/dist` or packaged `web-dist`).
 * Returns null when no built SPA bundle is found on disk.
 */
export function resolveWebDistDir(explicitDir?: string): string | null {
  if (typeof explicitDir === 'string' && explicitDir.trim().length > 0) {
    const resolved = path.resolve(explicitDir);
    return fs.existsSync(path.join(resolved, 'index.html')) ? resolved : null;
  }

  const candidates = [
    process.env.WEB_DIST_DIR,
    path.resolve(__dirname, '../../../../web/dist'),
    path.resolve(__dirname, '../../../web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'apps/web/dist'),
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, 'index.html'))) {
      return resolved;
    }
  }
  return null;
}

/**
 * Determines whether an incoming request should fall back to the React SPA entrypoint.
 */
export function isSpaNavigationRequest(method: string, reqPath: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    return false;
  }
  if (reqPath === '/api' || reqPath.startsWith('/api/')) {
    return false;
  }
  if (FILE_EXTENSION_REGEX.test(reqPath)) {
    return false;
  }
  return true;
}

/**
 * Attaches static asset serving and client-side SPA routing fallback to Express
 * so desktop and LAN clients can load both frontend and `/api` from port 4000.
 */
export function registerSpaStaticServing(
  expressApp: Express,
  explicitDir?: string,
): string | null {
  const webDistDir = resolveWebDistDir(explicitDir);
  if (!webDistDir) {
    return null;
  }

  const indexHtmlPath = path.join(webDistDir, 'index.html');

  expressApp.use(
    express.static(webDistDir, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }),
  );

  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    if (!isSpaNavigationRequest(req.method, req.path)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexHtmlPath);
  });

  return webDistDir;
}
