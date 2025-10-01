/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/storage.ts
 */

import type { ResourceConstructor } from '@self/types/resource';

export interface IStorage<K extends ResourceConstructor = ResourceConstructor> {
   get size(): number;
   get [Symbol.toStringTag](): string;

   get<T extends K>(key: T): InstanceType<T> | undefined;
   set<T extends K>(key: T, value: InstanceType<T>): this;
   has(key: K): boolean;
   delete(key: K): boolean;
   clear(): void;
}