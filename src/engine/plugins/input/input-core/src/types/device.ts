/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/types/device.ts
 */

/** represents a unique identifier for an input device. */
export type DeviceId = number;

/** special DeviceId representing the logical keyboard */
export const DEVICE_ID_KEYBOARD: DeviceId = -1;

/** special DeviceId representing the logical mouse */
export const DEVICE_ID_MOUSE: DeviceId = -2;

/** checks if a DeviceId represents the logical keyboard. */
export function is_keyboard_device(id: DeviceId): boolean {
   return id === DEVICE_ID_KEYBOARD;
}

/** checks if a DeviceId represents the logical mouse. */
export function is_mouse_device(id: DeviceId): boolean {
   return id === DEVICE_ID_MOUSE;
}

/** checks if a DeviceId represents a gamepad (non-negative). */
export function is_gamepad_device(id: DeviceId): boolean {
   return id >= 0;
}