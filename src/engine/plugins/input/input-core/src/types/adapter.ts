/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/types/adapter.ts
 */

import type { RawInputEvent } from '@self/types/input';
import type { PhysicalKey } from '@self/types/physical_keys';
import type { DeviceId } from '@self/types/device';

// TODO: move EVERYTHING into a resource!!!!!!!!

/** interface for platform-specific input adapters */
export interface InputAdapter {
   /** the queue of raw events collected since the last drain */
   readonly event_queue: RawInputEvent[];
   /** current pressed state of known physical keys */
   readonly key_states: Map<PhysicalKey, boolean>;
   /** current pressed state of mouse buttons */
   readonly mouse_button_states: Map<number, boolean>;
   /** is the mouse pointer currently locked? */
   is_pointer_locked: boolean;

   /** initialize the adapter */
   initialize(): Promise<void>;
   /** clean up the adapter */
   cleanup(): Promise<void>;

   /** retrieve and clear the queue of raw input events collected since the last call */
   drain_events(): RawInputEvent[];
   /** allows handlers to queue events into the main adapter queue */
   queue_event(
      event: Omit<RawInputEvent, 'timestamp' | 'device_id'>,
      device_id: DeviceId
   ): void;

   /** polls gamepads */
   poll_gamepads(): void;
   /** sets the deadzone for analog inputs */
   set_deadzone(value: number): void;
   /** gets the current state of all known physical keys */
   get_physical_key_states(): Set<PhysicalKey>;

   /** request pointer lock */
   lock_pointer(): void;
   /** release pointer lock */
   unlock_pointer(): void;
}