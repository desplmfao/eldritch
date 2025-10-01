/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-3d/src/ecs/components/position.ts
 */

import { vec3, type Vec3Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

@Reflectable()
export class ComponentPosition3D extends Component {
   dependencies = {};

   /** */
   @ReflectProperty({
      order: 0,
      type: '[f32, 3]',
      description: '',
   })
   data: Vec3Arg;

   //

   constructor(
      options?: Omit<ComponentPosition3D, 'dependencies'>
   ) {
      super();

      this.data = vec3.create(
         ...((options?.data as number[]) ?? [0.0, 0.0, 0.0])
      );
   }
}
