/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-adapter-browser/src/input_adapter/index.ts
 */

import type { InputAdapter } from '@eldritch-engine/plugin-input-core/types/adapter';
import type { RawInputEvent } from '@eldritch-engine/plugin-input-core/types/input';
import { PHYSICAL_KEYS, type PhysicalKey } from '@eldritch-engine/plugin-input-core/types/physical_keys';
import type { DeviceId } from '@eldritch-engine/plugin-input-core/types/device';

import { KeyboardInputHandler } from '@self/input_adapter/module/keyboard';
import { MouseInputHandler } from '@self/input_adapter/module/mouse';
import { GamepadInputHandler } from '@self/input_adapter/module/gamepad';

export class BrowserInputAdapter implements InputAdapter {
   event_queue: RawInputEvent[] = [];
   key_states: Map<PhysicalKey, boolean> = new Map();
   mouse_button_states: Map<number, boolean> = new Map();
   is_pointer_locked: boolean = false;

   #keyboard_handler: KeyboardInputHandler;
   #mouse_handler: MouseInputHandler;
   #gamepad_handler: GamepadInputHandler;

   #canvas_element?: HTMLCanvasElement;

   constructor(
      canvas_element?: HTMLCanvasElement | string
   ) {
      if (typeof canvas_element === 'string') {
         this.#canvas_element = document.querySelector(canvas_element)!;

         if (!this.#canvas_element) {
            console.warn(`canvas element not found for selector: ${canvas_element}`);
         }
      }

      else if (canvas_element instanceof HTMLCanvasElement) {
         this.#canvas_element = canvas_element;
      } else {
         this.#canvas_element = document.querySelector('#render-canvas')!;

         if (!this.#canvas_element) {
            console.warn("canvas element not provided and #render-canvas not found");
         }
      }

      this.#keyboard_handler = new KeyboardInputHandler(this);
      this.#mouse_handler = new MouseInputHandler(this, this.#canvas_element);
      this.#gamepad_handler = new GamepadInputHandler(this);
   }

   async initialize(): Promise<void> {
      this.#keyboard_handler.initialize();
      this.#mouse_handler.initialize();
      this.#gamepad_handler.initialize();

      console.info('all input handlers initialized');
   }

   async cleanup(): Promise<void> {
      this.#keyboard_handler.cleanup();
      this.#mouse_handler.cleanup();
      this.#gamepad_handler.cleanup();

      console.info('all input handlers cleaned up');
   }

   drain_events(): RawInputEvent[] {
      const mouse_movement = this.#mouse_handler.drain_accumulated_movement();
      const accumulated_events: RawInputEvent[] = [];

      if (mouse_movement) {
         if (mouse_movement.x !== 0) {
            accumulated_events.push({
               physical_input: PHYSICAL_KEYS.mouse_move_x,
               pressed: true,
               value: mouse_movement.x,
               timestamp: mouse_movement.timestamp,
               device_id: mouse_movement.device_id
            });
         }

         if (mouse_movement.y !== 0) {
            accumulated_events.push({
               physical_input: PHYSICAL_KEYS.mouse_move_y,
               pressed: true,
               value: mouse_movement.y,
               timestamp: mouse_movement.timestamp,
               device_id: mouse_movement.device_id
            });
         }
      }

      const events_to_drain = [
         ...this.event_queue,
         ...accumulated_events
      ];

      this.event_queue.length = 0;

      return events_to_drain;
   }

   queue_event(
      event: Omit<RawInputEvent, 'timestamp' | 'device_id'>,
      device_id: DeviceId
   ): void {
      this.event_queue.push({
         ...event,
         timestamp: performance.now(),
         device_id: device_id
      });
   }

   poll_gamepads(): void {
      this.#gamepad_handler.poll_gamepads();
   }

   set_deadzone(value: number): void {
      this.#gamepad_handler.set_deadzone(value);
   }

   lock_pointer(): void {
      if (
         this.#canvas_element
         && !this.is_pointer_locked
      ) {
         this.#canvas_element.requestPointerLock();
      }
   }

   unlock_pointer(): void {
      if (this.is_pointer_locked) {
         document.exitPointerLock();
      }
   }

   get_physical_key_states(): Set<PhysicalKey> {
      return new Set(this.key_states.entries()
         .filter(([, pressed]) => pressed)
         .map(([key]) => key));
   }
}