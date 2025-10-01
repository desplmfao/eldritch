/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/reflect/decorators.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';
import { define_metadata, get_own_metadata, has_own_metadata } from '@eldritch-engine/reflect/index';

import type { MetadataProperty } from '@eldritch-engine/type-utils/guerrero/index';

export interface ReflectableOptions {
   definition_type?: 'enum' | 'struct' | 'interface';
   extends?: string | string[];
   implements?: string[];
   alias_for?: string;
   alias_mode?: 'substitute' | 'extend';
}

//
//

export const METADATA_KEY_REFLECTABLE = 'guerrero:inject:reflectable';
export const METADATA_KEY_PROPERTIES = 'guerrero:inject:reflectable_properties';

//
//

export function Reflectable(
   options?: ReflectableOptions
): ClassDecorator {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   return (target: Function) => {
      const definition_type = options?.definition_type ?? 'struct';

      const metadata = {
         name: target.name,
         definition_type: definition_type,
      };

      if (!has_own_metadata(METADATA_KEY_REFLECTABLE, target)) {
         define_metadata(METADATA_KEY_REFLECTABLE, metadata, target);

         logger.trace(`marked '${target.name}' as reflectable (definition: ${definition_type})`);
      } else {
         const existing_metadata = get_own_metadata(METADATA_KEY_REFLECTABLE, target);

         if (existing_metadata) {
            existing_metadata.definition_type = definition_type;

            logger.trace(`updated existing metadata for '${target.name}' (definition: ${definition_type})`);
         } else {
            define_metadata(METADATA_KEY_REFLECTABLE, metadata, target);
         }
      }
   };
}

export function ReflectProperty(
   options?: Partial<Omit<MetadataProperty, 'property_key' | 'order' | 'type' | 'start_line' | 'end_line' | 'is_optional'>>
): PropertyDecorator {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   return (target: Object, property_key: string | symbol) => {
      const properties: Map<string | symbol, Partial<MetadataProperty>> =
         get_own_metadata(METADATA_KEY_PROPERTIES, target.constructor) ?? new Map();

      const partial_metadata: Partial<MetadataProperty> = {
         property_key,
         ...options,
      };

      properties.set(property_key, partial_metadata);

      define_metadata(METADATA_KEY_PROPERTIES, properties, target.constructor);

      logger.trace(`registered partial metadata for '${target.constructor.name}.${String(property_key)}'`);
   }
}