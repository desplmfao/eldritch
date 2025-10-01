/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/types/input.ts
 */

import type { PhysicalKey } from '@self/types/physical_keys';
import type { DeviceId } from '@self/types/device';

// TODO: make these classes for guerrero

/**
 * represents a logical game action
 *
 * can be a string, number, or symbol defined by the user
 */
export type Action = string | number;

/**
 * represents a physical input
 *
 * uses standard KeyboardEvent.code values and custom strings for mouse/other inputs
 */
export type PhysicalInput = PhysicalKey;

/** represents the state of a single game action */
export interface ActionData {
   /** is the action currently considered active/pressed? (based on raw input) */
   pressed: boolean;
   /** was the action just pressed in the current tick? (based on raw input) */
   just_pressed: boolean;
   /** was the action just released in the current tick? (based on raw input) */
   just_released: boolean;
   /** the analog value of the action, 0 or 1 for buttons */
   value: number;
   /** for paired axes */
   axis_pair?: [number, number];
   /** timestamp of the last event that updated this action state */
   timestamp: number;
   /** was the tap action triggered this tick? */
   just_tapped: boolean;
   /** was the double-tap action triggered this tick? */
   just_double_tapped: boolean;
   /** is the hold action currently active? */
   is_holding: boolean;
   /** did the hold action begin this tick? */
   just_started_holding: boolean;
   /** did the hold action end this tick? (release after hold duration met) */
   just_stopped_holding: boolean;
}

/** represents a raw input event captured by an adapter */
export interface RawInputEvent {
   /** the physical input identifier */
   physical_input: PhysicalInput;
   /** the state of the input */
   pressed: boolean;
   /** the analog value */
   value: number;
   /** timestamp of the raw event */
   timestamp: number;
   /** */
   device_id: DeviceId;
}