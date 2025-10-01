/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/events/compile_on_node_added.ts
 */

import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';
import type { EventArgs } from '@eldritch-engine/ecs-core/types/event';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentCommandNode } from '@self/ecs/components/command_node';
import { ResourceRecompileQueue } from '@self/ecs/resources/recompile_queue';

// TODO: add run_criteria here
export class EventCompileOnNodeAdded extends WorldEventHandler<'component_added'> {
   async update(
      args: EventArgs['component_added'],
      //
      recompile_queue: Res<ResourceRecompileQueue>
   ): Promise<void> {
      const [entity_id, component] = args;

      if (!(component instanceof ComponentCommandNode)) {
         return;
      }

      recompile_queue.entities.add(entity_id);
   }
}