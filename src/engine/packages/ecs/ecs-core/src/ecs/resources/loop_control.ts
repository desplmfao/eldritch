/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/resources/loop_control.ts
 */

import type { bool, f32, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Resource } from '@self/types/resource';

const DEFAULT_TICK_RATE_HZ = 64;
const DEFAULT_TARGET_FPS = 165; // this is my refresh-rate and it changes anyway
const DEFAULT_MAX_DELTA_TIME_SEC = 1 / 30;
const DEFAULT_YIELD_THRESHOLD_MS = 1.5;

@Reflectable()
export class ResourceLoopControl extends Resource {
   /** flag indicating if the main loop is currently running */
   is_running: t<bool> = false;

   /** the duration of a single fixed update tick in seconds */
   readonly fixed_time_step_sec: t<f32> = 1.0 / DEFAULT_TICK_RATE_HZ;

   /** accumulates delta time for triggering fixed updates */
   fixed_update_accumulator!: t<f32>;

   /** duration of the last complete fixed update step in seconds */
   last_fixed_update_duration!: t<f32>;

   /** target duration of a single render frame in milliseconds */
   readonly target_frame_time_ms: t<f32> = 1_000.0 / DEFAULT_TARGET_FPS;

   /** if remaining frame time is above this (ms), yield execution briefly */
   readonly yield_threshold_ms: t<f32> = DEFAULT_YIELD_THRESHOLD_MS;

   /** maximum allowed delta time in seconds to prevent spiral of death */
   readonly max_delta_time_sec: t<f32> = DEFAULT_MAX_DELTA_TIME_SEC;

   /** timestamp of the last render frame start (ms) */
   last_render_time_ms!: t<f32>;
}