/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/match_commands.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { System } from '@eldritch-engine/ecs-core/types/system';
import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';
import { ResourceCommandTrie } from '@self/ecs/resources/command_trie';
import { FeedbackLevel, ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';

import { ComponentMatchedCommand } from '@self/ecs/components/runtime/matched_command';

export class SystemMatchCommands extends System {
   async update(
      world: IWorld,
      //
      command_input: Res<ResourceRawCommandInput>,
      command_trie: Res<ResourceCommandTrie>,
      //
      feedback: Res<ResourceCommandFeedback>
   ) {
      if (command_input.queue.length === 0) {
         return;
      }

      const logger = default_logger.get_namespaced_logger('<namespace>');

      for (const { raw_string, sender_entity_id } of command_input.queue) {
         const words = raw_string.trim().split(/\s+/);

         if (
            words.length === 0
            || words[0] === ''
         ) {
            continue;
         }

         let current_node = command_trie.root;
         let longest_match_index = -1;
         let matched_entity_id: EntityId | null = null;

         for (let i = 0; i < words.length; i++) {
            const word = words[i]!;

            if (current_node.children.has(word)) {
               current_node = current_node.children.get(word)!;

               if (current_node.entity_id != null) {
                  longest_match_index = i;
                  matched_entity_id = current_node.entity_id;
               }
            } else {
               break;
            }
         }

         if (matched_entity_id != null) {
            const remaining_args = words.slice(longest_match_index + 1);

            logger.trace(`matched command entity '${matched_entity_id}' with args: [${remaining_args.join(', ')}]`);

            await world.entity_spawn_direct({
               components: [
                  [
                     ComponentMatchedCommand,
                     {
                        sender_entity_id,
                        matched_command_entity_id: matched_entity_id,
                        remaining_args,
                     }
                  ]
               ]
            });
         } else {
            logger.warn(`unknown command: '${raw_string}'`);

            feedback.queue.push(
               {
                  recipient_entity_id: sender_entity_id,
                  message: `unknown command: '${words[0]}'`,
                  level: FeedbackLevel.Error,
               }
            );
         }
      }

      command_input.queue = [];
   }
}