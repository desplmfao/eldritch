/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/components/light.ts
 */

import { vec3, type Vec3Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { ComponentPosition3D } from '@eldritch-engine/core-3d/ecs/components/position';
import { ComponentRotation3D } from '@eldritch-engine/core-3d/ecs/components/rotation';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

/** component holding properties for a directional light source */
@Reflectable()
export class ComponentDirectionalLight extends Component {
   dependencies = {
      components: [
         ComponentRotation3D.name
      ],
   };

   /** color of the light (rgb) */
   @ReflectProperty({
      order: 0,
      type: '[f32, 3]',
      description: 'color of the light (rgb)',
   })
   color: Vec3Arg;

   /** brightness multiplier */
   @ReflectProperty({
      order: 1,
      type: 'f32',
      description: 'brightness multiplier',
   })
   intensity: number;

   constructor(options?: {
      color?: [r: number, g: number, b: number];
      intensity?: number;
   }) {
      super();

      this.color = vec3.create(...(options?.color ?? [1.0, 1.0, 1.0]));
      this.intensity = options?.intensity ?? 1.0;
   }
}

/** component for a point light source emitting light in all directions */
@Reflectable()
export class ComponentPointLight extends Component {
   dependencies = {
      components: [
         ComponentPosition3D.name
      ],
   };

   /** color of the light (rgb) */
   @ReflectProperty({
      order: 0,
      type: '[f32, 3]',
      description: 'color of the light (rgb)',
   })
   color: Vec3Arg;

   /** brightness multiplier */
   @ReflectProperty({
      order: 1,
      type: 'f32',
      description: 'brightness multiplier',
   })
   intensity: number;

   /** maximum distance the light affects */
   @ReflectProperty({
      order: 2,
      type: 'f32',
      description: 'maximum distance the light affects',
   })
   range: number;

   constructor(options?: {
      color?: [r: number, g: number, b: number];
      intensity?: number;
      range?: number;
   }) {
      super();

      this.color = vec3.create(...(options?.color ?? [1.0, 1.0, 1.0]));
      this.intensity = options?.intensity ?? 1.0;
      this.range = options?.range ?? 10.0;
   }
}

/** component for a spot light source emitting light in a cone */
@Reflectable()
export class ComponentSpotLight extends Component {
   dependencies = {
      components: [
         ComponentPosition3D.name,
         ComponentRotation3D.name
      ],
   };

   /** color of the light (rgb) */
   @ReflectProperty({
      order: 0,
      type: '[f32, 3]',
      description: 'color of the light (rgb)',
   })
   color: Vec3Arg;

   /** brightness multiplier */
   @ReflectProperty({
      order: 1,
      type: 'f32',
      description: 'brightness multiplier',
   })
   intensity: number;

   /** maximum distance the light affects */
   @ReflectProperty({
      order: 2,
      type: 'f32',
      description: 'maximum distance the light affects',
   })
   range: number;

   /** inner angle of the spotlight cone (degrees). intensity is constant within this angle */
   @ReflectProperty({
      order: 3,
      type: 'f32',
      description: 'inner angle of the spotlight cone (degrees). intensity is constant within this angle',
   })
   inner_cone_angle: number;

   /** outer angle of the spotlight cone (degrees). intensity falls off to zero at this angle */
   @ReflectProperty({
      order: 4,
      type: 'f32',
      description: 'outer angle of the spotlight cone (degrees). intensity falls off to zero at this angle',
   })
   outer_cone_angle: number;

   constructor(
      options?: Omit<Partial<ComponentSpotLight>, 'dependencies'>
   ) {
      super();

      this.color = vec3.create(...((options?.color as number[]) ?? [1.0, 1.0, 1.0]));
      this.intensity = options?.intensity ?? 1.0;
      this.range = options?.range ?? 20.0;
      this.inner_cone_angle = options?.inner_cone_angle ?? 12.5;
      this.outer_cone_angle = options?.outer_cone_angle ?? 17.5;
   }
}