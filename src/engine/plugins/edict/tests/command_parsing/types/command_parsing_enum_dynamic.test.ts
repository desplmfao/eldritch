/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_parsing/types/command_parsing_enum_dynamic.test.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

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
import { create_dynamic_enum_parser } from '@self/ecs/parsers';

@Reflectable()
class Team extends Component { }

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

describe('edict - dynamic enum argument parsing', () => {
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

      const team_name_parser = create_dynamic_enum_parser({
         getter: (world: IWorld) => {
            const team_entities = world.entity_find_multiple_direct([Team.name, ComponentName.name]);
            const names: string[] = [];

            for (const team_id of team_entities) {
               const name_comp = world.component_get(team_id, ComponentName);

               if (name_comp) {
                  names.push(name_comp.value);
               }
            }

            return names;
         },
         error_message_on_not_found: (invalid_value, valid_options) => {
            return `invalid team name '${invalid_value}'. valid teams are: [${valid_options.join(', ')}]`
         }
      });

      parsers.parsers.set('team_name', team_name_parser);

      const team_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'team' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const join_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'join' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: team_cmd }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'team' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'team_name' }],
            [ComponentParentCommand, { target_entity_id: join_cmd }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [Team, {}],
            [ComponentName, { value: 'Blue' }]
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [Team, {}],
            [ComponentName, { value: 'Red' }]
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

   it('should parse a valid team name from the world state', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'team join Red',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['Red']);
      expect(feedback_resource.queue.length).toBe(0);
   });

   it('should fail to parse a team name that does not exist', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'team join Green',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue.length).toBe(1);
      expect(feedback_resource.queue[0]?.message).toContain("invalid team name 'Green'");
      expect(feedback_resource.queue[0]?.message).toContain('Blue, Red');
   });

   it('should provide suggestions based on current teams', async () => {
      const suggestions = await get_command_suggestions(world, world.storage.get(ResourceArgumentParserRegistry)!, 'team join ');
      const suggestion_texts = suggestions.map(s => s.text);

      expect(suggestion_texts).toHaveLength(2);
      expect(suggestion_texts).toEqual(expect.arrayContaining(['Blue', 'Red']));
   });

   it('should provide filtered suggestions', async () => {
      const suggestions = await get_command_suggestions(world, world.storage.get(ResourceArgumentParserRegistry)!, 'team join R');
      const suggestion_texts = suggestions.map(s => s.text);

      expect(suggestion_texts).toEqual(['Red']);
   });

   it('should update valid options for parsing after a new team is added', async () => {
      const sender_id = await world.entity_create_direct();

      await world.entity_spawn_direct({
         components: [
            [Team, {}],
            [ComponentName, { value: 'Green' }]
         ]
      });

      command_input.queue.push({
         raw_string: 'team join Green',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['Green']);
   });

   it('should update suggestions after a new team is added', async () => {
      await world.entity_spawn_direct({
         components: [
            [Team, {}],
            [ComponentName, { value: 'Green' }]
         ]
      });

      const suggestions = await get_command_suggestions(world, world.storage.get(ResourceArgumentParserRegistry)!, 'team join ');
      const suggestion_texts = suggestions.map(s => s.text);

      expect(suggestion_texts).toHaveLength(3);
      expect(suggestion_texts).toEqual(expect.arrayContaining(['Blue', 'Red', 'Green']));
   });
});