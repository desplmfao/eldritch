/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-2d/src/ecs/components/position.ts
 */

import { vec2, type Vec2Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

/** defines the 2d position and layering of an entity */
@Reflectable()
export class ComponentPosition2D extends Component {
   dependencies = {};

   /** 2d coordinates */
   @ReflectProperty({
      order: 0,
      type: '[u32, 2]',
      description: '2d coordinates',
   })
   data: Vec2Arg;

   /** depth value for layering */
   @ReflectProperty({
      order: 1,
      type: 'u32',
      description: 'depth value for layering',
   })
   z_index: number;

   //

   constructor(
      options?: {
         position?: [
            x: number,
            y: number
         ];
         z_index?: number;
      }
   ) {
      super();

      this.data = vec2.create(...(options?.position ?? [0.0, 0.0]));
      this.z_index = options?.z_index ?? 0;
   }
}
