/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/components/camera.ts
 */

import { vec3, type Vec3Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { ComponentPosition3D } from '@eldritch-engine/core-3d/ecs/components/position';
import { ComponentRotation3D } from '@eldritch-engine/core-3d/ecs/components/rotation';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

//
//

export enum CameraProjectionType {
   Perspective,
   Orthographic,
}

/** marker component to identify the currently active camera */
@Reflectable()
export class ComponentCameraActive extends Component {
   dependencies = {};
}

/** defines camera properties for rendering */
@Reflectable()
export class ComponentCamera extends Component {
   dependencies = {
      components: [
         ComponentPosition3D.name,
         ComponentRotation3D.name
      ],
   };

   /** field of view in degrees (for perspective projection) */
   @ReflectProperty({
      order: 0,
      type: 'f32',
      description: 'field of view in degrees (for perspective projection)'
   })
   fov: number;

   /** local offset applied to the camera's position relative to its entity */
   @ReflectProperty({
      order: 3,
      type: '[f32, 3]',
      description: 'local offset applied to the camera\'s position relative to its entity',
   })
   view_offset: Vec3Arg;

   /** local rotation offset applied to the camera's rotation (in degrees) */
   @ReflectProperty({
      order: 4,
      type: '[f32, 3]',
      description: 'local rotation offset applied to the camera\'s rotation (in degrees)',
   })
   rotation_offset: Vec3Arg;

   /** type of projection (perspective or orthographic) */
   @ReflectProperty({
      order: 5,
      type: 'u8',
      description: 'local rotation offset applied to the camera\'s rotation(in degrees)',
   })
   projection_type: CameraProjectionType;

   /** vertical size for orthographic projection */
   @ReflectProperty({
      order: 6,
      type: 'f32',
      description: 'vertical size for orthographic projection',
   })
   orthographic_size: number;

   constructor(
      options?: Omit<Partial<ComponentCamera>, 'dependencies'>
   ) {
      super();

      this.fov = options?.fov ?? 95;

      this.view_offset = vec3.create(...((options?.view_offset as number[]) ?? [0.0, 0.0, 0.0]));
      this.rotation_offset = vec3.create(...((options?.rotation_offset as number[]) ?? [0.0, 0.0, 0.0]));

      this.projection_type = options?.projection_type ?? CameraProjectionType.Perspective;
      this.orthographic_size = options?.orthographic_size ?? 10.0;
   }
}