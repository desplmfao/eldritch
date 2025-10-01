/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-adapter-browser/src/ecs/plugin.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceInputAdapterHandle } from '@eldritch-engine/plugin-input-core/ecs/resources/input_adapter_handle';

import { BrowserInputAdapter } from '@self/input_adapter/index';

export class PluginInputAdapterBrowser extends Plugin {
   #adapter_instance?: BrowserInputAdapter;

   async build(
      adapter_handle: Res<ResourceInputAdapterHandle>
   ): Promise<boolean> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (
         typeof window === 'undefined'
         || typeof document === 'undefined'
      ) {
         logger.error('browser input adapter cannot run in this environment');

         return true;
      }

      if (adapter_handle.adapter) {
         logger.warn('an input adapter is already set in ResourceInputAdapterHandle. skipping browser adapter setup');

         return true;
      }

      try {
         this.#adapter_instance = new BrowserInputAdapter();
         await this.#adapter_instance.initialize();
         adapter_handle.adapter = this.#adapter_instance;

         logger.trace('browser input adapter initialized and set in ResourceInputAdapterHandle');

         return true;
      } catch (e) {
         {
            const message = 'browser input adapter cannot run in this environment';

            logger.critical(message);
            throw new Error(message, { cause: e });
         }
      }
   }

   override async remove(): Promise<void> {
      if (this.#adapter_instance) {
         await this.#adapter_instance.cleanup();

         this.#adapter_instance = undefined;
      }
   }
}