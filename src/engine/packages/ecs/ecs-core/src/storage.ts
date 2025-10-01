/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/storage.ts
 */

import type { ResourceConstructor } from '@self/types/resource';
import type { IStorage } from '@self/types/storage';

export class Storage<
   K extends ResourceConstructor = ResourceConstructor
> implements IStorage<K> {
   #map = new Map<K, InstanceType<K>>();

   get size(): number {
      return this.#map.size;
   }

   get [Symbol.toStringTag](): string {
      return 'Storage';
   }

   get<T extends K>(key: T): InstanceType<T> | undefined {
      return this.#map.get(key);
   }

   set<T extends K>(key: T, value: InstanceType<T>): this {
      this.#map.set(key, value);

      return this;
   }

   has(key: K): boolean {
      return this.#map.has(key);
   }

   delete(key: K): boolean {
      return this.#map.delete(key);
   }

   clear(): void {
      this.#map.clear();
   }
}
