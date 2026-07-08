// Bundles the NestJS Lambda handler into a single self-contained file for AWS
// Lambda (node20, CJS). esbuild strips emitDecoratorMetadata and TS's isolated
// transpileModule collapses injected types to Object, both breaking Nest DI, so
// we transform .ts through SWC (correct legacy-decorator metadata, same as
// `nest -b swc`) and let esbuild bundle. Path aliases (@/…, @pilotage/*) resolve
// from tsconfig.json. Optional Nest/pg peers that aren't installed are external
// (Nest require()s them in try/catch).
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { transform } from '@swc/core';

const swc = {
  name: 'swc',
  setup(b) {
    b.onLoad({ filter: /\.ts$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const { code } = await transform(source, {
        filename: args.path,
        sourceMaps: false,
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
          target: 'es2021',
          keepClassNames: true,
        },
        module: { type: 'es6' },
      });
      return { contents: code, loader: 'js' };
    });
  },
};

await build({
  entryPoints: ['src/lambda.ts'],
  outfile: 'dist/lambda.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  keepNames: true,
  tsconfig: 'tsconfig.json',
  external: [
    '@nestjs/microservices',
    '@nestjs/websockets',
    '@nestjs/platform-socket.io',
    '@nestjs/platform-fastify',
    'class-transformer',
    'class-validator',
    'cache-manager',
    '@fastify/static',
    'pg-native',
  ],
  plugins: [swc],
  logLevel: 'info',
});

console.log('bundled -> dist/lambda.js');
