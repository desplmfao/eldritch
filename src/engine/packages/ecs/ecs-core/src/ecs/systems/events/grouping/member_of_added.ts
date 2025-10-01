/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/systems/events/grouping/member_of_added.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import { WorldEventHandler } from '@self/types/event_handler';
import type { EventArgs } from '@self/types/event';
import type { Res } from '@self/types/markers';

import { ComponentMemberOf } from '@self/ecs/components/grouping/member_of';
import { ComponentGroupMembers } from '@self/ecs/components/grouping/group_members';

import { ResourceRelationshipRegistry } from '@self/ecs/resources/relationship';

import {
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

import {
   relationship_get_metadata,
   update_new_target_on_relationship_added,
   update_target_on_relationship_removed,
   type RelationshipHandlerContext
} from '@self/operations/relationship';

export class EventOnRelationshipMemberOfAdded extends WorldEventHandler<'component_added'> {
   async update(
      args: EventArgs['component_added'],
      //
      world: IWorld,
      //
      relationship_registry: Res<ResourceRelationshipRegistry>,
      //
      component_updates: Res<ResourceComponentUpdates>,
      component_last_write_tick: Res<ResourceComponentLastWriteTick>,
      //
      world_tick: Res<ResourceWorldTick>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const [source_entity_id, added_component_generic, context] = args;

      if (!(added_component_generic instanceof ComponentMemberOf)) {
         return;
      }

      const added_component = added_component_generic as ComponentMemberOf;
      const old_relationship_state = context?.overwritten_component as ComponentMemberOf | undefined;

      const metadata = relationship_get_metadata(relationship_registry, ComponentMemberOf.name);

      if (!metadata) {
         logger.warn(`entity ${source_entity_id}: handling add for ${ComponentMemberOf.name}, but no metadata found`);

         return;
      }

      if (metadata.target_type !== ComponentGroupMembers.name) {
         logger.warn(`entity ${source_entity_id}: ${ComponentMemberOf.name} metadata target type mismatch. expected ${ComponentGroupMembers.name}, got ${metadata.target_type}`);

         return;
      }

      const handler_context: RelationshipHandlerContext = {
         world,
         resources: {
            component_updates,
            component_last_write_tick,
            world_tick
         },
         metadata,
         TargetComponentConstructor: ComponentGroupMembers,
         notifications: {}
      };

      if (
         old_relationship_state
         && old_relationship_state.target_entity_id !== added_component.target_entity_id
      ) {
         await update_target_on_relationship_removed(
            handler_context,
            source_entity_id,
            old_relationship_state,
            /** is_overwrite */ true
         );
      }

      await update_new_target_on_relationship_added(
         handler_context,
         source_entity_id,
         added_component,
         old_relationship_state?.target_entity_id
      );
   }
}