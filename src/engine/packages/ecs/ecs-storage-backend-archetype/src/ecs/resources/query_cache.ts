/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/src/ecs/resources/query_cache.ts
 */

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

import type { ArchetypeId } from '@self/ecs/resources/archetype';

export type QueryKey = string;

export interface QueryCacheEntry {
   result: ArchetypeId[];
   last_validated_tick: number;
}

export function query_cache_generate_key(
   components: string[],
   options?: {
      with?: string[];
      without?: string[];
   }
): QueryKey {
   const comp_ids = components
      .slice()
      .sort()
      .join(',');

   const with_ids =
      options?.with
         ?.slice()
         .sort()
         .join(',') ?? '';

   const without_ids =
      options?.without
         ?.slice()
         .sort()
         .join(',') ?? '';

   return `${comp_ids}|${with_ids}|${without_ids}`;
}

export class ResourceQueryCache extends Resource {
   cache: Map<QueryKey, QueryCacheEntry> = new Map();

   clear(): void {
      this.cache.clear();
   }
}
