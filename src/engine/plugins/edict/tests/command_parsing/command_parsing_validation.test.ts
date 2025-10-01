/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_parsing/command_parsing_validation.test.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { System } from '@eldritch-engine/ecs-core/types/system';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';
import { ComponentNumberRange } from '@self/ecs/components/validation/number_range';
import { ComponentStringLength } from '@self/ecs/components/validation/string_length';
import { ComponentStringRegex } from '@self/ecs/components/validation/string_regex';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';
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

describe('edict - argument validation', () => {
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

      const set_level_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'set_level' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'level' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'integer' }],
            [ComponentNumberRange, { min: 1, max: 10 }],
            [ComponentParentCommand, { target_entity_id: set_level_cmd }],
         ]
      });

      const set_username_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'set_username' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'username' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'word' }],
            [ComponentStringLength, { min: 3, max: 16 }],
            [ComponentStringRegex, { pattern: '^[a-zA-Z0-9_]+$', error_message: 'username can only contain letters, numbers, and underscores' }],
            [ComponentParentCommand, { target_entity_id: set_username_cmd }],
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

   it('should succeed parsing a number within the specified range', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_level 5',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledWith([5]);
      expect(feedback_resource.queue).toHaveLength(0);
   });

   it('should fail parsing a number below the minimum range', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_level 0',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue[0]?.message).toContain('value 0 is less than the minimum of 1');
   });

   it('should fail parsing a number above the maximum range', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_level 11',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue[0]?.message).toContain('value 11 is greater than the maximum of 10');
   });

   it('should succeed parsing a string with valid length and pattern', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_username MyUser_123',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledWith(['MyUser_123']);
   });

   it('should fail parsing a string that is too short', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_username io',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue[0]?.message).toContain('input must be at least 3 characters long');
   });

   it('should fail parsing a string that is too long', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_username this_is_a_very_long_username',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue[0]?.message).toContain('input must be no more than 16 characters long');
   });

   it('should fail parsing a string that does not match the regex pattern', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'set_username "invalid name"',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue[0]?.message).toContain('username can only contain letters, numbers, and underscores');
   });
});