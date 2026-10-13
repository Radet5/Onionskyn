/* Onionskyn core: pure logic (geometry, tweens, GIF, SVG, FLA import). No DOM access except DOMParser/JSZip at import time. */
/* Bundled as its own script and exposed as window.FCCore, which Runtime and HTML exports rely on (see docs/adr/0001). */
import { root, uid, clamp, lerp, clone, nz } from './util.js';
import { hexToRgb, rgbToHex, lerpHex, rgba } from './color.js';
import { newT, matOf, mmul, minv, mapply, decompose } from './matrix.js';
import { node, tracePath, pathD, bezPt, splitSeg, contoursBounds } from './path.js';
import { setImages, preloadImages } from './image.js';
import { groupEntries, drawUnits, maskedDraw } from './mask.js';
import { setMeasure, layoutText } from './text.js';
import { localBounds, worldCorners, worldBounds, recenter, applyMatrixToNodes, setObjMatrix } from './bounds.js';
import { ellipseContour, rectContour, mkPath, mkLayer, mkKf, mkDoc, normalizeDoc } from './factories.js';
import { ease, bezierEase } from './easing.js';
import { morphContours } from './morph.js';
import { setLib, kidsOf, tweenPairs, shapeTweenIssues, evalLayerObjs, evalDoc, kfIndexAt, kfAt, kfFor, sortKfs } from './timeline-eval.js';
import { ensureEditable, insertKeyframe, insertFrames, removeFrames, clearKeyframe, moveKeyframe, setTweenAt } from './keyframe-edit.js';
import { groupAlpha, drawObj, hitObj } from './render.js';
import { frameSVG, objSVG } from './svg.js';
import { quantize, lzw, gifWriter } from './gif.js';
import { parseNum, parseEdges, assembleLoops, importFLA } from './fla-import.js';

root.FCCore = {
  uid, clamp, lerp, clone, nz, hexToRgb, rgbToHex, lerpHex, rgba,
  newT, matOf, mmul, minv, mapply, decompose, node, tracePath, pathD, bezPt, splitSeg, contoursBounds, localBounds, worldCorners, worldBounds,
  recenter, applyMatrixToNodes, setObjMatrix, ellipseContour, rectContour, mkPath, mkLayer, mkKf, mkDoc, normalizeDoc,
  groupEntries, drawUnits, maskedDraw, groupAlpha, tweenPairs, shapeTweenIssues, ease, bezierEase, morphContours, evalLayerObjs, evalDoc, kfIndexAt, kfAt, kfFor, sortKfs, ensureEditable, insertKeyframe, insertFrames, removeFrames,
  clearKeyframe, moveKeyframe, setTweenAt, drawObj, hitObj, frameSVG, objSVG, quantize, lzw, gifWriter, parseNum, parseEdges, assembleLoops,
  importFLA, setImages, preloadImages, setLib, setMeasure, kidsOf, layoutText
};
