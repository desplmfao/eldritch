/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/component/find.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Component } from '@eldritch-engine/ecs-core/types/component';

class CompA extends Component { }
class CompB extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('entity_find_direct and entity_find_multiple_direct', () => {
      let world: World;

      let e1: number;
      let e2: number;
      let e3: number;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         e1 = await world.entity_spawn_direct({
            components: [
               [CompA, {}]
            ]
         });

         e2 = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}]
            ]
         });

         e3 = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}]
            ]
         });
      });

      it('entity_find_direct should find an entity with a single component', () => {
         const found = world.entity_find_direct([CompA.name])!;

         expect([e1, e2, e3]).toContain(found);
      });

      it('entity_find_direct should find an entity with multiple components', () => {
         const found = world.entity_find_direct([CompA.name, CompB.name])!;

         expect([e2, e3]).toContain(found);
      });

      it('entity_find_direct should return undefined if no entity matches', () => {
         class CompC extends Component { }

         const found = world.entity_find_direct([CompC.name]);
         expect(found).toBeUndefined();
      });

      it('entity_find_direct should not find deleted entities', async () => {
         await world.entity_delete_direct(e2);

         const found = world.entity_find_direct([CompA.name, CompB.name]);
         expect(found).toBe(e3);
      });

      it('entity_find_multiple_direct should find all entities with specified components', () => {
         const found = world.entity_find_multiple_direct([CompA.name, CompB.name]);
         expect(found.size).toBe(2);
         expect(found).toContain(e2);
         expect(found).toContain(e3);
      });

      it('entity_find_multiple_direct should return an empty set if no entities match', () => {
         class CompC extends Component { }

         const found = world.entity_find_multiple_direct([CompC.name]);
         expect(found.size).toBe(0);
      });

      it('entity_find_multiple_direct should not find deleted entities', async () => {
         await world.entity_delete_direct(e2);

         const found = world.entity_find_multiple_direct([CompA.name, CompB.name]);
         expect(found.size).toBe(1);
         expect(found).toContain(e3);
      });
   });
}