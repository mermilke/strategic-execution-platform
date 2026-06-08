// Ambient declarations so `tsc --noEmit` accepts global CSS side-effect imports
// (e.g. `import './globals.css'`). Next handles these at build time; this keeps
// the standalone typecheck happy.
declare module '*.css'
