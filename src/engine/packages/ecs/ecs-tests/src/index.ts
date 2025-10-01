/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/index.ts
 */

import { describe } from 'bun:test';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';

import { make_test as world_base_test } from '@self/world/base';
import { make_test as world_component_deferred_test } from '@self/world/component/deferred';
import { make_test as world_component_direct_test } from '@self/world/component/direct';
import { make_test as world_component_find_test } from '@self/world/component/find';
import { make_test as world_component_has_test } from '@self/world/component/has';
import { make_test as world_entity_deferred_test } from '@self/world/entity/deferred';
import { make_test as world_entity_direct_test } from '@self/world/entity/direct';
import { make_test as world_entity_spawn_recursive_test } from '@self/world/entity/spawn/recursive';
import { make_test as world_entity_spawn_single_test } from '@self/world/entity/spawn/single';
import { make_test as world_features_collaring_base_test } from '@self/world/features/collaring/base';
import { make_test as world_features_grouping_base_test } from '@self/world/features/grouping/base';
import { make_test as world_features_relationship_hierarchy_test } from '@self/world/features/relationship/hierarchy';
import { make_test as world_query_entity_view_test } from '@self/world/query/entity_view';
import { make_test as world_query_view_test } from '@self/world/query/view';
import { make_test as parts_master_scheduler_test } from '@self/parts/master_scheduler';
import { make_test as parts_observer_test } from '@self/parts/observer';
import { make_test as parts_plugin_management_test } from '@self/parts/plugin_management';
import { make_test as parts_scheduler_test } from '@self/parts/scheduler';

export async function run_all_tests(
   storage_backend: IWorldStorageBackend,
) {
   describe('ecs core', () => {
      describe('engine parts', () => {
         parts_master_scheduler_test(storage_backend);
         parts_observer_test(storage_backend);
         parts_plugin_management_test(storage_backend);
         parts_scheduler_test(storage_backend);
      });

      describe('world', () => {
         world_base_test(storage_backend);

         describe('components', () => {
            world_component_deferred_test(storage_backend);
            world_component_direct_test(storage_backend);
            world_component_find_test(storage_backend);
            world_component_has_test(storage_backend);
         });

         describe('entities', () => {
            world_entity_deferred_test(storage_backend);
            world_entity_direct_test(storage_backend);
            world_entity_spawn_recursive_test(storage_backend);
            world_entity_spawn_single_test(storage_backend);
         });

         describe('features', () => {
            world_features_collaring_base_test(storage_backend);
            world_features_grouping_base_test(storage_backend);
            world_features_relationship_hierarchy_test(storage_backend);
         });

         describe('queries', () => {
            world_query_entity_view_test(storage_backend);
            world_query_view_test(storage_backend);
         });
      });
   });
}