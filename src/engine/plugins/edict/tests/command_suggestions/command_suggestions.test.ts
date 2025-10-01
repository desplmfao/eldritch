/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_suggestions/command_suggestions.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { Component } from '@eldritch-engine/ecs-core/types/component';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentName } from '@self/ecs/components/name';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';

import { ResourceArgumentParserRegistry, type ArgumentParser } from '@self/ecs/resources/argument_parser_registry';
import { ResourceCommandTrie } from '@self/ecs/resources/command_trie';

import { PluginEdict } from '@self/ecs/plugin';

import { get_command_suggestions } from '@self/ecs/suggesters';

class Player extends Component { }

describe('edict - command suggestions with arguments', () => {
   let world: World;

   let trie: ResourceCommandTrie;
   let parsers: ResourceArgumentParserRegistry;

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 2
         }
      });

      const edict_plugin = new PluginEdict();

      await world.add_plugins([
         new DefaultPlugins(),
         //
         edict_plugin
      ]);

      trie = world.storage.get(ResourceCommandTrie)!;
      parsers = world.storage.get(ResourceArgumentParserRegistry)!;

      const player_parser: ArgumentParser = {
         parse: (_, input) => ({ success: true, value: input[0], consumed_words: 1 }),
         get_suggestions: async (_, partial_input) => {
            const player_names: string[] = [];
            const view = world.component_view<[typeof Player, typeof ComponentName]>([Player.name, ComponentName.name]);

            for await (const [, [player, name_comp]] of view) {
               if (name_comp.value.startsWith(partial_input)) {
                  player_names.push(name_comp.value);
               }
            }

            return player_names.map(name => ({
               text: name,
               tooltip: 'a player'
            }));
         },
      };

      parsers.parsers.set('player', player_parser);

      await world.entity_spawn_direct({
         components: [
            [Player, {}],
            [ComponentName, { value: 'Notch' }]
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [Player, {}],
            [ComponentName, { value: 'Jeb_' }]
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'SomeOtherEntity' }]
         ]
      });

      const give_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'give' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const player_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'player' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'player' }],
            [ComponentParentCommand, { target_entity_id: give_cmd }],
         ]
      });

      const item_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'item_id' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'integer' }],
            [ComponentParentCommand, { target_entity_id: player_arg }],
         ]
      });

      await world.initialize();
      await world.update(Schedule.First);
   });

   async function get_suggestion_texts(input: string): Promise<string[]> {
      const suggestions = await get_command_suggestions(world, parsers, input);
      return suggestions.map(s => s.text);
   }

   it('should suggest player names for a player argument type', async () => {
      const suggestions = await get_suggestion_texts('give ');
      expect(suggestions).toEqual(expect.arrayContaining(['Notch', 'Jeb_']));
      expect(suggestions.length).toBe(2);
   });

   it('should filter player name suggestions based on partial input', async () => {
      const suggestions = await get_suggestion_texts('give N');
      expect(suggestions).toEqual(['Notch']);
   });

   it('should suggest nothing for an argument with no suggestion provider', async () => {
      const suggestions = await get_suggestion_texts('give Notch ');
      expect(suggestions).toEqual([]);
   });

   it('should return literal suggestions if they match', async () => {
      const tp_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'tp' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const player_lit = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'player' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: tp_cmd }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const suggestions = await get_suggestion_texts('tp p');
      expect(suggestions).toEqual(['player']);
   });
});