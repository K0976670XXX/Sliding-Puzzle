function buildSolvedState(n) {
  return [...Array(n * n - 1).keys()].map((index) => index + 1).concat(0);
}

function getNeighborsForSize(index, boardSize) {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  const neighbors = [];

  if (row > 0) neighbors.push(index - boardSize);
  if (row < boardSize - 1) neighbors.push(index + boardSize);
  if (col > 0) neighbors.push(index - 1);
  if (col < boardSize - 1) neighbors.push(index + 1);

  return neighbors;
}

class MinHeap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  bubbleUp(index) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.compare(this.items[currentIndex], this.items[parentIndex]) >= 0) break;
      [this.items[currentIndex], this.items[parentIndex]] = [this.items[parentIndex], this.items[currentIndex]];
      currentIndex = parentIndex;
    }
  }

  bubbleDown(index) {
    let currentIndex = index;
    const length = this.items.length;

    while (true) {
      const leftIndex = (currentIndex * 2) + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = currentIndex;

      if (leftIndex < length && this.compare(this.items[leftIndex], this.items[smallestIndex]) < 0) {
        smallestIndex = leftIndex;
      }

      if (rightIndex < length && this.compare(this.items[rightIndex], this.items[smallestIndex]) < 0) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === currentIndex) break;

      [this.items[currentIndex], this.items[smallestIndex]] = [this.items[smallestIndex], this.items[currentIndex]];
      currentIndex = smallestIndex;
    }
  }
}

const LARGE_SOLVER_CONFIG = {
  5: {
    phaseMaxExpanded: 260000,
    phaseMaxDurationMs: 7000,
    greedyBeamWidth: 700,
    greedyMaxDepth: 120,
    phaseBeamWidth: 4,
    stageWeight: 1.5,
    finalMaxExpanded: 800000,
    finalMaxDurationMs: 12000,
  },
  6: {
    phaseMaxExpanded: 380000,
    phaseMaxDurationMs: 9000,
    greedyBeamWidth: 900,
    greedyMaxDepth: 150,
    phaseBeamWidth: 5,
    stageWeight: 1.5,
    finalMaxExpanded: 1200000,
    finalMaxDurationMs: 16000,
  },
};

const WEIGHTED_ASTAR_CONFIG = {
  4: {
    weight: 1.35,
  },
  5: {
    weight: 1.85,
  },
};

function createGoalLookup(boardSize) {
  const total = boardSize * boardSize;
  const goalRows = new Array(total);
  const goalCols = new Array(total);

  for (let value = 1; value < total; value += 1) {
    goalRows[value] = Math.floor((value - 1) / boardSize);
    goalCols[value] = (value - 1) % boardSize;
  }

  goalRows[0] = boardSize - 1;
  goalCols[0] = boardSize - 1;

  return { goalRows, goalCols };
}

function getLinearConflict(state, boardSize, goalRows, goalCols) {
  let conflict = 0;

  for (let row = 0; row < boardSize; row += 1) {
    for (let colA = 0; colA < boardSize; colA += 1) {
      const tileA = state[(row * boardSize) + colA];
      if (tileA === 0 || goalRows[tileA] !== row) continue;

      for (let colB = colA + 1; colB < boardSize; colB += 1) {
        const tileB = state[(row * boardSize) + colB];
        if (tileB === 0 || goalRows[tileB] !== row) continue;
        if (goalCols[tileA] > goalCols[tileB]) conflict += 2;
      }
    }
  }

  for (let col = 0; col < boardSize; col += 1) {
    for (let rowA = 0; rowA < boardSize; rowA += 1) {
      const tileA = state[(rowA * boardSize) + col];
      if (tileA === 0 || goalCols[tileA] !== col) continue;

      for (let rowB = rowA + 1; rowB < boardSize; rowB += 1) {
        const tileB = state[(rowB * boardSize) + col];
        if (tileB === 0 || goalCols[tileB] !== col) continue;
        if (goalRows[tileA] > goalRows[tileB]) conflict += 2;
      }
    }
  }

  return conflict;
}

function getManhattanDistance(state, boardSize, goalRows, goalCols) {
  let distance = 0;

  for (let index = 0; index < state.length; index += 1) {
    const value = state[index];
    if (value === 0) continue;

    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    distance += Math.abs(goalRows[value] - row) + Math.abs(goalCols[value] - col);
  }

  return distance;
}

function getHeuristic(state, boardSize, goalRows, goalCols) {
  return getManhattanDistance(state, boardSize, goalRows, goalCols)
    + getLinearConflict(state, boardSize, goalRows, goalCols);
}

function getWeightedAStarHeuristic(state, boardSize, goalRows, goalCols) {
  return getManhattanDistance(state, boardSize, goalRows, goalCols)
    + getLinearConflict(state, boardSize, goalRows, goalCols);
}

function reconstructSolution(goalKey, parentByKey, moveByKey) {
  const solution = [];
  let currentKey = goalKey;

  while (parentByKey.get(currentKey) !== null) {
    solution.push(moveByKey.get(currentKey));
    currentKey = parentByKey.get(currentKey);
  }

  return solution.reverse();
}

function isSameMoveSequence(leftMoves, rightMoves) {
  if (!Array.isArray(leftMoves) || !Array.isArray(rightMoves)) return false;
  if (leftMoves.length !== rightMoves.length) return false;

  for (let index = 0; index < leftMoves.length; index += 1) {
    if (leftMoves[index] !== rightMoves[index]) return false;
  }

  return true;
}

function solveWithBfs(startState, boardSize) {
  const goalState = buildSolvedState(boardSize);
  const goalKey = goalState.join(",");
  const startKey = startState.join(",");

  if (startKey === goalKey) {
    return { solution: [], reason: "solved", method: "bfs" };
  }

  const queue = [{
    state: [...startState],
    key: startKey,
    zeroIndex: startState.indexOf(0),
  }];
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize);
    for (const tileIndex of neighborIndexes) {
      const nextState = [...current.state];
      const movedTile = nextState[tileIndex];
      [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];

      const nextKey = nextState.join(",");
      if (parentByKey.has(nextKey)) continue;

      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);

      if (nextKey === goalKey) {
        return {
          solution: reconstructSolution(goalKey, parentByKey, moveByKey),
          reason: "optimal",
          method: "bfs",
        };
      }

      queue.push({
        state: nextState,
        key: nextKey,
        zeroIndex: tileIndex,
      });
    }
  }

  return { solution: null, reason: "unreachable", method: "bfs" };
}

function solveWithWeightedAStar(startState, boardSize) {
  const goalState = buildSolvedState(boardSize);
  const goalKey = goalState.join(",");
  const startKey = startState.join(",");

  if (startKey === goalKey) {
    return { solution: [], reason: "solved", method: "weighted-a*" };
  }

  const limits = SOLVER_LIMITS[boardSize] || SOLVER_LIMITS[4];
  const weight = WEIGHTED_ASTAR_CONFIG[boardSize]?.weight || 1.2;
  const { goalRows, goalCols } = createGoalLookup(boardSize);
  const openSet = new MinHeap((left, right) => {
    if (left.f !== right.f) return left.f - right.f;
    return left.h - right.h;
  });
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  const bestCostByKey = new Map([[startKey, 0]]);
  const stateByKey = new Map([[startKey, [...startState]]]);
  const startedAt = performance.now();
  let expanded = 0;
  const startH = getWeightedAStarHeuristic(startState, boardSize, goalRows, goalCols);

  openSet.push({
    key: startKey,
    zeroIndex: startState.indexOf(0),
    g: 0,
    h: startH,
    f: startH * weight,
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) break;

    if (current.g !== bestCostByKey.get(current.key)) continue;

    if (current.key === goalKey) {
      return {
        solution: reconstructSolution(goalKey, parentByKey, moveByKey),
        reason: "weighted",
        method: "weighted-a*",
      };
    }

    expanded += 1;
    if (expanded > limits.maxExpanded || (performance.now() - startedAt) > limits.maxDurationMs) {
      return { solution: null, reason: "timeout", method: "weighted-a*" };
    }

    const currentState = stateByKey.get(current.key);
    if (!currentState) continue;

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize)
      .map((tileIndex) => {
        const movedTile = currentState[tileIndex];
        const nextState = [...currentState];
        [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];
        const nextH = getWeightedAStarHeuristic(nextState, boardSize, goalRows, goalCols);
        return { tileIndex, movedTile, nextState, nextH };
      })
      .sort((left, right) => left.nextH - right.nextH);

    for (const neighbor of neighborIndexes) {
      const { tileIndex, movedTile, nextState, nextH } = neighbor;
      const nextKey = nextState.join(",");
      const nextG = current.g + 1;

      if (nextG >= (bestCostByKey.get(nextKey) ?? Infinity)) continue;

      bestCostByKey.set(nextKey, nextG);
      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);
      stateByKey.set(nextKey, nextState);
      openSet.push({
        key: nextKey,
        zeroIndex: tileIndex,
        g: nextG,
        h: nextH,
        f: nextG + (nextH * weight),
      });
    }
  }

  return { solution: null, reason: "unreachable", method: "weighted-a*" };
}

function getGoalValueAt(index, boardSize) {
  return index === (boardSize * boardSize) - 1 ? 0 : index + 1;
}

function isPhaseSolved(state, targetPositions, boardSize) {
  return targetPositions.every((position) => state[position] === getGoalValueAt(position, boardSize));
}

function getTargetValues(targetPositions, boardSize) {
  return targetPositions.map((position) => getGoalValueAt(position, boardSize));
}

function getPhaseHeuristic(state, boardSize, targetPositions, targetValues, goalRows, goalCols) {
  let score = 0;

  for (const position of targetPositions) {
    const goalValue = getGoalValueAt(position, boardSize);
    if (state[position] !== goalValue) {
      score += 18;
    }
  }

  for (const value of targetValues) {
    if (value === 0) continue;
    const index = state.indexOf(value);
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    score += Math.abs(goalRows[value] - row) + Math.abs(goalCols[value] - col);
  }

  return score;
}

function runPhaseAStar(startState, boardSize, targetPositions, config, goalRows, goalCols) {
  const startKey = startState.join(",");
  const zeroIndex = startState.indexOf(0);
  const targetValues = getTargetValues(targetPositions, boardSize);
  const openSet = new MinHeap((left, right) => {
    if (left.f !== right.f) return left.f - right.f;
    return left.h - right.h;
  });
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  const stateByKey = new Map([[startKey, [...startState]]]);
  const bestCostByKey = new Map([[startKey, 0]]);
  const startedAt = performance.now();
  let expanded = 0;
  const startH = getPhaseHeuristic(startState, boardSize, targetPositions, targetValues, goalRows, goalCols);

  openSet.push({
    key: startKey,
    zeroIndex,
    g: 0,
    h: startH,
    f: startH,
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) break;

    if (current.g !== bestCostByKey.get(current.key)) continue;

    const currentState = stateByKey.get(current.key);
    if (!currentState) continue;

    if (isPhaseSolved(currentState, targetPositions, boardSize)) {
      return {
        state: currentState,
        moves: reconstructSolution(current.key, parentByKey, moveByKey),
      };
    }

    expanded += 1;
    if (expanded > config.phaseMaxExpanded || (performance.now() - startedAt) > config.phaseMaxDurationMs) {
      return null;
    }

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize);
    for (const tileIndex of neighborIndexes) {
      const nextState = [...currentState];
      const movedTile = nextState[tileIndex];
      [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];

      const nextKey = nextState.join(",");
      const nextG = current.g + 1;
      if (nextG >= (bestCostByKey.get(nextKey) ?? Infinity)) continue;

      const nextH = getPhaseHeuristic(nextState, boardSize, targetPositions, targetValues, goalRows, goalCols);
      bestCostByKey.set(nextKey, nextG);
      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);
      stateByKey.set(nextKey, nextState);
      openSet.push({
        key: nextKey,
        zeroIndex: tileIndex,
        g: nextG,
        h: nextH,
        f: nextG + (nextH * 1.08),
      });
    }
  }

  return null;
}

function runPhaseGreedy(startState, boardSize, targetPositions, config, goalRows, goalCols) {
  const targetValues = getTargetValues(targetPositions, boardSize);
  let frontier = [{
    state: [...startState],
    zeroIndex: startState.indexOf(0),
    moves: [],
    key: startState.join(","),
  }];
  const visited = new Set([frontier[0].key]);

  for (let depth = 0; depth < config.greedyMaxDepth; depth += 1) {
    const nextFrontier = [];

    for (const node of frontier) {
      if (isPhaseSolved(node.state, targetPositions, boardSize)) {
        return {
          state: node.state,
          moves: node.moves,
        };
      }

      const neighborIndexes = getNeighborsForSize(node.zeroIndex, boardSize);
      for (const tileIndex of neighborIndexes) {
        const nextState = [...node.state];
        const movedTile = nextState[tileIndex];
        [nextState[node.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[node.zeroIndex]];

        const nextKey = nextState.join(",");
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);

        nextFrontier.push({
          state: nextState,
          zeroIndex: tileIndex,
          moves: [...node.moves, movedTile],
          key: nextKey,
          score: getPhaseHeuristic(nextState, boardSize, targetPositions, targetValues, goalRows, goalCols),
        });
      }
    }

    nextFrontier.sort((left, right) => left.score - right.score);
    frontier = nextFrontier.slice(0, config.greedyBeamWidth);
  }

  return null;
}

function createRelaxedConfig(config) {
  return {
    phaseMaxExpanded: Math.floor(config.phaseMaxExpanded * 1.8),
    phaseMaxDurationMs: Math.floor(config.phaseMaxDurationMs * 1.8),
    greedyBeamWidth: Math.floor(config.greedyBeamWidth * 1.5),
    greedyMaxDepth: Math.floor(config.greedyMaxDepth * 1.35),
    phaseBeamWidth: config.phaseBeamWidth,
    finalMaxExpanded: Math.floor((config.finalMaxExpanded || config.phaseMaxExpanded) * 1.6),
    finalMaxDurationMs: Math.floor((config.finalMaxDurationMs || config.phaseMaxDurationMs) * 1.6),
  };
}

function buildLayeredPhases(boardSize) {
  const phases = [];
  const solvedPositions = new Set();
  let top = 0;
  let left = 0;
  let bottom = boardSize - 1;
  let right = boardSize - 1;

  while ((bottom - top) > 2 && (right - left) > 2) {
    for (let col = left; col <= right; col += 1) {
      solvedPositions.add((top * boardSize) + col);
    }

    phases.push({
      kind: `row-${top + 1}`,
      targets: [...solvedPositions],
      region: { top, left, bottom, right },
    });

    top += 1;

    for (let row = top; row <= bottom; row += 1) {
      solvedPositions.add((row * boardSize) + left);
    }

    phases.push({
      kind: `col-${left + 1}`,
      targets: [...solvedPositions],
      region: { top, left, bottom, right },
    });

    left += 1;
  }

  phases.push({
    kind: "final",
    targets: [...Array(boardSize * boardSize).keys()],
    region: { top, left, bottom, right },
  });

  return phases;
}

function solveFinalRegion(startState, boardSize, config, goalRows, goalCols) {
  const goalState = buildSolvedState(boardSize);
  const goalKey = goalState.join(",");
  const startKey = startState.join(",");
  if (startKey === goalKey) {
    return {
      state: [...startState],
      moves: [],
    };
  }

  const openSet = new MinHeap((left, right) => {
    if (left.f !== right.f) return left.f - right.f;
    return left.h - right.h;
  });
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  const stateByKey = new Map([[startKey, [...startState]]]);
  const bestCostByKey = new Map([[startKey, 0]]);
  const startedAt = performance.now();
  let expanded = 0;
  const startH = getHeuristic(startState, boardSize, goalRows, goalCols);

  openSet.push({
    key: startKey,
    zeroIndex: startState.indexOf(0),
    g: 0,
    h: startH,
    f: startH * 1.08,
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) break;

    if (current.g !== bestCostByKey.get(current.key)) continue;

    if (current.key === goalKey) {
      return {
        state: stateByKey.get(current.key) || goalState,
        moves: reconstructSolution(goalKey, parentByKey, moveByKey),
      };
    }

    expanded += 1;
    if (expanded > config.finalMaxExpanded || (performance.now() - startedAt) > config.finalMaxDurationMs) {
      return null;
    }

    const currentState = stateByKey.get(current.key);
    if (!currentState) continue;

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize)
      .map((tileIndex) => {
        const movedTile = currentState[tileIndex];
        const nextState = [...currentState];
        [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];
        const nextH = getHeuristic(nextState, boardSize, goalRows, goalCols);
        return { tileIndex, movedTile, nextState, nextH };
      })
      .sort((leftNode, rightNode) => leftNode.nextH - rightNode.nextH);

    for (const neighbor of neighborIndexes) {
      const { tileIndex, movedTile, nextState, nextH } = neighbor;
      const nextKey = nextState.join(",");
      const nextG = current.g + 1;
      if (nextG >= (bestCostByKey.get(nextKey) ?? Infinity)) continue;

      bestCostByKey.set(nextKey, nextG);
      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);
      stateByKey.set(nextKey, nextState);
      openSet.push({
        key: nextKey,
        zeroIndex: tileIndex,
        g: nextG,
        h: nextH,
        f: nextG + (nextH * 1.08),
      });
    }
  }

  return null;
}

function applyMoveValueToState(state, boardSize, movedTile) {
  const nextState = [...state];
  const tileIndex = nextState.indexOf(movedTile);
  const zeroIndex = nextState.indexOf(0);

  if (tileIndex === -1 || zeroIndex === -1) return null;
  if (!getNeighborsForSize(zeroIndex, boardSize).includes(tileIndex)) return null;

  [nextState[zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[zeroIndex]];
  return nextState;
}

function followGuideUntilTargetsSatisfied(startState, boardSize, guideMoves, targetPositions) {
  let currentState = [...startState];
  const consumedMoves = [];

  if (isPhaseSolved(currentState, targetPositions, boardSize)) {
    return {
      state: currentState,
      moves: consumedMoves,
      consumed: 0,
    };
  }

  for (let index = 0; index < guideMoves.length; index += 1) {
    const nextState = applyMoveValueToState(currentState, boardSize, guideMoves[index]);
    if (!nextState) return null;

    currentState = nextState;
    consumedMoves.push(guideMoves[index]);

    if (isPhaseSolved(currentState, targetPositions, boardSize)) {
      return {
        state: currentState,
        moves: consumedMoves,
        consumed: index + 1,
      };
    }
  }

  return null;
}

function appendPhaseCandidate(candidates, candidate, boardSize, goalRows, goalCols) {
  const key = candidate.state.join(",");
  const heuristic = getHeuristic(candidate.state, boardSize, goalRows, goalCols);
  const score = candidate.solution.length + (heuristic * 0.45) - (candidate.guideIndex * 0.002);
  const nextCandidate = {
    ...candidate,
    key,
    score,
  };
  const existingIndex = candidates.findIndex((item) => item.key === key);

  if (existingIndex === -1) {
    candidates.push(nextCandidate);
    return;
  }

  const existing = candidates[existingIndex];
  if (
    nextCandidate.score < existing.score
    || (
      nextCandidate.score === existing.score
      && nextCandidate.solution.length < existing.solution.length
    )
  ) {
    candidates[existingIndex] = nextCandidate;
  }
}

function prunePhaseCandidates(candidates, beamWidth) {
  if (candidates.length <= beamWidth) {
    return candidates;
  }

  const sorted = [...candidates].sort((left, right) => {
    if (left.score !== right.score) return left.score - right.score;
    return left.solution.length - right.solution.length;
  });
  const pruned = sorted.slice(0, beamWidth);
  const furthestGuideCandidate = sorted.reduce((best, candidate) => {
    if (!best || candidate.guideIndex > best.guideIndex) {
      return candidate;
    }
    return best;
  }, null);

  if (
    furthestGuideCandidate
    && furthestGuideCandidate.guideIndex > 0
    && !pruned.some((candidate) => candidate.key === furthestGuideCandidate.key)
  ) {
    pruned[pruned.length - 1] = furthestGuideCandidate;
  }

  return pruned;
}

function isIndexInActiveArea(index, layer, boardSize) {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  return row >= layer && col >= layer;
}

function buildLockedPositionsBeforeTopRow(layer, boardSize) {
  const locked = new Set();

  for (let row = 0; row < layer; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      locked.add((row * boardSize) + col);
    }
  }

  for (let col = 0; col < layer; col += 1) {
    for (let row = layer; row < boardSize; row += 1) {
      locked.add((row * boardSize) + col);
    }
  }

  return locked;
}

function buildLockedPositionsBeforeLeftCol(layer, boardSize) {
  const locked = buildLockedPositionsBeforeTopRow(layer, boardSize);

  for (let col = layer; col < boardSize; col += 1) {
    locked.add((layer * boardSize) + col);
  }

  return locked;
}

function createLockedValueMap(state, lockedPositions) {
  const lockedValues = new Map();
  for (const position of lockedPositions) {
    lockedValues.set(position, state[position]);
  }
  return lockedValues;
}

function createStageTargetEntries(targetMap) {
  return Object.entries(targetMap).map(([index, value]) => ({
    index: Number(index),
    value,
  }));
}

function isLockedStateValid(state, lockedValues) {
  for (const [position, value] of lockedValues.entries()) {
    if (state[position] !== value) {
      return false;
    }
  }
  return true;
}

function isStageGoalSatisfied(state, targetEntries, lockedValues) {
  if (!isLockedStateValid(state, lockedValues)) {
    return false;
  }

  for (const target of targetEntries) {
    if (state[target.index] !== target.value) {
      return false;
    }
  }

  return true;
}

function getStageHeuristic(state, boardSize, targetEntries) {
  let score = 0;

  for (const target of targetEntries) {
    if (target.value === 0) continue;

    const tileIndex = state.indexOf(target.value);
    const currentRow = Math.floor(tileIndex / boardSize);
    const currentCol = tileIndex % boardSize;
    const targetRow = Math.floor(target.index / boardSize);
    const targetCol = target.index % boardSize;
    score += Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol);
  }

  return score;
}

function getStageSignature(state, targetEntries, lockedPositions) {
  const targetValues = new Set(targetEntries.map((target) => target.value));
  const signature = new Array(state.length);

  for (let index = 0; index < state.length; index += 1) {
    const value = state[index];

    if (value === 0) {
      signature[index] = "0";
    } else if (lockedPositions.has(index) || targetValues.has(value)) {
      signature[index] = String(value);
    } else {
      signature[index] = "x";
    }
  }

  return signature.join(",");
}

function runWeightedAStarStage(startState, boardSize, layer, targetMap, lockedPositions, config) {
  const targetEntries = createStageTargetEntries(targetMap);
  const lockedValues = createLockedValueMap(startState, lockedPositions);
  const startKey = startState.join(",");
  const startSignature = getStageSignature(startState, targetEntries, lockedPositions);
  const openSet = new MinHeap((left, right) => {
    if (left.f !== right.f) return left.f - right.f;
    if (left.h !== right.h) return left.h - right.h;
    return left.g - right.g;
  });
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  const stateByKey = new Map([[startKey, [...startState]]]);
  const bestCostBySignature = new Map([[startSignature, 0]]);
  const startedAt = performance.now();
  let expanded = 0;
  const startH = getStageHeuristic(startState, boardSize, targetEntries);
  const weight = config.stageWeight || 1.5;

  openSet.push({
    key: startKey,
    zeroIndex: startState.indexOf(0),
    g: 0,
    h: startH,
    f: startH * weight,
    lastMovedTile: null,
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) break;

    const currentState = stateByKey.get(current.key);
    if (!currentState) continue;

    const currentSignature = getStageSignature(currentState, targetEntries, lockedPositions);
    if (current.g !== bestCostBySignature.get(currentSignature)) continue;

    if (isStageGoalSatisfied(currentState, targetEntries, lockedValues)) {
      return {
        state: currentState,
        moves: reconstructSolution(current.key, parentByKey, moveByKey),
      };
    }

    expanded += 1;
    if (expanded > config.phaseMaxExpanded || (performance.now() - startedAt) > config.phaseMaxDurationMs) {
      return null;
    }

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize);
    for (const tileIndex of neighborIndexes) {
      if (!isIndexInActiveArea(tileIndex, layer, boardSize)) continue;
      if (lockedPositions.has(tileIndex)) continue;

      const movedTile = currentState[tileIndex];
      if (current.lastMovedTile !== null && movedTile === current.lastMovedTile) continue;

      const nextState = [...currentState];
      [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];

      if (!isLockedStateValid(nextState, lockedValues)) continue;

      const nextSignature = getStageSignature(nextState, targetEntries, lockedPositions);
      const nextG = current.g + 1;
      if (nextG >= (bestCostBySignature.get(nextSignature) ?? Infinity)) continue;

      const nextKey = nextState.join(",");
      const nextH = getStageHeuristic(nextState, boardSize, targetEntries);

      bestCostBySignature.set(nextSignature, nextG);
      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);
      stateByKey.set(nextKey, nextState);
      openSet.push({
        key: nextKey,
        zeroIndex: tileIndex,
        g: nextG,
        h: nextH,
        f: nextG + (nextH * weight),
        lastMovedTile: movedTile,
      });
    }
  }

  return null;
}

function solveFinal4x4WeightedAStar(startState, boardSize, layer, config) {
  const goalState = buildSolvedState(boardSize);
  const goalKey = goalState.join(",");
  const startKey = startState.join(",");
  if (startKey === goalKey) {
    return {
      state: [...startState],
      moves: [],
    };
  }

  const lockedPositions = buildLockedPositionsBeforeTopRow(layer, boardSize);
  const lockedValues = createLockedValueMap(startState, lockedPositions);
  const { goalRows, goalCols } = createGoalLookup(boardSize);
  const weight = WEIGHTED_ASTAR_CONFIG[4]?.weight || 1.35;
  const openSet = new MinHeap((left, right) => {
    if (left.f !== right.f) return left.f - right.f;
    return left.h - right.h;
  });
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  const stateByKey = new Map([[startKey, [...startState]]]);
  const bestCostByKey = new Map([[startKey, 0]]);
  let expanded = 0;
  const startedAt = performance.now();
  const startH = getWeightedAStarHeuristic(startState, boardSize, goalRows, goalCols);

  openSet.push({
    key: startKey,
    zeroIndex: startState.indexOf(0),
    g: 0,
    h: startH,
    f: startH * weight,
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) break;

    if (current.g !== bestCostByKey.get(current.key)) continue;

    if (current.key === goalKey) {
      return {
        state: stateByKey.get(current.key) || goalState,
        moves: reconstructSolution(current.key, parentByKey, moveByKey),
      };
    }

    expanded += 1;
    if (expanded > config.finalMaxExpanded || (performance.now() - startedAt) > config.finalMaxDurationMs) {
      return null;
    }

    const currentState = stateByKey.get(current.key);
    if (!currentState) continue;

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize)
      .map((tileIndex) => {
        const movedTile = currentState[tileIndex];
        const nextState = [...currentState];
        [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];
        const nextH = getWeightedAStarHeuristic(nextState, boardSize, goalRows, goalCols);
        return { tileIndex, movedTile, nextState, nextH };
      })
      .sort((left, right) => left.nextH - right.nextH);

    for (const tileIndex of neighborIndexes) {
      const { tileIndex: nextTileIndex, movedTile, nextState, nextH } = tileIndex;
      if (!isIndexInActiveArea(nextTileIndex, layer, boardSize)) continue;
      if (lockedPositions.has(nextTileIndex)) continue;

      if (!isLockedStateValid(nextState, lockedValues)) continue;

      const nextKey = nextState.join(",");
      const nextG = current.g + 1;
      if (nextG >= (bestCostByKey.get(nextKey) ?? Infinity)) continue;

      bestCostByKey.set(nextKey, nextG);
      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);
      stateByKey.set(nextKey, nextState);
      openSet.push({
        key: nextKey,
        zeroIndex: nextTileIndex,
        g: nextG,
        h: nextH,
        f: nextG + (nextH * weight),
      });
    }
  }

  return null;
}

function trySolveLargeStage(startState, boardSize, layer, targetMap, lockedPositions, config) {
  const result = runWeightedAStarStage(startState, boardSize, layer, targetMap, lockedPositions, config);
  if (result) {
    return result;
  }

  return runWeightedAStarStage(
    startState,
    boardSize,
    layer,
    targetMap,
    lockedPositions,
    createRelaxedConfig(config),
  );
}

function solveLargePuzzleLayered(startState, boardSize) {
  const config = LARGE_SOLVER_CONFIG[boardSize];
  if (!config) {
    return { solution: null, reason: "unsupported", method: "layered" };
  }

  const goalState = buildSolvedState(boardSize);
  const startKey = startState.join(",");
  if (startKey === goalState.join(",")) {
    return { solution: [], reason: "solved", method: "layered" };
  }

  let currentState = [...startState];
  let solution = [];

  for (let layer = 0; layer < boardSize - 4; layer += 1) {
    const topLocked = buildLockedPositionsBeforeTopRow(layer, boardSize);

    for (let col = layer; col < boardSize - 2; col += 1) {
      const targetIndex = (layer * boardSize) + col;
      const targetValue = getGoalValueAt(targetIndex, boardSize);
      if (currentState[targetIndex] !== targetValue) {
        const result = trySolveLargeStage(
          currentState,
          boardSize,
          layer,
          { [targetIndex]: targetValue },
          topLocked,
          config,
        );
        if (!result) {
          return { solution: null, reason: `top-row-${layer}-${col}-failed`, method: "layered" };
        }
        currentState = result.state;
        solution = solution.concat(result.moves);
      }

      topLocked.add(targetIndex);
    }

    const topPairLeftIndex = (layer * boardSize) + (boardSize - 2);
    const topPairRightIndex = (layer * boardSize) + (boardSize - 1);
    const topPairTargets = {
      [topPairLeftIndex]: getGoalValueAt(topPairLeftIndex, boardSize),
      [topPairRightIndex]: getGoalValueAt(topPairRightIndex, boardSize),
    };
    if (
      currentState[topPairLeftIndex] !== topPairTargets[topPairLeftIndex]
      || currentState[topPairRightIndex] !== topPairTargets[topPairRightIndex]
    ) {
      const result = trySolveLargeStage(
        currentState,
        boardSize,
        layer,
        topPairTargets,
        topLocked,
        config,
      );
      if (!result) {
        return { solution: null, reason: `top-pair-${layer}-failed`, method: "layered" };
      }
      currentState = result.state;
      solution = solution.concat(result.moves);
    }

    const leftLocked = buildLockedPositionsBeforeLeftCol(layer, boardSize);

    for (let row = layer + 1; row < boardSize - 2; row += 1) {
      const targetIndex = (row * boardSize) + layer;
      const targetValue = getGoalValueAt(targetIndex, boardSize);
      if (currentState[targetIndex] !== targetValue) {
        const result = trySolveLargeStage(
          currentState,
          boardSize,
          layer,
          { [targetIndex]: targetValue },
          leftLocked,
          config,
        );
        if (!result) {
          return { solution: null, reason: `left-col-${layer}-${row}-failed`, method: "layered" };
        }
        currentState = result.state;
        solution = solution.concat(result.moves);
      }

      leftLocked.add(targetIndex);
    }

    const leftPairTopIndex = ((boardSize - 2) * boardSize) + layer;
    const leftPairBottomIndex = ((boardSize - 1) * boardSize) + layer;
    const leftPairTargets = {
      [leftPairTopIndex]: getGoalValueAt(leftPairTopIndex, boardSize),
      [leftPairBottomIndex]: getGoalValueAt(leftPairBottomIndex, boardSize),
    };
    if (
      currentState[leftPairTopIndex] !== leftPairTargets[leftPairTopIndex]
      || currentState[leftPairBottomIndex] !== leftPairTargets[leftPairBottomIndex]
    ) {
      const result = trySolveLargeStage(
        currentState,
        boardSize,
        layer,
        leftPairTargets,
        leftLocked,
        config,
      );
      if (!result) {
        return { solution: null, reason: `left-pair-${layer}-failed`, method: "layered" };
      }
      currentState = result.state;
      solution = solution.concat(result.moves);
    }
  }

  const finalResult = solveFinal4x4WeightedAStar(currentState, boardSize, boardSize - 4, config);
  if (!finalResult) {
    return { solution: null, reason: "final-4x4-failed", method: "layered" };
  }

  currentState = finalResult.state;
  solution = solution.concat(finalResult.moves);

  if (currentState.join(",") !== goalState.join(",")) {
    return { solution: null, reason: "final-4x4-incomplete", method: "layered" };
  }

  return {
    solution,
    reason: "layered",
    method: "layered",
  };
}

function findShortestSolution(startState, boardSize, options = {}) {
  const { fallbackSolution = null } = options;

  if (boardSize === 3) {
    return solveWithBfs(startState, boardSize);
  }

  if (boardSize === 4 || boardSize === 5) {
    return solveWithWeightedAStar(startState, boardSize);
  }

  const layeredResult = solveLargePuzzleLayered(startState, boardSize);
  if (layeredResult.solution) {
    return layeredResult;
  }

  if (Array.isArray(fallbackSolution) && fallbackSolution.length > 0) {
    return {
      solution: [...fallbackSolution],
      reason: layeredResult.reason || "rollback-fallback",
      method: "rollback",
    };
  }

  return layeredResult;
}
