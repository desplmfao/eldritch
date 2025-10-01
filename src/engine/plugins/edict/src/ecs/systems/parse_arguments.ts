/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/parse_arguments.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res, Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentParsedCommand } from '@self/ecs/components/runtime/parsed_command';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';
import { ComponentOptional } from '@self/ecs/components/optional';

import { ResourceArgumentParserRegistry } from '@self/ecs/resources/argument_parser_registry';
import { FeedbackLevel, ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';
import { get_argument_entity_path } from '@self/ecs/compile_command_helper';

export class SystemParseArguments extends System {
   override order = -10;

   async update(
      world: IWorld,
      //
      parsed_entities: Query<ComponentParsedCommand>,
      parser_registry: Res<ResourceArgumentParserRegistry>,
      //
      feedback: Res<ResourceCommandFeedback>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      for (const [transient_entity_id, [parsed_comp]] of parsed_entities) {
         if (!world.entity_is_alive(transient_entity_id)) {
            continue;
         }

         if (!world.component_has(transient_entity_id, ComponentParsedCommand.name)) {
            continue;
         }

         const target_command = world.component_get(parsed_comp.matched_command_entity_id, ComponentCompiledCommand);

         if (!target_command) {
            logger.error(`could not find compiled command for entity '${parsed_comp.matched_command_entity_id}'. deleting transient parse entity`);

            await world.entity_delete_direct(transient_entity_id);

            continue;
         }

         const arg_entity_ids = get_argument_entity_path(world, parsed_comp.matched_command_entity_id);
         const expected_arg_types = target_command.argument_parser_names;
         const final_parsed_args: unknown[] = [];

         let remaining_args = [...(parsed_comp.remaining_args ?? [])];
         let parse_error_message: string | null = null;
         let all_succeeded = true;

         for (let i = 0; i < expected_arg_types.length; i++) {
            const arg_type_name = expected_arg_types[i]!;
            const arg_entity_id = arg_entity_ids[i];

            const parser_object = parser_registry.parsers.get(arg_type_name);

            if (!parser_object?.parse) {
               parse_error_message = `unknown argument parser '${arg_type_name}' for command ${target_command.full_path.join(' ')}`;
               all_succeeded = false;

               break;
            }

            if (remaining_args.length === 0) {
               if (arg_entity_id != null) {
                  const optional_comp = world.component_get(arg_entity_id, ComponentOptional);

                  if (optional_comp) {
                     final_parsed_args.push(optional_comp.default_value);

                     continue;
                  }
               }
            }

            const result = parser_object.parse(world, remaining_args, arg_entity_id);

            if (result.success) {
               final_parsed_args.push(result.value);

               remaining_args.splice(0, result.consumed_words);
            } else {
               parse_error_message = result.error;
               all_succeeded = false;

               break;
            }
         }

         if (
            all_succeeded &&
            remaining_args.length > 0
         ) {
            parse_error_message = `too many arguments provided for command '${target_command.full_path.join(' ')}'`;
            all_succeeded = false;
         }

         if (all_succeeded) {
            await world.component_add_multiple_direct(
               transient_entity_id,
               [
                  [
                     ComponentCommandInvocation,
                     {
                        sender_entity_id: parsed_comp.sender_entity_id,
                        target_command_entity: parsed_comp.matched_command_entity_id,
                        parsed_args: final_parsed_args,
                     }
                  ],
               ]
            );
         } else {
            if (parse_error_message) {
               feedback.queue.push(
                  {
                     recipient_entity_id: parsed_comp.sender_entity_id,
                     message: `invalid argument: '${parse_error_message}'`,
                     level: FeedbackLevel.Error,
                  }
               );
            }

            await world.entity_delete_direct(transient_entity_id);
         }

         await world.component_remove_multiple_direct(
            transient_entity_id,
            [
               ComponentParsedCommand.name
            ]
         );
      }
   }
}