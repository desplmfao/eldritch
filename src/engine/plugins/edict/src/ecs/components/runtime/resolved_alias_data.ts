/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/runtime/resolved_alias_data.ts
 */

import type { bool, f64, map, str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';
import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity'

/** @internal component holding pre-calculated alias resolution data */
@Reflectable()
export class ComponentResolvedAliasData extends Component {
   /** */
   target_entity_id: EntityId = entity_id_none;

   /** maps this alias's argument name to the target's argument name */
   argument_map!: t<map<str, str>>;

   /** maps a target argument name to a literal value to inject */
   literal_values!: t<map<str, str | f64 | bool>>;
}