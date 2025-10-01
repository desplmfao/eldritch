/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/plugin.ts
 */

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { EntityId, EntitySpawnDefinition } from '@eldritch-engine/ecs-core/types/entity';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';
import { ResourceRelationshipRegistry } from '@eldritch-engine/ecs-core/ecs/resources/relationship';
import { relationship_register } from '@eldritch-engine/ecs-core/operations/relationship';

import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';

import { EventOnRelationshipParentCommandAdded } from '@self/ecs/systems/events/relationship/subcommand/parent_command_added';
import { EventOnRelationshipParentCommandRemoved } from '@self/ecs/systems/events/relationship/subcommand/parent_command_removed';
import { EventOnAliasedByRemoved } from '@self/ecs/systems/events/relationship/alias/aliased_by_removed';
import { EventCompileOnNodeAdded } from '@self/ecs/systems/events/compile_on_node_added';
import { EventCompileOnSubcommandRemoved } from '@self/ecs/systems/events/compile_on_subcommand_removed';
import { EventRecompileOnGraphChange } from '@self/ecs/systems/events/recompile_on_graph_change';
import { EventSystemCommandLinker } from '@self/ecs/systems/events/system_command_linker';

import { ResourceRawCommandInput } from '@self/ecs/resources/command_input';
import { ResourceArgumentParserRegistry } from '@self/ecs/resources/argument_parser_registry';
import { ResourceCommandTrie } from '@self/ecs/resources/command_trie';
import { ResourceCommandFeedback } from '@self/ecs/resources/command_feedback';
import { ResourceSystemCommandRegistry } from '@self/ecs/resources/system_command_registry';
import { ResourceRecompileQueue } from '@self/ecs/resources/recompile_queue';

import { SystemApplyCommandSpawns } from '@self/ecs/systems/apply_command_spawns';
import { SystemBuildCommandTrie } from '@self/ecs/systems/build_command_trie';
import { SystemMatchCommands } from '@self/ecs/systems/match_commands';
import { SystemResolveAlias } from '@self/ecs/systems/resolve_alias';
import { SystemParseArguments } from '@self/ecs/systems/parse_arguments';
import { SystemCheckPermissions } from '@self/ecs/systems/check_permissions';
import { SystemExecuteCommands } from '@self/ecs/systems/execute_commands';
import { SystemExecutedCommandsCleanup } from '@self/ecs/systems/executed_commands_cleanup';
import { SystemProcessRecompileQueue } from '@self/ecs/systems/process_recompile_queue';

import { boolean_parser, parse_float, parse_greedy_string_array, parse_integer, parse_string, parse_string_quotable } from '@self/ecs/parsers';
import { world_command_spawn_direct } from '@self/ecs/compile_command_helper';

export class PluginEdict extends Plugin {
   async build(
      world: IWorld,
      relationship_registry: Res<ResourceRelationshipRegistry>
   ): Promise<boolean> {
      {
         const r_command_buffer = world.storage.get(ResourceCommandBuffer)!;
         r_command_buffer.command_spawn_commands = [];

         world.command_spawn_defer = function (
            this: IWorld,
            definition: EntitySpawnDefinition
         ): void {
            r_command_buffer.command_spawn_commands.push(definition);
         };

         world.command_spawn_direct = async function (
            this: IWorld,
            definition: EntitySpawnDefinition
         ): Promise<EntityId> {
            return await world_command_spawn_direct(this, definition, null);
         }
      }

      relationship_register(
         relationship_registry,
         //
         ComponentParentCommand.name,
         ComponentSubcommands.name,
         {
            linked_spawn: true,
         }
      );

      const arg_parsers = new ResourceArgumentParserRegistry();
      arg_parsers.parsers.set('boolean', boolean_parser);
      arg_parsers.parsers.set('string', parse_string_quotable);
      arg_parsers.parsers.set('word', parse_string);
      arg_parsers.parsers.set('greedy_words', parse_greedy_string_array);
      arg_parsers.parsers.set('integer', parse_integer);
      arg_parsers.parsers.set('float', parse_float);

      world.storage.set(ResourceArgumentParserRegistry, arg_parsers);
      world.storage.set(ResourceRawCommandInput, new ResourceRawCommandInput());
      world.storage.set(ResourceCommandTrie, new ResourceCommandTrie());
      world.storage.set(ResourceCommandFeedback, new ResourceCommandFeedback());
      world.storage.set(ResourceSystemCommandRegistry, new ResourceSystemCommandRegistry());
      world.storage.set(ResourceRecompileQueue, new ResourceRecompileQueue());

      await world.subscribe('component_added', new EventOnRelationshipParentCommandAdded());
      await world.subscribe('component_removed', new EventOnRelationshipParentCommandRemoved());

      await world.subscribe('component_added', new EventCompileOnNodeAdded());
      await world.subscribe('component_removed', new EventCompileOnSubcommandRemoved());

      const recompile_handler = new EventRecompileOnGraphChange();
      await world.subscribe('component_added', recompile_handler);
      await world.subscribe('component_removed', recompile_handler);

      const system_command_linker = new EventSystemCommandLinker();
      await world.subscribe('component_added', system_command_linker);
      await world.subscribe('component_removed', system_command_linker);

      await world.subscribe('component_removed', new EventOnAliasedByRemoved());

      await this.scheduler.system_add_multiple([
         [Schedule.First, new SystemProcessRecompileQueue()],
         [Schedule.First, new SystemBuildCommandTrie()],
         //
         [Schedule.Update, new SystemMatchCommands()],
         [Schedule.Update, new SystemResolveAlias()],
         [Schedule.Update, new SystemCheckPermissions()],
         [Schedule.Update, new SystemParseArguments()],
         //
         [Schedule.Last, new SystemExecuteCommands()],
         [Schedule.Last, new SystemExecutedCommandsCleanup()],
         //
         [Schedule.FixedFlush, new SystemApplyCommandSpawns()]
      ]);

      return true;
   }
}