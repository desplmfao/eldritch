/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/entity.ts
 */

import type { EntityId } from '@self/types/entity';

export function* entity_id_iterator(): IterableIterator<EntityId> {
   yield* number_iterator() as IterableIterator<EntityId>;
};

//
//

export function* number_iterator(): IterableIterator<number> {
   let id = 0;

   while (true) {
      yield ++id;
   }
}