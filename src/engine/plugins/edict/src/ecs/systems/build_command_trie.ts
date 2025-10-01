/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/build_command_trie.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res, Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';

import { CommandTrieNode, ResourceCommandTrie } from '@self/ecs/resources/command_trie';
import { CommandNodeType } from '@self/ecs/components/command_node';

export class SystemBuildCommandTrie extends System {
   async update(
      compiled_commands: Query<ComponentCompiledCommand>,
      //
      command_trie: Res<ResourceCommandTrie>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`rebuilding ${CommandTrieNode.name}...`);

      command_trie.root = new CommandTrieNode();

      for (const [entity_id, [command]] of compiled_commands) {
         let current_node = command_trie.root;

         for (let i = 0; i < command.full_path.length; i++) {
            const node_type = command.path_node_types[i];

            if (node_type === CommandNodeType.Literal) {
               const word = command.full_path[i]!;

               if (!current_node.children.has(word)) {
                  current_node.children.set(word, new CommandTrieNode());
               }

               current_node = current_node.children.get(word)!;
            }
         }

         current_node.entity_id = entity_id;
      }

      logger.trace(`${CommandTrieNode.name} rebuilt with '${compiled_commands.length}' commands`);
   }
}