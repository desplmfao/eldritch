/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_execution/command_execution.test.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { ComponentName } from '@self/ecs/components/name';
import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';
import { ComponentCurrentlyExecuted } from '@self/ecs/components/markers/currently_executed';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';

import { PluginEdict } from '@self/ecs/plugin';

@Reflectable()
class PermissionAdmin extends ComponentPermission { }

class SystemHealPlayer extends System {
   override order = 10;

   heal_function = mock((target_player: string, amount: number) => { });
   ban_function = mock((target_player: string) => { });

   async update(
      world: IWorld,
      //
      invocations: Query<[ComponentCommandInvocation]>
   ) {
      for (const [, [invocation]] of invocations) {
         const name_comp = world.component_get(invocation.target_command_entity, ComponentName);

         if (!name_comp) {
            continue;
         }

         if (name_comp.value === 'heal') {
            const [target_player, amount] = invocation.parsed_args as [string, number];

            this.heal_function(target_player, amount);
         } else if (name_comp.value === 'ban') {
            const [target_player] = invocation.parsed_args as [string];

            this.ban_function(target_player);
         }
      }
   }
}

describe('edict - end-to-end command execution', () => {
   let world: World;
   let command_input: ResourceRawCommandInput;
   let app_system: SystemHealPlayer;

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

      app_system = new SystemHealPlayer();
      await edict_plugin.scheduler.system_add(Schedule.Last, app_system);

      await world.entity_spawn_direct({
         components: [
            [
               ComponentName,
               {
                  value: 'heal'
               }
            ],
            [
               ComponentCompiledCommand,
               {
                  full_path: ['heal', 'target_player', 'amount'],
                  path_node_types: [CommandNodeType.Literal, CommandNodeType.Argument, CommandNodeType.Argument],
                  full_path_hash: 1n,
                  argument_parser_names: ['string', 'integer'],
                  permission_tag_names: []
               }
            ],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [
               ComponentName,
               {
                  value: 'ban'
               }
            ],
            [
               ComponentCompiledCommand,
               {
                  full_path: ['ban', 'target_player'],
                  path_node_types: [CommandNodeType.Literal, CommandNodeType.Argument],
                  full_path_hash: 2n,
                  argument_parser_names: ['string'],
                  permission_tag_names: [PermissionAdmin.name]
               }
            ],
         ]
      });

      command_input = world.storage.get(ResourceRawCommandInput)!;
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

   it('should execute a valid command from start to finish', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'heal notch 100',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(app_system.heal_function).toHaveBeenCalledTimes(1);
      expect(app_system.heal_function).toHaveBeenCalledWith('notch', 100);
      expect(app_system.ban_function).not.toHaveBeenCalled();

      command_input.queue.push({
         raw_string: 'heal notch 100',
         sender_entity_id: sender_id
      });

      await run_cycles(1);

      expect(app_system.heal_function).toHaveBeenCalledTimes(1);
      expect(app_system.heal_function).toHaveBeenCalledWith('notch', 100);
      expect(app_system.ban_function).not.toHaveBeenCalled();

      const invocation_view = world.component_view([ComponentCommandInvocation.name]);
      let invocation_count = 0;

      for await (const _ of invocation_view) {
         invocation_count++;
      }

      expect(invocation_count).toBe(0);

      const marker_view = world.component_view([ComponentCurrentlyExecuted.name]);
      let marker_count = 0;

      for await (const _ of marker_view) {
         marker_count++;
      }

      expect(marker_count).toBe(0);
   });

   it('should not execute a command that fails parsing', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'heal notch invalid_amount',
         sender_entity_id: sender_id
      });

      await run_cycles(2);

      expect(app_system.heal_function).not.toHaveBeenCalled();
   });

   it('should not execute a command if permissions are insufficient', async () => {
      const sender_id = await world.entity_create_direct();

      command_input.queue.push({
         raw_string: 'ban evil_user',
         sender_entity_id: sender_id
      });

      await run_cycles(3);

      expect(app_system.ban_function).not.toHaveBeenCalled();
   });

   it('should execute a command if permissions are sufficient', async () => {
      const admin_sender_id = await world.entity_spawn_direct({ components: [[PermissionAdmin, {}]] });

      command_input.queue.push({
         raw_string: 'ban evil_user',
         sender_entity_id: admin_sender_id
      });


      await run_cycles(4);

      expect(app_system.ban_function).toHaveBeenCalledTimes(1);
      expect(app_system.ban_function).toHaveBeenCalledWith('evil_user');
   });
});