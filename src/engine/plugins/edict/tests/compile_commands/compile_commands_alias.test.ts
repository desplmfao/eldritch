/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/compile_commands/compile_commands_alias.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentArgumentMap } from '@self/ecs/components/argument_map';
import { ComponentAliasLiterals } from '@self/ecs/components/alias_literals';
import { ComponentNumberRange } from '@self/ecs/components/validation/number_range';
import { ComponentAliasOf } from '@self/ecs/components/relationship/alias/alias_of';
import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentResolvedAliasData } from '@self/ecs/components/runtime/resolved_alias_data';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

import { PluginEdict } from '@self/ecs/plugin';

class PermissionAdmin extends ComponentPermission { }
class PermissionMod extends ComponentPermission { }

describe('edict - alias compilation', () => {
   let world: World;

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 5
         }
      });

      await world.add_plugins([
         new DefaultPlugins(),
         //
         new PluginEdict()
      ]);

      await world.initialize();
   });

   it('should compile a simple alias and inherit properties', async () => {
      // /gamemode <mode>
      // /gamemode creative
      // /gamemode c -> /gamemode creative
      const gamemode_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'gamemode' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionAdmin, {}],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'mode' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgType, { type_name: 'gamemode_type' }],
               ]
            },
            {
               components: [
                  [ComponentName, { value: 'creative' }],
                  [ComponentCommandNode, { type: CommandNodeType.Literal }],
               ]
            },
            {
               components: [
                  [ComponentName, { value: 'c' }],
                  [ComponentCommandNode, { type: CommandNodeType.Alias }],
                  [ComponentAliasOf, { target_path: ['gamemode', 'creative'] }],
               ]
            }
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const subcommands = world.component_get(gamemode_entity, ComponentSubcommands);
      expect(subcommands).toBeDefined();
      const alias_entity = [...subcommands!.source_entities.values()].find((id) => world.component_get(id as EntityId, ComponentName)?.value === 'c') as EntityId;

      expect(alias_entity).toBeDefined();

      const compiled_alias = world.component_get(alias_entity!, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.full_path).toEqual(['gamemode', 'c']);
      expect(compiled_alias!.permission_tag_names).toContain(PermissionAdmin.name);
      expect(compiled_alias!.argument_parser_names).toEqual([]);
   });

   it('should re-compile an alias when its target gets a new permission', async () => {
      const ban_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'ban' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'player' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgType, { type_name: 'player' }],
               ]
            }
         ]
      });

      const b_alias_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'b' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['ban', 'player'] }],
         ],
         children: [{
            components: [
               [ComponentName, { value: 'user' }],
               [ComponentCommandNode, { type: CommandNodeType.Argument }],
               [ComponentArgumentMap, { target_argument_name: 'player' }]
            ]
         }]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      let compiled_alias = world.component_get(b_alias_entity, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.permission_tag_names).toEqual([]);

      await world.component_add_multiple_direct(ban_entity, [[PermissionAdmin, {}]]);
      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      compiled_alias = world.component_get(b_alias_entity, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.permission_tag_names).toContain(PermissionAdmin.name);
   });

   it('should delete an alias when its target is deleted', async () => {
      const target_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'real' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ]
      });

      const alias_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'alias' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['real'] }]
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      expect(world.entity_is_alive(alias_entity)).toBe(true);
      await world.entity_delete_direct(target_entity);
      expect(world.entity_is_alive(alias_entity)).toBe(false);
   });
});

describe('edict - advanced aliasing with `command_spawn_direct`', () => {
   let world: World;

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 5
         }
      });

      await world.add_plugins([
         new DefaultPlugins(),
         //
         new PluginEdict()
      ]);

      await world.initialize();
   });

   it('should allow a root-level alias to point to a nested command leaf', async () => {
      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'gamemode' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionAdmin, {}],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'creative' }],
                  [ComponentCommandNode, { type: CommandNodeType.Literal }],
               ]
            }
         ]
      });

      const root_alias_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'creative' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['gamemode', 'creative'] }],
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_alias = world.component_get(root_alias_entity, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.full_path).toEqual(['creative']);
      expect(compiled_alias!.permission_tag_names).toContain(PermissionAdmin.name);
   });

   it('should handle an alias pointing to another alias (alias chain)', async () => {
      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'gamemode' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionAdmin, {}]
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'creative' }],
                  [ComponentCommandNode, { type: CommandNodeType.Literal }],
               ]
            }
         ]
      });

      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'gm' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['gamemode', 'creative'] }]
         ]
      });

      const c_alias_entity = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'c' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['gm'] }]
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_c = world.component_get(c_alias_entity, ComponentCompiledCommand);
      expect(compiled_c).toBeDefined();
      expect(compiled_c?.full_path).toEqual(['c']);
      expect(compiled_c?.permission_tag_names).toContain(PermissionAdmin.name);
   });
});

describe('edict - alias compilation with argument mapping', () => {
   let world: World;

   beforeEach(async () => {
      world = new World({
         storage_backend: new WorldStorageBackendArchetype(),
         logger_options: {
            log_level: 5
         }
      });

      await world.add_plugins([
         new DefaultPlugins(),
         //
         new PluginEdict()
      ]);

      await world.initialize();
   });

   it('should compile an alias with argument remapping and renaming', async () => {
      // /particle <effect_name> <position>
      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'particle' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionMod, {}],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'effect_name' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgType, { type_name: 'string' }],
               ],
               children: [
                  {
                     components: [
                        [ComponentName, { value: 'position' }],
                        [ComponentCommandNode, { type: CommandNodeType.Argument }],
                        [ComponentArgType, { type_name: 'vec3' }],
                     ]
                  }
               ]
            }
         ]
      });

      // /spawn_at <coords> <particle_name>
      const alias_id = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'spawn_at' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['particle', 'effect_name', 'position'] }],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'coords' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgumentMap, { target_argument_name: 'position' }],
               ]
            },
            {
               components: [
                  [ComponentName, { value: 'particle_name' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgumentMap, { target_argument_name: 'effect_name' }],
               ]
            }
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_alias = world.component_get(alias_id, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.full_path).toEqual(['spawn_at']);
      expect(compiled_alias!.argument_parser_names).toEqual(['vec3', 'string']);
      expect(compiled_alias!.permission_tag_names).toContain(PermissionMod.name);

      const resolved_data = world.component_get(alias_id, ComponentResolvedAliasData);
      expect(resolved_data).toBeDefined();
      expect(resolved_data!.argument_map.get('coords')).toBe('position');
      expect(resolved_data!.argument_map.get('particle_name')).toBe('effect_name');
   });

   it('should compile an alias with literal values (preset)', async () => {
      // /particle <effect_name> <position> <scale> <count>
      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'particle' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'effect_name' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgType, { type_name: 'string' }]
               ],
               children: [
                  {
                     components: [
                        [ComponentName, { value: 'position' }],
                        [ComponentCommandNode, { type: CommandNodeType.Argument }],
                        [ComponentArgType, { type_name: 'vec3' }]
                     ],
                     children: [
                        {
                           components: [
                              [ComponentName, { value: 'scale' }],
                              [ComponentCommandNode, { type: CommandNodeType.Argument }],
                              [ComponentArgType, { type_name: 'float' }]
                           ],
                           children: [
                              {
                                 components: [
                                    [ComponentName, { value: 'count' }],
                                    [ComponentCommandNode, { type: CommandNodeType.Argument }],
                                    [ComponentArgType, { type_name: 'integer' }]
                                 ],
                              }
                           ]
                        }
                     ]
                  }
               ]
            }
         ]
      });

      // /big_explosion <at>
      const alias_id = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'big_explosion' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['particle', 'effect_name', 'position', 'scale', 'count'] }],
            [ComponentAliasLiterals, {
               values: new Map<string, string | number>([
                  ['effect_name', 'explosion_large'],
                  ['scale', 5.0],
                  ['count', 100]
               ])
            }],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'at' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgumentMap, { target_argument_name: 'position' }],
               ]
            }
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_alias = world.component_get(alias_id, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.full_path).toEqual(['big_explosion']);
      expect(compiled_alias!.argument_parser_names).toEqual(['vec3']);

      const resolved_data = world.component_get(alias_id, ComponentResolvedAliasData);
      expect(resolved_data).toBeDefined();
      expect(resolved_data!.literal_values.get('effect_name')).toBe('explosion_large');
      expect(resolved_data!.literal_values.get('scale')).toBe(5.0);
      expect(resolved_data!.literal_values.get('count')).toBe(100);
      expect(resolved_data!.argument_map.get('at')).toBe('position');
   });

   it('should inherit argument types and validation components to its own argument nodes', async () => {
      // /set_level <level_number>
      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'set_level' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }]
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'level_number' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgType, { type_name: 'integer' }],
                  [ComponentNumberRange, { min: 1, max: 10 }],
               ]
            }
         ]
      });

      // /level <num>
      const alias_id = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'level' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['set_level', 'level_number'] }],
         ],
         children: [{
            components: [
               [ComponentName, { value: 'num' }],
               [ComponentCommandNode, { type: CommandNodeType.Argument }],
               [ComponentArgumentMap, { target_argument_name: 'level_number' }],
            ]
         }]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const alias_subcommands = world.component_get(alias_id, ComponentSubcommands);
      expect(alias_subcommands).toBeDefined();
      const alias_arg_entity_id = [...alias_subcommands!.source_entities.values()][0]! as EntityId;

      const inherited_arg_type = world.component_get(alias_arg_entity_id, ComponentArgType);
      expect(inherited_arg_type).toBeDefined();
      expect(inherited_arg_type!.type_name).toBe('integer');

      const inherited_range = world.component_get(alias_arg_entity_id, ComponentNumberRange);
      expect(inherited_range).toBeDefined();
      expect(inherited_range!.min).toBe(1);
      expect(inherited_range!.max).toBe(10);
   });

   it('should correctly chain aliases with literal values and argument mapping', async () => {
      // /gamemode <mode> <player>
      const target_root = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'gamemode' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
            [PermissionAdmin, {}]
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'mode' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgType, { type_name: 'string' }]
               ],
               children: [
                  {
                     components: [
                        [ComponentName, { value: 'player' }],
                        [ComponentCommandNode, { type: CommandNodeType.Argument }],
                        [ComponentArgType, { type_name: 'player' }]
                     ]
                  }
               ]
            }
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const target_mode_arg = world.component_get(target_root, ComponentSubcommands)!.source_entities.values().next().value;
      const target_player_leaf = world.component_get(target_mode_arg, ComponentSubcommands)!.source_entities.values().next().value;

      // /creative <user> -> /gamemode creative <user>
      await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'creative' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['gamemode', 'mode', 'player'] }],
            [ComponentAliasLiterals, { values: new Map([['mode', 'creative']]) }]
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'user' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgumentMap, { target_argument_name: 'player' }]
               ]
            }
         ]
      });

      // /c <person> -> /creative <person>
      const alias2_id = await world.command_spawn_direct({
         components: [
            [ComponentName, { value: 'c' }],
            [ComponentCommandNode, { type: CommandNodeType.Alias }],
            [ComponentAliasOf, { target_path: ['creative'] }]
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'person' }],
                  [ComponentCommandNode, { type: CommandNodeType.Argument }],
                  [ComponentArgumentMap, { target_argument_name: 'user' }]
               ]
            }
         ]
      });

      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush);

      const compiled_alias = world.component_get(alias2_id, ComponentCompiledCommand);
      expect(compiled_alias).toBeDefined();
      expect(compiled_alias!.full_path).toEqual(['c']);
      expect(compiled_alias!.permission_tag_names).toContain(PermissionAdmin.name);
      expect(compiled_alias!.argument_parser_names).toEqual(['player']);

      const resolved_data = world.component_get(alias2_id, ComponentResolvedAliasData);
      expect(resolved_data).toBeDefined();
      expect(resolved_data!.target_entity_id).toBe(target_player_leaf);
      expect(resolved_data!.literal_values.get('mode')).toBe('creative');
      expect(resolved_data!.argument_map.get('person')).toBe('player');
   });
});