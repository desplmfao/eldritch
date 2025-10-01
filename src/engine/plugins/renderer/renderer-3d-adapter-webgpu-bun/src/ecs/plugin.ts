/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-3d-adapter-webgpu-bun/src/ecs/plugin.ts
 */

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';

// TODO: read the 2d adapter todo.
export class PluginRenderer3DAdapterWebgpuBun extends Plugin {
   dependencies = [];

   async build() {
      return true;
   }

   override async remove() {
      // @ts-expect-error
      delete globalThis.navigator;
   }
}