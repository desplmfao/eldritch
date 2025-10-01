/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/tests/query_cache.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { default_logger } from '@eldritch-engine/logger/logger';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@self/index';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { ResourceWorldTick, ResourceComponentLastWriteTick } from '@eldritch-engine/ecs-core/ecs/resources/core';

import { Component } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { ResourceArchetypeMap } from '@self/ecs/resources/archetype';
import { ResourceQueryCache, query_cache_generate_key } from '@self/ecs/resources/query_cache'

class CompA extends Component {
   value = 'A';
}

class CompB extends Component {
   count = 0;
}

class CompC extends Component {
   active = true;
}

class CompD extends Component {
   data = null;
}

describe('query cache system', () => {
   let world: IWorld;

   let r_query_cache: ResourceQueryCache;
   let r_world_tick: ResourceWorldTick;
   let r_component_last_write_tick: ResourceComponentLastWriteTick;
   let r_archetypes: ResourceArchetypeMap;

   beforeEach(async () => {
      default_logger.options.log_level = 5;

      world = new World({
         storage_backend: new WorldStorageBackendArchetype()
      });

      r_query_cache = world.storage.get(ResourceQueryCache)!;
      r_world_tick = world.storage.get(ResourceWorldTick)!;
      r_component_last_write_tick = world.storage.get(ResourceComponentLastWriteTick)!;
      r_archetypes = world.storage.get(ResourceArchetypeMap)!;
   });

   async function run_view_and_collect(
      components: string[],
      options: {
         with?: string[],
         without?: string[]
      } = {}
   ) {
      const results = [];
      const view_iterator = world.component_view(components, options);

      for await (const result of view_iterator) {
         results.push(result);
      }

      return results;
   }

   describe('query_cache_generate_key', () => {
      it('should generate consistent keys for the same query', () => {
         const key1 = query_cache_generate_key([CompA.name, CompB.name]);
         const key2 = query_cache_generate_key([CompB.name, CompA.name]);

         expect(key1).toBe(`${CompA.name},${CompB.name}||`);
         expect(key1).toBe(key2);
      });

      it('should generate different keys for different component sets', () => {
         const key1 = query_cache_generate_key([CompA.name]);
         const key2 = query_cache_generate_key([CompB.name]);

         expect(key1).not.toBe(key2);
      });

      it('should include `with` filters in the key, sorted and comma-separated', () => {
         const key1 = query_cache_generate_key([CompA.name], { with: [CompB.name, CompC.name] });
         const key2 = query_cache_generate_key([CompA.name], { with: [CompC.name, CompB.name] });

         const expected_with_sorted = [CompB.name, CompC.name].sort().join(',');

         expect(key1).toBe(`${CompA.name}|${expected_with_sorted}|`);
         expect(key1).toBe(key2);
      });

      it('should include `without` filters in the key, sorted and comma-separated', () => {
         const key1 = query_cache_generate_key([CompA.name], { without: [CompB.name, CompC.name] });
         const key2 = query_cache_generate_key([CompA.name], { without: [CompC.name, CompB.name] });
         const expected_without_sorted = [CompB.name, CompC.name].sort().join(',');

         expect(key1).toBe(`${CompA.name}||${expected_without_sorted}`);
         expect(key1).toBe(key2);
      });

      it('should generate a comprehensive key with all parts', () => {
         const key = query_cache_generate_key(
            [
               CompA.name,
               CompB.name],
            {
               with: [CompC.name],
               without: [CompD.name]
            }
         );

         expect(key).toBe(`${CompA.name},${CompB.name}|${CompC.name}|${CompD.name}`);
      });

      it('should handle empty filter arrays correctly', () => {
         const key = query_cache_generate_key([CompA.name], { with: [], without: [] });

         expect(key).toBe(`${CompA.name}||`);
      });
   });

   describe('world.component_view() caching behavior', () => {
      let e1: EntityId;
      let e2: EntityId;
      let e3: EntityId;

      beforeEach(async () => {
         r_query_cache.clear();
         r_world_tick.data = 0;
         r_component_last_write_tick.data.clear();

         e1 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e1, [[CompA, {}], [CompB, {}]]);
         r_world_tick.data++;

         e2 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e2, [[CompA, {}]]);
         r_world_tick.data++;

         e3 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e3, [[CompA, {}], [CompB, {}], [CompC, {}]]);
         r_world_tick.data++;
      });

      it('should perform a live query and cache the result on first call', async () => {
         const query_key = query_cache_generate_key([CompA.name, CompB.name]);
         expect(r_query_cache.cache.has(query_key)).toBe(false);

         const results = await run_view_and_collect([CompA.name, CompB.name]);
         expect(results.map(r => r[0]).sort()).toEqual([e1, e3].sort());

         const cached_entry = r_query_cache.cache.get(query_key);
         expect(cached_entry).toBeDefined();
         expect(cached_entry?.result.length).toBe(2);
         expect(cached_entry?.last_validated_tick).toBe(r_world_tick.data);
      });

      it('should use cached result on subsequent calls if cache is valid', async () => {
         const query_key = query_cache_generate_key([CompA.name, CompB.name]);

         await run_view_and_collect([CompA.name, CompB.name]);
         const cached_tick_after_first_call = r_query_cache.cache.get(query_key)!.last_validated_tick;
         expect(cached_tick_after_first_call).toBe(3);

         r_world_tick.data++;

         const results = await run_view_and_collect([CompA.name, CompB.name]);
         expect(results.length).toBe(2);

         const cached_entry_after_second_call = r_query_cache.cache.get(query_key)!;
         expect(cached_entry_after_second_call.last_validated_tick).toBe(cached_tick_after_first_call);
      });

      it('should invalidate cache and re-query if a relevant component was written to since last validation', async () => {
         const query_key = query_cache_generate_key([CompA.name, CompB.name]);

         await run_view_and_collect([CompA.name, CompB.name]);
         const tick_before_write = r_query_cache.cache.get(query_key)!.last_validated_tick;

         r_component_last_write_tick.data.set(CompB.name, r_world_tick.data + 1);
         r_world_tick.data = 5;

         const results = await run_view_and_collect([CompA.name, CompB.name]);
         expect(results.length).toBe(2);

         const cached_entry_after_invalidation = r_query_cache.cache.get(query_key)!;
         expect(cached_entry_after_invalidation.last_validated_tick).toBe(r_world_tick.data);
         expect(cached_entry_after_invalidation.last_validated_tick).not.toBe(tick_before_write);
      });

      it('should NOT invalidate cache if an IRRELEVANT component was written to', async () => {
         const query_key = query_cache_generate_key([CompA.name]);

         await run_view_and_collect([CompA.name]);
         const tick_before_write = r_query_cache.cache.get(query_key)!.last_validated_tick;

         r_component_last_write_tick.data.set(CompC.name, r_world_tick.data + 1);
         r_world_tick.data = 5;

         const results = await run_view_and_collect([CompA.name]);
         expect(results.map(r => r[0]).sort()).toEqual([e1, e2, e3].sort());

         const cached_entry_after_irrelevant_write = r_query_cache.cache.get(query_key)!;
         expect(cached_entry_after_irrelevant_write.last_validated_tick).toBe(tick_before_write);
      });

      it('should invalidate cache if a component in `with` filter was written', async () => {
         const query_key = query_cache_generate_key([CompA.name], { with: [CompB.name] });
         await run_view_and_collect([CompA.name], { with: [CompB.name] });

         r_component_last_write_tick.data.set(CompB.name, r_world_tick.data + 1);
         r_world_tick.data = 5;

         await run_view_and_collect([CompA.name], { with: [CompB.name] });
         expect(r_query_cache.cache.get(query_key)!.last_validated_tick).toBe(r_world_tick.data);
      });

      it('should invalidate cache if a component in `without` filter was written', async () => {
         const query_key = query_cache_generate_key([CompA.name], { without: [CompC.name] });
         await run_view_and_collect([CompA.name], { without: [CompC.name] });

         r_component_last_write_tick.data.set(CompC.name, r_world_tick.data + 1);
         r_world_tick.data = 5;

         await run_view_and_collect([CompA.name], { without: [CompC.name] });
         expect(r_query_cache.cache.get(query_key)!.last_validated_tick).toBe(r_world_tick.data);
      });

      it('view should correctly filter deleted entities and cache reflects this after re-query', async () => {
         const query_key = query_cache_generate_key([CompA.name, CompB.name]);
         await run_view_and_collect([CompA.name, CompB.name]);
         expect(r_query_cache.cache.get(query_key)?.result.length).toBe(2);

         await world.entity_delete_direct(e1);
         r_world_tick.data = 4;

         const results = await run_view_and_collect([CompA.name, CompB.name]);
         expect(results.length).toBe(1);
         expect(results[0]![0]).toBe(e3);

         const cached_entry_after_delete = r_query_cache.cache.get(query_key)!;
         expect(cached_entry_after_delete).toBeDefined();
         expect(cached_entry_after_delete.result.length).toBe(1);
         const arch_e3_id = r_archetypes.entity_to_archetype_id.get(e3)!;
         expect(cached_entry_after_delete.result).toEqual([arch_e3_id]);
         expect(cached_entry_after_delete.last_validated_tick).toBe(r_world_tick.data);
      });

      it('should return empty results and cache them if no archetypes match', async () => {
         class CompUnused extends Component { }

         const query_key = query_cache_generate_key([CompUnused.name]);

         const results = await run_view_and_collect([CompUnused.name]);
         expect(results.length).toBe(0);

         const cached_entry = r_query_cache.cache.get(query_key);
         expect(cached_entry).toBeDefined();
         expect(cached_entry?.result.length).toBe(0);
         expect(cached_entry?.last_validated_tick).toBe(r_world_tick.data);

         r_world_tick.data++;
         const results2 = await run_view_and_collect([CompUnused.name]);
         expect(results2.length).toBe(0);
         expect(r_query_cache.cache.get(query_key)?.last_validated_tick).toBe(r_world_tick.data - 1);
      });
   });
});