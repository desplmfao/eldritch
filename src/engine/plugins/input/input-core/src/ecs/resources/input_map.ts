/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/ecs/resources/input_map.ts
 */

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

import type { Action } from '@self/types/input';
import type { PhysicalKey, Chord } from '@self/types/physical_keys';

import type { ResourceInputTimingConfig } from '@self/ecs/resources/input_timing_config';

export interface MappingTimingOverride extends Partial<ResourceInputTimingConfig> { }

export interface MappingDetails<A = Action> {
   action: A;
   timing_override?: MappingTimingOverride;
}

// TODO: make this reflectable
export class ResourceInputMap extends Resource {
   single_action_map: Map<PhysicalKey, Action> = new Map();
   chord_action_map: Map<string, Action> = new Map();
   axis_action_map: Map<PhysicalKey, Action> = new Map();
   axis_pair_map: Map<Action, { x?: PhysicalKey, y?: PhysicalKey }> = new Map();
   keys_in_chords: Set<PhysicalKey> = new Set();
   tap_action_map: Map<PhysicalKey, MappingDetails> = new Map();
   hold_action_map: Map<PhysicalKey, MappingDetails> = new Map();
   double_tap_action_map: Map<PhysicalKey, MappingDetails> = new Map();

   /** maps a standard button press/release to an action */
   map_button(
      action: Action,
      physical_input: PhysicalKey
   ): void {
      this.single_action_map.set(physical_input, action);
   }

   /** maps a combination of simultaneously pressed keys to an action */
   map_chord(
      action: Action,
      chord: Chord
   ): void {
      if (chord.length < 2) {
         if (chord.length === 1) {
            this.map_button(action, chord[0]!);
         }

         return;
      }

      const chord_key = this.get_chord_key(chord);
      this.chord_action_map.set(chord_key, action);

      for (const key of chord) {
         this.keys_in_chords.add(key);
      }
   }

   /** maps a single physical axis input to an action */
   map_axis_single(
      action: Action,
      physical_input: PhysicalKey
   ): void {
      this.axis_action_map.set(physical_input, action);
   }

   /** maps two physical axis inputs (x, y) to a single action, representing a 2d vector */
   map_axis_pair(
      action: Action,
      physical_input_x?: PhysicalKey,
      physical_input_y?: PhysicalKey
   ): void {
      this.axis_pair_map.set(
         action,
         {
            x: physical_input_x,
            y: physical_input_y
         }
      );

      if (physical_input_x) {
         this.axis_action_map.set(physical_input_x, action);
      }

      if (physical_input_y) {
         this.axis_action_map.set(physical_input_y, action);
      }
   }

   /** maps a quick tap (press and release within `max_tap_duration_ms`) to an action */
   map_tap_action(
      action: Action,
      physical_input: PhysicalKey,
      options?: {
         timing_override?: MappingTimingOverride
      }
   ): void {
      this.tap_action_map.set(
         physical_input,
         {
            action,
            timing_override: options?.timing_override
         }
      );
   }

   map_hold_action(
      action: Action,
      physical_input: PhysicalKey,
      options?: {
         timing_override?: MappingTimingOverride
      }
   ): void {
      this.hold_action_map.set(
         physical_input,
         {
            action,
            timing_override: options?.timing_override
         }
      );
   }

   map_double_tap_action(
      action: Action,
      physical_input: PhysicalKey,
      options?: {
         timing_override?: MappingTimingOverride
      }
   ): void {
      this.double_tap_action_map.set(
         physical_input,
         {
            action,
            timing_override: options?.timing_override
         }
      );
   }

   get_button_action(
      physical_input: PhysicalKey
   ): Action | undefined {
      return this.single_action_map.get(physical_input);
   }

   get_chord_action(
      chord: Chord
   ): Action | undefined {
      if (chord.length < 2) {
         return;
      }

      const chord_key = this.get_chord_key(chord);

      return this.chord_action_map.get(chord_key);
   }

   get_axis_action(
      physical_input: PhysicalKey
   ): Action | undefined {
      return this.axis_action_map.get(physical_input);
   }

   get_axis_pair_inputs(
      action: Action
   ): {
      x?: PhysicalKey,
      y?: PhysicalKey
   } | undefined {
      return this.axis_pair_map.get(action);
   }

   get_tap_action_details(
      physical_input: PhysicalKey
   ): MappingDetails | undefined {
      return this.tap_action_map.get(physical_input);
   }

   get_hold_action_details(
      physical_input: PhysicalKey
   ): MappingDetails | undefined {
      return this.hold_action_map.get(physical_input);
   }

   get_double_tap_action_details(
      physical_input: PhysicalKey
   ): MappingDetails | undefined {
      return this.double_tap_action_map.get(physical_input);
   }

   is_key_in_any_chord(
      key: PhysicalKey
   ): boolean {
      return this.keys_in_chords.has(key);
   }

   get_chord_key(
      chord: Chord
   ): string {
      return [...chord].sort().join('+');
   }

   get_all_chord_keys(): IterableIterator<string> {
      return this.chord_action_map.keys();
   }

   get_action_for_chord_key(
      chord_key: string
   ): Action | undefined {
      return this.chord_action_map.get(chord_key);
   }

   clear(): void {
      this.single_action_map.clear();
      this.chord_action_map.clear();
      this.axis_action_map.clear();
      this.axis_pair_map.clear();
      this.keys_in_chords.clear();
      this.tap_action_map.clear();
      this.hold_action_map.clear();
      this.double_tap_action_map.clear();
   }
}