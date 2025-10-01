/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/component/direct.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

class CompA extends Component {
   value: string = 'A';

   constructor(
      options?: Omit<CompA, 'dependencies'>
   ) {
      super();

      Object.assign(this, options);
   }
}

class CompB extends Component {
   override dependencies = {
      components: [CompA.name]
   };

   count: number = 0;
}

class CompC extends Component {
   active: boolean = true;
}

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('direct component operations', () => {
      let world: World;
      let entity_id: EntityId;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         entity_id = await world.entity_create_direct();
      });

      it('should add a single component to an entity', async () => {
         const success = await world.component_add_multiple_direct(entity_id, [[CompA, {}]]);

         expect(success).toBe(true);
         expect(world.component_has(entity_id, CompA.name)).toBe(true);
      });

      it('should add multiple components to an entity', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}], [CompC, {}]]);

         expect(world.component_has(entity_id, CompA.name)).toBe(true);
         expect(world.component_has(entity_id, CompC.name)).toBe(true);
      });

      it('should overwrite an existing component', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, { value: 'initial' }]]);

         let comp_a = world.component_get(entity_id, CompA);
         expect(comp_a?.value).toBe('initial');

         await world.component_add_multiple_direct(entity_id, [[CompA, { value: 'overwritten' }]]);
         comp_a = world.component_get(entity_id, CompA);
         expect(comp_a?.value).toBe('overwritten');
      });

      it('should remove a component from an entity', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}]]);

         const success = await world.component_remove_multiple_direct(entity_id, [CompA.name]);

         expect(success).toBe(true);
         expect(world.component_has(entity_id, CompA.name)).toBe(false);
      });

      it('should not fail when removing a non-existent component', async () => {
         const success = await world.component_remove_multiple_direct(entity_id, [CompA.name]);

         expect(success).toBe(false);
      });

      it('should validate and add a component with dependencies', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}]]);

         const success = await world.component_add_multiple_direct(entity_id, [[CompB, {}]]);

         expect(success).toBe(true);
         expect(world.component_has(entity_id, CompB.name)).toBe(true);
      });

      it('should throw when adding a component with unmet dependencies', async () => {
         const add_comp_b = world.component_add_multiple_direct(entity_id, [[CompB, {}]]);

         expect(add_comp_b).rejects.toThrow(new RegExp(`entity '${entity_id}': validation failed adding component '${CompB.name}'`));
      });

      it('should throw when removing a component that another component depends on', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}], [CompB, {}]]);

         const remove_comp_a = world.component_remove_multiple_direct(entity_id, [CompA.name]);

         expect(remove_comp_a).rejects.toThrow(`entity '${entity_id}': cannot remove component '${CompA.name}'. component '${CompB.name}' depends on it and is not being removed simultaneously`);
      });

      it('should succeed removing components when dependencies are also removed', async () => {
         await world.component_add_multiple_direct(entity_id, [[CompA, {}], [CompB, {}]]);

         const success = await world.component_remove_multiple_direct(entity_id, [CompA.name, CompB.name]);

         expect(success).toBe(true);
         expect(world.component_has(entity_id, CompA.name)).toBe(false);
         expect(world.component_has(entity_id, CompB.name)).toBe(false);
      });
   });
}