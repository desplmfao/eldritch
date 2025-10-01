/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/events/relationship/alias/aliased_by_removed.ts
 */

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';
import type { EventArgs } from '@eldritch-engine/ecs-core/types/event';

import { ComponentAliasedBy } from '@self/ecs/components/relationship/alias/aliased_by';

export class EventOnAliasedByRemoved extends WorldEventHandler<'component_removed'> {
   async update(
      args: EventArgs['component_removed'],
      //
      world: IWorld
   ): Promise<void> {
      const [, component, context] = args;

      if (
         context?.is_overwrite
         || !(component instanceof ComponentAliasedBy)
      ) {
         return;
      }

      for (const alias_entity_id of component.source_entities.values()) {
         if (world.entity_is_alive(alias_entity_id)) {
            await world.entity_delete_direct(alias_entity_id);
         }
      }
   }
}