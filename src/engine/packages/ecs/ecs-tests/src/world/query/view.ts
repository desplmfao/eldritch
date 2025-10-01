/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/query/view.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Component, type ComponentConstructor } from '@eldritch-engine/ecs-core/types/component';

class CompA extends Component { }
class CompB extends Component { }
class CompC extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('view queries', () => {
      let world: World;

      let e_ab: EntityId;
      let e_ac: EntityId;
      let e_b: EntityId;
      let e_abc: EntityId;

      let comp_a_on_ab: CompA;
      let comp_b_on_ab: CompB;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         const comp_a_initializer = { value: 'from e_ab' };
         const comp_b_initializer = { count: 123 };

         e_ab = await world.entity_spawn_direct({
            components: [
               [CompA, comp_a_initializer],
               [CompB, comp_b_initializer]
            ]
         });

         [comp_a_on_ab, comp_b_on_ab] = world.component_get_multiple(e_ab, [CompA, CompB]) as [CompA, CompB];

         e_ac = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompC, {}]
            ]
         });

         e_b = await world.entity_spawn_direct({
            components: [
               [CompB, {}]
            ]
         });

         e_abc = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}],
               [CompC, {}]
            ]
         });
      });

      async function collect_view(
         components: ComponentConstructor[],
         options?: {
            with?: string[],
            without?: string[]
         }
      ) {
         const results = [];
         const component_names = components.map(c => c.name);
         const view_iterator = world.component_view(component_names, options);

         for await (const result of view_iterator) {
            results.push(result);
         }

         return results.sort((a, b) => a[0] - b[0]);
      }

      it('should find entities with a single component', async () => {
         const results = await collect_view([CompA]);
         expect(results.length).toBe(3);

         const ids = results.map(r => r[0]);
         expect(ids).toEqual([e_ab, e_ac, e_abc].sort());
      });

      it('should find entities with multiple components', async () => {
         const results = await collect_view([CompA, CompB]);
         expect(results.length).toBe(2);

         const ids = results.map(r => r[0]);
         expect(ids).toEqual([e_ab, e_abc].sort());
      });

      it('should return component instances in the correct order', async () => {
         const results = await collect_view([CompA, CompB]);
         const e_ab_result = results.find(r => r[0] === e_ab);
         expect(e_ab_result).toBeDefined();

         const [id, components] = e_ab_result!;
         expect(id).toBe(e_ab);
         expect(components.length).toBe(2);
         expect(components[0]).toBeInstanceOf(CompA);
         expect(components[1]).toBeInstanceOf(CompB);
         expect(components[0]).toBe(comp_a_on_ab);
         expect(components[1]).toBe(comp_b_on_ab);
      });

      it('should find entities with a `with` filter', async () => {
         const results = await collect_view([CompA], { with: [CompC.name] });
         expect(results.length).toBe(2);

         const ids = results.map(r => r[0]);
         expect(ids).toEqual([e_ac, e_abc].sort());
      });

      it('should find entities with a `without` filter', async () => {
         const results = await collect_view([CompA], { without: [CompB.name] });

         expect(results.length).toBe(1);
         expect(results[0]![0]).toBe(e_ac);
      });

      it('should find entities with both `with` and `without` filters', async () => {
         const results = await collect_view([CompA], {
            with: [CompB.name],
            without: [CompC.name]
         });

         expect(results.length).toBe(1);
         expect(results[0]![0]).toBe(e_ab);
      });

      it('should return an empty iterator when no entities match', async () => {
         class CompD extends Component { }

         const results = await collect_view([CompD]);
         expect(results.length).toBe(0);
      });

      it('should not include deleted entities in the results', async () => {
         await world.entity_delete_direct(e_ab);

         const results = await collect_view([CompA, CompB]);
         expect(results.length).toBe(1);
         expect(results[0]![0]).toBe(e_abc);
      });
   });
}