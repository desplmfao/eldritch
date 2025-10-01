/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/resources/system_command_registry.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { Resource } from '@eldritch-engine/ecs-core/types/resource';
import { entity_id_none } from '@eldritch-engine/ecs-core/types/entity';

import { ResourceCommandTrie } from '@self/ecs/resources/command_trie';

import { SystemCommand } from '@self/types/system';

/** a resource that tracks all active SystemCommand instances to facilitate linking them to their target command entities at runtime */
export class ResourceSystemCommandRegistry extends Resource {
   #registry = new Map<string, Set<SystemCommand>>();

   register(
      system: SystemCommand
   ) {
      const path_key = system.$get_command_path().join(' ');

      if (!this.#registry.has(path_key)) {
         this.#registry.set(path_key, new Set());
      }

      this.#registry.get(path_key)!.add(system);
   }

   unregister(
      system: SystemCommand
   ) {
      const path_key = system.$get_command_path().join(' ');

      if (this.#registry.has(path_key)) {
         this.#registry.get(path_key)!.delete(system);

         if (this.#registry.get(path_key)!.size === 0) {
            this.#registry.delete(path_key);
         }
      }
   }

   get_systems_for_path(
      path: string[]
   ) {
      return this.#registry.get(path.join(' '));
   }

   /** performs an initial, one-time link for a newly initialized system */
   link_single_system(
      world: IWorld,
      //
      system: SystemCommand
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const trie = world.storage.get(ResourceCommandTrie);
      const path = system.$get_command_path();

      if (!trie) {
         logger.error('ResourceCommandTrie not found. cannot perform initial link');

         return;
      }

      let node = trie.root;

      for (const part of path) {
         const child = node.children.get(part);

         if (!child) {
            node.entity_id = undefined;

            break;
         }

         node = child;
      }

      if (
         node &&
         node.entity_id != null
      ) {
         system.$update_target_id(node.entity_id);
      } else {
         system.$update_target_id(entity_id_none);
      }
   }
}