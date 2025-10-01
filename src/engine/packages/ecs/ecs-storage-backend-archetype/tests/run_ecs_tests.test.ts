/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/tests/run_ecs_tests.test.ts
 */

import { run_all_tests } from '@eldritch-engine/ecs-tests/index';

import { WorldStorageBackendArchetype } from '@self/index';

await run_all_tests(new WorldStorageBackendArchetype());