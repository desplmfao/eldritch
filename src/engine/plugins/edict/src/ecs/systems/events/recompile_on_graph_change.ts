/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/events/recompile_on_graph_change.ts
 */

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';
import type { EventArgs } from '@eldritch-engine/ecs-core/types/event';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentCommandNode } from '@self/ecs/components/command_node';
import { ComponentName } from '@self/ecs/components/name';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentPermission } from '@self/ecs/components/markers/permission';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentAliasOf } from '@self/ecs/components/relationship/alias/alias_of';

import { ResourceRecompileQueue } from '@self/ecs/resources/recompile_queue';

export class EventRecompileOnGraphChange extends WorldEventHandler<'component_added' | 'component_removed'> {
   override run_criteria(
      args: EventArgs['component_added' | 'component_removed'],
      //
      world: IWorld
   ): boolean {
      const [entity_id, component, context] = args;

      if (!world.component_has(entity_id, ComponentCommandNode.name)) {
         return false;
      }

      const is_relevant_type =
         component instanceof ComponentName
         || component instanceof ComponentArgType
         || component instanceof ComponentPermission
         || component instanceof ComponentParentCommand
         || component instanceof ComponentAliasOf;

      if (
         !is_relevant_type
         || (context as { is_overwrite: boolean; })?.is_overwrite
      ) {
         return false;
      }

      return true;
   }

   async update(
      args: EventArgs['component_added' | 'component_removed'],
      //
      recompile_queue: Res<ResourceRecompileQueue>
   ): Promise<void> {
      const [entity_id] = args;

      recompile_queue.entities.add(entity_id);
   }
}