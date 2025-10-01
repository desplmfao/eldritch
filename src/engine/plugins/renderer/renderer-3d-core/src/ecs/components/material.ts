/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/components/material.ts
 */

import { vec3, type Vec3Arg, type Vec4Arg } from 'wgpu-matrix';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

export enum AlphaMode {
   Opaque,
   Mask,
   Blend,
}

/** defines the visual surface properties of a mesh */
@Reflectable()
export class ComponentMaterial extends Component {
   dependencies = {};

   /** base color or albedo (rgba) */
   @ReflectProperty({
      order: 0,
      type: '[f32, 4]',
      description: 'base color or albedo (rgba)',
   })
   color: Vec4Arg;

   /** how metallic the surface is (0.0 = dielectric, 1.0 = metal) */
   @ReflectProperty({
      order: 1,
      type: 'f32',
      description: 'how metallic the surface is (0.0 = dielectric, 1.0 = metal)',
   })
   metallic: number;

   /** how rough the surface is (0.0 = smooth, 1.0 = rough) */
   @ReflectProperty({
      order: 2,
      type: 'f32',
      description: 'how rough the surface is (0.0 = smooth, 1.0 = rough)',
   })
   roughness: number;

   /** color emitted by the material (rgb), independent of lighting */
   @ReflectProperty({
      order: 3,
      type: '[f32, 3]',
      description: 'color emitted by the material (rgb), independent of lighting',
   })
   emissive_color: Vec3Arg;

   /** how transparency is handled */
   @ReflectProperty({
      order: 4,
      type: 'u8',
      description: 'how transparency is handled',
   })
   alpha_mode: AlphaMode;

   /** threshold for alpha clipping when alpha_mode is 'Mask' (0.0 to 1.0) */
   @ReflectProperty({
      order: 5,
      type: 'f32',
      description: 'threshold for alpha clipping when alpha_mode is \'Mask\' (0.0 to 1.0)',
   })
   alpha_cutoff: number;

   /** whether the material should be rendered on both sides of triangles */
   @ReflectProperty({
      order: 6,
      type: 'bool',
      description: 'whether the material should be rendered on both sides of triangles',
   })
   double_sided: boolean;

   // TODO: add texture_id properties (albedo, normal, metallic_roughness, emissive, occlusion) later
   // TODO: add shader_id for custom renderer later

   constructor(
      options?: Omit<Partial<ComponentMaterial>, 'dependencies'>
   ) {
      super();

      this.color = vec3.create(...((options?.color as number[]) ?? [1.0, 1.0, 1.0, 1.0]));
      this.metallic = options?.metallic ?? 0.0;
      this.roughness = options?.roughness ?? 0.5;
      this.emissive_color = vec3.create(...((options?.emissive_color as number[]) ?? [1.0, 1.0, 1.0]));
      this.alpha_mode = options?.alpha_mode ?? AlphaMode.Opaque;
      this.alpha_cutoff = options?.alpha_cutoff ?? 0.5;
      this.double_sided = options?.double_sided ?? false;
   }
}