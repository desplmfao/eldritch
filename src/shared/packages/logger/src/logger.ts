/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/logger/src/logger.ts
 */

import type { ObjK } from '@eldritch-engine/type-utils';
import { escape_regex_string } from '@eldritch-engine/utils/std/regex';

import { AssembleAnsi } from '@self/ansi';

import type {
   ColorEntry,
   LogOptions,
   LogType,
   LoggerOptions,
   NamespacedLogger,
   ILogTransport,
   LogPayload,
   AnsiColorStyleName,
} from '@eldritch-engine/type-utils/logger/index';

import { InlineColorParser } from '@self/inline_color_parser';
import { ConsoleTransport } from '@self/transports/console';
import { ConsoleInterceptor } from '@self/interceptor';

/**
 * a class for logging messages with customizable colors and methods
 *
 * @template T_COLOR_LIST - a type representing a record of custom color entries
 */
export class Logger<T_COLOR_LIST extends Record<ObjK, ColorEntry> = Record<ObjK, ColorEntry>> {
   options: LoggerOptions;
   inline_parser: InlineColorParser;
   ansi_enabled: boolean;

   #enabled_patterns?: RegExp[];
   #namespace_cache = new Map<string, boolean>();
   #namespaced_logger_cache = new Map<string, NamespacedLogger>();
   #transports: ILogTransport[];
   #active_profiles = new Map<string, number>();
   #interceptor: ConsoleInterceptor | null = null;

   constructor(
      options: LoggerOptions
   ) {
      this.options = options;

      const force_color_env = process.env['FORCE_COLOR'];

      if (
         force_color_env === '1'
         || force_color_env === 'true'
      ) {
         this.ansi_enabled = true;
      } else if (
         force_color_env === '0'
         || force_color_env === 'false'
      ) {
         this.ansi_enabled = false;
      } else {
         const force_ansi = options.force_ansi ?? 'auto';

         if (force_ansi === true) {
            this.ansi_enabled = true;
         } else if (force_ansi === false) {
            this.ansi_enabled = false;
         } else {
            // 'auto' detection
            if (
               typeof navigator !== 'undefined'
               && navigator.userAgent
               && navigator.userAgent.includes('Firefox')
            ) {
               this.ansi_enabled = false;

               console.warn('!!! ansi colors disabled in firefox due to very poor support. to override, set force_ansi to true in logger options !!!');
            } else {
               this.ansi_enabled = true;
            }
         }
      }

      if (options.intercept_console) {
         const original_console = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console),
            time: console.time.bind(console),
            timeEnd: console.timeEnd.bind(console),
         };

         this.#transports = options.transports ?? [new ConsoleTransport(original_console)];
         this.#interceptor = new ConsoleInterceptor(this);
         this.#interceptor.enable();
      } else {
         this.#transports = options.transports ?? [new ConsoleTransport()];
      }

      this.inline_parser = new InlineColorParser(new AssembleAnsi(options?.list), this.ansi_enabled);
      this.set_enabled_namespaces(options?.enabled_namespaces);
   }

   get enabled_patterns() {
      return this.#enabled_patterns ? [...this.#enabled_patterns] : undefined;
   }

   #pattern_to_regex(pattern: string): RegExp {
      const regex_match = pattern.match(/^\/(.+)\/([gimyus]*)$/);

      if (regex_match) {
         try {
            const regex = new RegExp(regex_match[1]!, regex_match[2]);

            // this.trace(`interpreted '${pattern}' as regex: ${regex}`);

            return regex;
         } catch (e) {
            // this.warn(`invalid regex pattern provided: '${pattern}', treating as literal string. error:`, e);
         }
      }

      let processed_pattern = escape_regex_string(pattern);
      processed_pattern = processed_pattern.replace(/(?<!\\)\*/g, '.*');
      const final_regex_pattern = '^' + processed_pattern;

      // this.trace(`interpreted '${pattern}' as wildcard/literal, regex: ${final_regex_pattern}`);

      return new RegExp(final_regex_pattern);
   }

   #clear_caches(): void {
      this.#namespace_cache.clear();
      this.#namespaced_logger_cache.clear();

      // this.trace('namespace and logger caches cleared.');
   }

   enable_namespace(pattern: string): void {
      if (this.#enabled_patterns == null) {
         // this.trace(`cannot enable specific pattern '${pattern}' when all namespaces are already enabled`);

         return;
      }

      const new_regex = this.#pattern_to_regex(pattern);
      const pattern_exists = this.#enabled_patterns.some(
         (p) => p.source === new_regex.source && p.flags === new_regex.flags
      );

      if (!pattern_exists) {
         this.#enabled_patterns.push(new_regex);
         this.#clear_caches();

         // this.trace(`pattern enabled: ${new_regex}. caches cleared.`);
      } else {
         // this.trace(`pattern ${new_regex} already enabled`);
      }
   }


   disable_namespace(pattern: string): void {
      if (this.#enabled_patterns == null) {
         // this.warn(`cannot disable specific pattern '${pattern}'. set specific enabled namespaces/patterns first using set_enabled_namespaces()`);

         return;
      }

      const regex_to_remove = this.#pattern_to_regex(pattern);
      const initial_length = this.#enabled_patterns.length;

      this.#enabled_patterns = this.#enabled_patterns.filter(
         (p) => !(
            p.source === regex_to_remove.source
            && p.flags === regex_to_remove.flags
         )
      );

      if (this.#enabled_patterns.length < initial_length) {
         this.#clear_caches();

         // this.trace(`pattern disabled: ${regex_to_remove}. caches cleared.`);
      } else {
         // this.trace(`pattern not found for disabling: ${regex_to_remove}`);
      }
   }

   set_enabled_namespaces(patterns?: string[]): void {
      this.#clear_caches();

      if (patterns == null) {
         this.#enabled_patterns = undefined;

         // this.trace(`all namespaces enabled. caches cleared.`);
      } else {
         this.#enabled_patterns = patterns.map(p => this.#pattern_to_regex(p));

         // this.trace(`enabled patterns set to: [${this.#enabled_patterns.map(p => p.toString()).join(', ')}]. caches cleared.`);
      }
   }

   /// #if DEBUG
   test_self() {
      this.trace(
         'test::color_test',
         `\
color test
1, 2, 4, 7 should be a yellow color, and 3, 5, 6, should be an orange color

1: %internal_test1%hello%r%
2: %internal_test2%hello%r%
3: %internal_test3%hello%r%
4: %internal_test4%hello%r%
5: %internal_test5%hello%r%
6: %internal_test6%hello%r%
7: %internal_test7%hello%r%\
`);

      this.set_enabled_namespaces(['test::foo', 'test::bar*', '/^test::baz::.*/', 'test::color_test']);
      this.trace('test::foo', 'this should log (exact)');
      this.trace('test::foo', 'this should log (exact - cached)');
      this.trace('test::bar123', 'this should log (wildcard)');
      this.trace('test::bar123', 'this should log (wildcard - cached)');
      this.trace('test::bar', 'this should log (wildcard)');
      this.trace('test::bazz', 'this should NOT log (wildcard mismatch)');
      this.trace('test::bazz', 'this should NOT log (wildcard mismatch - cached)');
      this.trace('test::baz::system', 'this should log (regex)');
      this.trace('test::baz::system', 'this should log (regex - cached)');
      this.trace('test::baz::component', 'this should log (regex)');
      this.trace('test::baz', 'this should NOT log (regex mismatch)');
      this.trace('other::module', 'this should NOT log');

      this.enable_namespace('other::*');
      this.trace('other::module', 'this should log now');
      this.trace('other::module', 'this should log now (cached)');
      this.trace('test::foo', 'this should log (exact - re-cached)');

      this.disable_namespace('test::bar*');
      this.trace('test::bar456', 'this should NOT log now');
      this.trace('test::foo', 'this should log (exact - re-cached)');

      this.set_enabled_namespaces(undefined);
      this.trace('test::bar789', 'this should log (all enabled)');
      this.trace('final::test', 'this should log (all enabled)');
   }
   /// #endif

   _dispatch<T extends T_COLOR_LIST>(payload: LogPayload<T>): void {
      for (const transport of this.#transports) {
         try {
            transport.handle(payload);
         } catch (e) {
            console.error(`error in transport '${transport.constructor.name}':`, e);
         }
      }
   }

   _log(
      messages: unknown[],
      options: LogOptions<T_COLOR_LIST>
   ) {
      const namespace = options.namespace;

      const log_level_map: Map<LogType, number> = new Map([
         ['trace', 1],
         ['debug', 2],
         ['info', 3],
         ['success', 3],
         ['warn', 4],
         ['error', 5],
         ['critical', 5],
         ['assert', 5]
      ]);

      const method_level = log_level_map.get(options.log_method ?? 'error') ?? 3;

      if (method_level < this.options.log_level) {
         return;
      }

      let is_enabled = true;

      if (this.#enabled_patterns != null) {
         if (namespace) {
            const cached_status = this.#namespace_cache.get(namespace);

            if (cached_status != null) {
               is_enabled = cached_status;
            } else {
               is_enabled = false;

               for (const pattern of this.#enabled_patterns) {
                  if (pattern.test(namespace)) {
                     is_enabled = true;

                     break;
                  }
               }

               this.#namespace_cache.set(namespace, is_enabled);
            }
         }
      }

      if (!is_enabled) {
         return;
      }

      options.use_prefix = options.use_prefix ?? true;

      const log_method = options.log_method ?? 'error';
      const date_string = (options.have_time ?? true) ? `${new Date().toISOString()} -> ` : '';

      const default_prefix_color_map: Map<
         LogType,
         AnsiColorStyleName | keyof T_COLOR_LIST | [number, number]
      > = new Map([
         ['trace', 'bg_magenta'],
         ['debug', 'bg_magenta'],
         ['info', 'bg_white'],
         ['success', 'bg_green'],
         ['warn', 'bg_yellow'],
         ['error', 'bg_red'],
         ['critical', 'bg_red'],
         ['assert', 'bg_yellow']
      ]);

      const prefix_token: string = (default_prefix_color_map.get(log_method) as string) ?? 'bg_black_bright';
      const level_text = log_method.toUpperCase();
      const namespace_text = namespace ? `[${namespace}]` : '';
      const prefix_text = `[${level_text}]`;
      const prefix = this.inline_parser.apply_style(prefix_text, prefix_token);

      const formatted_messages: any[] = [];
      const prefix_parts: string[] = [];

      if (options.use_prefix) {
         prefix_parts.push(prefix);
      }

      if (options.have_time ?? true) {
         prefix_parts.push(date_string);
      }

      if (namespace_text) {
         prefix_parts.push(namespace_text);
      }

      const full_prefix = prefix_parts.join(' ');

      if (messages.length > 0) {
         const first_msg = messages[0];

         if (typeof first_msg === 'string') {
            formatted_messages.push(`${full_prefix} ${this.inline_parser.parse(first_msg)}`);

            for (let i = 1; i < messages.length; i++) {
               const msg = messages[i];

               formatted_messages.push(typeof msg === 'string' ? this.inline_parser.parse(msg) : msg);
            }
         } else {
            formatted_messages.push(full_prefix);

            for (const msg of messages) {
               formatted_messages.push(typeof msg === 'string' ? this.inline_parser.parse(msg) : msg);
            }
         }
      } else if (full_prefix) {
         formatted_messages.push(full_prefix);
      }

      this._dispatch({
         raw_messages: messages,
         options: options,
         formatted_messages,
      });
   }

   #is_namespace_arg(arg: unknown): arg is string {
      return typeof arg === 'string'
         && arg.length > 0;
   }

   trace(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'trace',
            namespace: namespace
         }
      );
   }

   debug(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'debug',
            namespace: namespace
         }
      );
   }

   info(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'info',
            namespace: namespace
         }
      );
   }

   success(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'success',
            namespace: namespace
         }
      );
   }

   warn(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'warn',
            namespace: namespace
         }
      );
   }

   error(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'error',
            namespace: namespace
         }
      );
   }

   critical(
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      let namespace: string = '';
      let actual_messages: unknown[];

      if (this.#is_namespace_arg(namespace_or_msg)) {
         namespace = namespace_or_msg;
         actual_messages = messages;
      } else {
         actual_messages = [namespace_or_msg, ...messages];
      }

      this._log(
         actual_messages,
         {
            log_method: 'critical',
            namespace: namespace
         }
      );
   }

   assert(
      condition: boolean,
      namespace_or_msg: unknown,
      ...messages: unknown[]
   ): void {
      if (!condition) {
         let namespace: string = '';
         let actual_messages: unknown[];

         if (this.#is_namespace_arg(namespace_or_msg)) {
            namespace = namespace_or_msg;
            actual_messages = messages.length > 0 ? messages : ['assertion failed'];
         } else {
            actual_messages = messages.length > 0 ? [namespace_or_msg, ...messages] : ['assertion failed'];
         }

         this._log(
            actual_messages,
            {
               log_method: 'assert',
               namespace: namespace
            }
         );
      }
   }

   /// #if DEBUG
   /**
    * **THIS IS ONLY AVAILABLE COMPILED WITH DEBUG**
    *
    * @param label
    * @param namespace
    */
   profile_begin(
      label: string,
      namespace?: string
   ): void {
      const full_label = namespace ? `${namespace}::${label}` : label;

      if (this.#active_profiles.has(full_label)) {
         this.warn(`profile timer started for '${full_label}', but a timer with that label is already active`);

         return;
      }

      this.#active_profiles.set(full_label, performance.now());

      this._dispatch({
         raw_messages: [],
         options: {
            log_method: 'profile',
            namespace
         },
         formatted_messages: [],
         profile_data: {
            label: full_label,
            type: 'begin'
         },
      });
   }

   /**
    * **THIS IS ONLY AVAILABLE COMPILED WITH DEBUG**
    *
    * @param label 
    * @param namespace 
    */
   profile_end(
      label: string,
      namespace?: string
   ): void {
      const full_label = namespace ? `${namespace}::${label}` : label;
      const start_time = this.#active_profiles.get(full_label);

      if (start_time == null) {
         this.warn(`profile timer ended for '${full_label}', but no timer was started with that label`);

         return;
      }

      const duration = performance.now() - start_time;
      this.#active_profiles.delete(full_label);

      this._dispatch({
         raw_messages: [],
         options: {
            log_method: 'profile',
            namespace
         },
         formatted_messages: [],
         profile_data: {
            label: full_label,
            type: 'end',
            duration_ms: duration
         },
      });
   }
   /// #endif

   /**
    * use '\<namespace>' if you want it to be auto filled with the ifdef plugin
    */
   get_namespaced_logger(namespace: string): NamespacedLogger {
      const cached_logger = this.#namespaced_logger_cache.get(namespace);

      if (cached_logger) {
         return cached_logger;
      }

      const new_logger: NamespacedLogger = {
         trace: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'trace',
                  namespace
               }
            )
         },

         debug: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'debug',
                  namespace
               }
            )
         },

         info: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'info',
                  namespace
               }
            )
         },

         success: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'success',
                  namespace
               }
            )
         },

         warn: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'warn',
                  namespace
               }
            )
         },

         error: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'error',
                  namespace
               }
            )
         },

         critical: (
            ...messages: unknown[]
         ) => {
            this._log(
               messages,
               {
                  log_method: 'critical',
                  namespace
               }
            )
         },

         assert: (
            condition: boolean,
            ...messages: unknown[]
         ) => {
            if (!condition) {
               this._log(
                  messages.length > 0 ? messages : ['assertion failed'],
                  {
                     log_method: 'assert',
                     namespace
                  }
               );
            }
         },

         /// #if DEBUG
         profile_begin: (label: string): void => {
            this.profile_begin(label, namespace);
         },

         profile_end: (label: string): void => {
            this.profile_end(label, namespace);
         },
         /// #endif
      };

      this.#namespaced_logger_cache.set(namespace, new_logger);

      return new_logger;
   }
}

export const default_logger = new Logger({
   log_level: 2
});