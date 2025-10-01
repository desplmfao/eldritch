/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-2d/src/ecs/components/velocity_linear.ts
 */

import { vec2, type Vec2Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

@Reflectable()
export class ComponentVelocityLinear2D extends Component {
   dependencies = {};

   /** */
   @ReflectProperty({
      order: 0,
      type: '[f32, 2]',
      description: '',
   })
   data: Vec2Arg;

   //

   constructor(
      options: {
         velocity: [
            x: number,
            y: number
         ],
      }
   ) {
      super();

      this.data = vec2.create(...options.velocity);
   }
}
