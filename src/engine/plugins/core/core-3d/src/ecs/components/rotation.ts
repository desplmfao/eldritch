/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-3d/src/ecs/components/rotation.ts
 */

import { vec3, type Vec3Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

@Reflectable()
export class ComponentRotation3D extends Component {
   dependencies = {};

   /** */
   @ReflectProperty({
      order: 0,
      type: '[f32, 3]',
      description: 'rotation (in degrees)',
   })
   data: Vec3Arg;

   //

   constructor(
      options?: Omit<ComponentRotation3D, 'dependencies'>
   ) {
      super();

      this.data = vec3.create(
         (options?.data?.[0] ?? 0.0) % 360,
         (options?.data?.[1] ?? 0.0) % 360,
         (options?.data?.[2] ?? 0.0) % 360
      );
   }
}
