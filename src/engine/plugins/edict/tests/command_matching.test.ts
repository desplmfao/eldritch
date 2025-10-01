/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_matching.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentMatchedCommand } from '@self/ecs/components/runtime/matched_command';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';

import { PluginEdict } from '@self/ecs/plugin';

describe('edict - command matching system', () => {
   let world: World;

   let command_input: ResourceRawCommandInput;

   let sender_id: number;
   let tp_player_entity_id: number;
   let tp_coords_entity_id: number;

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

      command_input = world.storage.get(ResourceRawCommandInput)!;
      sender_id = await world.entity_create_direct();

      tp_player_entity_id = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['tp', 'player'],
                  path_node_types: [CommandNodeType.Literal, CommandNodeType.Literal],
                  full_path_hash: 1n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      tp_coords_entity_id = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['tp', 'player', 'coords'],
                  path_node_types: [CommandNodeType.Literal, CommandNodeType.Literal, CommandNodeType.Literal],
                  full_path_hash: 2n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      await world.initialize();

      await world.update(Schedule.First);
   });

   it('should match a simple command with no arguments', async () => {
      command_input.queue.push({
         raw_string: 'tp player',
         sender_entity_id: sender_id as EntityId
      });

      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentMatchedCommand.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      expect(results.length).toBe(1);
      const [, [matched_comp]] = results[0] as [number, [ComponentMatchedCommand]];

      expect(matched_comp.sender_entity_id).toBe(sender_id as EntityId);
      expect(matched_comp.matched_command_entity_id).toBe(tp_player_entity_id as EntityId);
      expect(matched_comp.remaining_args).toEqual([]);
   });

   it('should match a command with arguments', async () => {
      command_input.queue.push({
         raw_string: 'tp player notch 10 20 30',
         sender_entity_id: sender_id as EntityId
      });

      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentMatchedCommand.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      expect(results.length).toBe(1);
      const [, [matched_comp]] = results[0] as [number, [ComponentMatchedCommand]];

      expect(matched_comp.matched_command_entity_id).toBe(tp_player_entity_id as EntityId);
      expect(matched_comp.remaining_args).toEqual(['notch', '10', '20', '30']);
   });

   it('should match the longest valid command path', async () => {
      command_input.queue.push({
         raw_string: 'tp player coords here',
         sender_entity_id: sender_id as EntityId
      });

      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentMatchedCommand.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      expect(results.length).toBe(1);
      const [, [matched_comp]] = results[0] as [number, [ComponentMatchedCommand]];

      expect(matched_comp.matched_command_entity_id).toBe(tp_coords_entity_id as EntityId);
      expect(matched_comp.remaining_args).toEqual(['here']);
   });

   it('should not create a MatchedCommand for an unknown command', async () => {
      command_input.queue.push({
         raw_string: 'unknown command here',
         sender_entity_id: sender_id as EntityId
      });

      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentMatchedCommand.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      expect(results.length).toBe(0);
   });

   it('should handle extra whitespace gracefully', async () => {
      command_input.queue.push({
         raw_string: '  tp   player  ',
         sender_entity_id: sender_id as EntityId
      });

      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentMatchedCommand.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      expect(results.length).toBe(1);
      const [, [matched_comp]] = results[0] as [number, [ComponentMatchedCommand]];

      expect(matched_comp.matched_command_entity_id).toBe(tp_player_entity_id as EntityId);
      expect(matched_comp.remaining_args).toEqual([]);
   });
});