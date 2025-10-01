/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/resolve_alias.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res, Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentName } from '@self/ecs/components/name';

import { ComponentMatchedCommand } from '@self/ecs/components/runtime/matched_command';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentResolvedAliasData } from '@self/ecs/components/runtime/resolved_alias_data';

import { FeedbackLevel, ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';
import { get_argument_entity_path } from '@self/ecs/compile_command_helper';

export class SystemResolveAlias extends System {
   override order = -15;

   async update(
      world: IWorld,
      //
      matched_entities: Query<[ComponentMatchedCommand]>,
      //
      feedback: Res<ResourceCommandFeedback>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      for (const [transient_entity_id, [matched_comp]] of matched_entities) {
         const resolved_alias_data = world.component_get(matched_comp.matched_command_entity_id, ComponentResolvedAliasData);

         if (!resolved_alias_data) {
            continue;
         }

         const target_command = world.component_get(resolved_alias_data.target_entity_id, ComponentCompiledCommand);

         if (!target_command) {
            logger.error(`alias entity ${matched_comp.matched_command_entity_id} points to a target ${resolved_alias_data.target_entity_id} which is missing its compiled command. this is a compilation error`);

            feedback.queue.push(
               {
                  recipient_entity_id: matched_comp.sender_entity_id,
                  message: `alias configuration is invalid`,
                  level: FeedbackLevel.Error,
               }
            );

            await world.entity_delete_direct(transient_entity_id);

            continue;
         }

         const alias_args = [...matched_comp.remaining_args];
         const final_target_args: string[] = [];

         let success = true;

         const target_arg_nodes = get_argument_entity_path(world, resolved_alias_data.target_entity_id);

         for (const target_arg_node_id of target_arg_nodes) {
            const target_arg_name = world.component_get(target_arg_node_id, ComponentName)!.value;

            if (resolved_alias_data.literal_values.has(target_arg_name)) {
               final_target_args.push(String(resolved_alias_data.literal_values.get(target_arg_name)));
            } else {
               let alias_arg_name: string | undefined;

               for (const [alias_name, target_name] of resolved_alias_data.argument_map.entries()) {
                  if (target_name === target_arg_name) {
                     alias_arg_name = alias_name;

                     break;
                  }
               }

               if (alias_arg_name) {
                  if (alias_args.length > 0) {
                     final_target_args.push(alias_args.shift()!);
                  } else {
                     success = false;

                     logger.warn(`alias mapping expected an argument for '${alias_arg_name}' (maps to '${target_arg_name}'), but no arguments were left`);

                     break;
                  }
               } else {
                  success = false;

                  logger.warn(`unmapped target argument '${target_arg_name}' has no literal value or alias argument mapping`);

                  break;
               }
            }
         }

         if (
            success
            && alias_args.length > 0
         ) {
            logger.warn(`alias resolution resulted in unused arguments: [${alias_args.join(', ')}]`);
         }

         if (success) {
            matched_comp.matched_command_entity_id = resolved_alias_data.target_entity_id;
            matched_comp.remaining_args = final_target_args;

            logger.trace(`resolved alias: target is now '${matched_comp.matched_command_entity_id}', args: [${final_target_args.join(', ')}]`);
         } else {
            feedback.queue.push(
               {
                  recipient_entity_id: matched_comp.sender_entity_id,
                  message: 'invalid arguments for alias command',
                  level: FeedbackLevel.Error,
               }
            );

            await world.entity_delete_direct(transient_entity_id);
         }
      }
   }
}