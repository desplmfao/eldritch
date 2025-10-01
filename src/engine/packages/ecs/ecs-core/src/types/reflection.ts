/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/reflection.ts
 */

import type { ObjK } from '@eldritch-engine/type-utils';

import type { IWorld } from '@self/types/world';

export interface Injection {
   injection_type: ObjK;
}

export type InjectionResolver = (world: IWorld, injection: Injection) => any;