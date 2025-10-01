/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/ecs/resources/asset_server.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

import { type AssetId, type Asset, Handle, type LoadState } from '@self/types/asset';
import type { IAssetLoader } from '@self/types/loader';
import type { IAssetSource } from '@self/types/source';

export interface AssetEntry {
   asset?: Asset;
   state: LoadState;
   dependencies: Set<AssetId>;
   promise?: Promise<Asset>;
}

export class ResourceAssetServer extends Resource {
   #assets = new Map<AssetId, AssetEntry>();
   #loaders: IAssetLoader[] = [];
   #sources = new Map<string, IAssetSource[]>();

   add_loader(loader: IAssetLoader): void {
      this.#loaders.push(loader);
   }

   add_source(source: IAssetSource): void {
      if (!this.#sources.has(source.namespace)) {
         this.#sources.set(source.namespace, []);
      }

      this.#sources.get(source.namespace)!.unshift(source);
   }

   load<T extends Asset>(path: string): Handle<T> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.info(`AssetServer: received load request for '${path}'`);

      return new Handle<T>(path);
   }

   get<T extends Asset>(handle: Handle<T>): T | undefined {
      return this.#assets.get(handle.id)?.asset as T | undefined;
   }

   get_load_state(handle: Handle<any>): LoadState | undefined {
      return this.#assets.get(handle.id)?.state;
   }
}