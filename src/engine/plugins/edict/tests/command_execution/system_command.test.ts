/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_execution/system_command.test.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentCurrentlyExecuted } from '@self/ecs/components/markers/currently_executed';

import { ResourceSystemCommandRegistry } from '@self/ecs/resources/system_command_registry';

import { PluginEdict } from '@self/ecs/plugin';

import { SystemCommand } from '@self/types/system';

class SystemSayHello extends SystemCommand {
   constructor() {
      super(['say', 'hello']);
   }

   update = mock(async () => { });
}

class SystemWhisper extends SystemCommand {
   constructor() {
      super(['whisper']);
   }

   update = mock(async () => { });
}

describe('edict - SystemCommand dynamic linking and execution', () => {
   let world: World;

   let say_hello_system: SystemSayHello;
   let edict_plugin: PluginEdict;

   let say_entity_id: EntityId;
   let say_hello_entity_id: EntityId;

   async function create_commands() {
      say_entity_id = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'say' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ],
      });

      say_hello_entity_id = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'hello' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: say_entity_id }],
         ],
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);
   }

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 2
         }
      });

      edict_plugin = new PluginEdict();
      await world.add_plugins([new DefaultPlugins(), edict_plugin]);

      say_hello_system = new SystemSayHello();
      await edict_plugin.scheduler.system_add(Schedule.Update, say_hello_system);

      await create_commands();
   });

   it('should link to the correct command ID on initialization', async () => {
      expect(say_hello_system.target_command_id).toBe(entity_id_none);

      await world.initialize();

      expect(say_hello_system.target_command_id).not.toBe(entity_id_none);
      expect(say_hello_system.target_command_id).toBe(say_hello_entity_id);
   });

   it('run_criteria should only be true when its specific command is marked for execution', async () => {
      await world.initialize();

      await world.component_add_multiple_direct(say_hello_entity_id, [[ComponentCurrentlyExecuted, {}]]);

      await world.update(Schedule.Update);
      expect(say_hello_system.update).toHaveBeenCalledTimes(1);

      await world.component_remove_multiple_direct(say_hello_entity_id, [ComponentCurrentlyExecuted.name]);

      await world.update(Schedule.Update);
      expect(say_hello_system.update).toHaveBeenCalledTimes(1);
   });

   it('should unlink from its command when the command entity is deleted', async () => {
      await world.initialize();
      expect(say_hello_system.target_command_id).toBe(say_hello_entity_id);

      await world.entity_delete_direct(say_hello_entity_id);
      await world.update(Schedule.First);

      expect(say_hello_system.target_command_id).toBe(entity_id_none);
   });

   it('should re-link to a new command entity with the same path (hot-swap)', async () => {
      await world.initialize();
      const original_id = say_hello_entity_id;
      expect(say_hello_system.target_command_id).toBe(original_id);

      await world.entity_delete_direct(say_entity_id);
      await world.update(Schedule.First);

      expect(say_hello_system.target_command_id).toBe(entity_id_none);

      await create_commands();
      const new_id = say_hello_entity_id;
      expect(new_id).not.toBe(original_id);

      expect(say_hello_system.target_command_id).toBe(new_id);

      await world.component_add_multiple_direct(new_id, [[ComponentCurrentlyExecuted, {}]]);
      await world.update(Schedule.Update);
      expect(say_hello_system.update).toHaveBeenCalledTimes(1);
   });

   it('should correctly register and unregister from the SystemCommandRegistry', async () => {
      const registry = world.storage.get(ResourceSystemCommandRegistry)!;

      expect(registry.get_systems_for_path(say_hello_system.$get_command_path())).toBeUndefined();

      await world.initialize();

      const registered_systems = registry.get_systems_for_path(say_hello_system.$get_command_path());
      expect(registered_systems).toBeDefined();
      expect(registered_systems?.has(say_hello_system)).toBe(true);

      await world.cleanup();
      expect(registry.get_systems_for_path(say_hello_system.$get_command_path())).toBeUndefined();
   });

   it('should handle systems targeting non-existent commands gracefully', async () => {
      const bad_system = new SystemWhisper();
      await edict_plugin.scheduler.system_add(Schedule.Update, bad_system);

      await world.initialize();

      expect(bad_system.target_command_id).toBe(entity_id_none);

      await world.update(Schedule.Update);
      expect(bad_system.update).not.toHaveBeenCalled();
   });
});