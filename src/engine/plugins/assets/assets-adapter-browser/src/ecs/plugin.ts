/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-adapter-browser/src/ecs/plugin.ts
 */

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceAssetServer } from '@eldritch-engine/plugin-assets-core/ecs/resources/asset_server';
import { BrowserHttpSource } from '@self/browser_http_source';

export class PluginAssetsAdapterBrowser extends Plugin {
   dependencies = [];

   async build(
      asset_server: Res<ResourceAssetServer>
   ): Promise<boolean> {
      const browser_source = new BrowserHttpSource('eldr');

      asset_server.add_source(browser_source);

      return true;
   }
}