/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_suggestions/command_suggestions_async.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';

import { ResourceArgumentParserRegistry, type ArgumentParser } from '@self/ecs/resources/argument_parser_registry';

import { PluginEdict } from '@self/ecs/plugin';

import { get_command_suggestions } from '@self/ecs/suggesters';

describe('edict - asynchronous command suggestions', () => {
   let world: World;

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

      parsers = world.storage.get(ResourceArgumentParserRegistry)!;

      const faction_member_parser: ArgumentParser = {
         parse: (_, input) => ({
            success: true,
            value: input[0],
            consumed_words: 1
         }),
         get_suggestions: async (_, partial_input) => {
            await new Promise(resolve => setTimeout(resolve, 10));

            const members: string[] = [];

            if (partial_input.startsWith('a')) {
               members.push('alice', 'anna');
            } else if (partial_input.startsWith('b')) {
               members.push('bob');
            } else {
               members.push('alice', 'anna', 'bob', 'charlie');
            }

            return members
               .filter(name => name.startsWith(partial_input))
               .map(name => ({ text: name, tooltip: 'Faction member' }));
         },
      };

      parsers.parsers.set('faction_member', faction_member_parser);

      const faction_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'faction' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const kick_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'kick' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: faction_cmd }],
         ]
      });

      const member_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'member' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'faction_member' }],
            [ComponentParentCommand, { target_entity_id: kick_cmd }],
         ]
      });

      await world.initialize();
      await world.update(Schedule.First);
   });

   async function getSuggestionTexts(input: string): Promise<string[]> {
      const suggestions = await get_command_suggestions(world, parsers, input);

      return suggestions.map(s => s.text);
   }

   it('should return suggestions from an async provider', async () => {
      const suggestions = await getSuggestionTexts('faction kick ');

      expect(suggestions).toEqual(expect.arrayContaining(['alice', 'anna', 'bob', 'charlie']));
      expect(suggestions.length).toBe(4);
   });

   it('should filter suggestions from an async provider based on partial input', async () => {
      const suggestions = await getSuggestionTexts('faction kick a');

      expect(suggestions).toEqual(expect.arrayContaining(['alice', 'anna']));
      expect(suggestions.length).toBe(2);
   });

   it('should return an empty array if async suggestions do not match', async () => {
      const suggestions = await getSuggestionTexts('faction kick z');

      expect(suggestions).toEqual([]);
   });

   it('should correctly handle multiple async suggestions in a chain if needed', async () => {
      const suggestions = await getSuggestionTexts('faction kick b');

      expect(suggestions).toEqual(['bob']);
   });
});