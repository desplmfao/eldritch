/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/default_plugins.ts
 */

import type { IWorld } from '@self/types/world';
import { Plugin } from '@self/types/plugin';
import { Schedule } from '@self/types/schedule';

import { SystemApplyEntityCommands } from '@self/ecs/systems/apply_entity_commands';

import { EventOnRelationshipChildOfAdded } from '@self/ecs/systems/events/relationship/child_of_added';
import { EventOnRelationshipChildOfRemoved } from '@self/ecs/systems/events/relationship/child_of_removed';
import { EventOnRelationshipMemberOfAdded } from '@self/ecs/systems/events/grouping/member_of_added';
import { EventOnRelationshipMemberOfRemoved } from '@self/ecs/systems/events/grouping/member_of_removed';
import { EventOnTagAdded } from '@self/ecs/systems/events/collaring/tag_added';
import { EventOnTagRemoved } from '@self/ecs/systems/events/collaring/tag_removed';

import { ResourceRelationshipRegistry } from '@self/ecs/resources/relationship';
import { ResourceReflectionMap } from '@self/ecs/resources/reflection';

import { ComponentChildOf } from '@self/ecs/components/relationship/child_of';
import { ComponentChildren } from '@self/ecs/components/relationship/children';
import { ComponentGroupMembers } from '@self/ecs/components/grouping/group_members';
import { ComponentMemberOf } from '@self/ecs/components/grouping/member_of';

import { relationship_register } from '@self/operations/relationship';

import { inject_query, injection_type as injection_type_query } from '@self/reflect/builtins/query';
import { inject_resource, injection_type as injection_type_resource } from '@self/reflect/builtins/resource';
import { inject_local, injection_type as injection_type_local } from '@self/reflect/builtins/local';

export class DefaultPlugins extends Plugin {
   async build(
      world: IWorld
   ) {
      const relationship_registry = world.storage.get(ResourceRelationshipRegistry)!;
      const reflection_map = world.storage.get(ResourceReflectionMap)!;

      relationship_register(
         relationship_registry,
         //
         ComponentChildOf.name,
         ComponentChildren.name,
         {
            linked_spawn: true
         }
      );

      relationship_register(
         relationship_registry,
         //
         ComponentMemberOf.name,
         ComponentGroupMembers.name,
         {
            linked_spawn: false
         }
      );

      reflection_map.register_injection_resolver(injection_type_query, inject_query);
      reflection_map.register_injection_resolver(injection_type_resource, inject_resource);
      reflection_map.register_injection_resolver(injection_type_local, inject_local);

      await world.subscribe('component_added', new EventOnRelationshipChildOfAdded());
      await world.subscribe('component_removed', new EventOnRelationshipChildOfRemoved());

      await world.subscribe('component_added', new EventOnRelationshipMemberOfAdded());
      await world.subscribe('component_removed', new EventOnRelationshipMemberOfRemoved());

      await world.subscribe('component_added', new EventOnTagAdded());
      await world.subscribe('component_removed', new EventOnTagRemoved());

      await this.scheduler.system_add_multiple([
         [Schedule.FixedFlush, new SystemApplyEntityCommands()]
      ]);

      return true;
   }
}