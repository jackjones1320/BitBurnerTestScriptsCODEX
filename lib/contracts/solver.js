function largestPrimeFactor(n) {
  let value = n;
  let factor = 2;
  let last = 1;
  while (factor * factor <= value) {
    if (value % factor === 0) {
      last = factor;
      value = Math.floor(value / factor);
      while (value % factor === 0) value = Math.floor(value / factor);
    }
    factor += factor === 2 ? 1 : 2;
  }
  return value > 1 ? value : last;
}

function maxSubarraySum(arr) {
  let best = arr[0];
  let cur = arr[0];
  for (let i = 1; i < arr.length; i += 1) {
    cur = Math.max(arr[i], cur + arr[i]);
    best = Math.max(best, cur);
  }
  return best;
}

function totalWaysToSum(n) {
  const dp = Array(n + 1).fill(0);
  dp[0] = 1;
  for (let num = 1; num < n; num += 1) {
    for (let sum = num; sum <= n; sum += 1) {
      dp[sum] += dp[sum - num];
    }
  }
  return dp[n];
}

function totalWaysToSum2([target, nums]) {
  const dp = Array(target + 1).fill(0);
  dp[0] = 1;
  for (const n of nums) {
    for (let sum = n; sum <= target; sum += 1) {
      dp[sum] += dp[sum - n];
    }
  }
  return dp[target];
}

function spiralizeMatrix(matrix) {
  const out = [];
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;

  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c += 1) out.push(matrix[top][c]);
    top += 1;

    for (let r = top; r <= bottom; r += 1) out.push(matrix[r][right]);
    right -= 1;

    if (top <= bottom) {
      for (let c = right; c >= left; c -= 1) out.push(matrix[bottom][c]);
      bottom -= 1;
    }

    if (left <= right) {
      for (let r = bottom; r >= top; r -= 1) out.push(matrix[r][left]);
      left += 1;
    }
  }

  return out;
}

function canJump(arr) {
  let reach = 0;
  for (let i = 0; i < arr.length; i += 1) {
    if (i > reach) return 0;
    reach = Math.max(reach, i + arr[i]);
    if (reach >= arr.length - 1) return 1;
  }
  return 1;
}

function minJumps(arr) {
  if (arr.length <= 1) return 0;
  let jumps = 0;
  let currentEnd = 0;
  let farthest = 0;
  for (let i = 0; i < arr.length - 1; i += 1) {
    farthest = Math.max(farthest, i + arr[i]);
    if (i === currentEnd) {
      jumps += 1;
      currentEnd = farthest;
      if (currentEnd >= arr.length - 1) return jumps;
      if (currentEnd <= i) return 0;
    }
  }
  return 0;
}

function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0].slice()];

  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

function generateIpAddresses(s) {
  const out = [];
  const n = s.length;
  for (let a = 1; a <= 3; a += 1) {
    for (let b = 1; b <= 3; b += 1) {
      for (let c = 1; c <= 3; c += 1) {
        const d = n - (a + b + c);
        if (d < 1 || d > 3) continue;
        const parts = [
          s.slice(0, a),
          s.slice(a, a + b),
          s.slice(a + b, a + b + c),
          s.slice(a + b + c),
        ];
        if (parts.every((part) => String(Number(part)) === part && Number(part) <= 255)) {
          out.push(parts.join("."));
        }
      }
    }
  }
  return out;
}

function stockTrader(k, prices) {
  if (prices.length === 0 || k === 0) return 0;
  if (k >= Math.floor(prices.length / 2)) {
    let profit = 0;
    for (let i = 1; i < prices.length; i += 1) {
      if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
    }
    return profit;
  }

  const buy = Array(k + 1).fill(-Infinity);
  const sell = Array(k + 1).fill(0);

  for (const price of prices) {
    for (let t = 1; t <= k; t += 1) {
      buy[t] = Math.max(buy[t], sell[t - 1] - price);
      sell[t] = Math.max(sell[t], buy[t] + price);
    }
  }

  return sell[k];
}

function minTrianglePath(triangle) {
  const dp = triangle[triangle.length - 1].slice();
  for (let r = triangle.length - 2; r >= 0; r -= 1) {
    for (let c = 0; c <= r; c += 1) {
      dp[c] = triangle[r][c] + Math.min(dp[c], dp[c + 1]);
    }
  }
  return dp[0];
}

function uniquePaths1([rows, cols]) {
  const dp = Array(cols).fill(1);
  for (let r = 1; r < rows; r += 1) {
    for (let c = 1; c < cols; c += 1) dp[c] += dp[c - 1];
  }
  return dp[cols - 1];
}

function uniquePaths2(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const dp = Array(cols).fill(0);
  dp[0] = grid[0][0] === 1 ? 0 : 1;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (grid[r][c] === 1) {
        dp[c] = 0;
      } else if (c > 0) {
        dp[c] += dp[c - 1];
      }
    }
  }
  return dp[cols - 1];
}

function shortestPathGrid(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return "";

  const dirs = [
    [1, 0, "D"],
    [-1, 0, "U"],
    [0, 1, "R"],
    [0, -1, "L"],
  ];
  const queue = [[0, 0]];
  const prev = new Map();
  prev.set("0,0", null);

  for (let i = 0; i < queue.length; i += 1) {
    const [r, c] = queue[i];
    if (r === rows - 1 && c === cols - 1) break;
    for (const [dr, dc, move] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      const key = String(nr) + "," + String(nc);
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (grid[nr][nc] === 1 || prev.has(key)) continue;
      prev.set(key, { from: String(r) + "," + String(c), move });
      queue.push([nr, nc]);
    }
  }

  const endKey = String(rows - 1) + "," + String(cols - 1);
  if (!prev.has(endKey)) return "";

  const moves = [];
  let cur = endKey;
  while (prev.get(cur) !== null) {
    const step = prev.get(cur);
    moves.push(step.move);
    cur = step.from;
  }
  return moves.reverse().join("");
}

const SOLVERS = {
  "Find Largest Prime Factor": largestPrimeFactor,
  "Subarray with Maximum Sum": maxSubarraySum,
  "Total Ways to Sum": totalWaysToSum,
  "Total Ways to Sum II": totalWaysToSum2,
  "Spiralize Matrix": spiralizeMatrix,
  "Array Jumping Game": canJump,
  "Array Jumping Game II": minJumps,
  "Merge Overlapping Intervals": mergeIntervals,
  "Generate IP Addresses": generateIpAddresses,
  "Algorithmic Stock Trader I": (prices) => stockTrader(1, prices),
  "Algorithmic Stock Trader II": (prices) => stockTrader(Math.floor(prices.length / 2), prices),
  "Algorithmic Stock Trader III": (prices) => stockTrader(2, prices),
  "Algorithmic Stock Trader IV": ([k, prices]) => stockTrader(k, prices),
  "Minimum Path Sum in a Triangle": minTrianglePath,
  "Unique Paths in a Grid I": uniquePaths1,
  "Unique Paths in a Grid II": uniquePaths2,
  "Shortest Path in a Grid": shortestPathGrid,
};

export function solveContract(type, data) {
  const solver = SOLVERS[type];
  if (!solver) return { solved: false, reason: "unsupported" };

  try {
    return { solved: true, answer: solver(data) };
  } catch (error) {
    return { solved: false, reason: "solver_error:" + String(error) };
  }
}
