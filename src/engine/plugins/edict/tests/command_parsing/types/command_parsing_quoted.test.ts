/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_parsing/types/command_parsing_quoted.test.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { System } from '@eldritch-engine/ecs-core/types/system';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input'
import { ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';

import { PluginEdict } from '@self/ecs/plugin';

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

describe('edict - quoted string argument parsing', () => {
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

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'say' }],
            [ComponentCompiledCommand, {
               full_path: ['say'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 1n,
               argument_parser_names: ['string', 'integer'],
               permission_tag_names: []
            }],
         ]
      });

      command_input = world.storage.get(ResourceRawCommandInput)!;
      feedback_resource = world.storage.get(ResourceCommandFeedback)!;
      await world.initialize();
   });

   async function run_cycles(count: number) {
      for (let i = 0; i < count; i++) {
         await world.update(Schedule.First);
         await world.update(Schedule.Update);
         await world.update(Schedule.Last);
         await world.update(Schedule.FixedFlush);
      }
   }

   it('should parse a multi-word quoted string as a single argument', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'say "hello world, this is a test" 1',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['hello world, this is a test', 1]);
      expect(feedback_resource.queue.length).toBe(0);
   });

   it('should parse a single-word quoted string', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'say "oneword" 2',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['oneword', 2]);
   });

   it('should parse a standard unquoted string as a single word', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'say unquoted_word 3',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['unquoted_word', 3]);
   });

   it('should fail parsing if a quote is not terminated', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'say "this is an open quote',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue.length).toBe(1);
      expect(feedback_resource.queue[0]?.message).toContain('unterminated quote');
   });

   it('should correctly handle arguments appearing after a quoted string', async () => {
      const sender_id = await world.entity_create_direct();

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'msg' }],
            [ComponentCompiledCommand, {
               full_path: ['msg'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 2n,
               argument_parser_names: ['string', 'string'],
               permission_tag_names: []
            }],
         ]
      });

      await world.update(Schedule.First);

      command_input.queue.push({
         raw_string: 'msg "quoted part" unquoted_part',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['quoted part', 'unquoted_part']);
   });
});