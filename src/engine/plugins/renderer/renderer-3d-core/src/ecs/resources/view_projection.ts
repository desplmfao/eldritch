/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-core/src/ecs/resources/view_projection.ts
 */

import {
   mat4,
   type Mat4Arg
} from 'wgpu-matrix';

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

// TODO: make this reflectable
export class ResourceViewProjection extends Resource {
   view_matrix: Mat4Arg = mat4.create();
   projection_matrix: Mat4Arg = mat4.create();
   view_projection_matrix: Mat4Arg = mat4.create();
}