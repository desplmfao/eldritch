/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/types/source.ts
 */

/**
 * an interface for a source of raw asset data
 * 
 * this abstracts away where assets come from (like over indexeddb or http fetching)
 */
export interface IAssetSource {
   /** the namespace this source provides assets for */
   readonly namespace: string;

   /**
    * asynchronously loads the raw bytes for a given asset path within this source's namespace
    * 
    * @param path the relative path of the asset within the namespace
    */
   load(path: string): Promise<ArrayBuffer>;
}