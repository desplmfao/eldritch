/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/validation/number_range.ts
 */

import type { f64, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';

/**
 * a validation component that constrains a numeric argument to a specific range
 * 
 * attach this to an argument node that uses a numeric parser
 */
@Reflectable()
export class ComponentNumberRange extends Component {
   /** the minimum allowed value */
   min?: t<f64>;

   /** the maximum allowed value */
   max?: t<f64>;
}