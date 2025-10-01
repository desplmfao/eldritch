/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_permissions.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentMatchedCommand } from '@self/ecs/components/runtime/matched_command';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

import { PluginEdict } from '@self/ecs/plugin';

class PermissionAdmin extends ComponentPermission { }
class PermissionModerator extends ComponentPermission { }

describe('edict - command permission checking system', () => {
   let world: World;
   let sender_no_perms: EntityId;
   let sender_mod: EntityId;
   let sender_admin: EntityId;

   let cmd_public: EntityId;
   let cmd_mod: EntityId;
   let cmd_admin: EntityId;

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

      sender_no_perms = await world.entity_create_direct();
      sender_mod = await world.entity_spawn_direct({ components: [[PermissionModerator, {}]] });
      sender_admin = await world.entity_spawn_direct({ components: [[PermissionAdmin, {}]] });

      cmd_public = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['public'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 1n,
               argument_parser_names: [],
               permission_tag_names: []
            }],
         ]
      });

      cmd_mod = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['mod'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 2n,
               argument_parser_names: [],
               permission_tag_names: [PermissionModerator.name]
            }],
         ]
      });

      cmd_admin = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['admin'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 3n,
               argument_parser_names: [],
               permission_tag_names: [PermissionAdmin.name]
            }],
         ]
      });

      await world.initialize();
   });

   async function run_permission_check_and_get_result() {
      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentCommandInvocation.name]);
      const results = [];
      for await (const result of view) {
         results.push(result);
      }

      return results[0] as [EntityId, [ComponentCommandInvocation]];
   }

   it('should allow execution for a public command from any sender', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentMatchedCommand, {
               sender_entity_id: sender_no_perms,
               matched_command_entity_id: cmd_public,
               remaining_args: [],
            }],
         ]
      });

      const result = await run_permission_check_and_get_result();
      expect(result).toBeDefined();
      const [, [invocation_comp]] = result!;
      expect(invocation_comp.target_command_entity).toBe(cmd_public);
   });

   it('should allow execution when sender has the required permission', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentMatchedCommand, {
               sender_entity_id: sender_mod,
               matched_command_entity_id: cmd_mod,
               remaining_args: [],
            }],
         ]
      });

      const result = await run_permission_check_and_get_result();
      expect(result).toBeDefined();
   });

   it('should deny execution when sender lacks the required permission', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentMatchedCommand, {
               sender_entity_id: sender_no_perms,
               matched_command_entity_id: cmd_admin,
               remaining_args: [],
            }],
         ]
      });

      const result = await run_permission_check_and_get_result();
      expect(result).toBeUndefined();
   });

   it('should deny execution when sender has some, but not all, required permissions', async () => {
      const cmd_super = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['super'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 4n,
               argument_parser_names: [],
               permission_tag_names: [
                  PermissionAdmin.name,
                  PermissionModerator.name
               ]
            }],
         ]
      });

      await world.update(Schedule.First);

      await world.entity_spawn_direct({
         components: [
            [ComponentMatchedCommand, {
               sender_entity_id: sender_admin,
               matched_command_entity_id: cmd_super,
               remaining_args: [],
            }],
         ]
      });

      const result = await run_permission_check_and_get_result();
      expect(result).toBeUndefined();
   });

   it('should allow execution if a sender has more permissions than required', async () => {
      const sender_super = await world.entity_spawn_direct({
         components: [
            [PermissionAdmin, {}],
            [PermissionModerator, {}]
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentMatchedCommand, {
               sender_entity_id: sender_super,
               matched_command_entity_id: cmd_mod,
               remaining_args: [],
            }],
         ]
      });

      const result = await run_permission_check_and_get_result();
      expect(result).toBeDefined();
   });
});