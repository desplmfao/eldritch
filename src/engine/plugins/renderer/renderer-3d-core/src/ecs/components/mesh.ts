/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/components/mesh.ts
 */

import { Component } from '@eldritch-engine/ecs-core/types/component';

export enum PrimitiveType {
   Cube,
   Sphere,
   Plane,
   // quad, and other stuff later
}

export class ComponentRenderable extends Component {
   dependencies = {};
}

export class ComponentMesh extends Component {
   dependencies = {};

   /** type of primitive mesh to render */
   primitive_type: PrimitiveType;
   // later: add vertex_buffer, index_buffer, etc. for custom meshes

   constructor(
      options: Omit<ComponentMesh, 'dependencies'>
   ) {
      super();

      this.primitive_type = options.primitive_type;
   }
}