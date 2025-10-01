/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-filter/src/parser.ts
 */

import { LOG_LEVEL_MAP, PLUGIN_NAME } from '@self/constants';
import type { LogFilterRule, LogFilterSettings } from '@self/types';

function parse_single_rule(rule_string: string): LogFilterRule | null {
   const parts = rule_string.split('=');

   if (parts.length !== 2) {
      console.warn(`[${PLUGIN_NAME}] invalid log filter rule format: '${rule_string}'. expected 'pattern=level'`);

      return null;
   }

   const pattern_str = parts[0]?.trim()!;
   const level_str = parts[1]?.trim().toLowerCase()!;

   const numeric_level = LOG_LEVEL_MAP.get(level_str);

   if (numeric_level == null) {
      console.warn(`[${PLUGIN_NAME}] invalid log level '${level_str}' in rule '${rule_string}'. supported levels: ${[...LOG_LEVEL_MAP.keys()].join(', ')}`);

      return null;
   }

   let regex: RegExp;

   if (
      pattern_str.startsWith('/')
      && pattern_str.endsWith('/')
   ) {
      try {
         regex = new RegExp(pattern_str.slice(1, -1));
      } catch (e) {
         console.warn(`[${PLUGIN_NAME}] invalid regex pattern '${pattern_str}' in rule '${rule_string}': ${e.message}. treating as literal`);

         const escaped_pattern = pattern_str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

         regex = new RegExp(`^${escaped_pattern}$`);
      }
   } else {
      const escaped_pattern = pattern_str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      regex = new RegExp(`^${escaped_pattern}$`);
   }

   return {
      pattern: regex,
      level: numeric_level,
      original_pattern: pattern_str,
      original_level_string: level_str,
   };
}

export function parse_log_filter_rules(
   rules_string: string | undefined,
   default_level_string: string
): LogFilterSettings {
   const rules: LogFilterRule[] = [];

   if (
      rules_string
      && rules_string.trim() !== ''
   ) {
      const rule_parts = rules_string.split(',');

      for (const part of rule_parts) {
         const rule = parse_single_rule(part.trim());

         if (rule) {
            rules.push(rule);
         }
      }
   }

   const default_numeric = LOG_LEVEL_MAP.get(default_level_string.toLowerCase());

   if (default_numeric == null) {
      console.error(`[${PLUGIN_NAME}] invalid default log level string: '${default_level_string}'. falling back to 'info'`);

      rules.push({
         pattern: /.*/,
         level: LOG_LEVEL_MAP.get('info')!,
         original_pattern: '/*',
         original_level_string: 'info',
      });

      return {
         rules,
         default_level_numeric: LOG_LEVEL_MAP.get('info')!
      };
   }

   return {
      rules,
      default_level_numeric: default_numeric
   };
}