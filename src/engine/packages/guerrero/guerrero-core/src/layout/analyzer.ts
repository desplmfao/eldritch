/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/layout/analyzer.ts
 */

import type { PropertyLayout, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { align_offset } from '@self/layout/calculator';

export interface OptimalLayoutSuggestion {
   /** the suggested optimal order of property keys */
   suggested_property_order: string[];
   /** the total size of the struct with the optimal ordering */
   optimal_size: number;
   /** the total padding of the struct with the optimal ordering */
   optimal_padding: number;
}

export interface SchemaAnalysisResult {
   /** the original total size of the struct */
   original_size: number;
   /** the total bytes of padding in the original layout */
   original_padding: number;
   /** the percentage of the original size that is wasted on padding */
   wasted_percentage: number;
   /** the suggested optimal layout */
   optimal_layout: OptimalLayoutSuggestion;
}

/**
 * a build-time utility to analyze a calculated schema layout for memory padding and suggest optimizations
 */
export class SchemaAnalyzer {
   /**
    * analyzes a schema layout to calculate padding and suggest a more optimal property order
    *
    * @param layout the schema layout to analyze
    *
    * @returns a result object with detailed padding info and an optimization suggestion
    */
   static analyze(
      layout: SchemaLayout
   ): SchemaAnalysisResult {
      const original_padding = this.#calculate_padding(layout.properties, layout.alignment);
      const optimal_suggestion = this.#calculate_optimal_layout(layout.properties);

      return {
         original_size: layout.total_size,
         original_padding: original_padding,
         wasted_percentage: layout.total_size > 0 ? original_padding / layout.total_size : 0,
         optimal_layout: optimal_suggestion,
      };
   }

   static #calculate_padding(
      properties: readonly PropertyLayout[],
      struct_alignment: number
   ): number {
      let current_offset = 0;
      let total_padding = 0;

      for (const prop of properties) {
         const aligned_offset = align_offset(current_offset, prop.alignment);
         const padding = aligned_offset - current_offset;

         total_padding += padding;
         current_offset = aligned_offset + prop.size;
      }

      const final_size = align_offset(current_offset, struct_alignment);
      const final_padding = final_size - current_offset;

      total_padding += final_padding;

      return total_padding;
   }

   static #calculate_optimal_layout(
      properties: readonly PropertyLayout[]
   ): OptimalLayoutSuggestion {
      const sorted_properties = [...properties].sort((a, b) => {
         if (a.alignment !== b.alignment) {
            return b.alignment - a.alignment;
         }

         return b.size - a.size;
      });

      const max_alignment = sorted_properties.reduce((max, prop) => Math.max(max, prop.alignment), 1);
      let optimal_offset = 0;

      for (const prop of sorted_properties) {
         optimal_offset = align_offset(optimal_offset, prop.alignment);
         optimal_offset += prop.size;
      }

      const optimal_size = align_offset(optimal_offset, max_alignment);
      const optimal_padding = this.#calculate_padding(sorted_properties, max_alignment);

      return {
         suggested_property_order: sorted_properties.map(p => String(p.property_key)),
         optimal_size: optimal_size,
         optimal_padding: optimal_padding,
      };
   }
}