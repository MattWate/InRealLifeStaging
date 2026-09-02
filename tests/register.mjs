import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@neondatabase/serverless') return { url: new URL('./sql-mock.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(url)) return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
} });
