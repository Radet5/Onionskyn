/* What `import … from '@core'` gives editor code: the Core already loaded by the fcCore script.
   build.mjs aliases '@core' to this file; Core's own source is never bundled here (see docs/adr/0001).
   CommonJS so that named imports map to properties of window.FCCore without listing every key here. */
module.exports = window.FCCore;
