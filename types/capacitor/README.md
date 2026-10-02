Minimal type declarations for the few Capacitor plugin calls the game makes
(see src/native.ts). tsconfig.json points `@capacitor/*` here so type checks
work whether or not the real packages are installed. At build time Vite
bundles the real packages from node_modules. If you use more of a plugin,
add its signature here.
