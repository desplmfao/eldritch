/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/resource.ts
 */

import type { SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

export type ResourceConstructorParameters<R> =
   (R extends new (
      ...args: infer P
   ) => unknown
      ? P
      : never);

export type ResourceConstructor<R extends Resource = Resource> =
   new (...args: ResourceConstructorParameters<R>) => R;

export abstract class Resource {
   // this is assigned in the codegen
   readonly __schema!: SchemaLayout;
}