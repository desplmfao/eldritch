/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/ecs/systems/process_input_events.ts
 */

import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import type { RawInputEvent } from '@self/types/input';
import type { PhysicalKey } from '@self/types/physical_keys';
import type { DeviceId } from '@self/types/device';

import { ResourceInputMap } from '@self/ecs/resources/input_map';
import { ResourceActionState } from '@self/ecs/resources/action_state';
import { ResourceInputAdapterHandle } from '@self/ecs/resources/input_adapter_handle';
import { ResourceInputTimingConfig } from '@self/ecs/resources/input_timing_config';

// TODO: move this into a resource
/** internal state tracking for advanced press types per physical input */
interface PhysicalInputState {
   /** timestamp when the physical input was pressed down */
   press_start_time: number;
   /** timestamp when the physical input was last released */
   last_release_time: number;
   /** timestamp when the *release* of a valid tap occurred */
   tap_detected_time: number;
   /** flag to prevent hold firing multiple times per press */
   hold_triggered: boolean;
   /** is the physical input currently down? */
   currently_pressed: boolean;
}

export class SystemProcessInputEvents extends System {
   override order = -1_000_000_000;

   #physical_input_tracker: Map<string, PhysicalInputState> = new Map();
   #taps_this_tick: Set<string> = new Set();
   #double_taps_this_tick: Set<string> = new Set();
   #hold_starts_this_tick: Set<string> = new Set();
   #hold_stops_this_tick: Set<string> = new Set();

   override run_criteria(
      adapter_handle: Res<ResourceInputAdapterHandle>
   ): boolean {
      return adapter_handle.adapter != null;
   }

   update(
      adapter_handle: Res<ResourceInputAdapterHandle>,
      input_map: Res<ResourceInputMap>,
      action_state: Res<ResourceActionState>,
      default_timing_config: Res<ResourceInputTimingConfig>
   ) {
      const input_adapter = adapter_handle.adapter!;
      const now = performance.now();

      action_state.pre_update_tick();

      this.#taps_this_tick.clear();
      this.#double_taps_this_tick.clear();
      this.#hold_starts_this_tick.clear();
      this.#hold_stops_this_tick.clear();

      input_adapter.poll_gamepads?.();

      const raw_events: RawInputEvent[] = input_adapter.drain_events();

      const latest_physical_states_this_tick: Map<string, RawInputEvent> = new Map();

      for (const event of raw_events) {
         const physical_key = `${event.physical_input}:${event.device_id}`;
         const existing_latest = latest_physical_states_this_tick.get(physical_key);

         if (
            !existing_latest
            || event.timestamp >= existing_latest.timestamp
         ) {
            latest_physical_states_this_tick.set(physical_key, event);
         }

         if (
            event.physical_input.startsWith('key_')
            || event.physical_input.startsWith('mouse_button')
            || event.physical_input.startsWith('gamepad_button')
            || event.physical_input.startsWith('gamepad_dpad')
         ) {
            this.#process_physical_button_event(event, default_timing_config, input_map);
         }
      }

      this.#update_ongoing_holds(now, default_timing_config, input_map);

      this.#update_action_state_from_physical(
         latest_physical_states_this_tick,
         input_map,
         action_state
      );

      this.#update_chord_states(input_map, action_state);
   }

   #process_physical_button_event(
      event: RawInputEvent,
      default_timing_config: ResourceInputTimingConfig,
      input_map: ResourceInputMap
   ): void {
      const tracker_key = `${event.physical_input}:${event.device_id}`;

      let state = this.#physical_input_tracker.get(tracker_key);

      const tap_mapping = input_map.get_tap_action_details(event.physical_input);
      const hold_mapping = input_map.get_hold_action_details(event.physical_input);
      const double_tap_mapping = input_map.get_double_tap_action_details(event.physical_input);

      const max_tap_duration = tap_mapping?.timing_override?.max_tap_duration_ms ?? default_timing_config.max_tap_duration_ms;
      const max_double_tap_interval = double_tap_mapping?.timing_override?.max_double_tap_interval_ms ?? default_timing_config.max_double_tap_interval_ms;

      if (
         !state
         && event.pressed
      ) {
         state = {
            press_start_time: event.timestamp,
            last_release_time: 0,
            tap_detected_time: 0,
            hold_triggered: false,
            currently_pressed: true,
         };

         this.#physical_input_tracker.set(tracker_key, state);

         const previous_state = this.#physical_input_tracker.get(tracker_key);

         if (
            previous_state
            && (previous_state?.tap_detected_time > 0)
            && (event.timestamp - previous_state.tap_detected_time) <= max_double_tap_interval
         ) {
            if (double_tap_mapping) {
               this.#double_taps_this_tick.add(`${double_tap_mapping.action}:${event.device_id}`);
            }

            state.tap_detected_time = 0;
         }
      }

      else if (
         state
         && !event.pressed
         && state.currently_pressed
      ) {
         const press_duration_ms = event.timestamp - state.press_start_time;

         state.last_release_time = event.timestamp;
         state.currently_pressed = false;

         if (!state.hold_triggered && press_duration_ms <= max_tap_duration) {
            if (tap_mapping) {
               this.#taps_this_tick.add(`${tap_mapping.action}:${event.device_id}`);
            }

            if (double_tap_mapping) {
               state.tap_detected_time = event.timestamp;
            } else {
               state.tap_detected_time = 0;
            }
         } else {
            state.tap_detected_time = 0;
         }

         if (state.hold_triggered) {
            if (hold_mapping) {
               this.#hold_stops_this_tick.add(`${hold_mapping.action}:${event.device_id}`);
            }

            state.hold_triggered = false;
         }

      }

      else if (
         state
         && event.pressed
         && !state.currently_pressed
      ) {
         state.press_start_time = event.timestamp;
         state.currently_pressed = true;
         state.hold_triggered = false;

         if (
            (state.tap_detected_time > 0)
            && (event.timestamp - state.tap_detected_time) <= max_double_tap_interval
         ) {
            if (double_tap_mapping) {
               this.#double_taps_this_tick.add(`${double_tap_mapping.action}:${event.device_id}`);
            }

            state.tap_detected_time = 0;
         }
      }
   }

   #update_ongoing_holds(
      now: number,
      default_timing_config: ResourceInputTimingConfig,
      input_map: ResourceInputMap
   ): void {
      for (const [tracker_key, state] of this.#physical_input_tracker.entries()) {
         if (
            state.currently_pressed
            && !state.hold_triggered
         ) {
            const current_press_duration_ms = now - state.press_start_time;

            const [physical_input_str, device_id_str] = tracker_key.split(':');

            if (
               !physical_input_str
               || !device_id_str
            ) {
               continue;
            }

            const physical_input = physical_input_str as PhysicalKey;
            const device_id = Number.parseInt(device_id_str, 10) as DeviceId;

            if (Number.isNaN(device_id)) {
               continue;
            }

            const hold_mapping = input_map.get_hold_action_details(physical_input);

            if (hold_mapping) {
               const min_hold_duration = hold_mapping.timing_override?.min_hold_duration_ms ?? default_timing_config.min_hold_duration_ms;

               if (current_press_duration_ms >= min_hold_duration) {
                  this.#hold_starts_this_tick.add(`${hold_mapping.action}:${device_id}`);

                  state.hold_triggered = true;
               }
            }
         }
      }
   }

   #update_action_state_from_physical(
      latest_physical_states: Map<string, RawInputEvent>,
      input_map: ResourceInputMap,
      action_state: ResourceActionState
   ): void {
      const processed_axes_for_pairs: Set<string> = new Set();
      const physical_keys_with_events = new Set<string>();

      for (const [action, pair_inputs] of input_map.axis_pair_map.entries()) {
         const relevant_devices_for_pair = new Set<DeviceId>();

         if (pair_inputs.x) {
            for (const [key, ev] of latest_physical_states.entries()) {
               if (key.startsWith(pair_inputs.x + ':')) {
                  relevant_devices_for_pair.add(ev.device_id);
                  physical_keys_with_events.add(key);
               }
            }

            processed_axes_for_pairs.add(pair_inputs.x);
         }

         if (pair_inputs.y) {
            for (const [key, ev] of latest_physical_states.entries()) {
               if (key.startsWith(pair_inputs.y + ':')) {
                  relevant_devices_for_pair.add(ev.device_id);
                  physical_keys_with_events.add(key);
               }
            }

            processed_axes_for_pairs.add(pair_inputs.y);
         }

         const existing_device_map = action_state.state.get(action);

         if (existing_device_map) {
            for (const device_id of existing_device_map.keys()) {
               relevant_devices_for_pair.add(device_id);
            }
         }

         for (const device_id of relevant_devices_for_pair) {
            if (Number.isNaN(device_id)) {
               continue;
            }

            const x_key = pair_inputs.x ? `${pair_inputs.x}:${device_id}` : undefined;
            const y_key = pair_inputs.y ? `${pair_inputs.y}:${device_id}` : undefined;

            const x_state = x_key ? latest_physical_states.get(x_key) : undefined;
            const y_state = y_key ? latest_physical_states.get(y_key) : undefined;

            const x_val = x_state?.value ?? 0;
            const y_val = y_state?.value ?? 0;

            const timestamp = Math.max(x_state?.timestamp ?? 0, y_state?.timestamp ?? 0, action_state.get_action_data(action, device_id)?.timestamp ?? 0);

            action_state.update_axis_pair(action, device_id, x_val, y_val, timestamp);
         }
      }

      for (const [physical_key_full, event] of latest_physical_states.entries()) {
         physical_keys_with_events.add(physical_key_full);

         const physical_input = event.physical_input;
         const device_id = event.device_id;

         if (processed_axes_for_pairs.has(physical_input)) {
            continue;
         }

         const button_action = input_map.get_button_action(physical_input);

         if (button_action != null) {
            action_state.update_action_state(button_action, device_id, event.pressed, event.value, event.timestamp);
         }

         const axis_action = input_map.get_axis_action(physical_input);
         const is_part_of_any_pair_def = Array.from(input_map.axis_pair_map.values()).some(p => p.x === physical_input || p.y === physical_input);

         if (
            axis_action != null
            && !input_map.axis_pair_map.has(axis_action)
            && !is_part_of_any_pair_def
         ) {
            action_state.update_action_state(axis_action, device_id, event.pressed, event.value, event.timestamp);
         }
      }

      const now = performance.now();

      for (const [action, device_map] of action_state.state.entries()) {
         const is_axis_pair_action = input_map.axis_pair_map.has(action);

         if (is_axis_pair_action) {
            continue;
         }

         const physical_keys_for_action: PhysicalKey[] = [];

         for (const [pk, act] of input_map.single_action_map.entries()) {
            if (act === action) {
               physical_keys_for_action.push(pk);
            }
         }

         for (const [pk, ac] of input_map.axis_action_map.entries()) {
            let is_part_of_any_pair_def = false;

            for (const pair_def of input_map.axis_pair_map.values()) {
               if (
                  pair_def.x === pk
                  || pair_def.y === pk
               ) {
                  is_part_of_any_pair_def = true;

                  break;
               }
            }

            if (
               ac === action
               && !input_map.axis_pair_map.has(action)
               && !is_part_of_any_pair_def
            ) {
               physical_keys_for_action.push(pk);
            }
         }

         for (const [device_id, data] of device_map.entries()) {
            let had_event_this_tick = false;

            for (const pk of physical_keys_for_action) {
               if (physical_keys_with_events.has(`${pk}:${device_id}`)) {
                  had_event_this_tick = true;

                  break;
               }
            }

            if (!had_event_this_tick) {
               if (data.value !== 0) {
               }

               if (data.is_holding) {
                  data.is_holding = false;
                  data.just_stopped_holding = true;
               }
            }
         }
      }

      for (const tap_key of this.#taps_this_tick) {
         const [action_str, device_id_str] = tap_key.split(':');

         if (
            !action_str
            || !device_id_str
         ) {
            continue;
         }

         const action = action_str;
         const device_id = Number.parseInt(device_id_str, 10);

         if (Number.isNaN(device_id)) {
            continue;
         }

         const data = action_state.ensure_action_device_entry(action, device_id);

         data.just_tapped = true;
         data.timestamp = Math.max(data.timestamp, now);
      }

      for (const dt_key of this.#double_taps_this_tick) {
         const [action_str, device_id_str] = dt_key.split(':');

         if (
            !action_str
            || !device_id_str
         ) {
            continue;
         }

         const action = action_str;
         const device_id = Number.parseInt(device_id_str, 10);

         if (Number.isNaN(device_id)) {
            continue;
         }

         const data = action_state.ensure_action_device_entry(action, device_id);

         data.just_double_tapped = true;
         data.timestamp = Math.max(data.timestamp, now);
      }

      for (const hs_key of this.#hold_starts_this_tick) {
         const [action_str, device_id_str] = hs_key.split(':');

         if (
            !action_str
            || !device_id_str
         ) {
            continue;
         }

         const action = action_str;
         const device_id = Number.parseInt(device_id_str, 10);

         if (Number.isNaN(device_id)) {
            continue;
         }

         const data = action_state.ensure_action_device_entry(action, device_id);

         data.is_holding = true;
         data.just_started_holding = true;
         data.timestamp = Math.max(data.timestamp, now);
      }

      for (const he_key of this.#hold_stops_this_tick) {
         const [action_str, device_id_str] = he_key.split(':');

         if (
            !action_str
            || !device_id_str
         ) {
            continue;
         }

         const action = action_str;
         const device_id = Number.parseInt(device_id_str, 10);

         if (Number.isNaN(device_id)) {
            continue;
         }

         const data = action_state.ensure_action_device_entry(action, device_id);

         data.is_holding = false;
         data.just_stopped_holding = true;
         data.timestamp = Math.max(data.timestamp, now);
      }
   }

   #update_chord_states(
      input_map: ResourceInputMap,
      action_state: ResourceActionState
   ): void {
      const active_physical_keys_per_device = new Map<DeviceId, Set<PhysicalKey>>();

      for (const [tracker_key, state] of this.#physical_input_tracker.entries()) {
         if (state.currently_pressed) {
            const [physical_input_str, device_id_str] = tracker_key.split(':');

            if (
               !physical_input_str
               || !device_id_str
            ) {
               continue;
            }

            const physical_input = physical_input_str as PhysicalKey;
            const device_id = Number.parseInt(device_id_str, 10);

            if (Number.isNaN(device_id)) {
               continue;
            }

            if (!active_physical_keys_per_device.has(device_id)) {
               active_physical_keys_per_device.set(device_id, new Set());
            }

            active_physical_keys_per_device.get(device_id)!.add(physical_input);
         }
      }

      for (const chord_key of input_map.get_all_chord_keys()) {
         const chord_action = input_map.get_action_for_chord_key(chord_key);

         if (chord_action == null) {
            continue;
         }

         const required_keys = chord_key.split('+') as PhysicalKey[];
         const relevant_devices = new Set<DeviceId>();

         for (const key of required_keys) {
            for (const [tk] of this.#physical_input_tracker.entries()) {
               if (tk.startsWith(key + ':')) {
                  const device_id_str = tk.split(':')[1];

                  if (device_id_str) {
                     const device_id = Number.parseInt(device_id_str, 10);

                     if (!Number.isNaN(device_id)) {
                        relevant_devices.add(device_id);
                     }
                  }
               }
            }
         }

         const existing_device_map = action_state.state.get(chord_action);

         if (existing_device_map) {
            for (const device_id of existing_device_map.keys()) {
               relevant_devices.add(device_id);
            }
         }

         for (const device_id of relevant_devices) {
            if (Number.isNaN(device_id)) {
               continue;
            }

            const pressed_keys_for_device = active_physical_keys_per_device.get(device_id) ?? new Set();
            const chord_fully_active = required_keys.every(key => pressed_keys_for_device.has(key));

            const current_data = action_state.ensure_action_device_entry(chord_action, device_id);
            const was_pressed = current_data.pressed;

            let latest_event_time = 0;

            for (const key of required_keys) {
               const tracker_key = `${key}:${device_id}`;
               const phys_state = this.#physical_input_tracker.get(tracker_key);

               if (phys_state) {
                  const relevant_time = phys_state.currently_pressed ? phys_state.press_start_time : phys_state.last_release_time;

                  latest_event_time = Math.max(latest_event_time, relevant_time);
               }
            }

            if (latest_event_time === 0) {
               latest_event_time = performance.now();
            }

            if (chord_fully_active) {
               if (
                  !was_pressed
                  || (latest_event_time > current_data.timestamp)
               ) {
                  action_state.update_action_state(chord_action, device_id, true, 1.0, latest_event_time);
               }

               for (const key of required_keys) {
                  const single_action = input_map.get_button_action(key);

                  if (
                     single_action
                     && single_action !== chord_action
                  ) {
                     const single_data = action_state.state.get(single_action)?.get(device_id);

                     if (single_data?.pressed) {
                        action_state.update_action_state(single_action, device_id, false, 0.0, latest_event_time);

                        const suppressed_data = action_state.ensure_action_device_entry(single_action, device_id);

                        if (suppressed_data.just_released) {
                           suppressed_data.just_released = false;
                        }
                     }
                  }
               }
            } else {
               if (was_pressed) {
                  action_state.update_action_state(chord_action, device_id, false, 0.0, latest_event_time);
               }
            }
         }
      }
   }
}