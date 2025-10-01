/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/types/asset_index.ts
 */

/** represents a single entry in the asset index */
export interface AssetIndexEntry {
   /** relative path from the assets root directory */
   path: string;
   hash?: string;
   size?: number;
   type?: string;
}

/** represents the overall asset index structure */
export interface AssetIndex {
   assets: AssetIndexEntry[];
   generated_at?: number;
}