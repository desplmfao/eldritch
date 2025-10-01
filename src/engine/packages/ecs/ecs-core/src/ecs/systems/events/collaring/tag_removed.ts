/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/systems/events/collaring/tag_removed.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';
import { shallow_clone } from '@eldritch-engine/utils/std/object';

import type { IWorld } from '@self/types/world';
import { WorldEventHandler } from '@self/types/event_handler';
import type { EventArgs } from '@self/types/event';
import type { Res } from '@self/types/markers';

import { ComponentTag } from '@self/ecs/components/collaring/tag';
import { ComponentCollar } from '@self/ecs/components/collaring/collar';

import {
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

export class EventOnTagRemoved extends WorldEventHandler<'component_removed'> {
   async update(
      args: EventArgs['component_removed'],
      //
      world: IWorld,
      //
      component_updates: Res<ResourceComponentUpdates>,
      component_last_write_tick: Res<ResourceComponentLastWriteTick>,
      //
      world_tick: Res<ResourceWorldTick>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const [entity_id, removed_component] = args;

      if (
         !(removed_component instanceof ComponentTag)
         || !world.entity_is_alive(entity_id)
      ) {
         return;
      }

      const collar = world.component_get(entity_id, ComponentCollar);

      if (!collar) {
         return;
      }

      const tag_name = removed_component.constructor.name;

      const index = collar.associated_tag_names.indexOf(tag_name);

      if (index === -1) {
         logger.trace(`entity '${entity_id}': tag '${tag_name}' was not on the collar. no update needed`);

         return;
      }

      logger.trace(`entity '${entity_id}': removing tag '${tag_name}' from ${ComponentCollar.name}`);

      collar.associated_tag_names.splice(index, 1);

      const collar_updates_map = component_updates.data.get(ComponentCollar.name);

      if (collar_updates_map) {
         const cloned_collar = shallow_clone(collar);

         collar_updates_map.set(entity_id, cloned_collar);

         component_last_write_tick.data.set(ComponentCollar.name, world_tick.data);
      } else {
         logger.warn(`entity '${entity_id}': ${ComponentCollar.name} was modified by removing a tag, but its update tracking map was not found`);
      }
   }
}