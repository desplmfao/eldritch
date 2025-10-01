/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_trie.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import { entity_id_none } from '@eldritch-engine/ecs-core/types/entity';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';

import { ResourceCommandTrie } from '@self/ecs/resources/command_trie';

import { PluginEdict } from '@self/ecs/plugin';

describe('edict - command Trie building', () => {
   let world: World;

   let trie_resource: ResourceCommandTrie;
   let edict_plugin: PluginEdict;

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 2
         }
      });

      edict_plugin = new PluginEdict();

      await world.add_plugins([
         new DefaultPlugins(),
         //
         edict_plugin
      ]);

      trie_resource = world.storage.get(ResourceCommandTrie)!;

      await world.initialize();
   });

   it('should build a simple Trie from multiple commands', async () => {
      const cmd1 = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['gamemode', 'creative'],
                  path_node_types: [CommandNodeType.Literal, CommandNodeType.Literal],
                  full_path_hash: 1n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      const cmd2 = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['gamemode', 'survival'],
                  path_node_types: [CommandNodeType.Literal, CommandNodeType.Literal],
                  full_path_hash: 2n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      const cmd3 = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['ban'],
                  path_node_types: [CommandNodeType.Literal],
                  full_path_hash: 3n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      await world.update(Schedule.First);

      const root = trie_resource.root;
      expect(root.children.has('gamemode')).toBe(true);
      expect(root.children.has('ban')).toBe(true);
      expect(root.children.has('teleport')).toBe(false);

      const gamemode_node = root.children.get('gamemode')!;
      expect(gamemode_node.entity_id).toBe(entity_id_none);
      expect(gamemode_node.children.has('creative')).toBe(true);
      expect(gamemode_node.children.has('survival')).toBe(true);

      const creative_node = gamemode_node.children.get('creative')!;
      expect(creative_node.entity_id).toBe(cmd1);

      const ban_node = root.children.get('ban')!;
      expect(ban_node.entity_id).toBe(cmd3);
   });

   it('should rebuild the Trie when a command is added', async () => {
      const kick_id = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['kick'],
                  path_node_types: [CommandNodeType.Literal],
                  full_path_hash: 1n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      await world.update(Schedule.First);

      expect(trie_resource.root.children.has('kick')).toBe(true);
      expect(trie_resource.root.children.get('kick')?.entity_id).toBe(kick_id);
   });

   it('should rebuild the Trie when a command is removed', async () => {
      const ban_entity = await world.entity_spawn_direct({
         components: [
            [
               ComponentCompiledCommand,
               {
                  full_path: ['ban'],
                  path_node_types: [CommandNodeType.Literal],
                  full_path_hash: 1n,
                  argument_parser_names: [],
                  permission_tag_names: []
               }
            ],
         ]
      });

      await world.update(Schedule.First);
      expect(trie_resource.root.children.has('ban')).toBe(true);

      await world.entity_delete_direct(ban_entity);
      await world.update(Schedule.First);

      expect(trie_resource.root.children.has('ban')).toBe(false);
   });

   // TODO: changes with more builtins, fix this? remove this? - desp
   it('should handle an empty set of commands', async () => {
      await world.update(Schedule.First);

      expect(trie_resource.root.children.size).toBe(0);
      expect(trie_resource.root.entity_id).toBe(entity_id_none);
   });
});