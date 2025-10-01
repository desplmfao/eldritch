/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/logger/src/interceptor.ts
 */

import type { Logger } from '@self/logger';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

export class ConsoleInterceptor {
   #is_enabled = false;
   #logger: Logger;

   #original_methods: {
      [key in ConsoleMethod]?: (...args: any[]) => void
   } = {};

   constructor(logger: Logger) {
      this.#logger = logger;
   }

   enable(): void {
      if (this.#is_enabled) {
         return;
      }

      const methods_to_intercept: ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];

      for (const method of methods_to_intercept) {
         if (typeof console[method] === 'function') {
            this.#original_methods[method] = console[method].bind(console);

            console[method] = (...args: any[]) => {
               this.#logger[method === 'log' ? 'info' : method]('global::console', ...args);
            };
         }
      }

      this.#is_enabled = true;
   }

   disable(): void {
      if (!this.#is_enabled) {
         return;
      }

      for (const method_key in this.#original_methods) {
         const method = method_key as ConsoleMethod;

         // @ts-expect-error
         console[method] = this.#original_methods[method];
      }

      this.#original_methods = {};
      this.#is_enabled = false;
   }
}