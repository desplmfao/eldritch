/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/components/frustum.ts
 */

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

/**
 * defines the view frustum properties, determining the shape of the visible volume. 
 * 
 * can be attached to the camera entity or another entity (e.g., player head) for more flexible view setups.
 */
@Reflectable()
export class ComponentFrustum extends Component {
   dependencies = {};

   /** near clipping plane distance. */
   @ReflectProperty({
      order: 1,
      type: 'f32',
      description: 'near clipping plane distance',
   })
   near: number;

   /** far clipping plane distance. */
   @ReflectProperty({
      order: 2,
      type: 'f32',
      description: 'far clipping plane distance',
   })
   far: number;

   /** aspect ratio (width / height). often calculated automatically based on viewport. */
   @ReflectProperty({
      order: 3,
      type: 'f32',
      description: 'aspect ratio (width / height)',
   })
   aspect_ratio: number;

   constructor(
      options?: Omit<Partial<ComponentFrustum>, 'dependencies'>
   ) {
      super();

      this.near = options?.near ?? 0.1;
      this.far = options?.far ?? 1000.0;
      this.aspect_ratio = options?.aspect_ratio ?? 16.0 / 9.0;
   }
}