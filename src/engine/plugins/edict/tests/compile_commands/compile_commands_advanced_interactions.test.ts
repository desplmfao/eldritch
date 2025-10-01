/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/compile_commands/compile_commands_advanced_interactions.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentAliasOf } from '@self/ecs/components/relationship/alias/alias_of';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';

import { PluginEdict } from '@self/ecs/plugin';

describe('edict - advanced interaction tests', () => {
   let world: World;

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 2
         }
      });

      await world.add_plugins([
         new DefaultPlugins(),
         //
         new PluginEdict()
      ]);

      await world.initialize();
   });

   it('should de-compile a chained alias when its intermediate target is changed', async () => {
      const entity_a = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'a' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const entity_b = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'b' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['a'] }],
         ]
      });

      const entity_c = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'c' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['b'] }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(entity_a, ComponentCompiledCommand.name)).toBe(true);
      expect(world.component_has(entity_b, ComponentCompiledCommand.name)).toBe(true);
      expect(world.component_has(entity_c, ComponentCompiledCommand.name)).toBe(true);
      expect(world.component_get(entity_c, ComponentCompiledCommand)?.full_path).toEqual(['c']);

      const entity_d = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'd' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      await world.component_add_multiple_direct(
         entity_b,
         [
            [ComponentAliasOf, { target_path: ['d'] }]
         ]
      );

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_b = world.component_get(entity_b, ComponentCompiledCommand);
      const compiled_c = world.component_get(entity_c, ComponentCompiledCommand);

      expect(compiled_b).toBeDefined();
      expect(compiled_c).toBeDefined();
   });

   it('should not compile an argument node that is missing ComponentArgType', async () => {
      const entity_gamemode = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'gamemode' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const entity_malformed_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'mode' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(entity_malformed_arg, ComponentCompiledCommand.name)).toBe(false);
   });

   it('should compile an argument node once its ComponentArgType is added', async () => {
      const entity_arg = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'player' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(entity_arg, ComponentCompiledCommand.name)).toBe(false);

      await world.component_add_multiple_direct(entity_arg, [[ComponentArgType, { type_name: 'player_selector' }]]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_arg = world.component_get(entity_arg, ComponentCompiledCommand);
      expect(compiled_arg).toBeDefined();
      expect(compiled_arg?.full_path).toEqual(['player']);
      expect(compiled_arg?.argument_parser_names).toEqual(['player_selector']);
   });
});