/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/compile_command_helper.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { hash_fnv1a } from '@eldritch-engine/utils/hash';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { ComponentDefinition } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId, EntitySpawnDefinition } from '@eldritch-engine/ecs-core/types/entity';

import { ComponentName } from '@self/ecs/components/name';
import { ComponentArgType } from '@self/ecs/components/arg_type';
import { ComponentCommandNode, CommandNodeType } from '@self/ecs/components/command_node';
import { ComponentArgumentMap } from '@self/ecs/components/argument_map';
import { ComponentNumberRange } from '@self/ecs/components/validation/number_range';
import { ComponentStringLength } from '@self/ecs/components/validation/string_length';
import { ComponentStringRegex } from '@self/ecs/components/validation/string_regex';
import { ComponentAliasLiterals } from '@self/ecs/components/alias_literals';

import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';
import { ComponentResolvedAliasData } from '@self/ecs/components/runtime/resolved_alias_data';

import { ComponentParentCommand } from '@self/ecs/components/relationship/subcommand/parent_command';
import { ComponentSubcommands } from '@self/ecs/components/relationship/subcommand/subcommands';

import { ComponentAliasOf } from '@self/ecs/components/relationship/alias/alias_of';
import { ComponentAliasedBy } from '@self/ecs/components/relationship/alias/aliased_by';
import { ComponentPermission } from '@self/ecs/components/markers/permission';

export function get_argument_entity_path(
   world: IWorld,
   //
   leaf_entity_id: EntityId
): EntityId[] {
   let current_id: EntityId | undefined = leaf_entity_id;

   const path: EntityId[] = [];

   while (current_id != null) {
      const current_node = world.component_get(current_id, ComponentCommandNode);

      if (current_node?.type === CommandNodeType.Argument) {
         path.unshift(current_id);
      }

      current_id = world.component_get(current_id, ComponentParentCommand)?.target_entity_id;
   }

   return path;
}

export function has_valid_subcommands(
   world: IWorld,
   //
   subcommands_comp?: ComponentSubcommands
): boolean {
   if (
      !subcommands_comp
      || subcommands_comp.source_entities.size === 0
   ) {
      return false;
   }

   for (const child_id of subcommands_comp.source_entities.values()) {
      if (
         world.component_has_multiple(
            child_id,
            [
               ComponentCommandNode.name,
               ComponentName.name
            ]
         ).every(v => v)
      ) {
         return true;
      }
   }

   return false;
}

export async function update_single_node_state(
   world: IWorld,
   //
   entity_id: EntityId,
   //
   visited?: Set<EntityId>
) {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const node_comp = world.component_get(entity_id, ComponentCommandNode);

   if (!node_comp) {
      return;
   }

   const alias_of_comp = world.component_get(entity_id, ComponentAliasOf);
   const is_alias_type = node_comp.type === CommandNodeType.Alias;

   if (is_alias_type) {
      if (alias_of_comp) {
         await compile_alias_node(
            world,
            //
            entity_id,
            alias_of_comp,
            //
            visited
         );
      } else {
         logger.warn(`node '${entity_id}' is type Alias but has no '${ComponentAliasOf.name}'. de-compiling`);

         if (world.component_has(entity_id, ComponentCompiledCommand.name)) {
            await world.component_remove_multiple_direct(
               entity_id,
               [
                  ComponentCompiledCommand.name
               ]
            );
         }
      }
   } else {
      const is_branch_node = has_valid_subcommands(world, world.component_get(entity_id, ComponentSubcommands));

      if (is_branch_node) {
         if (world.component_has(entity_id, ComponentCompiledCommand.name)) {
            await world.component_remove_multiple_direct(
               entity_id,
               [
                  ComponentCompiledCommand.name
               ]
            );
         }
      } else {
         let is_valid_leaf =
            (node_comp.type === CommandNodeType.Literal)
            || (
               node_comp.type === CommandNodeType.Argument
               && world.component_has(entity_id, ComponentArgType.name)
            );

         if (is_valid_leaf) {
            await compile_node(
               world,
               //
               entity_id
            );
         } else {
            if (world.component_has(entity_id, ComponentCompiledCommand.name)) {
               await world.component_remove_multiple_direct(
                  entity_id,
                  [
                     ComponentCompiledCommand.name
                  ]
               );
            }
         }
      }
   }
}

export async function compile_node(
   world: IWorld,
   //
   entity_id: EntityId,
   //
   precomputed?: {
      precomputed_argument_parsers: string[];
      precomputed_permission_tags: Set<string>;
   }
) {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const full_path: string[] = [];
   const path_node_types: CommandNodeType[] = [];
   const argument_parser_names: string[] = precomputed?.precomputed_argument_parsers ?? [];
   const permission_tag_names: Set<string> = precomputed?.precomputed_permission_tags ?? new Set();

   let current_id: EntityId | undefined = entity_id;
   let path_valid = true;

   while (current_id != null) {
      const [current_name, current_arg_type, current_parent, current_command_node] = world.component_get_from_name_multiple(
         current_id,
         [
            ComponentName.name,
            ComponentArgType.name,
            ComponentParentCommand.name,
            ComponentCommandNode.name
         ]
      ) as [
            ComponentName,
            ComponentArgType,
            ComponentParentCommand,
            ComponentCommandNode
         ];

      if (
         !current_name
         || !current_command_node
      ) {
         logger.warn(`command graph entity '${current_id}' is missing a required '${ComponentName.name}' or '${ComponentCommandNode.name}'. path from entity '${entity_id}' is invalid`);

         path_valid = false;

         break;
      }

      full_path.unshift(current_name.value);
      path_node_types.unshift(current_command_node.type);

      if (!precomputed) {
         if (current_arg_type) {
            argument_parser_names.unshift(current_arg_type.type_name);
         }

         const all_components_on_node = world.component_get_all(current_id);

         for (const component_instance of all_components_on_node) {
            if (component_instance instanceof ComponentPermission) {
               permission_tag_names.add(component_instance.constructor.name);
            }
         }
      }

      current_id = current_parent?.target_entity_id;
   }

   if (path_valid) {
      const path_string = full_path.join(' ');
      const path_hash = BigInt(hash_fnv1a(path_string));

      await world.component_add_multiple_direct(
         entity_id,
         [
            [
               ComponentCompiledCommand,
               {
                  full_path,
                  path_node_types,
                  full_path_hash: path_hash,
                  argument_parser_names,
                  permission_tag_names: Array.from(permission_tag_names),
               }
            ]
         ]
      );

      logger.trace(`compiled command: '${full_path.join(' ')}' on entity '${entity_id}'`);
   } else if (world.component_has(entity_id, ComponentCompiledCommand.name)) {
      await world.component_remove_multiple_direct(
         entity_id,
         [
            ComponentCompiledCommand.name
         ]
      );
   }
}

export async function recompile_descendant_leaves(
   world: IWorld,
   //
   entity_id: EntityId,
   //
   visited?: Set<EntityId>
): Promise<void> {
   if (!visited) {
      visited = new Set<EntityId>();
   }

   if (visited.has(entity_id)) {
      return;
   }

   visited.add(entity_id);

   await update_single_node_state(
      world,
      //
      entity_id,
      visited
   );

   const promises: Promise<void>[] = [];
   const subcommands = world.component_get(entity_id, ComponentSubcommands);

   if (
      subcommands
      && subcommands.source_entities.size > 0
   ) {
      for (const child_id of subcommands.source_entities.values()) {
         promises.push(
            recompile_descendant_leaves(
               world,
               //
               child_id,
               visited
            )
         );
      }
   }

   const aliased_by_comp = world.component_get(entity_id, ComponentAliasedBy);

   if (
      aliased_by_comp
      && aliased_by_comp.source_entities.size > 0
   ) {
      for (const alias_id of aliased_by_comp.source_entities.values()) {
         promises.push(
            recompile_descendant_leaves(
               world,
               //
               alias_id,
               visited
            )
         );
      }
   }

   await Promise.all(promises);
}

async function resolve_alias_target(
   world: IWorld,
   //
   target_path: string[]
): Promise<EntityId | undefined> {
   if (
      !target_path
      || target_path.length === 0
   ) {
      return;
   }

   const root_name = target_path[0]!;
   const roots = Array.from(
      world.entity_find_multiple_direct(
         [
            ComponentCommandNode.name,
            ComponentName.name
         ]
      )
   ).filter(id => !world.component_has(id, ComponentParentCommand.name));

   let current_id: EntityId | undefined;

   for (const root_id of roots) {
      if (world.component_get(root_id, ComponentName)?.value === root_name) {
         current_id = root_id;

         break;
      }
   }

   if (current_id == null) {
      return;
   }

   for (let i = 1; i < target_path.length; i++) {
      const part = target_path[i]!;
      const subcommands = world.component_get(current_id, ComponentSubcommands);

      if (!subcommands) {
         return;
      }

      let found_child = false;

      for (const child_id of subcommands.source_entities.values()) {
         if (world.component_get(child_id, ComponentName)?.value === part) {
            current_id = child_id as EntityId;
            found_child = true;

            break;
         }
      }

      if (!found_child) {
         return;
      }
   }

   return current_id;
}

async function update_alias_relationships(
   world: IWorld,
   //
   alias_id: EntityId,
   old_target_id?: EntityId,
   new_target_id?: EntityId
) {
   if (
      old_target_id != null
      && old_target_id !== new_target_id
   ) {
      const old_target_aliased_by = world.component_get(old_target_id, ComponentAliasedBy);

      if (old_target_aliased_by) {
         old_target_aliased_by.source_entities.delete(alias_id);
      }
   }

   if (new_target_id != null) {
      let aliased_by_comp = world.component_get(new_target_id, ComponentAliasedBy);

      if (!aliased_by_comp) {
         await world.component_add_multiple_direct(new_target_id, [[ComponentAliasedBy, {}]]);

         aliased_by_comp = world.component_get(new_target_id, ComponentAliasedBy);
      }

      if (aliased_by_comp) {
         aliased_by_comp.source_entities.add(alias_id);
      }
   }
}

async function inherit_and_compile_alias(
   world: IWorld,
   //
   alias_id: EntityId,
   //
   resolved_data: ComponentResolvedAliasData,
   target_compiled: ComponentCompiledCommand
) {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const alias_arg_nodes_ordered: EntityId[] = [];
   const alias_subcommands = world.component_get(alias_id, ComponentSubcommands);

   if (alias_subcommands) {
      for (const child_id of alias_subcommands.source_entities.values()) {
         const node_comp = world.component_get(child_id, ComponentCommandNode);

         if (node_comp?.type === CommandNodeType.Argument) {
            alias_arg_nodes_ordered.push(child_id);
         }
      }

      alias_arg_nodes_ordered.sort((a, b) => a - b);
   }

   const target_arg_nodes_by_name = new Map<string, EntityId>();
   const target_arg_nodes = get_argument_entity_path(world, resolved_data.target_entity_id);

   for (const target_arg_node_id of target_arg_nodes) {
      const name_comp = world.component_get(target_arg_node_id, ComponentName);

      if (name_comp) {
         target_arg_nodes_by_name.set(name_comp.value, target_arg_node_id);
      }
   }

   const final_parsers: string[] = [];
   const all_target_args_mapped = new Set<string>();

   const inheritable_validation_components = [ComponentNumberRange, ComponentStringLength, ComponentStringRegex];

   for (const alias_arg_node_id of alias_arg_nodes_ordered) {
      const alias_arg_name = world.component_get(alias_arg_node_id, ComponentName)?.value;
      const target_arg_name = resolved_data.argument_map.get((alias_arg_name ?? ''));

      if (!target_arg_name) {
         logger.warn(`alias argument '${alias_arg_node_id}' ('${alias_arg_name}') has no valid mapping to a target argument`);

         return;
      }

      const target_arg_node_id = target_arg_nodes_by_name.get(target_arg_name);

      if (!target_arg_node_id) {
         logger.warn(`alias argument maps to non-existent target argument '${target_arg_name}'`);

         return;
      }

      all_target_args_mapped.add(target_arg_name);

      const target_arg_type_comp = world.component_get(target_arg_node_id, ComponentArgType);

      if (!target_arg_type_comp) {
         logger.warn(`target argument '${target_arg_name}' is missing ${ComponentArgType.name}`);

         return;
      }

      final_parsers.push(target_arg_type_comp.type_name);

      const components_to_add: ComponentDefinition[] = [];

      if (!world.component_has(alias_arg_node_id, ComponentArgType.name)) {
         components_to_add.push([
            ComponentArgType,
            {
               type_name: target_arg_type_comp.type_name
            }
         ]);
      }

      for (const ctor of inheritable_validation_components) {
         const target_comp = world.component_get(target_arg_node_id, ctor);

         if (
            target_comp
            && !world.component_has(alias_arg_node_id, ctor.name)
         ) {
            components_to_add.push([ctor, target_comp]);
         }
      }

      if (components_to_add.length > 0) {
         await world.component_add_multiple_direct(alias_arg_node_id, components_to_add);
      }
   }

   for (const target_arg_node_id of target_arg_nodes) {
      const target_arg_name = world.component_get(target_arg_node_id, ComponentName)!.value;

      if (
         !resolved_data.literal_values.has(target_arg_name)
         && !all_target_args_mapped.has(target_arg_name)
      ) {
         logger.error(`target argument '${target_arg_name}' was not mapped by the alias and has no literal value`);

         return;
      }
   }

   const final_permissions = new Set(target_compiled.permission_tag_names);
   let current_id: EntityId | undefined = alias_id;

   while (current_id) {
      const all_components_on_node = world.component_get_all(current_id);

      for (const component_instance of all_components_on_node) {
         if (component_instance instanceof ComponentPermission) {
            final_permissions.add(component_instance.constructor.name);
         }
      }

      current_id = world.component_get(current_id, ComponentParentCommand)?.target_entity_id;
   }

   const alias_full_path: string[] = [];
   const alias_path_node_types: CommandNodeType[] = [];

   let alias_current_id: EntityId | undefined = alias_id;
   let path_valid = true;

   while (alias_current_id) {
      const [name_comp, command_node_comp] = world.component_get_multiple(
         alias_current_id,
         [
            ComponentName,
            ComponentCommandNode
         ]
      );

      if (
         !name_comp
         || !command_node_comp
      ) {
         path_valid = false;

         break;
      }

      alias_full_path.unshift(name_comp.value);
      alias_path_node_types.unshift(command_node_comp.type);

      alias_current_id = world.component_get(alias_current_id, ComponentParentCommand)?.target_entity_id;
   }

   if (path_valid) {
      const path_string = alias_full_path.join(' ');
      const path_hash = BigInt(hash_fnv1a(path_string));

      await world.component_add_multiple_direct(
         alias_id,
         [
            [
               ComponentCompiledCommand,
               {
                  full_path: alias_full_path,
                  path_node_types: alias_path_node_types,
                  full_path_hash: path_hash,
                  argument_parser_names: final_parsers,
                  permission_tag_names: Array.from(final_permissions),
               }
            ]
         ]
      );

      logger.trace(`compiled alias: '${alias_full_path.join(' ')}' on entity '${alias_id}'`);
   } else if (world.component_has(alias_id, ComponentCompiledCommand.name)) {
      await world.component_remove_multiple_direct(alias_id, [ComponentCompiledCommand.name]);
   }
}

export async function resolve_alias_chain(
   world: IWorld,
   //
   start_alias_id: EntityId,
   visited_aliases: Set<EntityId>
): Promise<{
   final_target_id: EntityId | undefined,
   final_argument_map: Map<string, string>,
   final_literal_values: Map<string, any>
}> {
   if (visited_aliases.has(start_alias_id)) {
      return {
         final_target_id: undefined,
         final_argument_map: new Map(),
         final_literal_values: new Map()
      };
   }

   visited_aliases.add(start_alias_id);

   const alias_of_comp = world.component_get(start_alias_id, ComponentAliasOf);

   if (!alias_of_comp) {
      return {
         final_target_id: undefined,
         final_argument_map: new Map(),
         final_literal_values: new Map()
      };
   }

   const direct_target_id = await resolve_alias_target(world, alias_of_comp.target_path);

   if (direct_target_id == null) {
      return {
         final_target_id: undefined,
         final_argument_map: new Map(),
         final_literal_values: new Map()
      };
   }

   const current_alias_arg_map = new Map<string, string>();
   const alias_subcommands = world.component_get(start_alias_id, ComponentSubcommands);
   const alias_children = (alias_subcommands ? [...alias_subcommands.source_entities.values()] : []);

   for (const child_id of alias_children) {
      const child_name = world.component_get(child_id, ComponentName)?.value;
      const arg_map_comp = world.component_get(child_id, ComponentArgumentMap);

      if (
         child_name
         && world.component_get(child_id, ComponentCommandNode)?.type === CommandNodeType.Argument
      ) {
         current_alias_arg_map.set(child_name, arg_map_comp?.target_argument_name ?? child_name);
      }
   }

   const current_alias_literals = world.component_get(start_alias_id, ComponentAliasLiterals)?.values ?? new Map();

   if (world.component_get(direct_target_id, ComponentCommandNode)?.type === CommandNodeType.Alias) {
      const parent_chain_data = await resolve_alias_chain(world, direct_target_id, visited_aliases);

      if (parent_chain_data.final_target_id == null) {
         return {
            final_target_id: undefined,
            final_argument_map: new Map(),
            final_literal_values: new Map()
         };
      }

      const composed_arg_map = new Map<string, string>();

      for (const [our_arg, intermediate_target_arg] of current_alias_arg_map.entries()) {
         const final_target_arg = parent_chain_data.final_argument_map.get(intermediate_target_arg);

         if (final_target_arg) {
            composed_arg_map.set(our_arg, final_target_arg);
         }
      }

      const final_literals = new Map([...parent_chain_data.final_literal_values, ...current_alias_literals]);

      return {
         final_target_id: parent_chain_data.final_target_id,
         final_argument_map: composed_arg_map,
         final_literal_values: final_literals
      };
   } else {
      return {
         final_target_id: direct_target_id,
         final_argument_map: current_alias_arg_map,
         final_literal_values: current_alias_literals
      };
   }
}

export async function compile_alias_node(
   world: IWorld,
   //
   alias_id: EntityId,
   alias_of_comp: ComponentAliasOf,
   //
   visited?: Set<EntityId>
) {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const { final_target_id, final_argument_map, final_literal_values } = await resolve_alias_chain(world, alias_id, new Set());

   await update_alias_relationships(world, alias_id, world.component_get(alias_id, ComponentResolvedAliasData)?.target_entity_id, final_target_id);

   if (final_target_id == null) {
      logger.warn(`alias '${alias_id}': target path [${alias_of_comp.target_path?.join(' ')}] did not resolve to a valid entity or created a cycle. de-compiling`);

      await world.component_remove_multiple_direct(alias_id, [ComponentCompiledCommand.name, ComponentResolvedAliasData.name]);

      return;
   }

   await recompile_descendant_leaves(
      world,
      //
      final_target_id,
      visited
   );

   const target_compiled = world.component_get(final_target_id, ComponentCompiledCommand);

   if (!target_compiled) {
      await world.component_remove_multiple_direct(alias_id, [ComponentCompiledCommand.name]);

      return;
   }

   await world.component_add_multiple_direct(
      alias_id,
      [
         [
            ComponentResolvedAliasData,
            {
               target_entity_id: final_target_id,
               argument_map: final_argument_map,
               literal_values: final_literal_values
            }
         ]
      ]
   );

   await inherit_and_compile_alias(
      world,
      //
      alias_id,
      world.component_get(alias_id, ComponentResolvedAliasData)!,
      target_compiled
   );
}

export async function world_command_spawn_direct(
   world: IWorld,
   //
   node: EntitySpawnDefinition,
   parent_id: EntityId | null
): Promise<EntityId> {
   const current_entity_id = await world.entity_create_direct();

   await world.component_add_multiple_direct(current_entity_id, node.components);

   if (parent_id != null) {
      await world.component_add_multiple_direct(
         current_entity_id,
         [
            [
               ComponentParentCommand,
               {
                  target_entity_id: parent_id
               }
            ]
         ]
      );
   }

   if (
      node.children
      && node.children.length > 0
   ) {
      const child_promises = node.children.map(
         (child_node) => {
            return world_command_spawn_direct(world, child_node, current_entity_id)
         }
      );

      await Promise.all(child_promises);
   }

   return current_entity_id;
}