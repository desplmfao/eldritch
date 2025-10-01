/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-adapter-browser/src/input_adapter/module/keyboard.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { PHYSICAL_KEYS, type PhysicalKey } from '@eldritch-engine/plugin-input-core/types/physical_keys';
import { DEVICE_ID_KEYBOARD } from '@eldritch-engine/plugin-input-core/types/device';
import type { InputAdapter } from '@eldritch-engine/plugin-input-core/types/adapter';

export const BROWSER_KEY_MAP: Map<string, PhysicalKey> = new Map([
   ['Escape', PHYSICAL_KEYS.key_escape],
   ['PrintScreen', PHYSICAL_KEYS.key_print_screen],
   ['ScrollLock', PHYSICAL_KEYS.key_scroll_lock],
   ['Pause', PHYSICAL_KEYS.key_pause],
   ['ContextMenu', PHYSICAL_KEYS.key_context_menu],

   ['F1', PHYSICAL_KEYS.key_f1],
   ['F2', PHYSICAL_KEYS.key_f2],
   ['F3', PHYSICAL_KEYS.key_f3],
   ['F4', PHYSICAL_KEYS.key_f4],
   ['F5', PHYSICAL_KEYS.key_f5],
   ['F6', PHYSICAL_KEYS.key_f6],
   ['F7', PHYSICAL_KEYS.key_f7],
   ['F8', PHYSICAL_KEYS.key_f8],
   ['F9', PHYSICAL_KEYS.key_f9],
   ['F10', PHYSICAL_KEYS.key_f10],
   ['F11', PHYSICAL_KEYS.key_f11],
   ['F12', PHYSICAL_KEYS.key_f12],

   ['Backquote', PHYSICAL_KEYS.key_backquote],
   ['Digit1', PHYSICAL_KEYS.key_digit_1],
   ['Digit2', PHYSICAL_KEYS.key_digit_2],
   ['Digit3', PHYSICAL_KEYS.key_digit_3],
   ['Digit4', PHYSICAL_KEYS.key_digit_4],
   ['Digit5', PHYSICAL_KEYS.key_digit_5],
   ['Digit6', PHYSICAL_KEYS.key_digit_6],
   ['Digit7', PHYSICAL_KEYS.key_digit_7],
   ['Digit8', PHYSICAL_KEYS.key_digit_8],
   ['Digit9', PHYSICAL_KEYS.key_digit_9],
   ['Digit0', PHYSICAL_KEYS.key_digit_0],
   ['Minus', PHYSICAL_KEYS.key_minus],
   ['Equal', PHYSICAL_KEYS.key_equal],
   ['Backspace', PHYSICAL_KEYS.key_backspace],

   ['Tab', PHYSICAL_KEYS.key_tab],
   ['KeyQ', PHYSICAL_KEYS.key_q],
   ['KeyW', PHYSICAL_KEYS.key_w],
   ['KeyE', PHYSICAL_KEYS.key_e],
   ['KeyR', PHYSICAL_KEYS.key_r],
   ['KeyT', PHYSICAL_KEYS.key_t],
   ['KeyY', PHYSICAL_KEYS.key_y],
   ['KeyU', PHYSICAL_KEYS.key_u],
   ['KeyI', PHYSICAL_KEYS.key_i],
   ['KeyO', PHYSICAL_KEYS.key_o],
   ['KeyP', PHYSICAL_KEYS.key_p],
   ['BracketLeft', PHYSICAL_KEYS.key_bracket_left],
   ['BracketRight', PHYSICAL_KEYS.key_bracket_right],
   ['Backslash', PHYSICAL_KEYS.key_backslash],

   ['CapsLock', PHYSICAL_KEYS.key_caps_lock],
   ['KeyA', PHYSICAL_KEYS.key_a],
   ['KeyS', PHYSICAL_KEYS.key_s],
   ['KeyD', PHYSICAL_KEYS.key_d],
   ['KeyF', PHYSICAL_KEYS.key_f],
   ['KeyG', PHYSICAL_KEYS.key_g],
   ['KeyH', PHYSICAL_KEYS.key_h],
   ['KeyJ', PHYSICAL_KEYS.key_j],
   ['KeyK', PHYSICAL_KEYS.key_k],
   ['KeyL', PHYSICAL_KEYS.key_l],
   ['Semicolon', PHYSICAL_KEYS.key_semicolon],
   ['Quote', PHYSICAL_KEYS.key_quote],
   ['Enter', PHYSICAL_KEYS.key_enter],

   ['ShiftLeft', PHYSICAL_KEYS.key_shift_left],
   ['KeyZ', PHYSICAL_KEYS.key_z],
   ['KeyX', PHYSICAL_KEYS.key_x],
   ['KeyC', PHYSICAL_KEYS.key_c],
   ['KeyV', PHYSICAL_KEYS.key_v],
   ['KeyB', PHYSICAL_KEYS.key_b],
   ['KeyN', PHYSICAL_KEYS.key_n],
   ['KeyM', PHYSICAL_KEYS.key_m],
   ['Comma', PHYSICAL_KEYS.key_comma],
   ['Period', PHYSICAL_KEYS.key_period],
   ['Slash', PHYSICAL_KEYS.key_slash],
   ['ShiftRight', PHYSICAL_KEYS.key_shift_right],

   ['ControlLeft', PHYSICAL_KEYS.key_control_left],
   ['AltLeft', PHYSICAL_KEYS.key_alt_left],
   ['Space', PHYSICAL_KEYS.key_space],
   ['AltRight', PHYSICAL_KEYS.key_alt_right],
   ['ControlRight', PHYSICAL_KEYS.key_control_right],

   ['Insert', PHYSICAL_KEYS.key_insert],
   ['Home', PHYSICAL_KEYS.key_home],
   ['PageUp', PHYSICAL_KEYS.key_page_up],
   ['Delete', PHYSICAL_KEYS.key_delete],
   ['End', PHYSICAL_KEYS.key_end],
   ['PageDown', PHYSICAL_KEYS.key_page_down],

   ['NumLock', PHYSICAL_KEYS.key_num_lock],
   ['NumpadDivide', PHYSICAL_KEYS.key_numpad_divide],
   ['NumpadMultiply', PHYSICAL_KEYS.key_numpad_multiply],
   ['NumpadSubtract', PHYSICAL_KEYS.key_numpad_subtract],
   ['Numpad7', PHYSICAL_KEYS.key_numpad_7],
   ['Numpad8', PHYSICAL_KEYS.key_numpad_8],
   ['Numpad9', PHYSICAL_KEYS.key_numpad_9],
   ['NumpadAdd', PHYSICAL_KEYS.key_numpad_add],
   ['Numpad4', PHYSICAL_KEYS.key_numpad_4],
   ['Numpad5', PHYSICAL_KEYS.key_numpad_5],
   ['Numpad6', PHYSICAL_KEYS.key_numpad_6],
   ['Numpad1', PHYSICAL_KEYS.key_numpad_1],
   ['Numpad2', PHYSICAL_KEYS.key_numpad_2],
   ['Numpad3', PHYSICAL_KEYS.key_numpad_3],
   ['NumpadEnter', PHYSICAL_KEYS.key_numpad_enter],
   ['Numpad0', PHYSICAL_KEYS.key_numpad_0],
   ['NumpadDecimal', PHYSICAL_KEYS.key_numpad_decimal],

   ['ArrowUp', PHYSICAL_KEYS.key_arrow_up],
   ['ArrowLeft', PHYSICAL_KEYS.key_arrow_left],
   ['ArrowDown', PHYSICAL_KEYS.key_arrow_down],
   ['ArrowRight', PHYSICAL_KEYS.key_arrow_right],
]);


export class KeyboardInputHandler {
   #adapter: InputAdapter;

   #bound_key_down = this.#handle_key_down.bind(this);
   #bound_key_up = this.#handle_key_up.bind(this);

   constructor(adapter: InputAdapter) {
      this.#adapter = adapter;
   }

   initialize(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      document.addEventListener('keydown', this.#bound_key_down);
      document.addEventListener('keyup', this.#bound_key_up);

      logger.trace(`initialized the keyboard input handler`);
   }

   cleanup(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      document.removeEventListener('keydown', this.#bound_key_down);
      document.removeEventListener('keyup', this.#bound_key_up);

      logger.trace(`removed the keyboard input handler`);
   }

   #handle_key_down(
      event: KeyboardEvent
   ): void {
      // TODO: make this keybindable
      if (
         event.code === 'Escape'
         && this.#adapter.is_pointer_locked
      ) {
         this.#adapter.unlock_pointer();
      }

      if (event.repeat) {
         return;
      }

      const physical_key = BROWSER_KEY_MAP.get(event.code);

      if (
         physical_key
         && !this.#adapter.key_states.get(physical_key)
      ) {
         this.#adapter.key_states.set(physical_key, true);

         this.#adapter.queue_event(
            {
               physical_input: physical_key,
               pressed: true,
               value: 1.0,
            },
            DEVICE_ID_KEYBOARD
         );
      }
   }

   #handle_key_up(
      event: KeyboardEvent
   ): void {
      const physical_key = BROWSER_KEY_MAP.get(event.code);

      if (
         physical_key
         && this.#adapter.key_states.get(physical_key)
      ) {
         this.#adapter.key_states.set(physical_key, false);

         this.#adapter.queue_event(
            {
               physical_input: physical_key,
               pressed: false,
               value: 0.0,
            },
            DEVICE_ID_KEYBOARD
         );
      }
   }
}