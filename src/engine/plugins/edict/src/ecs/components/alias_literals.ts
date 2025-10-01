/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/alias_literals.ts
 */

import type { bool, f64, map, str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';

/** provides a map of hardcoded, literal values for an alias's target command's arguments */
@Reflectable()
export class ComponentAliasLiterals extends Component {
   /** a map of target argument names to their literal values */
   values!: t<map<str, str | f64 | bool>>;
}