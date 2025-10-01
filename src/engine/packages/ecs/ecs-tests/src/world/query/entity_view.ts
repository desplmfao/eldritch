/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/query/entity_view.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Component } from '@eldritch-engine/ecs-core/types/component';

class CompA extends Component { }
class CompB extends Component { }
class CompC extends Component { }
class CompD extends Component { }

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('entity_view queries', () => {
      let world: World;

      let e_a: EntityId;
      let e_ab: EntityId;
      let e_ac: EntityId;
      let e_abc: EntityId;
      let e_b: EntityId;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 5
            }
         });

         e_a = await world.entity_spawn_direct({
            components: [
               [CompA, {}]
            ]
         });

         e_ab = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}]
            ]
         });

         e_ac = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompC, {}]
            ]
         });

         e_abc = await world.entity_spawn_direct({
            components: [
               [CompA, {}],
               [CompB, {}],
               [CompC, {}]
            ]
         });

         e_b = await world.entity_spawn_direct({
            components: [
               [CompB, {}]
            ]
         });
      });

      async function collect_view(
         options: {
            with?: string[];
            without?: string[];
         } = {}
      ): Promise<EntityId[]> {
         const results: EntityId[] = [];
         const view_iterator = world.entity_view(options);

         for await (const entity_id of view_iterator) {
            results.push(entity_id);
         }

         return results.sort((a, b) => a - b);
      }

      it('should find entities with a single component using `with`', async () => {
         const results = await collect_view({
            with: [CompA.name]
         });

         expect(results).toEqual([e_a, e_ab, e_ac, e_abc].sort());
      });

      it('should find entities with multiple components using `with`', async () => {
         const results = await collect_view({
            with: [CompA.name, CompB.name]
         });

         expect(results).toEqual([e_ab, e_abc].sort());
      });

      it('should find entities with a `without` filter', async () => {
         const results = await collect_view({
            with: [CompA.name],
            without: [CompC.name]
         });

         expect(results).toEqual([e_a, e_ab].sort());
      });

      it('should find entities with both `with` and `without` filters', async () => {
         const results = await collect_view({
            with: [CompA.name, CompB.name],
            without: [CompC.name]
         });

         expect(results).toEqual([e_ab]);
      });

      it('should find entities using only a `without` filter', async () => {
         const results = await collect_view({
            without: [CompC.name]
         });

         expect(results).toEqual([e_a, e_ab, e_b].sort());
      });

      it('should return an empty iterator when no entities match', async () => {
         const results = await collect_view({
            with: [CompD.name]
         });

         expect(results.length).toBe(0);
      });

      it('should not include deleted entities in the results', async () => {
         let results = await collect_view({
            with: [CompA.name, CompB.name]
         });

         expect(results).toContain(e_ab);

         await world.entity_delete_direct(e_ab);

         results = await collect_view({
            with: [CompA.name, CompB.name]
         });

         expect(results).not.toContain(e_ab);
         expect(results).toEqual([e_abc]);
      });

      it('should return an empty iterator for a query with no filters', async () => {
         const results = await collect_view({});

         expect(results.length).toBe(0);
      });
   });
}