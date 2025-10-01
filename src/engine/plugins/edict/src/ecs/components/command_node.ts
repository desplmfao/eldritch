/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/command_node.ts
 */

import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';

export enum CommandNodeType {
   Literal,
   Argument,
   Alias,
}

@Reflectable()
export class ComponentCommandNode extends Component {
   /** the type of node this command entity represents */
   type: CommandNodeType = CommandNodeType.Literal;
}