/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/event_handler.ts
 */

import type { MaybePromise } from '@eldritch-engine/type-utils';

import type { Event, EventArgs } from '@self/types/event';

export abstract class WorldEventHandler<E extends Event> {
   /** */
   run_criteria?(args: EventArgs[E], ...injections: unknown[]): MaybePromise<boolean>;
   /** */
   initialize?(...injections: unknown[]): MaybePromise<boolean | void>;
   /** */
   cleanup?(...injections: unknown[]): MaybePromise<void>;

   abstract update(args: EventArgs[E], ...injections: unknown[]): MaybePromise<void>;
}

/** */
export type WorldEventHandlerConstructor<P extends WorldEventHandler<any> = WorldEventHandler<any>> =
   new (...args: any[]) => P;