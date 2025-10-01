/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/reflect/builtins/local.ts
 */

import type { IWorld } from '@self/types/world';

import type { Injection } from '@self/types/reflection';

export const injection_type = 'ecs:inject:local';

export interface InjectionLocal extends Injection {
   injection_type: typeof injection_type;
}

// TODO: implement this
/** @internal */
export function inject_local(
   world: IWorld,
   injection: InjectionLocal
): IWorld {
   return world;
}
