/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/guerrero/index.ts
 */

import type { FileOrigin } from '@self/builder/origin';

import type { map, arr, fixed_arr, set, sparseset } from '@self/guerrero/markers';
import type { IGuerreroSparseSet } from '@self/guerrero/interfaces';
import type { BuildTuple, IsAny, IsUnknown } from '@self/index';

/** base type for representing a pointer/offset within a ArrayBufferLike */
export type Pointer = number;

/** generic interface for ArrayBufferLike-backed views/wrappers */
export interface IView {
   /** */
   readonly __view: DataView;
   /** the underlying buffer of the view */
   readonly __buffer: ArrayBufferLike;
   /** starting offset of this view/object in the buffer */
   readonly __byte_offset: Pointer;

   /** frees all data in the data type instance */
   free?(): void;
   /** copies all data from the source onto itself */
   $copy_from?(source: any): void;
}

export interface IViewConstructor<T extends IView = IView> {
   /** the pre-calculated binary layout schema for this type */
   readonly __schema: SchemaLayout;

   /** the constructor signature */
   new(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      ...other: any[]
   ): T;
}

/** defines the contract for an IView-compatible struct that can be stored in a hash-based set or map */
export interface IHashable extends IView {
   /**  a custom hashing function that returns a 32-bit integer hash code for the object */
   $hash(): number;

   /**
    * a custom equality function to compare this object with another
    * 
    * @param other - the other object to compare against
    */
   $equals(other: this): boolean;
}

/** base metadata common to all definitions */
export interface MetadataClassBase {
   /** the name of the typescript class */
   name: string;
}

/** metadata for an enum definition */
export interface MetadataEnum extends MetadataClassBase {
   /** the type of definition this class represents */
   definition_type: 'enum';

   //

   /** enums cannot extend other types */
   extends?: never;
   /** enums cannot implement interfaces */
   implements?: never;
}

/** metadata for a struct (class-like) definition */
export interface MetadataStruct extends MetadataClassBase {
   /** the type of definition this class represents */
   definition_type: 'struct';

   //

   /** the name of the single struct or interface this struct extends*/
   extends?: string;
   /** an array of names of interfaces this struct implements */
   implements?: string[];
}

/** metadata for an interface definition */
export interface MetadataInterface extends MetadataClassBase {
   /** the type of definition this class represents */
   definition_type: 'interface';

   //

   /** an array of names of interfaces this interface extends */
   extends?: string[];
   /** interfaces do not implement other interfaces; they extend them */
   implements?: never;
}

/** */
export type Metadata = MetadataEnum | MetadataStruct | MetadataInterface;

/** metadata for a single variant within a union type */
export interface UnionVariantMetadata {
   /** the type string of the variant */
   type_string: string;
   /** the integer tag/discriminant for this variant */
   tag: number;
   /** the schema layout for this variant if it is a struct, otherwise undefined for primitives */
   schema?: SchemaLayout;
   /** detailed binary info for this variant */
   binary_info: BinaryTypeInfo;
}

/** defines the binary characteristics (size and alignment) of a reflected type */
export interface BinaryTypeInfo {
   /** size of the type in bytes */
   size: number;
   /** alignment requirement in bytes (must be a power of 2) */
   alignment: number;
   /** for map keys, the type string of the key element */
   key_type?: string;
   /** for arrays and map values, the type string of the element */
   element_type?: string;
   /** for fixed-size arrays, the number of elements */
   element_count?: number;
   /** indicates if this type represents a struct requiring recursive layout calculation */
   is_nested_struct?: boolean;
   /** indicates if this type represents a dynamic-size structure (string, dynamic array, map, set) */
   is_dynamic?: boolean;
   /** indicates if the type contains dynamic data internally */
   has_dynamic_data?: boolean;
   /** indicates if the type was explicitly marked as optional */
   is_optional?: boolean;
   /** indicates if the field itself is a pointer to the actual data */
   is_ptr?: boolean;
   /** if this property represents a typescript enum */
   is_enum?: boolean;
   /** if this property represents a tagged union */
   is_union?: boolean;
   /** if this property represents a tuple */
   is_tuple?: boolean;
   /** if this property is a union, this holds the definitions of its variants */
   variants?: UnionVariantMetadata[];
   /** for bit-packed fields, the starting bit within the container field */
   bit_offset?: number;
   /** for bit-packed fields, the number of bits this property occupies */
   bit_width?: number;
   /** for array-like types, the pre-calculated schema for the element type */
   element_schema?: SchemaLayout;
   /** for tuple-like types, the pre-calculated schemas for each element */
   element_schemas?: SchemaLayout[];
   /** for map-like types, the pre-calculated schema for the key type */
   key_schema?: SchemaLayout;
}

/** */
export interface MetadataProperty {
   /** the name of the property in the typescript class */
   property_key: string | symbol;
   /** order for schema generation */
   order: number;
   /** the specific type string */
   type: string;
   /** optional display name for tools/editors */
   display_name?: string;
   /** optional description for tools/editors */
   description?: string;
   /** whether the property should be included during serialization */
   serializable?: boolean;
   /** hint that the property should not be directly modified by external systems */
   read_only?: boolean;
   /** 1-based start line number in the source file */
   start_line?: number;
   /** 1-based end line number in the source file */
   end_line?: number;
   /** */
   is_optional?: boolean;
   /** for enum properties, specifies the underlying integer type */
   enum_base_type?: 'u8' | 'u16' | 'u32';
   /** for integer properties, specifies the number of bits it should occupy in a bitfield */
   bits?: number;
   /** the default value for this property, to be embedded in the schema */
   default_value?: unknown;
}

/** calculated layout information for a single property within a binary schema */
export interface PropertyLayout extends MetadataProperty {
   /** calculated byte offset from the start of the structure */
   offset: number;
   /** calculated size of this property in bytes (can be size of a pointer for dynamic types) */
   size: number;
   /** calculated alignment requirement for this property */
   alignment: number;
   /** detailed binary type info derived from the reflection type string */
   binary_info: BinaryTypeInfo;

   /** if the property is an enum */
   is_enum?: boolean;
   /** if the property is an enum, this holds the member definitions for debug tooling */
   enum_members?: {
      name: string,
      value: number
   }[];
   /** if the property is a union, this holds the variant definitions for debug tooling */
   variants?: UnionVariantMetadata[];
   /** for bit-packed fields, the starting bit within the container field */
   bit_offset?: number;
   /** for bit-packed fields, the number of bits this property occupies */
   bit_width?: number;
   /** the default value for this property, to be embedded in the schema */
   default_value?: unknown;
}

/** calculated layout information for a reflectable class/component */
export interface SchemaLayout {
   /** a direct reference to the constructor of the view class */
   class_ctor?: IViewConstructor<IView>; // TODO: make this not optional if class_name isnt used, but if class_name is used its optional
   /** the original class name, used only at build-time before the constructor is available */
   class_name?: string;
   /** total size of the structure in bytes, including padding */
   total_size: number;
   /** the alignment requirement for the structure (max alignment of its members) */
   alignment: number;
   /** an ordered array of property layouts where the index corresponds to the property's 'order' */
   properties: PropertyLayout[];
   /** indicates if this layout contains any dynamically sized fields requiring an allocator */
   has_dynamic_data: boolean;
}

/** structure holding metadata extracted by the swc visitor */
export interface MetadataClassExtracted {
   /** */
   class_name: string;
   /** */
   properties: MetadataProperty[];
   /** */
   is_reflectable: boolean;
   /** the type of definition this class represents, defaults to 'struct' */
   definition_type: 'enum' | 'struct' | 'interface';
   /** names of types this class/interface extends */
   extends_type_names?: string[];
   /** names of interfaces this class implements */
   implements_type_names?: string[];
   /** */
   file_path: string;
   /** 1-based start line number of the class in the source file */
   start_line: number;
   /** 1-based end line number of the class in the source file */
   end_line: number;
   /** indicates if the class uses `__schema_props` for its definition */
   has_manual_props?: boolean;
   /** indicates if the class has a user-defined constructor */
   has_constructor?: boolean;
   /** if definition_type is 'enum', this holds the parsed member definitions */
   enum_members?: {
      name: string;
      value: number;
   }[];
   /** the origin category of the file this type was defined in */
   origin?: FileOrigin;
   /** if this is a zombie class, specifies the guerrero type string it is an alias for */
   alias_for?: string;
   /** for zombie classes, specifies the aliasing mode */
   alias_mode?: 'substitute' | 'extend';
}

export type Unbrand<T> =
   (T extends (infer E)[]
      ? Unbrand<E>[]
      : (T extends (infer Base) & { __guerrero: true }
         ? Base
         : T));

/**
 * recursively unwraps guerrero-branded types into their corresponding native javascript types
 *
 * @template T the guerrero type to unwrap
 * @template K an optional keyof T to omit from the final object type
 */
export type guerrero_omit<T, K extends keyof any = never> =
   IsAny<T> extends true ? any
   : IsUnknown<T> extends true ? unknown
   : T extends map<infer K, infer V> ? Map<guerrero_omit<K>, guerrero_omit<V>>
   : T extends arr<infer E> ? guerrero_omit<E>[]
   : T extends fixed_arr<infer E, infer L extends number> ? BuildTuple<guerrero_omit<E>, L>
   : T extends set<infer E> ? Set<guerrero_omit<E>>
   : T extends sparseset ? IGuerreroSparseSet
   : T extends (infer Base) & { __guerrero: true } ? guerrero_omit<Base, K>
   : T extends Map<any, any> | Set<any> ? T
   : (T extends readonly any[] ?
      (number extends T['length'] ?
         guerrero_omit<T[number]>[]
         : { -readonly [P in keyof T]: guerrero_omit<T[P]> }
      )
      : (T extends object ? { [P in keyof Omit<T, K & keyof T>]: guerrero_omit<T[P]> }
         : T))