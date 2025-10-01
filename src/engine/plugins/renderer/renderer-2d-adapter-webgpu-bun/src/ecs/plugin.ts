/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/renderer/renderer-2d-adapter-webgpu-bun/src/ecs/plugin.ts
 */

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';

// TODO: add configuration, and the window, make it somehow intertwine with the input system for bun, input needs to happen on the window, not everywhere
export class PluginRenderer2dAdapterNodeWebgpu extends Plugin {
   dependencies = [];

   async build(
      //
   ): Promise<boolean> {
      return true;
   }

   override async remove(
      //
   ): Promise<void> {
      // @ts-expect-error
      delete globalThis.navigator;
   }
}