/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/resources/scene_lighting.ts
 */

import {
   vec3,
   type Vec3Arg
} from 'wgpu-matrix';

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

// TODO: make this reflectable
/** resource holding scene-wide lighting properties like ambient light */
export class ResourceSceneLighting extends Resource {
   /** ambient light color (rgb) */
   ambient_color: Vec3Arg;

   constructor(
      options?: Omit<ResourceSceneLighting, 'dependencies'>
   ) {
      super();

      this.ambient_color = vec3.create(...((options?.ambient_color as number[]) ?? [0.1, 0.1, 0.1]));
   }
}