/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/resources/relationship.ts
 */

import { Resource } from '@self/types/resource';
import type { RelationshipMetadata } from '@self/types/relationship';

// TODO: make this work with guerrero

/** registry to link Relationship types with their targets and metadata */
export class ResourceRelationshipRegistry extends Resource {
   by_relationship_type = new Map<string, RelationshipMetadata>();
   by_target_type = new Map<string, RelationshipMetadata>();
}
