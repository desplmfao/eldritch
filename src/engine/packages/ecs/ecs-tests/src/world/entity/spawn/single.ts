/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/entity/spawn/single.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

class CompA extends Component {
   value: string = 'a';
}

class CompB extends Component { }
class CompC extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('spawning single entities', () => {
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

      async function flush_commands() {
         await world.update(Schedule.FixedFlush);
      }

      it('should spawn an entity directly with components', async () => {
         const entity_id = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}]
            ]
         });

         expect(world.entity_is_alive(entity_id)).toBe(true);
         expect(world.component_has(entity_id, CompA.name)).toBe(true);
         expect(world.component_has(entity_id, CompB.name)).toBe(true);

         const comp_a = world.component_get(entity_id, CompA);
         expect(comp_a?.value).toBe('a');
      });

      it('should spawn an entity directly with children', async () => {
         const parent_id = await world.entity_spawn_direct({
            components: [
               [CompA, {}]
            ],
            children: [
               {
                  components: [
                     [CompB, {}]
                  ]
               },
               {
                  components: [
                     [CompC, {}]
                  ]
               }
            ]
         });

         expect(world.entity_is_alive(parent_id)).toBe(true);
         const children = world.entity_children_get(parent_id);
         expect(children.length).toBe(2);

         const child1_id = children.find(id => world.component_has(id, CompB.name));
         const child2_id = children.find(id => world.component_has(id, CompC.name));

         expect(child1_id).toBeDefined();
         expect(world.entity_is_alive(child1_id!)).toBe(true);
         expect(world.entity_parent_get(child1_id!)).toBe(parent_id);

         expect(child2_id).toBeDefined();
         expect(world.entity_is_alive(child2_id!)).toBe(true);
         expect(world.entity_parent_get(child2_id!)).toBe(parent_id);
      });

      it('should spawn an entity deferred with components', async () => {
         world.entity_spawn_defer({
            components: [
               [CompA, { value: 'deferred' }]
            ]
         });

         await flush_commands();

         const entity_id = world.entity_find_direct([CompA.name]);
         expect(entity_id).toBeDefined();
         expect(world.entity_is_alive(entity_id!)).toBe(true);
         const comp_a = world.component_get(entity_id!, CompA);
         expect(comp_a?.value).toBe('deferred');
      });
   });
}