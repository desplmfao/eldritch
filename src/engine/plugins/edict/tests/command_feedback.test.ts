/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_feedback.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { ComponentName } from '@self/ecs/components/name';
import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';
import { ResourceCommandFeedback, FeedbackLevel } from '@self/ecs/resources/command_feedback';

import { PluginEdict } from '@self/ecs/plugin'

class PermissionAdmin extends ComponentPermission { }

describe('edict - command feedback system', () => {
   let world: World;

   let command_input: ResourceRawCommandInput;
   let feedback_resource: ResourceCommandFeedback;

   let sender_id: EntityId;

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

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'heal' }],
            [ComponentCompiledCommand, {
               full_path: ['heal'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 1n,
               argument_parser_names: ['string', 'integer'],
               permission_tag_names: []
            }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentName, { value: 'ban' }],
            [ComponentCompiledCommand, {
               full_path: ['ban'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 2n,
               argument_parser_names: ['string'],
               permission_tag_names: [PermissionAdmin.name]
            }],
         ]
      });

      command_input = world.storage.get(ResourceRawCommandInput)!;
      feedback_resource = world.storage.get(ResourceCommandFeedback)!;
      sender_id = await world.entity_create_direct();

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

   it('should generate feedback for an unknown command', async () => {
      command_input.queue.push({
         raw_string: 'fly',
         sender_entity_id: sender_id
      });

      await run_cycles(2);

      expect(feedback_resource.queue.length).toBe(1);
      const feedback = feedback_resource.queue[0]!;
      expect(feedback.recipient_entity_id).toBe(sender_id);
      expect(feedback.level).toBe(FeedbackLevel.Error);
      expect(feedback.message).toBe(`unknown command: 'fly'`);
   });

   it('should generate feedback for a command with incorrect argument types', async () => {
      command_input.queue.push({
         raw_string: 'heal notch hamburger',
         sender_entity_id: sender_id
      });

      await run_cycles(3);

      expect(feedback_resource.queue.length).toBe(1);
      const feedback = feedback_resource.queue[0]!;
      expect(feedback.recipient_entity_id).toBe(sender_id);
      expect(feedback.level).toBe(FeedbackLevel.Error);
      expect(feedback.message).toContain(`invalid integer format: 'hamburger'`);
   });

   it('should generate feedback for a command with too many arguments', async () => {
      command_input.queue.push({
         raw_string: 'heal notch 100 extra',
         sender_entity_id: sender_id
      });

      await run_cycles(3);

      expect(feedback_resource.queue.length).toBe(1);
      const feedback = feedback_resource.queue[0]!;
      expect(feedback.recipient_entity_id).toBe(sender_id);
      expect(feedback.level).toBe(FeedbackLevel.Error);
      expect(feedback.message).toContain('too many arguments provided');
   });

   it('should generate feedback for insufficient permissions', async () => {
      command_input.queue.push({
         raw_string: 'ban evil_user',
         sender_entity_id: sender_id
      });

      await run_cycles(4);

      expect(feedback_resource.queue.length).toBe(1);
      const feedback = feedback_resource.queue[0]!;
      expect(feedback.recipient_entity_id).toBe(sender_id);
      expect(feedback.level).toBe(FeedbackLevel.Error);
      expect(feedback.message).toContain(`you do not have permission to use the command 'ban'`);
   });

   it('should NOT generate feedback for a successful command', async () => {
      const admin_id = await world.entity_spawn_direct({
         components: [
            [PermissionAdmin, {}]
         ]
      });

      command_input.queue.push({
         raw_string: 'ban successful_ban',
         sender_entity_id: admin_id
      });

      await run_cycles(4);

      expect(feedback_resource.queue.length).toBe(0);
   });
});