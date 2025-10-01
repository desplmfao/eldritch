/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-adapter-browser/src/input_adapter/module/mouse.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { PHYSICAL_KEYS, type PhysicalKey } from '@eldritch-engine/plugin-input-core/types/physical_keys';
import { DEVICE_ID_MOUSE, type DeviceId } from '@eldritch-engine/plugin-input-core/types/device';
import type { InputAdapter } from '@eldritch-engine/plugin-input-core/types/adapter';

export const MAX_SINGLE_MOUSE_DELTA = 1_000;

export class MouseInputHandler {
   #adapter: InputAdapter;

   #canvas_element?: HTMLCanvasElement;

   #accumulated_movement_x: number = 0;
   #accumulated_movement_y: number = 0;
   #last_mouse_move_timestamp: number = 0;

   #bound_mouse_down = this.#handle_mouse_down.bind(this);
   #bound_mouse_up = this.#handle_mouse_up.bind(this);
   #bound_mouse_move = this.#handle_mouse_move.bind(this);
   #bound_context_menu = this.#handle_context_menu.bind(this);
   #bound_wheel = this.#handle_wheel.bind(this);
   #bound_canvas_click = this.#handle_canvas_click.bind(this);
   #bound_pointer_lock_change = this.#handle_pointer_lock_change.bind(this);
   #bound_pointer_lock_error = this.#handle_pointer_lock_error.bind(this);

   constructor(
      adapter: InputAdapter,
      canvas_element?: HTMLCanvasElement
   ) {
      this.#adapter = adapter;
      this.#canvas_element = canvas_element;
   }

   initialize(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.#canvas_element) {
         this.#canvas_element.addEventListener('click', this.#bound_canvas_click);
      }

      document.addEventListener('mousedown', this.#bound_mouse_down);
      document.addEventListener('mouseup', this.#bound_mouse_up);
      document.addEventListener('mousemove', this.#bound_mouse_move);
      document.addEventListener('contextmenu', this.#bound_context_menu);
      document.addEventListener('wheel', this.#bound_wheel, { passive: false });

      document.addEventListener('pointerlockchange', this.#bound_pointer_lock_change);
      document.addEventListener('pointerlockerror', this.#bound_pointer_lock_error);

      logger.trace(`initialized the mouse input handler`);
   }

   cleanup(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.#canvas_element) {
         this.#canvas_element.removeEventListener('click', this.#bound_canvas_click);
      }

      document.removeEventListener('mousedown', this.#bound_mouse_down);
      document.removeEventListener('mouseup', this.#bound_mouse_up);
      document.removeEventListener('mousemove', this.#bound_mouse_move);
      document.removeEventListener('contextmenu', this.#bound_context_menu);
      document.removeEventListener('wheel', this.#bound_wheel);

      document.removeEventListener('pointerlockchange', this.#bound_pointer_lock_change);
      document.removeEventListener('pointerlockerror', this.#bound_pointer_lock_error);

      if (this.#adapter.is_pointer_locked) {
         this.#adapter.unlock_pointer();
      }

      logger.trace(`removed the mouse input handler`);
   }

   drain_accumulated_movement(): {
      x: number;
      y: number;
      timestamp: number;
      device_id: DeviceId
   } | undefined {
      if (
         this.#accumulated_movement_x !== 0
         || this.#accumulated_movement_y !== 0
      ) {
         const movement = {
            x: this.#accumulated_movement_x,
            y: this.#accumulated_movement_y,
            timestamp: this.#last_mouse_move_timestamp > 0 ? this.#last_mouse_move_timestamp : performance.now(),
            device_id: DEVICE_ID_MOUSE
         };

         this.#accumulated_movement_x = 0;
         this.#accumulated_movement_y = 0;
         this.#last_mouse_move_timestamp = 0;

         return movement;
      }

      return;
   }

   #get_mouse_button_physical_input(
      button_index: number
   ): PhysicalKey | undefined {
      switch (button_index) {
         case 0: return PHYSICAL_KEYS.mouse_button_left;
         case 1: return PHYSICAL_KEYS.mouse_button_middle;
         case 2: return PHYSICAL_KEYS.mouse_button_right;
         case 3: return PHYSICAL_KEYS.mouse_button_back;
         case 4: return PHYSICAL_KEYS.mouse_button_forward;

         default: {
            return;
         }
      }
   }

   #handle_mouse_down(
      event: MouseEvent
   ): void {
      const physical_input = this.#get_mouse_button_physical_input(event.button);

      if (
         physical_input
         && !this.#adapter.mouse_button_states.get(event.button)
      ) {
         this.#adapter.mouse_button_states.set(event.button, true);
         this.#adapter.key_states.set(physical_input, true);

         this.#adapter.queue_event(
            {
               physical_input: physical_input,
               pressed: true,
               value: 1.0,
            },
            DEVICE_ID_MOUSE
         );
      }
   }

   #handle_mouse_up(
      event: MouseEvent
   ): void {
      const physical_input = this.#get_mouse_button_physical_input(event.button);

      if (
         physical_input
         && this.#adapter.mouse_button_states.get(event.button)
      ) {
         this.#adapter.mouse_button_states.set(event.button, false);
         this.#adapter.key_states.set(physical_input, false);

         this.#adapter.queue_event(
            {
               physical_input: physical_input,
               pressed: false,
               value: 0.0,
            },
            DEVICE_ID_MOUSE
         );
      }
   }

   #handle_mouse_move(
      event: MouseEvent
   ): void {
      if (this.#adapter.is_pointer_locked) {
         let delta_x = event.movementX;
         let delta_y = event.movementY;

         if (Math.abs(delta_x) > MAX_SINGLE_MOUSE_DELTA) {
            delta_x = Math.sign(delta_x) * MAX_SINGLE_MOUSE_DELTA;
         }

         if (Math.abs(delta_y) > MAX_SINGLE_MOUSE_DELTA) {
            delta_y = Math.sign(delta_y) * MAX_SINGLE_MOUSE_DELTA;
         }

         if (
            delta_x !== 0
            || delta_y !== 0
         ) {
            this.#accumulated_movement_x += delta_x;
            this.#accumulated_movement_y += delta_y;

            this.#last_mouse_move_timestamp = event.timeStamp > 0 ? event.timeStamp : performance.now();
         }
      }
   }

   #handle_wheel(
      event: WheelEvent
   ): void {
      if (this.#adapter.is_pointer_locked) {
         event.preventDefault();
      }

      const delta_y = event.deltaY !== 0 ? -Math.sign(event.deltaY) : 0;
      const delta_x = event.deltaX !== 0 ? Math.sign(event.deltaX) : 0;

      if (delta_y !== 0) {
         this.#adapter.queue_event(
            {
               physical_input: PHYSICAL_KEYS.mouse_wheel_y,
               pressed: true,
               value: delta_y,
            },
            DEVICE_ID_MOUSE
         );
      }

      if (delta_x !== 0) {
         this.#adapter.queue_event(
            {
               physical_input: PHYSICAL_KEYS.mouse_wheel_x,
               pressed: true,
               value: delta_x,
            },
            DEVICE_ID_MOUSE
         );
      }
   }

   #handle_context_menu(
      event: MouseEvent
   ): void {
      if (this.#adapter.is_pointer_locked) {
         event.preventDefault();
      }
   }

   #handle_canvas_click(
      event: MouseEvent
   ): void {
      if (
         this.#canvas_element
         && !this.#adapter.is_pointer_locked
      ) {
         this.#adapter.lock_pointer();
      }
   }

   #handle_pointer_lock_change(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const is_now_locked = document.pointerLockElement === this.#canvas_element;

      if (this.#adapter.is_pointer_locked !== is_now_locked) {
         this.#adapter.is_pointer_locked = is_now_locked;

         logger.trace(`pointer lock state changed: ${is_now_locked ? 'locked' : 'unlocked'}`);

         this.#accumulated_movement_x = 0;
         this.#accumulated_movement_y = 0;
         this.#last_mouse_move_timestamp = 0;
      }
   }

   #handle_pointer_lock_error(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.critical('pointer lock failed');

      if (this.#adapter.is_pointer_locked) {
         this.#adapter.is_pointer_locked = false;

         this.#accumulated_movement_x = 0;
         this.#accumulated_movement_y = 0;
         this.#last_mouse_move_timestamp = 0;
      }
   }
}