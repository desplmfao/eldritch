/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-2d/src/ecs/components/rotation.ts
 */

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

/** defines the 2d rotation (around the z-axis) of an entity */
@Reflectable()
export class ComponentRotation2D extends Component {
   dependencies = {};

   /** angle in degrees */
   @ReflectProperty({
      order: 0,
      type: 'f32',
      description: 'angle in degrees',
   })
   angle: number;

   //

   constructor(
      options?: {
         angle?: number;
      }
   ) {
      super();

      this.angle = options?.angle ?? 0;
   }
}
