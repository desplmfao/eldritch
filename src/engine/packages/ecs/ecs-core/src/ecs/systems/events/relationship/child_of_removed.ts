/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/systems/events/relationship/child_of_removed.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import { WorldEventHandler } from '@self/types/event_handler';
import type { EventArgs } from '@self/types/event';
import type { Res } from '@self/types/markers';

import { ComponentChildOf } from '@self/ecs/components/relationship/child_of';
import { ComponentChildren } from '@self/ecs/components/relationship/children';

import { ResourceRelationshipRegistry } from '@self/ecs/resources/relationship';

import {
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

import {
   relationship_get_metadata,
   update_target_on_relationship_removed,
   type RelationshipHandlerContext
} from '@self/operations/relationship';

export class EventOnRelationshipChildOfRemoved extends WorldEventHandler<'component_removed'> {
   async update(
      args: EventArgs['component_removed'],
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

      const [source_entity_id, removed_component_generic, context] = args;

      if (context?.is_overwrite) {
         return;
      }

      if (!(removed_component_generic instanceof ComponentChildOf)) {
         return;
      }

      const removed_component = removed_component_generic as ComponentChildOf;

      const metadata = relationship_get_metadata(relationship_registry, ComponentChildOf.name);

      if (!metadata) {
         logger.warn(`entity ${source_entity_id}: handling remove for ${ComponentChildOf.name}, but no metadata found.`);

         return;
      }

      if (metadata.target_type !== ComponentChildren.name) {
         logger.warn(`entity ${source_entity_id}: ${ComponentChildOf.name} metadata target type mismatch. expected ${ComponentChildren.name}, got ${metadata.target_type}`);

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
         TargetComponentConstructor: ComponentChildren,
         notifications: {
            source_removed_from_target_event_name: 'entity_child_removed',
            relationship_set_event_name: 'entity_parent_set'
         }
      };

      await update_target_on_relationship_removed(
         handler_context,
         source_entity_id,
         removed_component
      );
   }
}