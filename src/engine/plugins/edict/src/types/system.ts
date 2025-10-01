/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/types/system.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { System } from '@eldritch-engine/ecs-core/types/system';

import { ComponentCurrentlyExecuted } from '@self/ecs/components/markers/currently_executed';
import { ResourceSystemCommandRegistry } from '@self/ecs/resources/system_command_registry';

/**
 * an abstract base class for systems that are designed to execute a specific command
 *
 * it automatically links itself to a command entity based on the provided path and uses a `run_criteria` to ensure its `update` method only runs when that specific command is invoked
 * 
 * this simplifies creating decoupled, high-performance command execution logic
 *
 * @example
 * class SystemHeal extends SystemCommand {
 *   constructor() {
 *     // this system will execute for the command defined by the path '/heal <player> <amount>'
 *     super(['heal', 'player', 'amount']);
 *   }
 *   
 *   update(query: Query<...>) {
 *     // healing logic here...
 *   }
 * }
 */
export abstract class SystemCommand extends System {

   #target_command_id: EntityId = -1;
   readonly #command_name_path: string[];

   /**
    * @param command_path the full, ordered path of the command this system handles
    */
   constructor(
      command_path: string | string[]
   ) {
      super();

      this.#command_name_path = Array.isArray(command_path) ? command_path : [command_path];
   }

   get target_command_id() {
      return this.#target_command_id;
   }

   /** @internal */
   $update_target_id(
      id: EntityId
   ) {
      this.#target_command_id = id;
   }

   /** @internal */
   $get_command_path() {
      return this.#command_name_path;
   }

   override async initialize(
      world: IWorld
   ) {
      const logger = default_logger.get_namespaced_logger(`<namespace>`);

      const registry = world.storage.get(ResourceSystemCommandRegistry);

      if (!registry) {
         logger.error('ResourceSystemCommandRegistry not found. cannot link SystemCommand');

         return true;
      }

      registry.register(this);
      registry.link_single_system(world, this);

      return true;
   }

   override async cleanup(
      world: IWorld
   ) {
      const registry = world.storage.get(ResourceSystemCommandRegistry);

      if (registry) {
         registry.unregister(this);
      }

      return true;
   }

   override async run_criteria(
      world: IWorld
   ): Promise<boolean> {
      return world.component_has(this.#target_command_id, ComponentCurrentlyExecuted.name);
   }
}