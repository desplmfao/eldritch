/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/events/relationship/subcommand/parent_command_removed.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';
import type { EventArgs } from '@eldritch-engine/ecs-core/types/event';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';

import { ResourceRelationshipRegistry } from '@eldritch-engine/ecs-core/ecs/resources/relationship';

import {
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@eldritch-engine/ecs-core/ecs/resources/core';

import {
   relationship_get_metadata,
   update_target_on_relationship_removed,
   type RelationshipHandlerContext
} from '@eldritch-engine/ecs-core/operations/relationship';

// TODO: add run_criteria here
export class EventOnRelationshipParentCommandRemoved extends WorldEventHandler<'component_removed'> {
   async update(
      args: EventArgs['component_removed'],
      //
      world: IWorld,
      //
      component_updates: Res<ResourceComponentUpdates>,
      component_last_write_tick: Res<ResourceComponentLastWriteTick>,
      world_tick: Res<ResourceWorldTick>,
      //
      relationship_registry: Res<ResourceRelationshipRegistry>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const [source_entity_id, removed_component, context] = args;

      if (
         context?.is_overwrite
         || !(removed_component instanceof ComponentParentCommand)
      ) {
         return;
      }

      const metadata = relationship_get_metadata(relationship_registry, ComponentParentCommand.name);

      if (!metadata) {
         logger.warn(`entity '${source_entity_id}': handling remove for '${ComponentParentCommand.name}', but no metadata found`);

         return;
      }

      if (metadata.target_type !== ComponentSubcommands.name) {
         logger.warn(`entity '${source_entity_id}': '${ComponentParentCommand.name}' metadata target type mismatch. expected '${ComponentSubcommands.name}', got '${metadata.target_type}'`);

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
         TargetComponentConstructor: ComponentSubcommands,
         notifications: {}
      };

      await update_target_on_relationship_removed(
         handler_context,
         source_entity_id,
         removed_component
      );

      if (world.entity_is_alive(source_entity_id)) {
         logger.trace(`entity '${source_entity_id}' was un-parented. deleting orphaned command sub-tree`);

         await world.entity_delete_direct(source_entity_id);
      }
   }
}