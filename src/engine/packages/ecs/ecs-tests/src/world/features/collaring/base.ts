/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/features/collaring/base.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentTag } from '@eldritch-engine/ecs-core/ecs/components/collaring/tag';
import { ComponentCollar } from '@eldritch-engine/ecs-core/ecs/components/collaring/collar';

class MyTagA extends ComponentTag { }
class MyTagB extends ComponentTag { }
class MyTagC extends ComponentTag { }
class NonTagComponent extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('world - collaring and tagging system', () => {
      let world: World;
      let entity_id: EntityId;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         await world.add_plugin(new DefaultPlugins());

         entity_id = await world.entity_create_direct();
      });

      it('should add a tag name to the collar when a tag component is added', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}]]);

         const collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toEqual([MyTagA.name]);
      });

      it('should not modify the collar if a non-tag component is added', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);
         await world.component_add_multiple_direct(entity_id, [[NonTagComponent, {}]]);

         const collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toEqual([]);
      });

      it('should do nothing if a tag is added to an entity without a collar', async () => {
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}]]);

         expect(world.component_has(entity_id, MyTagA.name)).toBe(true);
      });

      it('should add multiple tag names to the collar and keep them sorted', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);

         await world.component_add_multiple_direct(entity_id, [[MyTagC, {}]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagB, {}]]);

         const collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toEqual([MyTagA.name, MyTagB.name, MyTagC.name]);
      });

      it('should remove a tag name from the collar when a tag component is removed', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}], [MyTagB, {}]]);

         let collar = world.component_get(entity_id, ComponentCollar);
         expect(collar?.associated_tag_names).toEqual([MyTagA.name, MyTagB.name]);

         await world.component_remove_multiple_direct(entity_id, [MyTagA.name]);

         collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toEqual([MyTagB.name]);
      });

      it('should handle removing a tag that is not on the collar', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagB, {}]]);

         await world.component_remove_multiple_direct(entity_id, [MyTagA.name]);

         const collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toEqual([MyTagB.name]);
      });

      it('should not add a duplicate tag name to the collar', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}]]);

         const collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toHaveLength(1);
         expect(collar?.associated_tag_names).toEqual([MyTagA.name]);
      });

      it('should not modify the collar when a non-tag component is removed', async () => {
         await world.component_add_multiple_direct(entity_id, [[ComponentCollar, { associated_tag_names: [] }]]);
         await world.component_add_multiple_direct(entity_id, [[MyTagA, {}], [NonTagComponent, {}]]);

         let collar = world.component_get(entity_id, ComponentCollar);
         expect(collar?.associated_tag_names).toEqual([MyTagA.name]);

         await world.component_remove_multiple_direct(entity_id, [NonTagComponent.name]);

         collar = world.component_get(entity_id, ComponentCollar);
         expect(collar).toBeDefined();
         expect(collar?.associated_tag_names).toEqual([MyTagA.name]);
      });
   });
}