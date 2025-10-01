/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/benchmarks/build.ts
 */

import { build_single } from '@eldritch-engine/builder/index';

async function main() {
   console.info('\n--- building benchmark files ---');

   try {
      const glob = new Bun.Glob('**/*.bench.ts');
      const benchmark_files = await Array.fromAsync(glob.scan('.'));

      if (benchmark_files.length > 0) {
         console.info(`found ${benchmark_files.length} benchmark files to compile`);

         await build_single(
            {
               entryPoints: benchmark_files,
               outdir: 'bench-dist',
            }
         );

         console.info('successfully compiled benchmark files to `bench-dist/`');
      } else {
         console.info('no benchmark files found (`*.bench.ts`), skipping benchmark build');
      }
   } catch (e) {
      console.error('an error occurred during benchmark compilation:', e);
   }

   console.info('\n--- build process finished ---');
}

main();