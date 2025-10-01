/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/index.ts
 */

export type ObjK = string | number | symbol;

export type Isolate<T> = {
   [P in keyof T]: T[P];
};

// https://twitter.com/mattpocockuk/status/1622730173446557697?s=20
export type Prettify<T> = {
   [K in keyof T]: T[K];
} & {};

export type Prettify2<T> = {
   [K in keyof T]: Prettify<T[K]>;
} & {};

export type Partial2<T> = {
   [K in keyof T]?: Partial<T[K]>;
};

export type NeverKey<T> = {
   [K in keyof T]: never;
} & {};

export type Merge<T, U> = {
   [K in keyof T | keyof U]: K extends keyof U ? U[K] : K extends keyof T ? T[K] : never;
};

export type Inverse<T extends Record<ObjK, ObjK>> = {
   [K in keyof T as T[K]]: K;
};

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;

export type IsAny<T> = 0 extends (1 & T) ? true : false;
export type IsUnknown<T> = unknown extends T ? (IsAny<T> extends false ? true : false) : false;

export type BuildTuple<T, L extends number, R extends unknown[] = []> = R['length'] extends L
   ? R
   : BuildTuple<T, L, [T, ...R]>;