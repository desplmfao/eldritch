/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_parsing/types/command_parsing_enum.test.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { System } from '@eldritch-engine/ecs-core/types/system';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';
import { ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';
import { ResourceArgumentParserRegistry } from '@self/ecs/resources/argument_parser_registry';

import { PluginEdict } from '@self/ecs/plugin';

import { get_command_suggestions } from '@self/ecs/suggesters';
import { create_enum_parser } from '@self/ecs/parsers';

class SystemCommandRunner extends System {
   override order = 10;

   last_invocation = mock((args: unknown[]) => { });

   async update(
      invocations: Query<[ComponentCommandInvocation]>
   ) {
      for (const [, [invocation]] of invocations) {
         this.last_invocation(invocation.parsed_args);
      }
   }
}

enum Gamemode {
   Survival,
   Creative,
   Adventure,
   Spectator,
}

enum Difficulty {
   Peaceful,
   Easy,
   Normal,
   Hard,
}

describe('edict - enum argument parsing', () => {
   let world: World;

   let command_input: ResourceRawCommandInput;
   let feedback_resource: ResourceCommandFeedback;
   let runner_system: SystemCommandRunner;

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

      runner_system = new SystemCommandRunner();
      await edict_plugin.scheduler.system_add(Schedule.Last, runner_system);

      const parsers = world.storage.get(ResourceArgumentParserRegistry)!;
      parsers.parsers.set('gamemode', create_enum_parser(Gamemode));
      parsers.parsers.set('difficulty', create_enum_parser(Difficulty));

      const gamemode_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'gamemode' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'mode' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'gamemode' }],
            [ComponentParentCommand, { target_entity_id: gamemode_cmd }],
         ]
      });

      const difficulty_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'difficulty' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'level' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'difficulty' }],
            [ComponentParentCommand, { target_entity_id: difficulty_cmd }],
         ]
      });

      command_input = world.storage.get(ResourceRawCommandInput)!;
      feedback_resource = world.storage.get(ResourceCommandFeedback)!;

      await world.initialize();
      await world.update(Schedule.First);
   });

   async function run_cycles(count: number) {
      for (let i = 0; i < count; i++) {
         await world.update(Schedule.First);
         await world.update(Schedule.Update);
         await world.update(Schedule.Last);
         await world.update(Schedule.FixedFlush);
      }
   }

   it('should parse a valid numeric enum value (case-insensitive)', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'gamemode creative',
         sender_entity_id: sender_id
      });

      await run_cycles(4);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['Creative']);
   });

   it('should fail to parse an invalid numeric enum value', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'gamemode invalidmode',
         sender_entity_id: sender_id
      });

      await run_cycles(4);
      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue.length).toBe(1);
      expect(feedback_resource.queue[0]?.message).toContain(`invalid value 'invalidmode'`);
   });

   it('should parse a valid string enum value', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'difficulty hard',
         sender_entity_id: sender_id
      });

      await run_cycles(4);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['hard']);
   });

   it('should provide suggestions for numeric enums', async () => {
      const suggestions = await get_command_suggestions(world, world.storage.get(ResourceArgumentParserRegistry)!, 'gamemode ');
      const suggestion_texts = suggestions.map(s => s.text);
      expect(suggestion_texts).toEqual(expect.arrayContaining(['Survival', 'Creative', 'Adventure', 'Spectator']));
   });

   it('should filter suggestions for numeric enums', async () => {
      const suggestions = await get_command_suggestions(world, world.storage.get(ResourceArgumentParserRegistry)!, 'gamemode Cr');
      const suggestion_texts = suggestions.map(s => s.text);
      expect(suggestion_texts).toEqual(['Creative']);
   });

   it('should provide suggestions for string enums (case-insensitive)', async () => {
      const suggestions = await get_command_suggestions(world, world.storage.get(ResourceArgumentParserRegistry)!, 'difficulty n');
      const suggestion_texts = suggestions.map(s => s.text);
      expect(suggestion_texts).toEqual(['normal']);
   });
});