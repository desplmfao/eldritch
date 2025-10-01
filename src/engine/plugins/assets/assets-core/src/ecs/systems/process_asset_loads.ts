/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/ecs/systems/process_asset_loads.ts
 */

import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceAssetServer } from '@self/ecs/resources/asset_server';

/** a placeholder system that would manage the asset loading queue */
export class SystemProcessAssetLoads extends System {
   dependencies = {};

   update(
      asset_server: Res<ResourceAssetServer>
   ): void {
   }
}