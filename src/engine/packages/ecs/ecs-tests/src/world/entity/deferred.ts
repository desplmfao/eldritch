/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/entity/deferred.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

class CompA extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('deferred entity operations', () => {
      let world: World;
      let cmd_buffer: ResourceCommandBuffer;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         await world.add_plugin(new DefaultPlugins());
         await world.initialize();

         cmd_buffer = world.storage.get(ResourceCommandBuffer)!;
      });

      it('should defer spawning an entity and create it after flushing', async () => {
         world.entity_spawn_defer({
            components: [
               [CompA, {}]
            ]
         });

         expect(cmd_buffer.spawn_definitions.length).toBe(1);

         let found = world.entity_find_direct([CompA.name]);
         expect(found).toBeUndefined();

         await world.update(Schedule.FixedFlush);

         expect(cmd_buffer.spawn_definitions.length).toBe(0);
         found = world.entity_find_direct([CompA.name]);
         expect(found).toBeDefined();
         expect(world.entity_is_alive(found!)).toBe(true);
      });

      it('should defer deleting an entity and remove it after flushing', async () => {
         const entity_id = await world.entity_create_direct();
         expect(world.entity_is_alive(entity_id)).toBe(true);

         world.entity_delete_defer(entity_id);
         expect(cmd_buffer.delete_entity_commands.has(entity_id)).toBe(true);
         expect(world.entity_is_alive(entity_id)).toBe(true);

         await world.update(Schedule.FixedFlush);

         expect(cmd_buffer.delete_entity_commands.size).toBe(0);
         expect(world.entity_is_alive(entity_id)).toBe(false);
      });

      it('should cancel pending component adds if entity is deferred for deletion', async () => {
         const entity_id = await world.entity_create_direct();

         world.component_add_multiple_defer(entity_id, [[CompA, {}]]);
         expect(cmd_buffer.add_component_commands.has(entity_id)).toBe(true);

         world.entity_delete_defer(entity_id);
         expect(cmd_buffer.delete_entity_commands.has(entity_id)).toBe(true);
         expect(cmd_buffer.add_component_commands.has(entity_id)).toBe(false);

         await world.update(Schedule.FixedFlush);

         expect(world.entity_is_alive(entity_id)).toBe(false);
      });
   });
}