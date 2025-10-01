/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/compile_commands/compile_commands_edge_cases.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentAliasOf } from '@self/ecs/components/relationship/alias/alias_of';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

import { PluginEdict } from '@self/ecs/plugin';

class PermissionSuperuser extends ComponentPermission { }

describe('edict - edge cases and complex interactions', () => {
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

   it('should not compile and should handle circular alias dependencies gracefully', async () => {
      const alias_a = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'alias_a' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
         ]
      });

      const alias_b = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'alias_b' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['alias_a'] }],
         ]
      });

      await world.component_add_multiple_direct(
         alias_a,
         [
            [ComponentAliasOf, { target_path: ['alias_b'] }],
         ]
      );

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_a = world.component_get(alias_a, ComponentCompiledCommand);
      const compiled_b = world.component_get(alias_b, ComponentCompiledCommand);

      expect(compiled_a).toBeUndefined();
      expect(compiled_b).toBeUndefined();
   });

   it('should not compile an alias pointing to a non-leaf node', async () => {
      const parent = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'parent' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const child = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'child' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: parent }],
         ]
      });

      const alias_to_parent = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'alias' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['parent'] }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(parent, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_has(alias_to_parent, ComponentCompiledCommand.name)).toBe(false);
   });

   it('should compile an alias when its target becomes a leaf node', async () => {
      const parent = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'parent' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionSuperuser, {}],
         ]
      });

      const child = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'child' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: parent }],
         ]
      });

      const alias_to_parent = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'alias' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['parent'] }],
         ]
      });

      expect(world.component_has(alias_to_parent, ComponentCompiledCommand.name)).toBe(false);

      await world.entity_delete_direct(child);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(parent, ComponentCompiledCommand.name)).toBe(true);

      const compiled_alias = world.component_get(alias_to_parent, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias?.full_path).toEqual(['alias']);
      expect(compiled_alias?.permission_tag_names).toContain(PermissionSuperuser.name);
   });

   it('should correctly re-compile an alias when it is re-parented', async () => {
      const root1 = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'root1' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const root2 = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'root2' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const target = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'target' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionSuperuser, {}],
         ]
      });

      const alias = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'myalias' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['target'] }],
            [ComponentParentCommand, { target_entity_id: root1 }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_alias = world.component_get(alias, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias?.full_path).toEqual(['root1', 'myalias']);
      expect(compiled_alias?.permission_tag_names).toContain(PermissionSuperuser.name);

      await world.component_add_multiple_direct(
         alias,
         [
            [ComponentParentCommand, { target_entity_id: root2 }],
         ]
      );

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_alias = world.component_get(alias, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias?.full_path).toEqual(['root2', 'myalias']);
      expect(compiled_alias?.permission_tag_names).toContain(PermissionSuperuser.name);
   });

   it('should de-compile an alias if its ComponentName is removed', async () => {
      const target = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'target' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const alias = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'myalias' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['target'] }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(alias, ComponentCompiledCommand.name)).toBe(true);

      await world.component_remove_multiple_direct(alias, [ComponentName.name]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(alias, ComponentCompiledCommand.name)).toBe(false);
   });

   it('should not compile a malformed alias missing its ComponentAliasOf', async () => {
      const malformed_alias = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'malformed' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(malformed_alias, ComponentCompiledCommand.name)).toBe(false);
   });
});