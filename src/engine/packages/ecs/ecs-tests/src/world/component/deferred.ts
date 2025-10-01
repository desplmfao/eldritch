/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/component/deferred.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

class CompA extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('deferred component operations', () => {
      let world: World;

      let cmd_buffer: ResourceCommandBuffer;
      let entity_id: EntityId;

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
         entity_id = await world.entity_create_direct();
      });

      it('should defer adding a component', async () => {
         world.component_add_multiple_defer(entity_id, [[CompA, {}]]);

         expect(world.component_has(entity_id, CompA.name)).toBe(false);
         expect(cmd_buffer.add_component_commands.get(entity_id)).toBeDefined();

         await world.update(Schedule.FixedFlush);

         expect(world.component_has(entity_id, CompA.name)).toBe(true);
         expect(cmd_buffer.add_component_commands.size).toBe(0);
      });

      it('should defer removing a component', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}]]);

         world.component_remove_multiple_defer(entity_id, [CompA.name]);

         expect(world.component_has(entity_id, CompA.name)).toBe(true);
         expect(cmd_buffer.remove_component_commands.get(entity_id)).toBeDefined();

         await world.update(Schedule.FixedFlush);

         expect(world.component_has(entity_id, CompA.name)).toBe(false);
         expect(cmd_buffer.remove_component_commands.size).toBe(0);
      });

      it('should cancel a deferred add with a deferred remove', async () => {
         world.component_add_multiple_defer(entity_id, [[CompA, {}]]);
         world.component_remove_multiple_defer(entity_id, [CompA.name]);

         expect(cmd_buffer.add_component_commands.get(entity_id)?.length ?? 0).toBe(0);
         expect(cmd_buffer.remove_component_commands.get(entity_id)?.has(CompA.name)).toBe(true);

         await world.update(Schedule.FixedFlush);

         expect(world.component_has(entity_id, CompA.name)).toBe(false);
      });

      it('should cancel a deferred remove with a deferred add', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}]]);

         world.component_remove_multiple_defer(entity_id, [CompA.name]);
         world.component_add_multiple_defer(entity_id, [[CompA, {}]]);

         expect(cmd_buffer.remove_component_commands.get(entity_id)?.has(CompA.name)).toBe(false);
         expect(cmd_buffer.add_component_commands.get(entity_id)?.length).toBe(1);

         await world.update(Schedule.FixedFlush);

         expect(world.component_has(entity_id, CompA.name)).toBe(true);
      });
   });
}