/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/parsers.ts
 */

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import type { ArgumentParser, ArgumentParserFunction, SuggestionProviderFunction } from '@self/ecs/resources/argument_parser_registry';

import { ComponentStringLength } from '@self/ecs/components/validation/string_length';
import { ComponentStringRegex } from '@self/ecs/components/validation/string_regex';
import { ComponentNumberRange } from '@self/ecs/components/validation/number_range';

export function validate_string(
   world: IWorld,
   //
   value: string,
   //
   argument_entity_id?: EntityId
): {
   success: true
} | {
   success: false,
   error: string
} {
   if (argument_entity_id == null) {
      return {
         success: true
      };
   }

   const length_validator = world.component_get(argument_entity_id, ComponentStringLength);

   if (length_validator) {
      if (
         length_validator.min != null
         && value.length < length_validator.min
      ) {
         return {
            success: false,
            error: `input must be at least ${length_validator.min} characters long`
         };
      }

      if (
         length_validator.max != null
         && value.length > length_validator.max
      ) {
         return {
            success: false,
            error: `input must be no more than ${length_validator.max} characters long`
         };
      }
   }

   const regex_validator = world.component_get(argument_entity_id, ComponentStringRegex);

   if (regex_validator) {
      const regex = new RegExp(regex_validator.pattern);

      if (!regex.test(value)) {
         return {
            success: false,
            error: regex_validator.error_message!
         };
      }
   }

   return {
      success: true
   };
}

/**
 * a built-in argument parser that consumes a single word as a string
 * 
 * this does not handle spaces or quotes. for that, use `parse_string_quotable`
 */
export const parse_string: ArgumentParser = {
   parse: (
      world,
      //
      input_words,
      //
      argument_entity_id
   ) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected a string, but found nothing'
         };
      }

      const value = input_words[0]!;

      const validation_result = validate_string(
         world,
         //
         value,
         //
         argument_entity_id
      );

      if (!validation_result.success) {
         return validation_result;
      }

      return {
         success: true,
         value: value,
         consumed_words: 1
      };
   },
};

/**
 * a built-in argument parser that consumes a single string argument
 * 
 * if the argument starts with a double quote (`"`), it will consume all subsequent words until a word ending with a double quote is found, joining them into a single string
 * 
 * otherwise, it behaves like `parse_string` and consumes a single word
 * 
 * this does NOT support quote escaping
 */
export const parse_string_quotable: ArgumentParser = {
   parse: (
      world,
      //
      input_words,
      //
      argument_entity_id
   ) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected a string, but found nothing'
         };
      }

      const first_word = input_words[0]!;

      if (!first_word.startsWith('"')) {
         const validation_result = validate_string(
            world,
            //
            first_word,
            //
            argument_entity_id
         );

         if (!validation_result.success) {
            return validation_result;
         }

         return {
            success: true,
            value: first_word,
            consumed_words: 1
         };
      }

      const content: string[] = [];
      let consumed_words = 0;
      let found_end_quote = false;

      for (let i = 0; i < input_words.length; i++) {
         const current_word = input_words[i]!;

         consumed_words++;

         if (i === 0) {
            const without_quote = current_word.substring(1);

            if (without_quote.endsWith('"')) {
               content.push(without_quote.slice(0, -1));

               found_end_quote = true;

               break;
            }

            content.push(without_quote);
         } else {
            if (current_word.endsWith('"')) {
               content.push(current_word.slice(0, -1));

               found_end_quote = true;

               break;
            }

            content.push(current_word);
         }
      }

      if (!found_end_quote) {
         return {
            success: false,
            error: 'unterminated quote: expected a closing " at the end of the string'
         };
      }

      const final_string = content.join(' ');
      const validation_result = validate_string(world, final_string, argument_entity_id);

      if (!validation_result.success) {
         return validation_result;
      }

      return {
         success: true,
         value: final_string,
         consumed_words: consumed_words
      };
   },
};

/**
 * a built-in argument parser that consumes the next word as an integer
 */
export const parse_integer: ArgumentParser = {
   parse: (
      world,
      //
      input_words,
      //
      argument_entity_id
   ) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected an integer, but found nothing'
         };
      }

      const word = input_words[0]!;
      const num = parseInt(word, 10);

      if (
         Number.isNaN(num)
         || !Number.isInteger(num)
      ) {
         return {
            success: false,
            error: `invalid integer format: '${word}'`
         };
      }

      if (argument_entity_id != null) {
         const range_validator = world.component_get(argument_entity_id, ComponentNumberRange);

         if (range_validator) {
            if (
               range_validator.min != null
               && num < range_validator.min
            ) {
               return {
                  success: false,
                  error: `value ${num} is less than the minimum of ${range_validator.min}`
               };
            }

            if (
               range_validator.max != null
               && num > range_validator.max
            ) {
               return {
                  success: false,
                  error: `value ${num} is greater than the maximum of ${range_validator.max}`
               };
            }
         }
      }

      return {
         success: true,
         value: num,
         consumed_words: 1
      };
   }
};

/**
 * a built-in argument parser that consumes the next word as a floating-point number
 */
export const parse_float: ArgumentParser = {
   parse: (
      world,
      //
      input_words,
      //
      argument_entity_id
   ) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected a number, but found nothing'
         };
      }

      const word = input_words[0]!;
      const num = parseFloat(word);

      if (Number.isNaN(num)) {
         return {
            success: false,
            error: `invalid number format: "${word}"`
         };
      }

      if (argument_entity_id != null) {
         const range_validator = world.component_get(argument_entity_id, ComponentNumberRange);

         if (range_validator) {
            if (
               range_validator.min != null
               && num < range_validator.min
            ) {
               return {
                  success: false,
                  error: `value ${num} is less than the minimum of ${range_validator.min}`
               };
            }

            if (
               range_validator.max != null
               && num > range_validator.max
            ) {
               return {
                  success: false,
                  error: `value ${num} is greater than the maximum of ${range_validator.max}`
               };
            }
         }
      }

      return {
         success: true,
         value: num,
         consumed_words: 1
      };
   }
};

/**
 * a built-in argument parser that greedily consumes all remaining words into an array of strings
 *
 * this should only be used as the last argument in a command path
 */
export const parse_greedy_string_array: ArgumentParser = {
   parse: (_, input_words) => {
      return {
         success: true,
         value: [...input_words],
         consumed_words: input_words.length,
      };
   },
};

/**
 * a built-in argument parser for boolean values
 */
export const boolean_parser: ArgumentParser = {
   parse: (_, input_words) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected a bool, but found nothing'
         };
      }

      const word = input_words[0]!.toLowerCase();

      if (
         word === 'true'
         || word === '1'
      ) {
         return {
            success: true,
            value: true,
            consumed_words: 1
         };
      }

      if (
         word === 'false'
         || word === '0'
      ) {
         return {
            success: true,
            value: false,
            consumed_words: 1
         };
      }

      return {
         success: false,
         error: `invalid bool: '${input_words[0]}', expected true, or false`
      };
   },
   get_suggestions: (world, partial_input) => {
      const options = ['true', 'false'];

      return options
         .filter(opt => opt.startsWith(partial_input.toLowerCase()))
         .map(text => ({ text }));
   },
};

/**
 * creates an argument parser for a typescript enum. works with both string and numeric enums
 *
 * @param enum_obj the enum object itself
 */
export function create_enum_parser(
   enum_obj: object
): ArgumentParser {
   const valid_values = Object.values(enum_obj)
      .filter(
         (value): value is string => typeof value === 'string'
      );

   const parse_fn: ArgumentParserFunction = (_, input_words) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected an enum value, but found nothing'
         };
      }

      const word = input_words[0]!;
      const lower_word = word.toLowerCase();
      const matched_value = valid_values.find(v => v.toLowerCase() === lower_word);

      if (matched_value) {
         return {
            success: true,
            value: matched_value,
            consumed_words: 1
         };
      } else {
         return {
            success: false,
            error: `invalid value '${word}'. expected one of: [ ${valid_values.join(', ')} ]`
         };
      }
   };

   const suggestions_fn: SuggestionProviderFunction = (_, partial_input) => {
      const lower_partial = partial_input.toLowerCase();

      return valid_values
         .filter(
            v => v
               .toLowerCase()
               .startsWith(lower_partial)
         ).map(text => ({ text }));
   }

   return {
      parse: parse_fn,
      get_suggestions: suggestions_fn,
   };
}

/**
 * creates an argument parser that dynamically gets its valid values and suggestions from the world state at parse-time
 *
 * this is useful for arguments that depend on game state, such as player names, or dynamically reading object keys and using them as arguments
 *
 * @param options configuration for the dynamic parser
 * @param options.getter a function that takes the world and returns the current list of valid string options
 * @param options.error_message_on_not_found a function to generate a custom error message if the input is not found
 */
export function create_dynamic_enum_parser(
   options: {
      getter: (world: IWorld) => string[];
      error_message_on_not_found: (invalid_value: string, valid_options: string[]) => string;
   }
): ArgumentParser {
   const { getter, error_message_on_not_found } = options;

   const parse_fn: ArgumentParserFunction = (
      world,
      //
      input_words
   ) => {
      if (input_words.length === 0) {
         return {
            success: false,
            error: 'expected a value, but found nothing'
         };
      }

      const valid_options = getter(world);
      const lowercased_options = valid_options.map(v => v.toLowerCase());
      const word = input_words[0]!;
      const lower_word = word.toLowerCase();

      const matched_index = lowercased_options.indexOf(lower_word);

      if (matched_index > -1) {
         return {
            success: true,
            value: valid_options[matched_index],
            consumed_words: 1
         };
      } else {
         return {
            success: false,
            error: error_message_on_not_found(word, valid_options)
         };
      }
   };

   const suggestions_fn: SuggestionProviderFunction = (world, partial_input) => {
      const valid_options = getter(world);
      const lower_partial = partial_input.toLowerCase();

      return valid_options
         .filter(v => v.toLowerCase().startsWith(lower_partial))
         .map(text => ({ text }));
   };

   return {
      parse: parse_fn,
      get_suggestions: suggestions_fn,
   };
}