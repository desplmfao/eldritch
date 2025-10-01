find . -name "node_modules" -type d -exec rm -rf {} +
find . -name "*dist*" -type d -exec rm -rf {} +
find . -name "__generated__" -type d -exec rm -rf {} +
find . -name "*.tsbuildinfo" -type f -delete