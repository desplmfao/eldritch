/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/check_permissions.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res, Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentMatchedCommand } from '@self/ecs/components/runtime/matched_command';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentParsedCommand } from '@self/ecs/components/runtime/parsed_command';

import { FeedbackLevel, ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';

export class SystemCheckPermissions extends System {
   override order = -12;

   async update(
      world: IWorld,
      //
      matched_entities: Query<ComponentMatchedCommand>,
      //
      feedback: Res<ResourceCommandFeedback>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      for (const [transient_entity_id, [matched_comp]] of matched_entities) {
         if (!world.entity_is_alive(transient_entity_id)) {
            continue;
         }

         const target_command = world.component_get(matched_comp.matched_command_entity_id, ComponentCompiledCommand);

         if (!target_command) {
            logger.error(`could not find compiled command for entity ${matched_comp.matched_command_entity_id}. deleting transient parse entity`);

            await world.entity_delete_direct(transient_entity_id);

            continue;
         }

         const required_perms = target_command.permission_tag_names;
         let has_permission = true;

         if (required_perms.length > 0) {
            if (!world.entity_is_alive(matched_comp.sender_entity_id)) {
               has_permission = false;
            } else {
               const sender_has_perms = world.component_has_multiple(
                  matched_comp.sender_entity_id,
                  required_perms
               );

               if (!sender_has_perms.every(v => v === true)) {
                  has_permission = false;
               }
            }
         }

         if (has_permission) {
            await world.component_add_multiple_direct(
               transient_entity_id,
               [
                  [
                     ComponentParsedCommand,
                     {
                        sender_entity_id: matched_comp.sender_entity_id,
                        matched_command_entity_id: matched_comp.matched_command_entity_id,
                        remaining_args: matched_comp.remaining_args,
                        parsed_args: [],
                     }
                  ]
               ]
            );
         } else {
            feedback.queue.push(
               {
                  recipient_entity_id: matched_comp.sender_entity_id,
                  message: `you do not have permission to use the command '${target_command.full_path.join(' ')}'`,
                  level: FeedbackLevel.Error,
               }
            );

            await world.entity_delete_direct(transient_entity_id);
         }

         await world.component_remove_multiple_direct(transient_entity_id, [ComponentMatchedCommand.name]);
      }
   }
}