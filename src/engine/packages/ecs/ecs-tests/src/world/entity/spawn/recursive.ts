/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/entity/spawn/recursive.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

class Name extends Component {
   name?: string;
}

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('recursive entity spawning', () => {
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

      it('should recursively spawn a multi-level hierarchy (deferred)', async () => {
         world.entity_spawn_defer({
            components: [
               [Name, { name: 'parent' }]
            ],
            children: [
               {
                  components: [
                     [Name, { name: 'child 1' }]
                  ],
                  children: [
                     {
                        components: [
                           [Name, { name: 'grandchild 1.1' }]
                        ]
                     },
                     {
                        components: [
                           [Name, { name: 'grandchild 1.2' }]
                        ]
                     }
                  ]
               },
               {
                  components: [
                     [Name, { name: 'child 2' }]
                  ]
               }
            ]
         });

         await world.update(Schedule.FixedFlush);

         const parent_id = world.entity_find_direct([Name.name]);
         expect(parent_id).toBeDefined();
         expect(world.component_get(parent_id!, Name)?.name).toBe('parent');

         const children_ids = world.entity_children_get(parent_id!);
         expect(children_ids.length).toBe(2);

         let child1_id!: EntityId;
         let child2_id!: EntityId;

         for (const id of children_ids) {
            const name_comp = world.component_get(id, Name);

            if (name_comp?.name === 'child 1') {
               child1_id = id;
            }

            if (name_comp?.name === 'child 2') {
               child2_id = id;
            }
         }

         expect(child1_id).toBeDefined();
         expect(child2_id).toBeDefined();

         const grandchildren_ids = world.entity_children_get(child1_id!);
         expect(grandchildren_ids.length).toBe(2);

         let grandchild1_name!: string;
         let grandchild2_name!: string;

         for (const id of grandchildren_ids) {
            const name_comp = world.component_get(id, Name);

            if (name_comp?.name === 'grandchild 1.1') {
               grandchild1_name = name_comp.name;

               expect(world.entity_parent_get(id)).toBe(child1_id);
            }

            if (name_comp?.name === 'grandchild 1.2') {
               grandchild2_name = name_comp.name;

               expect(world.entity_parent_get(id)).toBe(child1_id);
            }
         }

         expect(grandchild1_name).toBe('grandchild 1.1');
         expect(grandchild2_name).toBe('grandchild 1.2');

         expect(world.entity_children_get(child2_id!).length).toBe(0);
      });

      it('should recursively spawn a multi-level hierarchy (direct)', async () => {
         const parent_id = await world.entity_spawn_direct({
            components: [
               [Name, { name: 'parent' }]
            ],
            children: [
               {
                  components: [
                     [Name, { name: 'child 1' }]
                  ],
                  children: [
                     {
                        components: [
                           [Name, { name: 'grandchild 1.1' }]
                        ]
                     },
                     {
                        components: [
                           [Name, { name: 'grandchild 1.2' }]
                        ]
                     }
                  ]
               },
               {
                  components: [
                     [Name, { name: 'child 2' }]
                  ]
               }
            ]
         });

         expect(parent_id).toBeDefined();
         expect(world.component_get(parent_id!, Name)?.name).toBe('parent');

         const children_ids = world.entity_children_get(parent_id!);
         expect(children_ids.length).toBe(2);

         let child1_id!: EntityId;
         let child2_id!: EntityId;

         for (const id of children_ids) {
            const name_comp = world.component_get(id, Name);

            if (name_comp?.name === 'child 1') {
               child1_id = id;
            }

            if (name_comp?.name === 'child 2') {
               child2_id = id;
            }
         }

         expect(child1_id).toBeDefined();
         expect(child2_id).toBeDefined();

         const grandchildren_ids = world.entity_children_get(child1_id!);
         expect(grandchildren_ids.length).toBe(2);

         let grandchild1_found = false;
         let grandchild2_found = false;

         for (const id of grandchildren_ids) {
            const name_comp = world.component_get(id, Name);

            if (name_comp?.name === 'grandchild 1.1') {
               grandchild1_found = true;
            }

            if (name_comp?.name === 'grandchild 1.2') {
               grandchild2_found = true;
            }
         }

         expect(grandchild1_found).toBe(true);
         expect(grandchild2_found).toBe(true);
      });
   });
}