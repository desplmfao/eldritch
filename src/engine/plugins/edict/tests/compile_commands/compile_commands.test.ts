/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/compile_commands/compile_commands.test.ts
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
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

import { PluginEdict } from '@self/ecs/plugin';

class PermissionAdmin extends ComponentPermission { }
class PermissionMod extends ComponentPermission { }

describe('edict - initial compilation', () => {
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

   it('should correctly compile a simple leaf command upon creation', async () => {
      const heal_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'heal' }],
            [PermissionMod, {}],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_comp = world.component_get(heal_entity, ComponentCompiledCommand);
      expect(compiled_comp).toBeDefined();
      expect(compiled_comp!.full_path).toEqual(['heal']);
      expect(compiled_comp!.argument_parser_names).toEqual([]);
      expect(compiled_comp!.permission_tag_names).toContain(PermissionMod.name);
   });

   it('should correctly compile a command with arguments and inherited permissions', async () => {
      const tp_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'tp' }],
            [PermissionAdmin, {}],
         ]
      });

      const target_arg_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentName, { value: 'target' }],
            [ComponentArgType, { type_name: 'player' }],
            [ComponentParentCommand, { target_entity_id: tp_entity }],
            [PermissionMod, {}],
         ]
      });

      const dest_arg_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentName, { value: 'destination' }],
            [ComponentArgType, { type_name: 'vec3' }],
            [ComponentParentCommand, { target_entity_id: target_arg_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_comp = world.component_get(dest_arg_entity, ComponentCompiledCommand);
      expect(compiled_comp).toBeDefined();
      expect(compiled_comp!.full_path).toEqual(['tp', 'target', 'destination']);
      expect(compiled_comp!.argument_parser_names).toEqual(['player', 'vec3']);
      expect(compiled_comp!.permission_tag_names).toContain(PermissionAdmin.name);
      expect(compiled_comp!.permission_tag_names).toContain(PermissionMod.name);
      expect(compiled_comp!.permission_tag_names.length).toBe(2);
   });

   it('should not compile a node that is not a leaf node (has subcommands)', async () => {
      const parent_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'parent' }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'child' }],
            [ComponentParentCommand, { target_entity_id: parent_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(parent_entity, ComponentCompiledCommand.name)).toBe(false);
   });

   it('should compile leaf nodes at different depths', async () => {
      const gamemode_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'gamemode' }],
         ]
      });

      const creative_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'creative' }],
            [ComponentParentCommand, { target_entity_id: gamemode_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_gm = world.component_get(gamemode_entity, ComponentCompiledCommand);
      expect(compiled_gm).toBeUndefined();

      const compiled_creative = world.component_get(creative_entity, ComponentCompiledCommand);
      expect(compiled_creative).toBeDefined();
      expect(compiled_creative!.full_path).toEqual(['gamemode', 'creative']);
   });

   it('should compile a node when it becomes a leaf after its child is removed', async () => {
      const parent_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'parent' }],
         ]
      });

      const child_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'child' }],
            [ComponentParentCommand, { target_entity_id: parent_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(parent_entity, ComponentCompiledCommand.name)).toBe(false);

      await world.entity_delete_direct(child_entity);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_comp = world.component_get(parent_entity, ComponentCompiledCommand);
      expect(compiled_comp).toBeDefined();
      expect(compiled_comp!.full_path).toEqual(['parent']);
   });
});


describe('edict - runtime graph modifications', () => {
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

   it('should compile a new root command added at runtime', async () => {
      const kick_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'kick' }],
            [PermissionAdmin, {}],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_kick = world.component_get(kick_entity, ComponentCompiledCommand);
      expect(compiled_kick).toBeDefined();
      expect(compiled_kick!.full_path).toEqual(['kick']);
   });

   it('should de-compile a parent when a child is added at runtime', async () => {
      const heal_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'heal' }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(heal_entity, ComponentCompiledCommand.name)).toBe(true);

      await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentName, { value: 'target' }],
            [ComponentParentCommand, { target_entity_id: heal_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(heal_entity, ComponentCompiledCommand.name)).toBe(false);
   });

   it('should re-compile a parent when its last child is removed at runtime', async () => {
      const parent_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'parent' }],
         ]
      });

      const child_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'child' }],
            [ComponentParentCommand, { target_entity_id: parent_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(parent_entity, ComponentCompiledCommand.name)).toBe(false);

      await world.entity_delete_direct(child_entity);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_comp = world.component_get(parent_entity, ComponentCompiledCommand);
      expect(compiled_comp).toBeDefined();
      expect(compiled_comp!.full_path).toEqual(['parent']);
   });

   it('should handle reparenting correctly at runtime', async () => {
      const team_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'team' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const add_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'add' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: team_entity }]
         ]
      });

      const player_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'player' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'player' }],
            [ComponentParentCommand, { target_entity_id: add_entity }]
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(team_entity, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_has(add_entity, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_get(player_entity, ComponentCompiledCommand)?.full_path).toEqual(['team', 'add', 'player']);

      await world.component_remove_multiple_direct(add_entity, [ComponentParentCommand.name]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_get(team_entity, ComponentCompiledCommand)?.full_path).toEqual(['team']);
      expect(world.entity_is_alive(add_entity)).toBe(false);
      expect(world.entity_is_alive(player_entity)).toBe(false);
   });
});

describe('edict - advanced recompilation scenarios', () => {
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

   it('should re-compile descendant leaves when a parent node name changes', async () => {
      const gamemode_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'gamemode' }],
         ]
      });

      const creative_entity = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentName, { value: 'creative' }],
            [ComponentParentCommand, { target_entity_id: gamemode_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_creative = world.component_get(creative_entity, ComponentCompiledCommand);
      expect(compiled_creative?.full_path).toEqual(['gamemode', 'creative']);

      await world.component_add_multiple_direct(gamemode_entity, [[ComponentName, { value: 'gm' }]]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_creative = world.component_get(creative_entity, ComponentCompiledCommand);
      expect(compiled_creative).toBeDefined();
      expect(compiled_creative?.full_path).toEqual(['gm', 'creative']);
   });

   it('should re-compile descendant leaves when a permission is added to a parent', async () => {
      const settings_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'settings' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const audio_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'audio' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: settings_entity }],
         ]
      });

      const volume_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'volume' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: audio_entity }],
            [PermissionMod, {}],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_volume = world.component_get(volume_entity, ComponentCompiledCommand);
      expect(compiled_volume?.permission_tag_names).toEqual([PermissionMod.name]);

      await world.component_add_multiple_direct(settings_entity, [[PermissionAdmin, {}]]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_volume = world.component_get(volume_entity, ComponentCompiledCommand);
      expect(compiled_volume).toBeDefined();
      expect(compiled_volume?.permission_tag_names).toContain(PermissionAdmin.name);
      expect(compiled_volume?.permission_tag_names).toContain(PermissionMod.name);
      expect(compiled_volume?.permission_tag_names.length).toBe(2);
   });

   it('should re-compile descendant leaves when a permission is removed from a parent', async () => {
      const settings_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'settings' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionAdmin, {}],
         ]
      });

      const volume_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'volume' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: settings_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_volume = world.component_get(volume_entity, ComponentCompiledCommand);
      expect(compiled_volume?.permission_tag_names).toEqual([PermissionAdmin.name]);

      await world.component_remove_multiple_direct(settings_entity, [PermissionAdmin.name]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_volume = world.component_get(volume_entity, ComponentCompiledCommand);
      expect(compiled_volume).toBeDefined();
      expect(compiled_volume?.permission_tag_names).toEqual([]);
   });

   it('should re-compile descendant leaves when an argument type changes', async () => {
      const particle_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'particle' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ]
      });

      const type_arg_entity = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'type' }],
            [ComponentCommandNode, { type: CommandNodeType.Argument }],
            [ComponentArgType, { type_name: 'string' }],
            [ComponentParentCommand, { target_entity_id: particle_entity }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_type_arg = world.component_get(type_arg_entity, ComponentCompiledCommand);
      expect(compiled_type_arg?.argument_parser_names).toEqual(['string']);

      await world.component_add_multiple_direct(type_arg_entity, [[ComponentArgType, { type_name: 'particle_effect' }]]);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_type_arg = world.component_get(type_arg_entity, ComponentCompiledCommand);
      expect(compiled_type_arg).toBeDefined();
      expect(compiled_type_arg?.argument_parser_names).toEqual(['particle_effect']);
   });

   it('should delete orphaned children and re-compile the new leaf when an intermediate node is deleted', async () => {
      const entity_a = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'a' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const entity_b = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'b' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: entity_a }]
         ]
      });

      const entity_c = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'c' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: entity_b }]
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(entity_a, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_has(entity_b, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_has(entity_c, ComponentCompiledCommand.name)).toBe(true);
      expect(world.entity_is_alive(entity_c)).toBe(true);

      await world.entity_delete_direct(entity_b);

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.entity_is_alive(entity_b)).toBe(false);
      expect(world.entity_is_alive(entity_c)).toBe(false);
      expect(world.component_has(entity_a, ComponentCompiledCommand.name)).toBe(true);

      const compiled_a = world.component_get(entity_a, ComponentCompiledCommand);
      expect(compiled_a?.full_path).toEqual(['a']);
   });

   it('should re-compile a whole sub-tree when it is re-parented', async () => {
      const root1 = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'root1' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const root2 = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'root2' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const subtree_parent = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'sub' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: root1 }]
         ]
      });

      const subtree_leaf = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'leaf' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: subtree_parent }]
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_leaf = world.component_get(subtree_leaf, ComponentCompiledCommand);
      expect(compiled_leaf?.full_path).toEqual(['root1', 'sub', 'leaf']);
      expect(world.component_has(root1, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_has(root2, ComponentCompiledCommand.name)).toBe(true);

      await world.component_add_multiple_direct(
         subtree_parent,
         [
            [ComponentParentCommand, { target_entity_id: root2 }]
         ]
      );

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_leaf = world.component_get(subtree_leaf, ComponentCompiledCommand);
      expect(compiled_leaf?.full_path).toEqual(['root2', 'sub', 'leaf']);
      expect(world.component_has(root1, ComponentCompiledCommand.name)).toBe(true);
      expect(world.component_has(root2, ComponentCompiledCommand.name)).toBe(false);
   });

   it('should not compile a node that has an invalid child (e.g., missing name)', async () => {
      const parent = await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'parent' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const invalid_child = await world.entity_spawn_direct({
         components: [
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [ComponentParentCommand, { target_entity_id: parent }]
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.component_has(invalid_child, ComponentCompiledCommand.name)).toBe(false);
      expect(world.component_has(parent, ComponentCompiledCommand.name)).toBe(true);

      const compiled_parent = world.component_get(parent, ComponentCompiledCommand);
      expect(compiled_parent?.full_path).toEqual(['parent']);
   });
});