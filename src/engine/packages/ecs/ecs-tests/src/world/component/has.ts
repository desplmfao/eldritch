/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/component/has.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

class CompA extends Component { }
class CompB extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('component_has and component_has_multiple', () => {
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

         await world.component_add_multiple_direct(entity_id, [[CompA, {}]]);
      });

      it('component_has should return true if component exists', () => {
         expect(world.component_has(entity_id, CompA.name)).toBe(true);
      });

      it('component_has should return false if component does not exist', () => {
         expect(world.component_has(entity_id, CompB.name)).toBe(false);
      });

      it('component_has should return false for a non-existent entity', () => {
         expect(world.component_has(999, CompA.name)).toBe(false);
      });

      it('component_has should return false for a deleted entity', async () => {
         await world.entity_delete_direct(entity_id);

         expect(world.component_has(entity_id, CompA.name)).toBe(false);
      });

      it('component_has_multiple should return in order', async () => {
         const results = world.component_has_multiple(entity_id, [CompA.name, CompB.name]);
         expect(results).toEqual([true, false]);
      });

      it('component_has_multiple should return all false for a non-existent entity', () => {
         const results = world.component_has_multiple(999, [CompA.name, CompB.name]);
         expect(results).toEqual([false, false]);
      });
   });
}