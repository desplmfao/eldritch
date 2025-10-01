/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/logger/src/transports/console.ts
 */

import type { ObjK } from '@eldritch-engine/type-utils';
import type { ILogTransport, LogPayload, ColorEntry, ValidLogsConsoleNamespace } from '@eldritch-engine/type-utils/logger/index';

type ConsoleAPI = Pick<typeof console, 'log' | 'info' | 'warn' | 'error' | 'debug' | 'time' | 'timeEnd'>;

export class ConsoleTransport implements ILogTransport {
   #console: ConsoleAPI;

   constructor(console_api: ConsoleAPI = console) {
      this.#console = console_api;
   }

   handle<T_COLOR_LIST extends Record<ObjK, ColorEntry>>(
      payload: LogPayload<T_COLOR_LIST>
   ): void {
      const { formatted_messages, options, raw_messages, profile_data } = payload;
      const log_method = options.log_method ?? 'error';

      if (
         log_method === 'profile'
         && profile_data
      ) {
         if (profile_data.type === 'begin') {
            this.#console.time(profile_data.label);
         } else if (profile_data.type === 'end') {
            this.#console.timeEnd(profile_data.label);
         }
         return;
      }

      let console_method = (options.console_log_force ?? log_method) as ValidLogsConsoleNamespace;

      if (
         log_method === 'critical'
         || (
            log_method === 'assert'
            && raw_messages.length > 0
            && raw_messages[0] !== true
         )
      ) {
         console_method = 'error';
      } else if (!(['debug', 'info', 'warn', 'error'].indexOf(console_method) > -1)) {
         console_method = 'info';
      }

      if (typeof this.#console[console_method] === 'function') {
         this.#console[console_method](...formatted_messages);
      } else {
         this.#console.log(`(log method '${console_method}' invalid)`, ...formatted_messages);
      }
   }
}