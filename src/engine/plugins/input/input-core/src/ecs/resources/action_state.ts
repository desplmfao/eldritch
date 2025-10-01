/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/ecs/resources/action_state.ts
 */

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

import type { Action, ActionData } from '@self/types/input';
import type { DeviceId } from '@self/types/device';

/** resource storing the current state of all registered game actions */
export class ResourceActionState extends Resource {
   state: Map<Action, Map<DeviceId, ActionData>> = new Map();

   /**
    * gets the current state data for a specific action on a specific device
    * 
    * @param action the action to query
    * @param device_id the specific device id
    */
   get_action_data(
      action: Action,
      device_id: DeviceId
   ): ActionData | undefined {
      return this.state.get(action)?.get(device_id);
   }

   /**
    * checks if an action is currently pressed on a specific device
    * 
    * @param action the action to check
    * @param device_id the specific device id
    */
   pressed(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.pressed ?? false;
   }

   /**
    * checks if an action was just pressed in the current tick on a specific device
    * 
    * @param action the action to check
    * @param device_id the specific device id
    */
   just_pressed(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.just_pressed ?? false;
   }

   /**
    * checks if an action was just released in the current tick on a specific device
    *
    * @param action the action to check
    * @param device_id the specific device id
    */
   just_released(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.just_released ?? false;
   }

   /**
    * gets the analog value of an action on a specific device
    * 
    * @param action the action to check
    * @param device_id the specific device id
    */
   value(
      action: Action,
      device_id: DeviceId
   ): number {
      return this.state.get(action)?.get(device_id)?.value ?? 0;
   }

   /**
    * gets the combined axis pair value for an action on a specific device
    * 
    * @param action the action to check
    * @param device_id the specific device id
    */
   axis_pair(
      action: Action,
      device_id: DeviceId
   ): [number, number] | undefined {
      return this.state.get(action)?.get(device_id)?.axis_pair;
   }

   /** checks if the tap action was triggered this tick on a specific device */
   just_tapped(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.just_tapped ?? false;
   }

   /** checks if the double-tap action was triggered this tick on a specific device */
   just_double_tapped(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.just_double_tapped ?? false;
   }

   /** checks if the hold action is currently active on a specific device */
   is_holding(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.is_holding ?? false;
   }

   /** checks if the hold action started this tick on a specific device */
   just_started_holding(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.just_started_holding ?? false;
   }

   /** checks if the hold action stopped this tick on a specific device */
   just_stopped_holding(
      action: Action,
      device_id: DeviceId
   ): boolean {
      return this.state.get(action)?.get(device_id)?.just_stopped_holding ?? false;
   }

   /** checks if the action is pressed on *any* device */
   any_pressed(
      action: Action
   ): boolean {
      const device_map = this.state.get(action);

      if (!device_map) {
         return false;
      }

      for (const data of device_map.values()) {
         if (data.pressed) {
            return true;
         }
      }

      return false;
   }

   /** checks if the action was just pressed on *any* device this tick */
   any_just_pressed(
      action: Action
   ): boolean {
      const device_map = this.state.get(action);

      if (!device_map) {
         return false;
      }

      for (const data of device_map.values()) {
         if (data.just_pressed) {
            return true;
         }
      }

      return false;
   }

   /** checks if the action was just released on *any* device this tick */
   any_just_released(
      action: Action
   ): boolean {
      const device_map = this.state.get(action);

      if (!device_map) {
         return false;
      }

      for (const data of device_map.values()) {
         if (data.just_released) {
            return true;
         }
      }

      return false;
   }

   /** gets the highest absolute analog value for the action across all devices */
   get_highest_value(
      action: Action
   ): {
      value: number;
      device_id: DeviceId
   } | undefined {
      const device_map = this.state.get(action);

      if (
         !device_map
         || device_map.size === 0
      ) {
         return;
      }

      let highest_value = 0;
      let source_device_id: DeviceId | undefined = undefined;

      for (const [device_id, data] of device_map.entries()) {
         if (Math.abs(data.value) >= Math.abs(highest_value)) {
            if (
               Math.abs(data.value) > Math.abs(highest_value)
               || source_device_id == null
               || device_id < source_device_id
            ) {
               highest_value = data.value;
               source_device_id = device_id;
            }
         }
      }

      return source_device_id != null ? {
         value: highest_value,
         device_id: source_device_id
      } : undefined;
   }

   /** gets the axis pair value from the first device reporting non-zero input for the action */
   get_first_axis_pair(
      action: Action
   ): {
      pair: [number, number];
      device_id: DeviceId
   } | undefined {
      const device_map = this.state.get(action);

      if (!device_map) {
         return;
      }

      const sorted_device_ids = [...device_map.keys()].sort((a, b) => a - b);

      for (const device_id of sorted_device_ids) {
         const data = device_map.get(device_id);

         if (
            data?.axis_pair
            && (
               data.axis_pair[0] !== 0
               || data.axis_pair[1] !== 0
            )
         ) {
            return {
               pair: data.axis_pair,
               device_id: device_id
            };
         }
      }

      return;
   }

   /** gets a list of device ids currently pressing the specified action */
   get_active_devices(
      action: Action
   ): DeviceId[] {
      const device_map = this.state.get(action);

      if (!device_map) {
         return [];
      }

      const active_devices: DeviceId[] = [];

      for (const [device_id, data] of device_map.entries()) {
         if (data.pressed) {
            active_devices.push(device_id);
         }
      }

      return active_devices;
   }

   /** ensures an action and device entry exists in the state map */
   ensure_action_device_entry(
      action: Action,
      device_id: DeviceId
   ): ActionData {
      if (!this.state.has(action)) {
         this.state.set(action, new Map());
      }

      const device_map = this.state.get(action)!;

      if (!device_map.has(device_id)) {
         device_map.set(
            device_id,
            {
               pressed: false,
               just_pressed: false,
               just_released: false,
               value: 0,
               timestamp: 0,
               just_tapped: false,
               just_double_tapped: false,
               is_holding: false,
               just_started_holding: false,
               just_stopped_holding: false,
            }
         );
      }

      return device_map.get(device_id)!;
   }

   /** updates the state of a specific action for a specific device */
   update_action_state(
      action: Action,
      device_id: DeviceId,
      pressed: boolean,
      value: number,
      timestamp: number
   ): void {
      const data = this.ensure_action_device_entry(action, device_id);

      if (
         timestamp < data.timestamp
         && data.timestamp !== 0
      ) {
         return;
      }

      const previously_pressed = data.pressed;

      data.pressed = pressed;
      data.value = pressed ? value : 0;
      data.timestamp = timestamp;

      if (
         !previously_pressed
         && pressed
      ) {
         data.just_pressed = true;
         data.just_released = false;
      } else if (
         previously_pressed
         && !pressed
      ) {
         data.just_released = true;
         data.just_pressed = false;
      }
   }

   /** updates the axis_pair state for an action on a specific device */
   update_axis_pair(
      action: Action,
      device_id: DeviceId,
      x: number,
      y: number,
      timestamp: number
   ): void {
      const data = this.ensure_action_device_entry(action, device_id);

      if (timestamp >= data.timestamp) {
         if (!data.axis_pair) {
            data.axis_pair = [x, y];
         } else {
            data.axis_pair[0] = x;
            data.axis_pair[1] = y;
         }

         data.timestamp = timestamp;
      }
   }

   pre_update_tick(): void {
      for (const device_map of this.state.values()) {
         for (const data of device_map.values()) {
            data.just_pressed = false;
            data.just_released = false;
            data.just_tapped = false;
            data.just_double_tapped = false;
            data.just_started_holding = false;
            data.just_stopped_holding = false;

            if (!data.pressed) {
               data.value = 0;
            }
         }
      }
   }

   /** clears all action states for all devices */
   clear(): void {
      this.state.clear();
   }
}