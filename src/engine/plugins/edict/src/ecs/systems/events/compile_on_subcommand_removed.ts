/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/events/compile_on_subcommand_removed.ts
 */

import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';
import type { EventArgs } from '@eldritch-engine/ecs-core/types/event';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';

import { ResourceRecompileQueue } from '@self/ecs/resources/recompile_queue';

export class EventCompileOnSubcommandRemoved extends WorldEventHandler<'component_removed'> {
   async update(
      args: EventArgs['component_removed'],
      //
      recompile_queue: Res<ResourceRecompileQueue>
   ): Promise<void> {
      const [entity_id, component] = args;

      if (component instanceof ComponentSubcommands) {
         recompile_queue.entities.add(entity_id);
      }
   }
}