/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/features/relationship/hierarchy.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';

import { ComponentChildOf } from '@eldritch-engine/ecs-core/ecs/components/relationship/child_of';
import { ComponentChildren } from '@eldritch-engine/ecs-core/ecs/components/relationship/children';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('relationship - hierarchy', () => {
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

      it('should automatically add ComponentChildren when ComponentChildOf is added', async () => {
         const parent_id = await world.entity_create_direct();
         const child_id = await world.entity_create_direct();

         expect(world.component_has(parent_id, ComponentChildren.name)).toBe(false);

         await world.component_add_multiple_direct(child_id, [[ComponentChildOf, { target_entity_id: parent_id }]]);
         expect(world.component_has(parent_id, ComponentChildren.name)).toBe(true);

         const children_comp = world.component_get(parent_id, ComponentChildren);
         expect(children_comp?.source_entities.has(child_id)).toBe(true);
      });

      it('should automatically remove from ComponentChildren when ComponentChildOf is removed', async () => {
         const parent_id = await world.entity_create_direct();
         const child_id = await world.entity_create_direct();

         await world.component_add_multiple_direct(child_id, [[ComponentChildOf, { target_entity_id: parent_id }]]);
         await world.component_remove_multiple_direct(child_id, [ComponentChildOf.name]);
         expect(world.component_has(parent_id, ComponentChildren.name)).toBe(false);
      });

      it('should update old and new parents when ComponentChildOf target changes', async () => {
         const parent1_id = await world.entity_create_direct();
         const parent2_id = await world.entity_create_direct();
         const child_id = await world.entity_create_direct();

         await world.component_add_multiple_direct(child_id, [[ComponentChildOf, { target_entity_id: parent1_id }]]);
         expect(world.entity_children_get(parent1_id)).toContain(child_id);

         await world.component_add_multiple_direct(child_id, [[ComponentChildOf, { target_entity_id: parent2_id }]]);
         expect(world.component_has(parent1_id, ComponentChildren.name)).toBe(false);
         expect(world.entity_children_get(parent2_id)).toContain(child_id);
         expect(world.entity_parent_get(child_id)).toBe(parent2_id);
      });

      it('should recursively delete children when parent is deleted (linked_spawn: true)', async () => {
         const parent_id = await world.entity_create_direct();
         const child_id = await world.entity_create_direct();
         const grandchild_id = await world.entity_create_direct();

         await world.entity_parent_set_direct(child_id, parent_id);
         await world.entity_parent_set_direct(grandchild_id, child_id);
         expect(world.entity_is_alive(parent_id)).toBe(true);
         expect(world.entity_is_alive(child_id)).toBe(true);
         expect(world.entity_is_alive(grandchild_id)).toBe(true);

         await world.entity_delete_direct(parent_id);
         expect(world.entity_is_alive(parent_id)).toBe(false);
         expect(world.entity_is_alive(child_id)).toBe(false);
         expect(world.entity_is_alive(grandchild_id)).toBe(false);
      });

      it('should notify entity_parent_set event on change', async () => {
         const parent1 = await world.entity_create_direct();
         const parent2 = await world.entity_create_direct();
         const child = await world.entity_create_direct();

         const handler = mock((args) => { });
         await world.subscribe('entity_parent_set', { update: handler });

         await world.entity_parent_set_direct(child, parent1);
         expect(handler).toHaveBeenCalledTimes(1);
         expect(handler.mock.calls[0]![0]).toEqual([child, parent1, undefined]);

         await world.entity_parent_set_direct(child, parent2);
         expect(handler).toHaveBeenCalledTimes(2);
         expect(handler.mock.calls[1]![0]).toEqual([child, parent2, parent1]);

         await world.entity_parent_set_direct(child, undefined);
         expect(handler).toHaveBeenCalledTimes(3);
         expect(handler.mock.calls[2]![0]).toEqual([child, undefined, parent2]);
      });
   });
}