/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/ecs/resources/input_timing_config.ts
 */

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class ResourceInputTimingConfig extends Resource {
   /** maximum duration (milliseconds) for a press to qualify as a tap */
   max_tap_duration_ms: t<u32> = 200;

   /** minimum duration (milliseconds) a press must be held to qualify as a hold */
   min_hold_duration_ms: t<u32> = 300;

   /** maximum interval (milliseconds) between the release of the first tap and the press of the second tap for a double-tap */
   max_double_tap_interval_ms: t<u32> = 300;
}