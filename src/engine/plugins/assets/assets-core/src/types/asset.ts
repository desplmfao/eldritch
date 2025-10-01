/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/types/asset.ts
 */

export type AssetId = string;

/**
 * a lightweight, type-safe reference to an asset
 * 
 * this handle is cheap to copy and store in components
 */
export class Handle<T extends Asset> {
   readonly brand: symbol = Symbol();
   readonly id: AssetId;

   constructor(
      id: AssetId
   ) {
      this.id = id;
   }
}

/** base class for all asset types. */
export abstract class Asset {
   handle!: Handle<this>;
}

/** the loading state of an asset */
export enum LoadState {
   NotLoaded,
   Loading,
   Loaded,
   Failed,
}