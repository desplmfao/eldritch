/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_parsing/command_parsing.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentParsedCommand } from '@self/ecs/components/runtime/parsed_command';
import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';

import { PluginEdict } from '@self/ecs/plugin';

describe('edict - command argument parsing system', () => {
   let world: World;
   let sender_id: EntityId;
   let command_entity_id: EntityId;

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

      sender_id = await world.entity_create_direct();

      command_entity_id = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['msg'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 1n,
               argument_parser_names: ['string', 'integer'],
               permission_tag_names: []
            }],
         ]
      });

      await world.initialize();
      await world.update(Schedule.First);
   });

   async function run_parse_and_get_result() {
      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentCommandInvocation.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      return results[0] as [EntityId, [ComponentCommandInvocation]];
   }

   it('should successfully parse valid arguments and create a ParsedCommand', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: command_entity_id,
               remaining_args: ['hello_world', '123'],
               parsed_args: [],
            }],
         ]
      });

      const result = await run_parse_and_get_result();

      expect(result).toBeDefined();
      const [transient_id, [invocation_comp]] = result!;

      expect(invocation_comp).toBeInstanceOf(ComponentCommandInvocation);
      expect(invocation_comp.sender_entity_id).toBe(sender_id);
      expect(invocation_comp.target_command_entity).toBe(command_entity_id);
      expect(invocation_comp.parsed_args).toEqual(['hello_world', 123]);

      expect(world.component_has(transient_id, ComponentParsedCommand.name)).toBe(false);
   });

   it('should fail parsing if an argument has an incorrect type', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: command_entity_id,
               remaining_args: ['a_string', 'not_an_integer'],
               parsed_args: [],
            }],
         ]
      });

      const result = await run_parse_and_get_result();

      expect(result).toBeUndefined();

      const view = world.component_view([ComponentParsedCommand.name]);
      let count = 0;

      for await (const _ of view) {
         count++;
      }

      expect(count).toBe(0);
   });

   it('should fail parsing if there are too few arguments', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: command_entity_id,
               remaining_args: ['only_one_arg'],
               parsed_args: [],
            }],
         ]
      });

      const result = await run_parse_and_get_result();
      expect(result).toBeUndefined();
   });

   it('should fail parsing if there are too many arguments', async () => {
      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: command_entity_id,
               remaining_args: ['string', '42', 'extra_arg'],
               parsed_args: [],
            }],
         ]
      });

      const result = await run_parse_and_get_result();
      expect(result).toBeUndefined();
   });

   it('should fail parsing if a required parser is not registered', async () => {
      const unregistered_command_id = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['special'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 2n,
               argument_parser_names: ['unregistered_parser'],
               permission_tag_names: []
            }],
         ]
      });

      await world.update(Schedule.First);

      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: unregistered_command_id,
               remaining_args: ['some_value'],
               parsed_args: [],
            }],
         ]
      });

      const result = await run_parse_and_get_result();
      expect(result).toBeUndefined();
   });

   it('should handle multiple MatchedCommand entities in one frame', async () => {
      const command2_id = await world.entity_spawn_direct({
         components: [
            [ComponentCompiledCommand, {
               full_path: ['float_test'],
               path_node_types: [CommandNodeType.Literal],
               full_path_hash: 3n,
               argument_parser_names: ['float'],
               permission_tag_names: []
            }],
         ]
      });

      await world.update(Schedule.First);

      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: command_entity_id,
               remaining_args: ['valid', '100'],
               parsed_args: [],
            }],
         ]
      });

      await world.entity_spawn_direct({
         components: [
            [ComponentParsedCommand, {
               sender_entity_id: sender_id,
               matched_command_entity_id: command2_id,
               remaining_args: ['not-a-float'],
               parsed_args: [],
            }],
         ]
      });

      await world.update(Schedule.Update);
      await world.update(Schedule.FixedFlush);

      const view = world.component_view([ComponentCommandInvocation.name]);
      const results = [];

      for await (const result of view) {
         results.push(result);
      }

      expect(results.length).toBe(1);
      const [, [invocation_comp]] = results[0] as [EntityId, [ComponentCommandInvocation]];
      expect(invocation_comp.target_command_entity).toBe(command_entity_id);
      expect(invocation_comp.parsed_args).toEqual(['valid', 100]);
   });
});