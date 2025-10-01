/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_parsing/command_parsing_optional.test.ts
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
import { ComponentOptional } from '@self/ecs/components/optional';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';

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

describe('edict - optional argument parsing', () => {
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

      const effect_cmd = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'effect' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const player_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'player' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'word' }],
            [ComponentParentCommand, { target_entity_id: effect_cmd }],
         ]
      });

      const duration_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'duration' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'integer' }],
            [ComponentOptional, { default_value: 30 }],
            [ComponentParentCommand, { target_entity_id: player_arg }],
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

   it('should use default value when optional argument is omitted', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'effect Notch',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['Notch', 30]);
      expect(feedback_resource.queue).toHaveLength(0);
   });

   it('should use provided value when optional argument is supplied', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'effect Jeb_ 60',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).toHaveBeenCalledTimes(1);
      expect(runner_system.last_invocation).toHaveBeenCalledWith(['Jeb_', 60]);
   });

   it('should fail parsing if a required argument before an optional one is missing', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'effect',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(runner_system.last_invocation).not.toHaveBeenCalled();
      expect(feedback_resource.queue.length).toBe(1);
      expect(feedback_resource.queue[0]?.message).toContain('expected a string, but found nothing');
   });
});