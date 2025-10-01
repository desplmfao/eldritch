#!/usr/bin/env bash

mkdir -p docs-json
rm -f docs-json/*.json

find src/**/**/* -maxdepth 0 -type d | while read package_path; do
   if [ -f "$package_path/package.json" ] && [ -f "$package_path/tsconfig.json" ]; then
      package_name_from_package_json=$(jq -r .name "$package_path/package.json")
    
      safe_package_filename_part=$(echo "$package_name_from_package_json" | tr -s '/' '-' | sed 's/^@//')
      json_output_filename="$safe_package_filename_part.json"
    
      echo "$package_name_from_package_json ($package_path/src) -> docs-json/$json_output_filename"

      entry_point_glob="$package_path/src/**/*.ts" 

      pnpx typedoc \
         --json "docs-json/$json_output_filename" \
         --entryPoints "$entry_point_glob" \
         --tsconfig "$package_path/tsconfig.json" \
         --name "$package_name_from_package_json" \
         --validation.invalidLink false
   else
      echo "skipping $package_path"
   fi
done

echo "merging json documentation outputs..."

pnpx typedoc \
  --entryPointStrategy merge \
  --out docs/typedoc \
  --name "eldritch engine" \
  --includeVersion \
  --tsconfig tsconfig.json \
  --options typedoc.json \
  "docs-json/*.json"

echo "documentation generation complete in docs"