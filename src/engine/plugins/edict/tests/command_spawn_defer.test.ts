/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/tests/command_spawn_defer.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { WorldStorageBackendArchetype } from '@eldritch-engine/ecs-storage-backend-archetype/index';

import { DefaultPlugins } from '@eldritch-engine/ecs-core/ecs/default_plugins';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { PluginEdict } from '@self/ecs/plugin';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';
import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';

describe('edict - recursive command_spawn_defer', () => {
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

   it('should correctly build a multi-level command hierarchy from a single definition', async () => {
      world.command_spawn_defer({
         components: [
            [ComponentName, { value: 'particle' }],
            [ComponentCommandNode, { type: CommandNodeType.Literal }],
         ],
         children: [
            {
               components: [
                  [ComponentName, { value: 'effect' }],
                  [ComponentCommandNode, { type: CommandNodeType.Literal }],
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
                              [ComponentName, { value: 'target_player' }],
                              [ComponentCommandNode, { type: CommandNodeType.Argument }],
                              [ComponentArgType, { type_name: 'player' }],
                           ],
                        },
                     ],
                  },
               ],
            },
            {
               components: [
                  [ComponentName, { value: 'speed' }],
                  [ComponentCommandNode, { type: CommandNodeType.Literal }],
               ],
            },
         ],
      });

      await world.update(Schedule.FixedFlush);
      await world.update(Schedule.First);
      await world.update(Schedule.FixedFlush); // to process recompiles

      const particle_entity = world.entity_find_direct([ComponentName.name])!;
      const particle_name = world.component_get(particle_entity!, ComponentName);
      expect(particle_name?.value).toBe('particle');
      expect(world.component_has(particle_entity!, ComponentParentCommand.name)).toBe(false);
      expect(world.component_has(particle_entity!, ComponentCompiledCommand.name)).toBe(false);

      const particle_subcommands = world.component_get(particle_entity!, ComponentSubcommands);
      expect(particle_subcommands?.source_entities.size).toBe(2);

      let effect_entity: EntityId | undefined;
      let speed_entity: EntityId | undefined;

      for (const child_id of particle_subcommands!.source_entities.values()) {
         const name_comp = world.component_get(child_id as EntityId, ComponentName);

         if (name_comp?.value === 'effect') {
            effect_entity = child_id as EntityId;
         }

         if (name_comp?.value === 'speed') {
            speed_entity = child_id as EntityId;
         }
      }

      expect(effect_entity).toBeDefined();
      expect(speed_entity).toBeDefined();

      const speed_parent = world.component_get(speed_entity!, ComponentParentCommand);
      expect(speed_parent?.target_entity_id).toBe(particle_entity);
      const speed_compiled = world.component_get(speed_entity!, ComponentCompiledCommand);
      expect(speed_compiled).toBeDefined();
      expect(speed_compiled?.full_path).toEqual(['particle', 'speed']);

      const effect_parent = world.component_get(effect_entity!, ComponentParentCommand);
      expect(effect_parent?.target_entity_id).toBe(particle_entity);
      expect(world.component_has(effect_entity!, ComponentCompiledCommand.name)).toBe(false);

      const effect_subcommands = world.component_get(effect_entity!, ComponentSubcommands);
      expect(effect_subcommands?.source_entities.size).toBe(1);
      const effect_name_entity = effect_subcommands!.source_entities.values().next().value;
      const effect_name_name = world.component_get(effect_name_entity, ComponentName);
      expect(effect_name_name?.value).toBe('effect_name');

      const effect_name_subcommands = world.component_get(effect_name_entity!, ComponentSubcommands);
      const target_player_entity = effect_name_subcommands!.source_entities.values().next().value;
      const target_player_name = world.component_get(target_player_entity, ComponentName);
      expect(target_player_name?.value).toBe('target_player');

      const target_player_compiled = world.component_get(target_player_entity, ComponentCompiledCommand);
      expect(target_player_compiled).toBeDefined();
      expect(target_player_compiled?.full_path).toEqual(['particle', 'effect', 'effect_name', 'target_player']);
      expect(target_player_compiled?.argument_parser_names).toEqual(['string', 'player']);
   });
});