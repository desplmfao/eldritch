/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-3d/src/ecs/components/world_transform.ts
 */

import { mat4, type Mat4Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

/** component holding the calculated world transform matrix for an entity. */
@Reflectable()
export class ComponentWorldTransform extends Component {
   dependencies = {};

   /** the final calculated 4x4 world transformation matrix */
   @ReflectProperty({
      order: 0,
      type: '[f32, 16]',
      description: 'the final calculated 4x4 world transformation matrix',
      read_only: true
   })
   data: Mat4Arg;

   constructor(
      options?: Omit<ComponentWorldTransform, 'dependencies'>
   ) {
      super();

      this.data = mat4.clone(
         options?.data ?? mat4.identity()
      );
   }
}