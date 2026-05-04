// The MIT License
//
// Copyright (c) 2024 Felix Lemke
//
// Permission is hereby granted, free of charge,
// to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to
// deal in the Software without restriction, including
// without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom
// the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice
// shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
// ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var SCALE = 3; // from KDE
var START_BRANCHES = 0; // from config
var SHOW_REVERSE_ANIMATION = true; // from config
var FILL_CITY = true; // from config

var WIDTH = 0; // from KDE
var HEIGHT = 0; // from KDE

var COLUMN_COUNT = 0; // from KDE
var ROW_COUNT = 0; // from KDE

const default_lifetime = 8000;
const default_lifetime_branch = 15;
const prob_city2land = 12.0;
const prob_land2city = 0.003;
const prob_branch_off_city = 15;
const prob_branch_off_land = 6;
const prob_branch_off_to_main = 1;

const branch_falloff = 50;

const max_steps_back = 100;

const hue_delta = 9;
const lightness_default = 140;
var lightness_branch = 60;
const saturation_default = 255;

function prok(probability) {
  return Math.random() < probability / 100.0;
}
function randomScaleRound(to) {
  return Math.round(Math.random() * to);
}

var previous_config = null;
var previous_size = null;
var reverse_running = false;

var cells = [];
var active_branches = [];
var all_branches = [];
var history = [];

class StackEntry {
  constructor(type, par1, par2, par3, par4) {
    this.type = type; // LINE or RECT
    this.par1 = par1;
    this.par2 = par2;
    this.par3 = par3;
    this.par4 = par4;
  }
}

var BG_COLOR_DARK = "#000";
var BG_COLOR_LIGHT = "#FFF";
var BG_COLOR = BG_COLOR_LIGHT;

class Pos {
  constructor(x, y) {
    this.x = (x + COLUMN_COUNT) % COLUMN_COUNT;
    this.y = (y + ROW_COUNT) % ROW_COUNT;
  }

  toIdx(off_x = 0, off_y = 0) {
    return (
      ((this.y + off_y + ROW_COUNT) % ROW_COUNT) * COLUMN_COUNT +
      ((this.x + off_x + COLUMN_COUNT) % COLUMN_COUNT)
    );
  }

  static fromIdx(idx) {
    let y = Math.floor(idx / COLUMN_COUNT);
    let x = idx - y * COLUMN_COUNT;
    return new Pos(x, y);
  }
}

class Branch {
  constructor(pos) {
    this.pos = pos;
    this.active = true;
    this.mode = "CITY";
    this.expandDirection = new Pos(0, 0);
    this.ownCells = [pos];
    this.age = 0;
    this.lifeTime = default_lifetime;
    this.hue = Math.round(Math.random() * 360);
    this.saturation = saturation_default;
    this.lightness = lightness_default;
    this.history = [];
  }

  getColor() {
    return (
      "hsl(" + this.hue + "," + this.saturation + "," + this.lightness + ")"
    );
  }

  getSecondaryColor() {
    return (
      "hsla(" +
      this.hue +
      "," +
      this.saturation +
      "," +
      this.lightness +
      ", 0.25)"
    );
  }

  createLine(to, context, from = null) {
    if (!from) {
      from = this.pos;
    }

    let width = 2;
    let offset = width / 2.0; // this is to move the line away from the screen corner (due to the linewidth)
    if (this.mode === "LAND") {
      width = 2;
    }

    let margin = width / 2.0; // this is to avoid overlap of filled squares with lines

    if (FILL_CITY && this.mode === "CITY" && this.ownCells.length >= 1) {
      // 1) take the line from the lastPosition to the newPositon
      let previous_pos = this.ownCells[this.ownCells.length - 1];

      // 2) calculate the perpendicular direction (with length 1)
      let perpendicular_vector = new Pos(
        to.y - previous_pos.y,
        to.x - previous_pos.x,
      );

      // 3) add the perpendicular vector to the previous position to create an imaginary square
      let imaginary = new Pos(
        previous_pos.x + perpendicular_vector.x,
        previous_pos.y + perpendicular_vector.y,
      );

      // 4) find the top left corner of the square
      let top_left = new Pos(
        Math.min(to.x, imaginary.x),
        Math.min(to.y, imaginary.y),
      );

      // 5) draw a filled rect with topLeft Point and width/height = 1 (but scaled with grid Size and additional margin to not overlap with lines)
      context.fillStyle = this.getSecondaryColor();
      context.globalCompositeOperation = "overlay";
      context.fillRect(
        2 * SCALE * top_left.x + margin + offset,
        2 * SCALE * top_left.y + margin + offset,
        2 * SCALE - 2 * margin,
        2 * SCALE - 2 * margin,
      );

      this.history.push(
        new StackEntry(
          "RECT",
          2 * SCALE * top_left.x + margin + offset,
          2 * SCALE * top_left.y + margin + offset,
          2 * SCALE - 2 * margin,
          2 * SCALE - 2 * margin,
        ),
      );

      // 6) repeat step 2, but mirrored at the line (so basically -x and -y of the first perpendicular vector)
      perpendicular_vector = new Pos(
        -to.y + previous_pos.y,
        -to.x + previous_pos.x,
      );

      // 7) get new imaginary rect (on the other side of the line), find topLeft corner, draw rect
      imaginary = new Pos(
        previous_pos.x + perpendicular_vector.x,
        previous_pos.y + perpendicular_vector.y,
      );

      top_left = new Pos(
        Math.min(to.x, imaginary.x),
        Math.min(to.y, imaginary.y),
      );

      context.fillRect(
        2 * SCALE * top_left.x + margin + offset,
        2 * SCALE * top_left.y + margin + offset,
        2 * SCALE - 2 * margin,
        2 * SCALE - 2 * margin,
      );

      this.history.push(
        new StackEntry(
          "RECT",
          2 * SCALE * top_left.x + margin + offset,
          2 * SCALE * top_left.y + margin + offset,
          2 * SCALE - 2 * margin,
          2 * SCALE - 2 * margin,
        ),
      );
    }

    context.globalCompositeOperation = "source-over";
    context.lineWidth = width;
    context.strokeStyle = this.getColor();

    let diff_x = to.x - from.x;
    let diff_y = to.y - from.y;

    if (diff_x > 1) {
      // going <- with wraparound
      this.drawLineAndSave(context, to.x + 1, from.y, to.x, to.y, offset);
      from.x = to.x;
    } else if (diff_x < -1) {
      // going -> with wraparound
      this.drawLineAndSave(context, from.x, from.y, from.x + 1, to.y, offset);
      from.x = to.x;
    } else if (diff_y > 1) {
      // going ^ with wraparound
      this.drawLineAndSave(context, from.x, to.y + 1, to.x, to.y, offset);
      from.y = to.y;
    } else if (diff_y < -1) {
      // going v with wraparound
      this.drawLineAndSave(context, from.x, from.y, to.x, from.y + 1, offset);
      from.y = to.y;
    }

    this.drawLineAndSave(context, from.x, from.y, to.x, to.y, offset);

    this.pos = to;
    this.ownCells.push(to);
  }

  drawLineAndSave(context, from_x, from_y, to_x, to_y, offset) {
    context.beginPath();
    context.moveTo(2 * SCALE * from_x + offset, 2 * SCALE * from_y + offset);
    context.lineTo(2 * SCALE * to_x + offset, 2 * SCALE * to_y + offset);
    context.stroke();

    this.history.push(
      new StackEntry(
        "LINE",
        2 * SCALE * from_x + offset,
        2 * SCALE * from_y + offset,
        2 * SCALE * to_x + offset,
        2 * SCALE * to_y + offset,
      ),
    );
  }

  static reverseLine(context, stackEntry) {
    let width = 2;

    context.globalCompositeOperation = "source-over";
    if (stackEntry.type === "RECT") {
      context.fillStyle = BG_COLOR;
      context.strokeStyle = null;
      context.fillRect(
        stackEntry.par1,
        stackEntry.par2,
        stackEntry.par3,
        stackEntry.par4,
      );
    }

    if (stackEntry.type === "LINE") {
      context.lineWidth = width;
      context.strokeStyle = BG_COLOR;
      context.beginPath();
      context.moveTo(stackEntry.par1, stackEntry.par2);
      context.lineTo(stackEntry.par3, stackEntry.par4);
      context.stroke();
    }
  }

  moveToNewPos() {
    for (
      let i = this.ownCells.length - 1;
      i >= Math.max(0, this.ownCells.length - max_steps_back);
      i--
    ) {
      let testPos = this.ownCells[i];
      if (this.getFreeCells(testPos).length > 0) {
        this.pos = testPos;
        return true;
      }
    }

    return false;
  }

  getFreeCells(pos = null) {
    if (!pos) {
      pos = this.pos;
    }

    let free_cells = [];
    if (cells[pos.toIdx(1, 0)] === false) {
      free_cells.push(new Pos(pos.x + 1, pos.y));
    }
    if (cells[pos.toIdx(-1, 0)] === false) {
      free_cells.push(new Pos(pos.x - 1, pos.y));
    }
    if (cells[pos.toIdx(0, 1)] === false) {
      free_cells.push(new Pos(pos.x, pos.y + 1));
    }
    if (cells[pos.toIdx(0, -1)] === false) {
      free_cells.push(new Pos(pos.x, pos.y - 1));
    }

    return free_cells;
  }

  findNextMove() {
    if (!this.active) {
      return null;
    }

    let free_cells = this.getFreeCells();
    if (free_cells.length === 0) {
      if (this.moveToNewPos()) {
        return this.findNextMove();
      }
      this.active = false;
      return null;
    }

    if (this.lifeTime - this.age < default_lifetime_branch) {
      this.mode = "CITY";
    } else if (this.mode === "LAND") {
      let expand_to_position = new Pos(
        this.pos.x + this.expandDirection.x,
        this.pos.y + this.expandDirection.y,
      );

      if (
        free_cells.find((cell) => {
          return (
            cell.x === expand_to_position.x && cell.y === expand_to_position.y
          );
        })
      ) {
        // if there is a free cell at the expand position, make it more likely to be chosen
        for (let i = 0; i < 10; i++) {
          free_cells.push(expand_to_position);
        }
      } else {
        this.mode = "CITY";
        this.age = randomScaleRound(this.age);
      }
    }

    return randomChoice(free_cells);
  }

  setExpandDirection() {
    let freecells = this.getFreeCells();
    if (freecells.length === 0) {
      return;
    }

    let targetPos = randomChoice(freecells);

    this.expandDirection = new Pos(
      targetPos.x - this.pos.x,
      targetPos.y - this.pos.y,
    );
  }

  drawMove(context) {
    if (this.age >= this.lifeTime) {
      this.active = false;
      return null;
    }

    if (this.mode === "CITY" && prok(prob_city2land)) {
      this.mode = "LAND";
      this.setExpandDirection();
    } else if (this.mode === "LAND" && prok(prob_land2city)) {
      this.mode = "CITY";
      this.age = randomScaleRound(this.age);
    }

    let new_position = this.findNextMove();
    if (!new_position) {
      return null;
    }

    this.createLine(new_position, context);
    this.age++;
    cells[new_position.toIdx()] = true;
  }

  setMain() {
    this.saturation = saturation_default;
    this.lightness = lightness_default;
    this.hue += hue_delta;
    this.hue %= 360;

    this.lifeTime = default_lifetime;
  }

  branchOff(context) {
    // do not branch off for first 10 steps
    if (this.ownCells.length <= 10) {
      return null;
    }

    let previous_position = this.ownCells[this.ownCells.length - 1];

    let free_cells = this.getFreeCells(previous_position);
    if (free_cells.length === 0) {
      return null;
    }

    let new_position = randomChoice(free_cells);
    this.createLine(new_position, context, previous_position);

    let branch = new Branch(this.pos);
    branch.hue = this.hue;
    branch.lightness = lightness_branch;
    branch.lifeTime = default_lifetime_branch;
    cells[new_position.toIdx()] = true;

    return branch;
  }
}

function randomChoice(fromList) {
  return fromList[randomScaleRound(fromList.length - 1)];
}

function randomPos() {
  return Pos.fromIdx(randomScaleRound(cells.length));
}

function initialize(ctx, config) {
  SCALE = config.scale;
  START_BRANCHES = config.start_branches;
  SHOW_REVERSE_ANIMATION = config.show_reverse;
  FILL_CITY = config.fill_city;

  COLUMN_COUNT = Math.floor(WIDTH / config.scale / 2);
  ROW_COUNT = Math.floor(HEIGHT / config.scale / 2);

  all_branches = [];
  reverse_running = false;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  var lightness_branch = BG_COLOR === BG_COLOR_DARK ? 60 : 180;

  for (let y = 0; y < ROW_COUNT; y++) {
    for (let x = 0; x < COLUMN_COUNT; x++) {
      let idx = y * COLUMN_COUNT + x;
      cells[idx] = false;
    }
  }

  active_branches = [];
  for (let i = 0; i < START_BRANCHES; i++) {
    active_branches.push(new Branch(randomPos()));
  }
  all_branches = active_branches;

  console.log("Initialize the City Grow Wallpaper");
}

function paintMatrix(ctx, size, config) {
  if (config != previous_config || size != previous_size) {
    WIDTH = size.width;
    HEIGHT = size.height;
    restart(ctx, config);
    previous_config = config;
    previous_size = size;
  }

  if (reverse_running === true && SHOW_REVERSE_ANIMATION === false) {
    return false;
  }

  if (reverse_running === true) {
    all_branches = all_branches.filter((branch) => {
      if (branch.history.length === 0) {
        return false;
      }

      const reverse_points = Math.ceil(50 / all_branches.length);
      for (
        let i = 0;
        i < Math.min(branch.history.length, reverse_points);
        i++
      ) {
        let last_action = branch.history.pop();
        Branch.reverseLine(ctx, last_action);
      }

      return true;
    });

    if (all_branches.length === 0) {
      return false;
    }

    return true;
  }

  active_branches.forEach((branch) => {
    let prob_scaled_branch_off_city =
      (prob_branch_off_city * (1.0 + branch_falloff)) /
      (branch_falloff + active_branches.length);
    let prob_scaled_branch_off_land =
      (prob_branch_off_land * (1.0 + branch_falloff)) /
      (branch_falloff + active_branches.length);

    if (
      (branch.mode === "CITY" && prok(prob_scaled_branch_off_city)) ||
      (branch.mode === "LAND" && prok(prob_scaled_branch_off_land))
    ) {
      let new_branch = branch.branchOff(ctx);

      if (new_branch) {
        if (prok(prob_branch_off_to_main)) {
          new_branch.setMain();
        }

        active_branches.push(new_branch);
        all_branches.push(new_branch);
      }
    }
  });

  active_branches = active_branches.filter((branch) => {
    branch.drawMove(ctx);
    return branch.active;
  });

  if (active_branches.length === 0) {
    reverse_running = true;
    return true;
  }

  return true;
}

function restart(ctx, config) {
  ctx.reset();

  all_branches = [];
  reverse_running = false;

  initialize(ctx, config);
}
