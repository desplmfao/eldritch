/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/types/loader.ts
 */

import type { Asset } from '@self/types/asset';

/**
 * provides context to an AssetLoader, allowing it to register dependencies discovered during the loading process
 */
export interface AssetLoaderContext {
   add_dependency(path: string): void;
}

/**
 * defines the logic for parsing raw asset bytes into a typed Asset object
 */
export interface IAssetLoader<T extends Asset = Asset> {
   /** the file extensions this loader can handle */
   readonly extensions: ReadonlySet<string>;

   /**
    * asynchronously loads and processes an asset from its raw bytes
    * 
    * @param bytes the raw data of the asset
    * @param context the loader context for registering dependencies
    */
   load(bytes: ArrayBuffer, context: AssetLoaderContext): Promise<T>;
}