/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-adapter-browser/src/input_adapter/module/gamepad.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { PHYSICAL_KEYS, type PhysicalKey } from '@eldritch-engine/plugin-input-core/types/physical_keys';
import type { DeviceId } from '@eldritch-engine/plugin-input-core/types/device';
import type { InputAdapter } from '@eldritch-engine/plugin-input-core/types/adapter';

export class GamepadInputHandler {
   #adapter: InputAdapter;

   #previous_gamepad_states: Map<number, Gamepad> = new Map();
   #deadzone: number = 0.15;

   #bound_gamepad_connected = this.#handle_gamepad_connected.bind(this);
   #bound_gamepad_disconnected = this.#handle_gamepad_disconnected.bind(this);

   constructor(adapter: InputAdapter) {
      this.#adapter = adapter;
   }

   initialize(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      window.addEventListener('gamepadconnected', this.#bound_gamepad_connected);
      window.addEventListener('gamepaddisconnected', this.#bound_gamepad_disconnected);

      logger.trace(`initialized the gamepad input handler, polling gamepads...`);

      this.poll_gamepads();
   }

   cleanup(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      window.removeEventListener('gamepadconnected', this.#bound_gamepad_connected);
      window.removeEventListener('gamepaddisconnected', this.#bound_gamepad_disconnected);

      logger.trace(`removed the gamepad input handler`);
   }

   set_deadzone(
      value: number
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      this.#deadzone = Math.max(0, Math.min(1, value));

      logger.trace(`gamepad deadzone set to ${this.#deadzone}`);
   }

   poll_gamepads(): void {
      const gamepads = navigator.getGamepads();

      for (let i = 0; i < gamepads.length; i++) {
         const current_gamepad = gamepads[i];
         const previous_gamepad_state = this.#previous_gamepad_states.get(i);

         if (
            current_gamepad
            && !previous_gamepad_state
         ) {
            this.#handle_connect(current_gamepad);

            continue;
         } else if (
            !current_gamepad
            && previous_gamepad_state
         ) {
            this.#handle_disconnect(previous_gamepad_state);

            continue;
         }

         if (
            !current_gamepad
            || !previous_gamepad_state
         ) {
            continue;
         }

         const device_id = current_gamepad.index as DeviceId;

         for (let button_index = 0; button_index < current_gamepad.buttons.length; button_index++) {
            const current_button = current_gamepad.buttons[button_index];
            const previous_button = previous_gamepad_state.buttons[button_index];
            const physical_key = this.#get_gamepad_button_physical_input(button_index);

            if (
               !physical_key
               || !current_button
               || !previous_button
            ) {
               continue;
            }

            if (
               current_button.pressed !== previous_button.pressed
               || (
                  current_button.pressed
                  && Math.abs(current_button.value - previous_button.value) > 0.01
               )
            ) {
               this.#adapter.queue_event(
                  {
                     physical_input: physical_key,
                     pressed: current_button.pressed,
                     value: current_button.value,
                  },
                  device_id
               );

               this.#adapter.key_states.set(physical_key, current_button.pressed);
            }
         }

         for (let axis_index = 0; axis_index < current_gamepad.axes.length; axis_index++) {
            const current_value = current_gamepad.axes[axis_index]!;
            const previous_value = previous_gamepad_state.axes[axis_index]!;
            const physical_key = this.#get_gamepad_axis_physical_input(axis_index);

            if (!physical_key) {
               continue;
            }

            const current_abs = Math.abs(current_value);
            const previous_abs = Math.abs(previous_value);

            let value_to_report = 0;

            if (current_abs > this.#deadzone) {
               const range = 1.0 - this.#deadzone;
               const scaled_value = range > 0 ? (current_abs - this.#deadzone) / range : 1.0;

               value_to_report = Math.sign(current_value) * Math.min(1.0, scaled_value);
            }

            let previous_reported_value = 0;

            if (previous_abs > this.#deadzone) {
               const range = 1.0 - this.#deadzone;
               const scaled_value = range > 0 ? (previous_abs - this.#deadzone) / range : 1.0;

               previous_reported_value = Math.sign(previous_value) * Math.min(1.0, scaled_value);
            }

            if (Math.abs(value_to_report - previous_reported_value) > 0.001) {
               this.#adapter.queue_event(
                  {
                     physical_input: physical_key,
                     pressed: value_to_report !== 0,
                     value: value_to_report,
                  },
                  device_id
               );

               this.#adapter.key_states.set(physical_key, value_to_report !== 0);
            }
         }

         this.#previous_gamepad_states.set(i, this.#clone_gamepad_state(current_gamepad));
      }
   }

   #handle_gamepad_connected(
      event: GamepadEvent
   ): void {
      this.#handle_connect(event.gamepad);
   }

   #handle_connect(
      gamepad: Gamepad
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`gamepad connected at index ${gamepad.index}: ${gamepad.id}. ${gamepad.buttons.length} buttons, ${gamepad.axes.length} axes`);

      this.#previous_gamepad_states.set(gamepad.index, this.#clone_gamepad_state(gamepad));
   }

   #handle_gamepad_disconnected(
      event: GamepadEvent
   ): void {
      this.#handle_disconnect(event.gamepad);
   }

   #handle_disconnect(
      gamepad: Gamepad
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`gamepad disconnected from index ${gamepad.index}: ${gamepad.id}`);

      const device_id = gamepad.index as DeviceId;

      for (let btn_idx = 0; btn_idx < gamepad.buttons.length; btn_idx++) {
         const physical_key = this.#get_gamepad_button_physical_input(btn_idx);

         if (
            physical_key
            && gamepad.buttons[btn_idx]?.pressed
         ) {
            this.#adapter.queue_event(
               {
                  physical_input: physical_key,
                  pressed: false,
                  value: 0.0
               },
               device_id
            );

            this.#adapter.key_states.set(physical_key, false);
         }
      }

      for (let axis_idx = 0; axis_idx < gamepad.axes.length; axis_idx++) {
         const physical_key = this.#get_gamepad_axis_physical_input(axis_idx);
         const current_abs = Math.abs(gamepad.axes[axis_idx]!);

         if (
            physical_key &&
            current_abs > this.#deadzone
         ) {
            this.#adapter.queue_event(
               {
                  physical_input: physical_key,
                  pressed: false,
                  value: 0.0
               },
               device_id
            );

            this.#adapter.key_states.set(physical_key, false);
         }
      }

      this.#previous_gamepad_states.delete(gamepad.index);
   }

   #clone_gamepad_state(
      gamepad: Gamepad
   ): Gamepad {
      return {
         ...gamepad,
         buttons: gamepad.buttons.map(b => (
            {
               pressed: b.pressed,
               touched: b.touched,
               value: b.value
            }
         )),
         axes: [
            ...gamepad.axes
         ],
      } as Gamepad;
   }

   #get_gamepad_button_physical_input(
      button_index: number
   ): PhysicalKey | undefined {
      switch (button_index) {
         case 0: return PHYSICAL_KEYS.gamepad_button_south;
         case 1: return PHYSICAL_KEYS.gamepad_button_east;
         case 2: return PHYSICAL_KEYS.gamepad_button_west;
         case 3: return PHYSICAL_KEYS.gamepad_button_north;
         case 4: return PHYSICAL_KEYS.gamepad_left_bumper;
         case 5: return PHYSICAL_KEYS.gamepad_right_bumper;
         case 6: return PHYSICAL_KEYS.gamepad_left_trigger_button;
         case 7: return PHYSICAL_KEYS.gamepad_right_trigger_button;
         case 8: return PHYSICAL_KEYS.gamepad_select;
         case 9: return PHYSICAL_KEYS.gamepad_start;
         case 10: return PHYSICAL_KEYS.gamepad_left_stick_press;
         case 11: return PHYSICAL_KEYS.gamepad_right_stick_press;
         case 12: return PHYSICAL_KEYS.gamepad_dpad_up;
         case 13: return PHYSICAL_KEYS.gamepad_dpad_down;
         case 14: return PHYSICAL_KEYS.gamepad_dpad_left;
         case 15: return PHYSICAL_KEYS.gamepad_dpad_right;

         default: {
            return;
         }
      }
   }

   #get_gamepad_axis_physical_input(
      axis_index: number
   ): PhysicalKey | undefined {
      switch (axis_index) {
         case 0: return PHYSICAL_KEYS.gamepad_left_stick_x;
         case 1: return PHYSICAL_KEYS.gamepad_left_stick_y;
         case 2: return PHYSICAL_KEYS.gamepad_right_stick_x;
         case 3: return PHYSICAL_KEYS.gamepad_right_stick_y;
         case 4: return PHYSICAL_KEYS.gamepad_left_trigger;
         case 5: return PHYSICAL_KEYS.gamepad_right_trigger;
         case 6: return PHYSICAL_KEYS.gamepad_left_trigger;
         case 7: return PHYSICAL_KEYS.gamepad_right_trigger;

         default: {
            return;
         }
      }
   }
}