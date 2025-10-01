/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-adapter-browser/src/browser_http_source.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IAssetSource } from '@eldritch-engine/plugin-assets-core/types/source';
import type { AssetIndex } from '@eldritch-engine/plugin-assets-core/types/asset_index';

export class BrowserHttpSource implements IAssetSource {
   readonly namespace: string;

   #base_url: string;
   #asset_index: AssetIndex | null = null;
   #initialized: Promise<void>;

   constructor(
      namespace: string,
      base_url: string = 'assets'
   ) {
      this.namespace = namespace;

      this.#base_url = base_url;
      this.#initialized = this.#initialize();
   }

   async #initialize(): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      try {
         const response = await fetch('/asset_index.json');

         if (!response.ok) {
            throw new Error(`failed to fetch asset_index.json: ${response.statusText}`);
         }

         this.#asset_index = await response.json();

         logger.info(`asset source for namespace '${this.namespace}' initialized with ${this.#asset_index?.assets.length} assets.`);
      } catch (e) {
         logger.error(`failed to initialize ${BrowserHttpSource.name}: ${e.message}`);

         this.#asset_index = { assets: [] };
      }
   }

   async load(
      path: string
   ): Promise<ArrayBuffer> {
      await this.#initialized;

      const logger = default_logger.get_namespaced_logger('<namespace>');

      const asset_entry = this.#asset_index?.assets.find(a => a.path === path);

      if (!asset_entry) {
         throw new Error(`asset '${path}' not found in asset index for source '${this.namespace}'.`);
      }

      const url = `/${this.#base_url}/${path}`;

      logger.trace(`fetching asset from url: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
         throw new Error(`failed to fetch asset '${path}': ${response.statusText}`);
      }

      return await response.arrayBuffer();
   }
}