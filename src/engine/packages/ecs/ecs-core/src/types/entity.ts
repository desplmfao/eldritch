/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/entity.ts
 */

import type { u32, t } from '@eldritch-engine/type-utils/guerrero/markers';
import type { ComponentDefinition } from '@self/types/component';

/** */
export type EntityId = t<u32>;

/** */
export const entity_id_none: EntityId = 0; // null entity id

/** describes a recursive structure for spawning an entity and its children */
export interface EntitySpawnDefinition {
   /** an array of component definitions for this entity */
   components: ComponentDefinition[];
   /** an optional array of child entity definitions, following the same structure */
   children?: EntitySpawnDefinition[];
}