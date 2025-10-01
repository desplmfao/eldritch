/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/suggesters.ts
 */

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import type { ResourceArgumentParserRegistry } from '@self/ecs/resources/argument_parser_registry';

import { CommandNodeType, ComponentCommandNode } from '@self/ecs/components/command_node';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentName } from '@self/ecs/components/name';

import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';

import type { CommandSuggestion } from '@self/types/command_suggestion';

export async function get_children_suggestions(
   world: IWorld,
   //
   parent_id: EntityId | null,
   //
   parsers: ResourceArgumentParserRegistry,
   partial_word: string
): Promise<CommandSuggestion[]> {
   const suggestions: CommandSuggestion[] = [];
   const children_ids: EntityId[] = [];

   if (parent_id == null) {
      const roots = world.entity_find_multiple_direct(
         [
            ComponentCommandNode.name,
            ComponentName.name
         ]
      );

      for (const root_id of roots) {
         if (!world.component_has(root_id, ComponentParentCommand.name)) {
            children_ids.push(root_id);
         }
      }
   } else {
      const subcommands = world.component_get(parent_id, ComponentSubcommands);

      if (subcommands) {
         children_ids.push(...(subcommands.source_entities.values()));
      }
   }

   for (const child_id of children_ids) {
      const node_comp = world.component_get(child_id, ComponentCommandNode);

      if (!node_comp) {
         continue;
      }

      if (node_comp.type === CommandNodeType.Argument) {
         const arg_type_comp = world.component_get(child_id, ComponentArgType);

         if (arg_type_comp) {
            const parser = parsers.parsers.get(arg_type_comp.type_name);

            if (parser?.get_suggestions) {
               const arg_suggestions = await parser.get_suggestions(world, partial_word);

               suggestions.push(...arg_suggestions);
            }
         }
      } else {
         const name_comp = world.component_get(child_id, ComponentName);

         if (
            name_comp &&
            name_comp.value.toLowerCase().startsWith(partial_word.toLowerCase())
         ) {
            suggestions.push(
               {
                  text: name_comp.value
               }
            );
         }
      }
   }

   return suggestions;
}

/**
 * generates a list of suggestions for completing the current command input string
 * 
 * this function walks the command graph based on the entered words and uses registered suggestion providers for argument nodes to offer context-aware completions
 *
 * @param world the world instance, used for context by argument parsers
 * @param parsers the argument parser registry containing suggestion providers
 * @param partial_input the current, incomplete command string entered by the user
 */
export async function get_command_suggestions(
   world: IWorld,
   //
   parsers: ResourceArgumentParserRegistry,
   partial_input: string
): Promise<CommandSuggestion[]> {
   const is_trailing_space = partial_input.endsWith(' ');
   const words = partial_input.trim().split(/\s+/).filter(w => w.length > 0);

   if (partial_input.trim() === '') {
      return get_children_suggestions(world, null, parsers, '');
   }

   let current_parent_id: EntityId | null = null;

   for (let i = 0; i < words.length - 1 || (is_trailing_space && i < words.length); i++) {
      const word = words[i]!;
      const children = await get_children_suggestions(world, current_parent_id, parsers, word);

      let next_parent_id: EntityId | null = null;

      const literal_match = children.find(c => c.text === word);

      if (literal_match) {
         const all_nodes = world.entity_find_multiple_direct([ComponentName.name]);

         for (const node_id of all_nodes) {
            const name_comp = world.component_get(node_id, ComponentName);
            const parent_comp = world.component_get(node_id, ComponentParentCommand);

            if (
               name_comp?.value === word &&
               parent_comp?.target_entity_id === current_parent_id
            ) {
               next_parent_id = node_id;

               break;
            } else if (
               name_comp?.value === word &&
               current_parent_id == null &&
               !parent_comp
            ) {
               next_parent_id = node_id;

               break;
            }
         }
      } else {
         const subcommands: ComponentSubcommands | undefined = current_parent_id ? world.component_get(current_parent_id, ComponentSubcommands) : undefined;

         // doesn't need to be readable - desp
         const potential_children: EntityId[] =
            subcommands ? [
               ...subcommands.source_entities.values()
            ] : [
               ...(
                  world.entity_find_multiple_direct(
                     [
                        ComponentCommandNode.name,
                        ComponentName.name
                     ]
                  )
               )
            ].filter(
               (id) => {
                  return !world.component_has(id, ComponentParentCommand.name);
               }
            );

         for (const child_id of potential_children) {
            const node_comp = world.component_get(child_id, ComponentCommandNode);

            if (node_comp?.type === CommandNodeType.Argument) {
               next_parent_id = child_id;

               break;
            }
         }
      }

      if (next_parent_id == null) {
         return [];
      }

      current_parent_id = next_parent_id;
   }

   const partial_word = is_trailing_space ? '' : words[words.length - 1]!;

   return get_children_suggestions(world, current_parent_id, parsers, partial_word);
}