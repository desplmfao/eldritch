/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-3d/src/ecs/systems/update_world_transforms.ts
 */

import { mat4, quat, utils, type Mat4Arg } from 'wgpu-matrix';

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentChildOf } from '@eldritch-engine/ecs-core/ecs/components/relationship/child_of';

import { ComponentPosition3D } from '@self/ecs/components/position';
import { ComponentRotation3D } from '@self/ecs/components/rotation';
import { ComponentScale } from '@self/ecs/components/transform';
import { ComponentWorldTransform } from '@self/ecs/components/world_transform';

export class SystemUpdateWorldTransforms extends System {
   override order = -90;

   dependencies = {};

   #local_matrix_cache: Map<EntityId, Mat4Arg> = new Map();
   // sparseset?
   #processed_this_frame: Set<EntityId> = new Set();

   async update(
      world: IWorld,
      //
      transformable_entities_query: Query<[ComponentPosition3D]>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      this.#local_matrix_cache.clear();
      this.#processed_this_frame.clear();

      logger.trace(`updating world transforms for ${transformable_entities_query.length} potentially transformable entities`);

      for (const [entity_id] of transformable_entities_query) {
         if (!this.#processed_this_frame.has(entity_id)) {
            await this.#calculate_and_set_world_transform(world, entity_id);
         }
      }
   }

   async #calculate_and_set_world_transform(
      world: IWorld,
      //
      entity_id: EntityId,
   ): Promise<Mat4Arg> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.#processed_this_frame.has(entity_id)) {
         const existing_transform = world.component_get(entity_id, ComponentWorldTransform);

         return existing_transform?.data ?? mat4.clone(mat4.identity());
      }

      const [pos, rot, scl, child_of] = world.component_get_multiple(
         entity_id,
         [
            ComponentPosition3D,
            ComponentRotation3D,
            //
            ComponentScale,
            //
            ComponentChildOf,
         ]
      );

      if (!pos) {
         logger.trace(`entity ${entity_id} missing ComponentPosition3D during recursive transform calculation. skipping`);

         this.#processed_this_frame.add(entity_id);

         return mat4.clone(mat4.identity());
      }

      let local_matrix = this.#local_matrix_cache.get(entity_id);

      if (!local_matrix) {
         const translation = mat4.translation(pos.data);
         const rotation_quat = rot
            ? quat.fromEuler(
               utils.degToRad(rot.data[0]!),
               utils.degToRad(rot.data[1]!),
               utils.degToRad(rot.data[2]!),
               'xyz'
            )
            : quat.identity();

         const rotation = mat4.fromQuat(rotation_quat);
         const scale = scl ? mat4.scaling(scl.scale) : mat4.identity();

         local_matrix = mat4.multiply(translation, rotation);
         mat4.multiply(local_matrix, scale, local_matrix);

         this.#local_matrix_cache.set(entity_id, local_matrix);
      }

      let final_world_matrix: Mat4Arg;

      if (
         child_of &&
         world.entity_is_alive(child_of.target_entity_id)
      ) {
         const parent_id = child_of.target_entity_id;

         logger.trace(`entity '${entity_id}': calculating parent ${parent_id} transform recursively`);

         const parent_world_matrix = await this.#calculate_and_set_world_transform(
            world,
            parent_id,
         );

         final_world_matrix = mat4.multiply(parent_world_matrix, local_matrix);
      } else {
         /// #if LOGGER_HAS_TRACE
         if (
            child_of &&
            !world.entity_is_alive(child_of.target_entity_id)
         ) {
            logger.trace(`entity '${entity_id}': parent ${child_of.target_entity_id} is not alive or missing, treating as root`);
         } else {
            logger.trace(`entity '${entity_id}': is a root entity (no parent component)`);
         }
         /// #endif

         final_world_matrix = mat4.clone(local_matrix);
      }

      const existing_transform = world.component_get(entity_id, ComponentWorldTransform);

      if (existing_transform) {
         if (!mat4.equals(existing_transform.data, final_world_matrix)) {
            mat4.copy(final_world_matrix, existing_transform.data);
         }
      } else {
         logger.trace(`entity '${entity_id}': adding new ${ComponentWorldTransform.name}`);

         await world.component_add_multiple_direct(
            entity_id,
            [
               new ComponentWorldTransform({
                  data: final_world_matrix
               })
            ]
         );
      }

      this.#processed_this_frame.add(entity_id);

      logger.trace(`entity '${entity_id}': calculated and set world transform component`);

      return final_world_matrix;
   }
}