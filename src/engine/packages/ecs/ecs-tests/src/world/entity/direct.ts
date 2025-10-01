/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/entity/direct.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';

import { ComponentChildOf } from '@eldritch-engine/ecs-core/ecs/components/relationship/child_of';

import {
   ResourceEntitiesDeleted
} from '@eldritch-engine/ecs-core/ecs/resources/core';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

class CompA extends Component { }
class CompB extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('direct entity operations', () => {
      let world: World;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         await world.add_plugin(new DefaultPlugins());
         await world.initialize();
      });

      it('should create an entity directly and confirm it is alive', async () => {
         const entity_id = await world.entity_create_direct();
         expect(entity_id).toBeGreaterThan(0);
         expect(world.entity_is_alive(entity_id)).toBe(true);
      });

      it('should delete an entity directly and confirm it is not alive', async () => {
         const entity_id = await world.entity_create_direct();
         expect(world.entity_is_alive(entity_id)).toBe(true);

         const deleted = await world.entity_delete_direct(entity_id);
         expect(deleted).toBe(true);
         expect(world.entity_is_alive(entity_id)).toBe(false);
      });

      it('should fire component_removed events for all components on direct deletion', async () => {
         const event_handler = mock((args) => { });

         await world.subscribe('component_removed', { update: event_handler });

         const entity_id = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}]
            ]
         });

         await world.entity_delete_direct(entity_id);

         expect(event_handler).toHaveBeenCalledTimes(2);

         const removed_comp_names = event_handler.mock.calls.map(call => call[0][1].constructor.name);
         expect(removed_comp_names).toContain(CompA.name);
         expect(removed_comp_names).toContain(CompB.name);
      });

      it('should reuse a deleted entity id', async () => {
         const entity_id1 = await world.entity_create_direct();
         await world.entity_delete_direct(entity_id1);

         const deleted_pool = world.storage.get(ResourceEntitiesDeleted);
         expect(deleted_pool?.data.has(entity_id1)).toBe(true);

         const entity_id2 = await world.entity_create_direct();
         expect(entity_id2).toBe(entity_id1);
         expect(deleted_pool?.data.has(entity_id1)).toBe(false);
      });

      it('should delete multiple entities directly', async () => {
         const e1 = await world.entity_create_direct();
         const e2 = await world.entity_create_direct();
         const e3 = await world.entity_create_direct();

         const results = await world.entity_delete_multiple_direct([e1, e3]);
         expect(results.get(e1)).toBe(true);
         expect(results.get(e2)).toBeUndefined();
         expect(results.get(e3)).toBe(true);

         expect(world.entity_is_alive(e1)).toBe(false);
         expect(world.entity_is_alive(e2)).toBe(true);
         expect(world.entity_is_alive(e3)).toBe(false);
      });

      it('should find a single entity with specified components', async () => {
         const e1 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e1, [[CompA, {}]]);

         const e2 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e2, [[CompA, {}], [CompB, {}]]);

         const found_id = world.entity_find_direct([CompA.name, CompB.name]);
         expect(found_id).toBe(e2);
      });

      it('should return undefined when no entity matches find query', async () => {
         const e1 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e1, [[CompA, {}]]);

         const found_id = world.entity_find_direct([CompA.name, CompB.name]);
         expect(found_id).toBeUndefined();
      });

      it('should find multiple entities with specified components', async () => {
         const e1 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e1, [[CompA, {}], [CompB, {}]]);

         const e2 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e2, [[CompB, {}]]);

         const e3 = await world.entity_create_direct();
         await world.component_add_multiple_direct(e3, [[CompA, {}], [CompB, {}]]);

         const found_ids = world.entity_find_multiple_direct([CompA.name, CompB.name]);
         expect(found_ids.size).toBe(2);
         expect(found_ids).toContain(e1);
         expect(found_ids).toContain(e3);
      });

      it('should set an entity\'s parent directly', async () => {
         const parent_id = await world.entity_create_direct();
         const child_id = await world.entity_create_direct();

         const success = await world.entity_parent_set_direct(child_id, parent_id);
         expect(success).toBe(true);

         const child_of_comp = world.component_get(child_id, ComponentChildOf);
         expect(child_of_comp).toBeDefined();
         expect(child_of_comp?.target_entity_id).toBe(parent_id);

         expect(world.entity_parent_get(child_id)).toBe(parent_id);
         expect(world.entity_children_get(parent_id)).toContain(child_id);
      });

      it('should remove an entity\'s parent directly', async () => {
         const parent_id = await world.entity_create_direct();
         const child_id = await world.entity_create_direct();
         await world.entity_parent_set_direct(child_id, parent_id);

         expect(world.entity_parent_get(child_id)).toBe(parent_id);

         await world.entity_parent_set_direct(child_id, undefined);
         expect(world.entity_parent_get(child_id)).toBeUndefined();
         expect(world.component_has(child_id, ComponentChildOf.name)).toBe(false);
         expect(world.entity_children_get(parent_id)).not.toContain(child_id);
      });
   });
}