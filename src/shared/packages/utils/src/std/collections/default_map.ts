/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/collections/default_map.ts
 */

export class DefaultMap<K, V> extends Map<K, V> {
   #default_factory: () => V;

   constructor(
      default_factory: () => V, entries?: readonly (readonly [K, V])[] | null
   ) {
      super(entries);

      this.#default_factory = default_factory;
   }

   override get(key: K): V {
      if (!this.has(key)) {
         this.set(key, this.#default_factory());
      }

      return super.get(key)!;
   }
}