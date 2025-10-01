/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/features/grouping/base.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';

import { ComponentMemberOf } from '@eldritch-engine/ecs-core/ecs/components/grouping/member_of';
import { ComponentGroupMembers } from '@eldritch-engine/ecs-core/ecs/components/grouping/group_members';
import { ComponentIsLogicalGroup } from '@eldritch-engine/ecs-core/ecs/components/grouping/is_logical_group';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('relationship - grouping', () => {
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

      it('should add member to GroupMembers when MemberOf is added', async () => {
         const group_id = await world.entity_spawn_direct({ components: [[ComponentIsLogicalGroup, { group_name: 'Test Group' }]] });
         const member_id = await world.entity_create_direct();

         expect(world.component_has(group_id, ComponentGroupMembers.name)).toBe(false);

         await world.component_add_multiple_direct(member_id, [[ComponentMemberOf, { target_entity_id: group_id }]]);
         expect(world.component_has(group_id, ComponentGroupMembers.name)).toBe(true);

         const group_members_comp = world.component_get(group_id, ComponentGroupMembers);
         expect(group_members_comp?.source_entities.has(member_id)).toBe(true);
      });

      it('should remove member from GroupMembers when MemberOf is removed', async () => {
         const group_id = await world.entity_spawn_direct({ components: [[ComponentIsLogicalGroup, { group_name: 'Test Group' }]] });
         const member_id = await world.entity_create_direct();

         await world.component_add_multiple_direct(member_id, [[ComponentMemberOf, { target_entity_id: group_id }]]);
         await world.component_remove_multiple_direct(member_id, [ComponentMemberOf.name]);
         expect(world.component_has(group_id, ComponentGroupMembers.name)).toBe(false);
      });

      it('should update old and new groups when MemberOf target changes', async () => {
         const group1_id = await world.entity_spawn_direct({ components: [[ComponentIsLogicalGroup, { group_name: 'Group 1' }]] });
         const group2_id = await world.entity_spawn_direct({ components: [[ComponentIsLogicalGroup, { group_name: 'Group 2' }]] });
         const member_id = await world.entity_create_direct();

         await world.component_add_multiple_direct(member_id, [[ComponentMemberOf, { target_entity_id: group1_id }]]);

         let group1_members = world.component_get(group1_id, ComponentGroupMembers);
         expect(group1_members?.source_entities.has(member_id)).toBe(true);

         await world.component_add_multiple_direct(member_id, [[ComponentMemberOf, { target_entity_id: group2_id }]]);
         expect(world.component_has(group1_id, ComponentGroupMembers.name)).toBe(false);

         let group2_members = world.component_get(group2_id, ComponentGroupMembers);
         expect(group2_members?.source_entities.has(member_id)).toBe(true);
      });

      it('should NOT delete members when group is deleted (linked_spawn: false)', async () => {
         const group_id = await world.entity_spawn_direct({ components: [[ComponentIsLogicalGroup, { group_name: 'Test Group' }]] });
         const member_id = await world.entity_create_direct();

         await world.component_add_multiple_direct(member_id, [[ComponentMemberOf, { target_entity_id: group_id }]]);
         expect(world.entity_is_alive(group_id)).toBe(true);
         expect(world.entity_is_alive(member_id)).toBe(true);

         await world.entity_delete_direct(group_id);
         expect(world.entity_is_alive(group_id)).toBe(false);
         expect(world.entity_is_alive(member_id)).toBe(true);
         expect(world.component_has(member_id, ComponentMemberOf.name)).toBe(true);
      });
   });
}