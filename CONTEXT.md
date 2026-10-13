# Onionskyn

A browser-based, Flash-style animation editor that ships as one standalone HTML file. Users draw vector artwork on a timeline of layers and keyframes, then export it as a player, a video-like format, or a project file.

## Language

### Document model

**Document**:
The whole animation being edited: stage size, frame rate, background, the Scene's layers, the Library, and embedded media.
_Avoid_: Project (that's the saved file), doc (in prose)

**Project file**:
A saved Document on disk (`.onionskyn.json`).
_Avoid_: Save, doc file

**Scene**:
The Document's top-level Timeline, the one you're on when you're not inside a Symbol.
_Avoid_: Main timeline, root

**Timeline**:
An ordered stack of Layers over a frame count. The Scene has one, and so does each Symbol.

**Layer**:
One row of a Timeline, holding a sequence of Keyframes.

**Mask layer**:
A Layer whose shapes clip the Masked layers directly below it.

**Masked layer**:
A Layer clipped by the nearest Mask layer above it.

**Frame**:
A single point in time on a Timeline, numbered from 1 in the UI.

**Keyframe**:
A Frame on a Layer where the content is set explicitly. Content stays the same until the next Keyframe unless a Tween connects them.
_Avoid_: kf (in prose)

**Tween**:
Interpolation from one Keyframe to the next. Either a **Motion tween** (transform and colour) or a **Shape tween** (the outline morphs).

**Ease**:
The timing curve applied to a Tween.

### Objects on the stage

**Object**:
One drawable thing in a Keyframe: a Path, Text, Image, Group or Symbol instance.
_Avoid_: Element, item

**Path**:
A vector Object made of one or more contours of bezier nodes, with fill and stroke.
_Avoid_: Shape (except in "Shape tween")

**Group**:
An Object that holds other Objects so they transform together.

**Symbol**:
A reusable Timeline stored in the Library.

**Library**:
The Document's collection of Symbols, keyed by name.

**Symbol instance**:
An Object that places a Symbol on a Timeline. It is either a Movie clip or a Graphic.
_Avoid_: Clip (the code's object kind `'clip'` means any Symbol instance, not just a Movie clip)

**Movie clip**:
A Symbol instance that loops on its own clock, independent of the Timeline it sits on.

**Graphic**:
A Symbol instance whose frames follow the Timeline it sits on (loop, play once, or single frame).

### Editor

**Stage**:
The canvas area of the editor where the current Frame is drawn and edited.

**Onion skin**:
Faded ghosts of neighbouring Frames drawn on the Stage.

**Tool**:
A pointer mode for the Stage (Selection, Node edit, Pen, Brush, Fluid brush and so on).

**Fluid brush**:
A Tool that paints stabilised, tapered, variable-width strokes as filled Paths.
_Avoid_: fb (in prose)

### Output

**Core**:
The shared logic and rendering used by the editor, by the Runtime, and by exports.

**Runtime**:
The player embedded in HTML exports and Preview, with a CreateJS-style MovieClip API for scripts.
_Avoid_: Player (in code names)

**Export**:
Turning the Document into an output format (HTML5 player, GIF, SVG and so on). A Project file is a save, not an Export.
